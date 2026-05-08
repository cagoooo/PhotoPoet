"use client";

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {ArrowLeft, Loader2} from 'lucide-react';

import {firebaseDb, isFirebaseConfigured} from '@/lib/firebase';
import {useAuth} from '@/hooks/useAuth';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {SiteFooter} from '@/components/SiteFooter';

const PAGE_SIZE = 20;
const STYLE_LABEL: Record<string, string> = {
  'modern': '🌸 現代詩',
  'seven-jueju': '🏯 七言絕句',
  'five-jueju': '🎋 五言絕句',
  'haiku': '🍃 俳句',
  'taigi': '🌾 台語白話',
  'elder': '🌅 早安語',
};

interface Poem {
  id: string;
  poem: string;
  style: string | null;
  createdAt: Date | null;
}

function formatDate(d: Date | null) {
  if (!d) return '';
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const {user, loading: authLoading, configured} = useAuth();
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const [poems, setPoems] = useState<Poem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  async function loadPage(startCursor?: QueryDocumentSnapshot<DocumentData> | null) {
    if (!configured || !user) return;
    setLoading(true);
    setError(null);
    try {
      const baseQuery = [
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ];
      const q = startCursor
        ? query(collection(firebaseDb(), 'poems'), ...baseQuery, startAfter(startCursor))
        : query(collection(firebaseDb(), 'poems'), ...baseQuery);
      const snap = await getDocs(q);
      const next: Poem[] = snap.docs.map(d => {
        const data = d.data();
        const ts = data.createdAt;
        return {
          id: d.id,
          poem: data.poem || '',
          style: data.style ?? null,
          createdAt: ts?.toDate ? ts.toDate() : null,
        };
      });
      setPoems(prev => (startCursor ? [...prev, ...next] : next));
      setCursor(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e: any) {
      console.error('[history] load error', e);
      setError(e?.message || '無法載入歷史紀錄');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && configured && user) {
      loadPage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, configured, user?.uid]);

  // 未登入：跳回主頁
  useEffect(() => {
    if (!authLoading && configured && !user) {
      router.replace(`${basePath}/`);
    }
  }, [authLoading, configured, user, router, basePath]);

  return (
    <div className="flex flex-col items-center min-h-screen py-8 px-4 bg-gradient-to-br from-sky-100 to-pink-100">
      <div className="w-full max-w-2xl">
        {/* admin-route-back-to-home: 回主頁按鈕（顯眼位置） */}
        <div className="mb-4">
          <Link
            href={`${basePath}/`}
            className="inline-flex items-center text-sm text-purple-700 hover:text-purple-900 hover:underline"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            回主頁
          </Link>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm shadow-md">
          <CardHeader className="bg-gradient-to-br from-purple-700 to-pink-700 text-white">
            <CardTitle className="text-2xl">📜 我的詩歷史</CardTitle>
            <p className="text-sm text-gray-200 mt-1">
              你登入後生成的詩，最新的在最上方。
            </p>
          </CardHeader>
          <CardContent className="p-4">
            {!configured && (
              <p className="text-center text-sm text-gray-500 py-8">
                Firebase 尚未設定。
              </p>
            )}
            {configured && authLoading && (
              <p className="text-center text-sm text-gray-500 py-8 inline-flex items-center justify-center w-full">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                登入狀態檢查中…
              </p>
            )}
            {configured && !authLoading && !user && (
              <p className="text-center text-sm text-gray-500 py-8">
                未登入。即將返回主頁…
              </p>
            )}
            {configured && user && error && (
              <p className="text-center text-sm text-red-600 py-4">{error}</p>
            )}
            {configured && user && !error && poems.length === 0 && !loading && (
              <p className="text-center text-sm text-gray-500 py-8">
                還沒有任何詩。回主頁上傳第一張照片開始 ✨
              </p>
            )}
            {configured && user && (
              <ul className="space-y-3">
                {poems.map(p => (
                  <li
                    key={p.id}
                    className="rounded-lg border bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 shadow"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                      <span>{p.style ? STYLE_LABEL[p.style] ?? p.style : '🌸 詩'}</span>
                      <span>{formatDate(p.createdAt)}</span>
                    </div>
                    <div className="whitespace-pre-line text-base leading-relaxed">
                      {p.poem}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {configured && user && hasMore && poems.length > 0 && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={() => loadPage(cursor)} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      載入中…
                    </>
                  ) : (
                    '載入更多'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <SiteFooter />
      </div>
    </div>
  );
}
