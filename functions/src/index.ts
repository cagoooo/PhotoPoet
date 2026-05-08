/**
 * PhotoPoet Cloud Functions (gen2, region asia-east1)
 *
 *   POST /api/generate  → generatePoem  (Gemini via Genkit)
 *   GET  /api/proxy     → proxyImage    (CORS-bypass image fetcher with SSRF guards)
 *
 * Both endpoints are reached through Firebase Hosting rewrites configured in firebase.json.
 *
 * Stage 2 only — Turnstile / Auth / Firestore quota will be layered in Stage 3 & 4.
 */

import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {setGlobalOptions} from 'firebase-functions/v2';
import {genkit, z} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {verifyTurnstile, getClientIp} from './turnstile';
import {verifyIdToken, consumeQuota, savePoem, DAILY_LIMIT} from './auth-quota';

setGlobalOptions({region: 'asia-east1', maxInstances: 10});

const GEMINI_KEY = defineSecret('GOOGLE_GENAI_API_KEY');
const TURNSTILE_SECRET = defineSecret('TURNSTILE_SECRET');

// ─────────────────────────────────────────────────────────────────
// generatePoem
// ─────────────────────────────────────────────────────────────────

const PoemInputSchema = z.object({
  photoDataUri: z
    .string()
    .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '需要 image data URI'),
});

const PoemOutputSchema = z.object({
  poem: z.string(),
});

let aiSingleton: ReturnType<typeof genkit> | null = null;
function getAI() {
  if (!aiSingleton) {
    aiSingleton = genkit({
      plugins: [googleAI({apiKey: GEMINI_KEY.value()})],
      model: 'googleai/gemini-2.0-flash',
    });
  }
  return aiSingleton;
}

