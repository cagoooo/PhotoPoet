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
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {defineSecret} from 'firebase-functions/params';
import {setGlobalOptions} from 'firebase-functions/v2';
import {genkit, z} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {verifyTurnstile, getClientIp} from './turnstile';
import {verifyIdToken, consumeQuota, savePoem, DAILY_LIMIT} from './auth-quota';
import {notifyAdmin} from './notify-line';

setGlobalOptions({region: 'asia-east1', maxInstances: 10});

const GEMINI_KEY = defineSecret('GOOGLE_GENAI_API_KEY');
const TURNSTILE_SECRET = defineSecret('TURNSTILE_SECRET');
const LINE_TOKEN = defineSecret('PHOTOPOET_LINE_CHANNEL_ACCESS_TOKEN');
const LINE_ADMIN = defineSecret('PHOTOPOET_LINE_ADMIN_USER_ID');

// ─────────────────────────────────────────────────────────────────
// generatePoem
// ─────────────────────────────────────────────────────────────────

const POEM_STYLES = [
  'modern',
  'seven-jueju',
  'five-jueju',
  'haiku',
  'taigi',
  'elder',
] as const;
type PoemStyle = (typeof POEM_STYLES)[number];

const STYLE_INSTRUCTIONS: Record<PoemStyle, string> = {
  'modern':
    '請寫一首自由形式的繁體中文現代詩，4-8 行，有意象、有情感，可長短句交錯。',
  'seven-jueju':
    '請寫一首四句、每句七字（共 28 字）的繁體中文絕句，講求對仗工整、意境深遠。',
  'five-jueju':
    '請寫一首四句、每句五字（共 20 字）的繁體中文絕句，言簡意賅、留白有韻。',
  'haiku':
    '請寫一首三行的繁體中文俳句（5-7-5 字節奏），抓取一個瞬間的感受或景物。',
  'taigi':
    '請用台語白話文寫一首親切自然的繁體中文短詩，4-6 行，可帶點俚語或日常感。',
  'elder':
    '請寫一段溫暖正向的繁體中文早安問候語（2-4 行），適合長輩使用，加上祝福或人生小哲理。',
};

/** 給 LINE 通知 / 詩文牆 等 UI 顯示用的中文標籤（含 emoji） */
const STYLE_DISPLAY: Record<PoemStyle, string> = {
  'modern': '🌸 現代詩',
  'seven-jueju': '🏯 七言絕句',
  'five-jueju': '🎋 五言絕句',
  'haiku': '🍃 俳句',
  'taigi': '🌾 台語白話',
  'elder': '🌅 早安問候語',
};

function isPoemStyle(s: unknown): s is PoemStyle {
  return typeof s === 'string' && (POEM_STYLES as readonly string[]).includes(s);
}

