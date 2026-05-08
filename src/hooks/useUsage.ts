"use client";

import {useEffect, useState} from 'react';
import {doc, getDoc} from 'firebase/firestore';
import {firebaseDb, isFirebaseConfigured} from '@/lib/firebase';

export interface UsageData {
  count: number;
  date: string;
}

/**
 * 一次性從 Firestore 拉 users/{uid}.usage，給已登入使用者看「今日剩餘」用。
 * 不再 subscribe — quota 真實值從 generatePoem response 拿，這裡只給 first-load
 * 「歡迎回來，今日剩餘 X」效果。
 */
export function useUsage(uid: string | null | undefined) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured) {
      setUsage(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDoc(doc(firebaseDb(), 'users', uid))
      .then(snap => {
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : null;
        const u = (data?.usage ?? {count: 0, date: ''}) as UsageData;
        setUsage(u);
      })
      .catch(err => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  return {usage, loading, error};
}

/** Asia/Taipei 今日 (yyyy-mm-dd)，與 backend auth-quota.ts 同步 */
export function todayKeyTaipei(): string {
  const now = new Date(Date.now() + 8 * 60 * 60_000);
  return now.toISOString().slice(0, 10);
}
