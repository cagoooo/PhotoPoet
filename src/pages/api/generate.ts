import type {NextApiRequest, NextApiResponse} from 'next';
import {generatePoem, GeneratePoemInput} from '@/ai/flows/generate-poem';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const MAX_PHOTO_DATA_URI_LENGTH = 8_000_000;

type UsageRecord = {
  count: number;
  resetAt: number;
};

const usageByClient = new Map<string, UsageRecord>();

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

function getClientKey(req: NextApiRequest) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const firstForwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0];
  const realIp = req.headers['x-real-ip'];
  const fallbackIp = req.socket.remoteAddress;

  return (
    firstForwardedIp ||
    (Array.isArray(realIp) ? realIp[0] : realIp) ||
    fallbackIp ||
    'unknown'
  ).trim();
}

function checkRateLimit(clientKey: string) {
  const now = Date.now();
  const current = usageByClient.get(clientKey);

  if (!current || current.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    usageByClient.set(clientKey, {count: 1, resetAt});
    return {allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt};
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {allowed: false, remaining: 0, resetAt: current.resetAt};
  }

  current.count += 1;
  usageByClient.set(clientKey, current);
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - current.count,
    resetAt: current.resetAt,
  };
}

function setRateLimitHeaders(
  res: NextApiResponse,
  remaining: number,
  resetAt: number
) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());
  res.setHeader('Retry-After', retryAfterSeconds.toString());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method Not Allowed'});
  }

  const {photo} = req.body;

  if (!photo || typeof photo !== 'string') {
    return res.status(400).json({error: '請先上傳一張照片。'});
  }

  if (!photo.startsWith('data:image/') || photo.length > MAX_PHOTO_DATA_URI_LENGTH) {
    return res.status(400).json({
      error: '照片格式不正確，或檔案太大。請改用較小的圖片後再試一次。',
    });
  }

  const clientKey = getClientKey(req);
  const quota = checkRateLimit(clientKey);
  setRateLimitHeaders(res, quota.remaining, quota.resetAt);

  if (!quota.allowed) {
    console.warn('Blocked over-limit generation request', {
      clientKey,
      resetAt: new Date(quota.resetAt).toISOString(),
    });

    return res.status(429).json({
      error: '為了避免 AI API 額度被快速耗盡，每位使用者每小時最多可產生 5 次。請稍後再試，謝謝你一起珍惜資源。',
      resetAt: quota.resetAt,
    });
  }

  try {
    const input: GeneratePoemInput = {photoDataUri: photo};
    const result = await generatePoem(input);
    return res.status(200).json({poem: result.poem});
  } catch (error: any) {
    console.error('API 錯誤:', error);
    return res.status(500).json({
      error: error.message || '產生詩詞時發生錯誤，請稍後再試。',
    });
  }
}