export const generatePoem = onRequest(
  {
    secrets: [GEMINI_KEY, TURNSTILE_SECRET],
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 60,
    concurrency: 20,
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({error: 'Method Not Allowed'});
      return;
    }

    const body = req.body || {};

    // 1️⃣ Auth — must be a real Google-signed-in user
    const user = await verifyIdToken(req.headers.authorization);
    if (!user) {
      res.status(401).json({error: '請先用 Google 帳號登入後再試。'});
      return;
    }

    // 2️⃣ Turnstile
    const turnstile = await verifyTurnstile(
      body.turnstileToken,
      process.env.TURNSTILE_SECRET,
      getClientIp(req as any)
    );
    if (!turnstile.ok) {
      res.status(403).json({error: turnstile.reason || '人機驗證失敗'});
      return;
    }

    // 3️⃣ Per-user daily quota (transactional inc, no race)
    const quota = await consumeQuota(user);
    if (!quota.ok) {
      res.status(429).json({error: quota.reason || '已達每日上限', remaining: 0, dailyLimit: DAILY_LIMIT});
      return;
    }

    // Frontend currently sends `{ photo }` — accept both shapes.
    const photoDataUri: string | undefined = body.photoDataUri || body.photo;

    if (!photoDataUri || typeof photoDataUri !== 'string') {
      res.status(400).json({error: '照片為必填欄位'});
      return;
    }

    const parsed = PoemInputSchema.safeParse({photoDataUri});
    if (!parsed.success) {
      res.status(400).json({error: '照片格式不正確'});
      return;
    }

    if (photoDataUri.length > 14 * 1024 * 1024) {
      // ~10 MB binary as base64 ≈ 13.4 MB — give a small margin.
      res.status(413).json({error: '圖片過大，請壓縮後再試'});
      return;
    }

    try {
      const ai = getAI();
      const prompt = ai.definePrompt({
        name: 'generatePoemPrompt',
        input: {schema: PoemInputSchema},
        output: {schema: PoemOutputSchema},
        prompt:
          '你是一位詩人。 根據照片，創作一首反映其內容、氣氛和關鍵元素的詩。 這首詩必須是繁體中文。\n\nPhoto: {{media url=photoDataUri}}',
      });

      const {output} = await prompt({photoDataUri});
      if (!output) {
        throw new Error('AI 模型未能產生有效的輸出。');
      }

      // store history (best-effort — don't fail the request if write fails)
      let poemId: string | null = null;
      try {
        poemId = await savePoem(user.uid, output.poem);
      } catch (e) {
        console.warn('[generatePoem] savePoem failed', e);
      }

      res.status(200).json({
        poem: output.poem,
        remaining: quota.remaining,
        dailyLimit: DAILY_LIMIT,
        poemId,
      });
    } catch (err: any) {
      console.error('[generatePoem] error', err);
      const status = err?.status === 429 ? 429 : err?.status === 503 ? 503 : 500;
      res.status(status).json({error: err?.message || '生成詩詞失敗'});
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// proxyImage  (SSRF-hardened)
// ─────────────────────────────────────────────────────────────────

const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const PRIVATE_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe80')) return true;
  if (lower.startsWith('::ffff:')) return isPrivateIPv4(lower.slice(7));
  return false;
}

async function assertSafeHostname(hostname: string): Promise<void> {
  const lower = hostname.toLowerCase();
  if (PRIVATE_HOSTNAMES.has(lower)) throw new Error('不允許的目標位址');

  const ipVer = isIP(lower);
  const ipsToCheck: string[] = ipVer
    ? [lower]
    : (await lookup(lower, {all: true})).map(r => r.address);

  for (const ip of ipsToCheck) {
    const v = isIP(ip);
    if (v === 4 && isPrivateIPv4(ip)) throw new Error('不允許的目標位址');
    if (v === 6 && isPrivateIPv6(ip)) throw new Error('不允許的目標位址');
  }
}

export const proxyImage = onRequest(
  {cors: true, memory: '256MiB', timeoutSeconds: 30, maxInstances: 5},
  async (req, res) => {
    const url = String((req.query as any).url || '');
    if (!url) {
      res.status(400).json({error: 'URL parameter is required'});
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      res.status(400).json({error: '無效的 URL'});
      return;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      res.status(400).json({error: '只接受 http/https 協定'});
      return;
    }

    try {
      await assertSafeHostname(parsed.hostname);
    } catch (e: any) {
      res.status(403).json({error: e.message || '不允許的目標位址'});
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      let current = parsed;
      let r: Response | null = null;
      const MAX_REDIRECTS = 5;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        r = await fetch(current.toString(), {
          redirect: 'manual',
          signal: controller.signal,
        });
        if (r.status >= 300 && r.status < 400) {
          const loc = r.headers.get('location');
          if (!loc) {
            res.status(502).json({error: '重新導向缺少目的地'});
            return;
          }
          let next: URL;
          try {
            next = new URL(loc, current);
          } catch {
            res.status(502).json({error: '無效的重新導向'});
            return;
          }
          if (next.protocol !== 'http:' && next.protocol !== 'https:') {
            res.status(403).json({error: '不允許的重新導向協定'});
            return;
          }
          try {
            await assertSafeHostname(next.hostname);
          } catch (e: any) {
            res.status(403).json({error: e.message || '重新導向至不允許的位址'});
            return;
          }
          current = next;
          continue;
        }
        break;
      }
      if (!r) {
        res.status(502).json({error: 'fetch 失敗'});
        return;
      }
      if (r.status >= 300 && r.status < 400) {
        res.status(400).json({error: '重新導向次數過多'});
        return;
      }
      if (!r.ok) {
        res.status(r.status).json({error: 'Failed to fetch image'});
        return;
      }

      const ct = r.headers.get('content-type') || '';
      if (!ct.toLowerCase().startsWith('image/')) {
        res.status(415).json({error: '回應不是圖片'});
        return;
      }

      const len = r.headers.get('content-length');
      if (len && Number(len) > MAX_BYTES) {
        res.status(413).json({error: '圖片過大'});
        return;
      }

      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) {
        res.status(413).json({error: '圖片過大'});
        return;
      }

      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(buf);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        res.status(504).json({error: '讀取圖片逾時'});
        return;
      }
      console.error('[proxyImage] error', err);
      res.status(500).json({error: err?.message || 'proxy 失敗'});
    } finally {
      clearTimeout(timer);
    }
  }
);