const PoemInputSchema = z.object({
  photoDataUri: z
    .string()
    .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '需要 image data URI'),
  styleInstruction: z.string(),
  freshSeed: z.string().optional(),
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
    secrets: [GEMINI_KEY, TURNSTILE_SECRET, LINE_TOKEN, LINE_ADMIN],
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

    if (photoDataUri.length > 14 * 1024 * 1024) {
      // ~10 MB binary as base64 ≈ 13.4 MB — give a small margin.
      res.status(413).json({error: '圖片過大，請壓縮後再試'});
      return;
    }

    const style: PoemStyle = isPoemStyle(body.style) ? body.style : 'modern';
    const styleInstruction = STYLE_INSTRUCTIONS[style];
    const isRegenerate = body.regenerate === true;
    const freshSeed = isRegenerate
      ? `（這是同一張照片的重新詮釋第 ${Math.floor(Math.random() * 9999)} 次嘗試，請以全新角度切入，避免重複先前可能的詩句。）`
      : '';

    const parsed = PoemInputSchema.safeParse({photoDataUri, styleInstruction, freshSeed});
    if (!parsed.success) {
      res.status(400).json({error: '輸入格式不正確'});
      return;
    }

    try {
      const ai = getAI();
      const prompt = ai.definePrompt({
        name: 'generatePoemPrompt',
        input: {schema: PoemInputSchema},
        output: {schema: PoemOutputSchema},
        config: {
          temperature: isRegenerate ? 0.95 : 0.8,
          topP: 0.95,
        },
        prompt:
          '你是一位細膩的詩人。仔細觀察下面的照片：注意主體、光線、色調、氛圍與可能的情緒。\n\n{{styleInstruction}}\n\n{{#if freshSeed}}{{freshSeed}}\n\n{{/if}}只輸出詩本身，不要加任何解釋或前言。\n\nPhoto: {{media url=photoDataUri}}',
      });

      const {output} = await prompt({photoDataUri, styleInstruction, freshSeed});
      if (!output) {
        throw new Error('AI 模型未能產生有效的輸出。');
      }

      // store history (best-effort — don't fail the request if write fails)
      const publishToWall = body.publishToWall === true;
      let poemId: string | null = null;
      try {
        poemId = await savePoem(user.uid, output.poem, {
          style,
          isPublic: publishToWall,
          // 用使用者顯示名稱（無則 fallback 到 email 前段，再無則匿名）
          displayName:
            user.name ||
            (user.email ? user.email.split('@')[0] : null) ||
            '匿名詩人',
        });
      } catch (e) {
        console.warn('[generatePoem] savePoem failed', e);
      }

      // 「使用者活躍」LINE 告警：同 uid 每天第一首才推（in-memory dedupe）
      // → 一個活躍使用者最多耗 1 條 LINE 月額度/天
      const todayKeyTaipei = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const usedToday = DAILY_LIMIT - quota.remaining; // 含本次
      const heroName = user.name || user.email?.split('@')[0] || '匿名詩人';
      notifyAdmin({
        status: 'success',
        dedupeKey: `user-active-${user.uid}-${todayKeyTaipei}`,
        title: '有人來寫詩了',
        hero: `${heroName}，第 ${usedToday} 首詩誕生 ✨`,
        fields: [
          {icon: '🎨', label: '風格', value: STYLE_DISPLAY[style]},
          {icon: '🌐', label: '版本', value: 'PhotoPoet Pro'},
        ],
        progress: {current: usedToday, total: DAILY_LIMIT, label: '今日進度'},
        footerNote: '同一人每天只通知一次 🌸',
      }).catch(() => {});

      res.status(200).json({
        poem: output.poem,
        style,
        remaining: quota.remaining,
        dailyLimit: DAILY_LIMIT,
        poemId,
      });
    } catch (err: any) {
      console.error('[generatePoem] error', err);
      const errStatus = err?.status === 429 ? 429 : err?.status === 503 ? 503 : 500;
      const errMsg = String(err?.message || err || '生成詩詞失敗');

      // ─────────────────────────────────────────────────────────────
      // LINE 失敗告警 (best-effort，絕不擋 response)
      //
      // 三類錯誤分流，dedupe key 也分開避免互相蓋掉：
      //   • Gemini quota 用盡 (429 / RESOURCE_EXHAUSTED) — 同日只通知 1 次
      //   • Gemini 暫時過載 (503) — warning 主題；10 min backoff 自動處理
      //   • 其他 5xx — failed 主題；同錯誤碼同日 1 次
      //
      // 不通知：401 (Auth) / 403 (Turnstile) / 後端 quota 已達 (429 from
      //   consumeQuota) — 那些是使用者端問題或正常設計，站長無需救火
      // ─────────────────────────────────────────────────────────────
      const looksLikeQuota =
        errStatus === 429 ||
        /quota|RESOURCE_EXHAUSTED|Too Many Requests|rate ?limit/i.test(errMsg);
      const looksLikeOverload =
        errStatus === 503 || /overload|503/i.test(errMsg);

      const todayKeyForErr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const heroNameForErr =
        user.name || user.email?.split('@')[0] || '匿名詩人';

      notifyAdmin({
        status: looksLikeOverload ? 'warning' : 'failed',
        dedupeKey: looksLikeQuota
          ? `gemini-quota-exhausted-${todayKeyForErr}`
          : `gemini-error-${errStatus}-${todayKeyForErr}`,
        title: looksLikeQuota
          ? 'Gemini 免費額度用盡 ⸺'
          : looksLikeOverload
          ? 'Gemini 暫時過載 ⸺'
          : '生詩失敗 ⸺',
        hero: looksLikeQuota ? '今日 quota 已耗盡 ✦' : undefined,
        fields: [
          {icon: '👤', label: '使用者', value: heroNameForErr},
          {icon: '🎨', label: '風格', value: STYLE_DISPLAY[style]},
          {icon: '⚠️', label: '錯誤碼', value: String(errStatus)},
          {icon: '💬', label: '原因', value: errMsg.slice(0, 200)},
        ],
        footerNote: looksLikeQuota
          ? '免費 tier 通常隔日 reset；考慮升 paid 或加 cap'
          : looksLikeOverload
          ? '常見現象，AI 服務側問題；頻繁出現可加重試'
          : '請查 Cloud Functions logs 排查',
      }).catch(() => {});

      res.status(errStatus).json({error: errMsg});
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

// ─────────────────────────────────────────────────────────────────
// dailyBackup — P1：每天 03:00 Asia/Taipei export Firestore 到 GCS
//   • bucket: gs://photopoet-ha364-backups/<yyyy-mm-dd>/
//   • lifecycle 30 天自動刪
//   • 失敗推 LINE 告警
// ─────────────────────────────────────────────────────────────────

export const dailyBackup = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Asia/Taipei',
    region: 'asia-east1',
    timeoutSeconds: 540,
    memory: '256MiB',
    retryCount: 0,
  },
  async () => {
    // 不推 LINE 通知（節省月額度 200 條）。狀態靠 Cloud Logging：
    //   gcloud functions logs read dailyBackup --region=asia-east1 --gen2
    // 失敗會被 console.error 寫進 Logging，可日後在 GCP Console 設 alert
    // policy 改用 email / Pub/Sub 推播（成本極低）。
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const outputUriPrefix = `gs://photopoet-ha364-backups/${dateKey}`;
    const databaseName = 'projects/photopoet-ha364/databases/(default)';

    let accessToken: string;
    try {
      const {GoogleAuth} = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/datastore'],
      });
      const client = await auth.getClient();
      const tokenRes = await client.getAccessToken();
      if (!tokenRes.token) throw new Error('Could not obtain access token');
      accessToken = tokenRes.token;
    } catch (err: any) {
      console.error('[dailyBackup] CRITICAL auth failed', {dateKey, error: String(err?.message || err)});
      return;
    }

    try {
      const apiUrl = `https://firestore.googleapis.com/v1/${databaseName}:exportDocuments`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outputUriPrefix,
          collectionIds: ['users', 'poems'],
        }),
      });
      const body = (await res.json()) as any;

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
      }

      console.log('[dailyBackup] export started', {
        operation: body.name,
        outputUriPrefix,
        dateKey,
      });
    } catch (err: any) {
      console.error('[dailyBackup] CRITICAL export failed', {
        dateKey,
        error: String(err?.message || err).slice(0, 500),
      });
    }
  }
);
