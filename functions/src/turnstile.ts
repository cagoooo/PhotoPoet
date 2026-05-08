/**
 * Cloudflare Turnstile server-side verification helper.
 *
 * Behaviour:
 *  - secret missing or set to PLACEHOLDER_NOT_CONFIGURED → fail-open (skip verify)
 *    so deploys / first-boots that haven't been wired to a real key still work.
 *  - token missing or invalid → 403-style failure with a Chinese reason.
 *  - Cloudflare API unreachable → fail-closed (don't let attackers bypass by DDoS-ing CF).
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  ok: boolean;
  reason?: string;
}

interface TurnstileApiResponse {
  success: boolean;
  'error-codes'?: string[];
}

export function isTurnstileConfigured(secret: string | undefined): boolean {
  return !!secret && secret !== 'PLACEHOLDER_NOT_CONFIGURED';
}

export async function verifyTurnstile(
  token: unknown,
  secret: string | undefined,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  if (!isTurnstileConfigured(secret)) return {ok: true};

  if (!token || typeof token !== 'string') {
    return {ok: false, reason: '缺少人機驗證，請重新整理頁面再試。'};
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secret as string);
    params.append('response', token);
    if (remoteIp) params.append('remoteip', remoteIp);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: params.toString(),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const data = (await res.json()) as TurnstileApiResponse;
    if (!data.success) {
      const codes = (data['error-codes'] ?? ['unknown']).join(', ');
      return {ok: false, reason: `人機驗證失敗：${codes}`};
    }
    return {ok: true};
  } catch (err: any) {
    console.error('[turnstile] verify error', err);
    return {ok: false, reason: '人機驗證服務暫時無法使用，請稍後再試。'};
  }
}

export function getClientIp(req: {headers: Record<string, any>; ip?: string}): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return String(fwd[0]).split(',')[0].trim();
  return req.ip;
}
