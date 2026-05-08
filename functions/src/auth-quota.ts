/**
 * Auth + per-user daily quota helper.
 *
 * Verifies the Firebase ID token from the Authorization: Bearer <token> header,
 * then atomically checks/increments a per-day counter in Firestore.
 *
 * The counter lives at users/{uid}.usage = { date: "YYYY-MM-DD", count: N }.
 * If the stored date != today, the counter is reset.
 *
 * All writes are inside a transaction so two concurrent requests can't both
 * sneak past the limit.
 */

import {getApps, initializeApp} from 'firebase-admin/app';
import {getAuth, type DecodedIdToken} from 'firebase-admin/auth';
import {getFirestore, FieldValue} from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp();

export const DAILY_LIMIT = 20;

export interface QuotaResult {
  ok: boolean;
  remaining: number;
  reason?: string;
}

export interface AuthedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

const TZ_OFFSET_MIN = 8 * 60; // Asia/Taipei
function todayKey(): string {
  const now = new Date(Date.now() + TZ_OFFSET_MIN * 60_000);
  return now.toISOString().slice(0, 10);
}

export async function verifyIdToken(authHeader: string | undefined): Promise<AuthedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const decoded: DecodedIdToken = await getAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: (decoded as any).name,
      picture: (decoded as any).picture,
    };
  } catch (err) {
    console.warn('[auth] verifyIdToken failed:', (err as any)?.code || err);
    return null;
  }
}

/**
 * Check + increment in one transaction. Also keeps the user profile in sync
 * (displayName / email / photoURL refresh on every call so we don't need a
 * separate "ensure user doc" path).
 */
export async function consumeQuota(user: AuthedUser): Promise<QuotaResult> {
  const db = getFirestore();
  const userRef = db.collection('users').doc(user.uid);
  const today = todayKey();

  return db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    const data = snap.exists ? snap.data() : null;
    const usage: {date: string; count: number} = data?.usage ?? {date: today, count: 0};
    const currentCount = usage.date === today ? usage.count : 0;

    if (currentCount >= DAILY_LIMIT) {
      return {ok: false, remaining: 0, reason: `今日已達上限 ${DAILY_LIMIT} 首，明天再來。`};
    }

    const newCount = currentCount + 1;
    const profile = {
      displayName: user.name ?? null,
      email: user.email ?? null,
      photoURL: user.picture ?? null,
      updatedAt: FieldValue.serverTimestamp(),
      ...(snap.exists ? {} : {createdAt: FieldValue.serverTimestamp()}),
    };

    tx.set(
      userRef,
      {
        ...profile,
        usage: {date: today, count: newCount},
      },
      {merge: true}
    );

    return {ok: true, remaining: DAILY_LIMIT - newCount};
  });
}

export async function savePoem(
  uid: string,
  poem: string,
  meta?: {style?: string}
): Promise<string> {
  const db = getFirestore();
  const ref = await db.collection('poems').add({
    uid,
    poem,
    style: meta?.style ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}
