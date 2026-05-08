"use client";

import {useEffect, useState} from 'react';
import Link from 'next/link';
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
import {ArrowLeft, Loader2, Copy, Check, Sparkles} from 'lucide-react';

import {firebaseDb, isFirebaseConfigured} from '@/lib/firebase';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {SiteFooter} from '@/components/SiteFooter';
import {PoemTTSButton} from '@/components/PoemTTSButton';
import {toast} from '@/hooks/use-toast';

const PAGE_SIZE = 20;
const STYLE_LABEL: Record<string, string> = {
  'modern': '🌸 現代詩',
  'seven-jueju': '🏯 七言絕句',
  'five-jueju': '🎋 五言絕句',
  'haiku': '🍃 俳句',
  'taigi': '🌾 台語白話',
  'elder': '🌅 早安語',
};

interface PublicPoem {
  id: string;
  poem: string;
  style: string | null;
  displayName: string | null;
  createdAt: Date | null;
}

function formatDate(d: Date | null) {
  if (!d) return '';
  return d.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WallPage() {
  const [poems, setPoems] = useState<PublicPoem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadPage(startCursor?: QueryDocumentSnapshot<DocumentData> | null) {
    if (!isFirebaseConfigured) {
      setError('Firebase 尚未設定');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const baseQuery = [
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ];
      const q = startCursor
        ? query(collection(firebaseDb(), 'poems'), ...baseQuery, startAfter(startCursor))
        : query(collection(firebaseDb(), 'poems'), ...baseQuery);
      const snap = await getDocs(q);
      const next: PublicPoem[] = snap.docs.map(d => {
        const data = d.data();
        const ts = data.createdAt;
        return {
          id: d.id,
          poem: data.poem || '',
          style: data.style ?? null,
          displayName: data.displayName ?? null,
          createdAt: ts?.toDate ? ts.toDate() : null,
        };
      });
      setPoems(prev => (startCursor ? [...prev, ...next] : next));
      setCursor(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e: any) {
      console.error('[wall] load error', e);
      setError(e?.message || '無法載入詩文牆');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopy(id: string, poem: string, author: string | null) {
    const fullText = author ? `${poem}\n\n— ${author}` : poem;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedId(id);
      toast({title: '已複製', description: '詩文已複製到剪貼簿。'});
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 2000);
    } catch {
      toast({title: '複製失敗', description: '請手動選取複製。'});
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen py-8 px-4 bg-gradient-to-br from-sky-100 to-pink-100">
      <div className="w-full max-w-2xl">
        {/* admin-route-back-to-home: 回主頁按鈕（顯眼位置） */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-purple-700 hover:text-purple-900 hover:underline"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            回主頁
          </Link>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm shadow-md">
          <CardHeader className="bg-gradient-to-br from-purple-700 to-pink-700 text-white">
            <CardTitle className="text-2xl">🌸 詩文牆</CardTitle>
            <p className="text-sm text-gray-200 mt-1">
              社群成員公開分享的詩，依時間倒序。想加入？回主頁勾選「公開分享」。
            </p>
          </CardHeader>
          <CardContent className="p-4">
            {error && (
              <p className="text-center text-sm text-red-600 py-4">{error}</p>
            )}
            {!error && poems.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-purple-300" />
                <p>還沒有人公開分享。</p>
                <p className="mt-1 text-xs">
                  <Link href="/" className="text-purple-700 hover:underline">
                    回主頁寫第一首
                  </Link>
                </p>
              </div>
            )}
            {!error && poems.length > 0 && (
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
                    <div className="mt-2 text-xs text-purple-200/80 text-right">
                      — {p.displayName || '匿名詩人'}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-gray-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(p.id, p.poem, p.displayName)}
                        className="flex-1 bg-transparent border-gray-600 text-gray-200 hover:bg-gray-700 hover:text-white"
                      >
                        {copiedId === p.id ? (
                          <><Check className="h-4 w-4 mr-1.5" />已複製</>
                        ) : (
                          <><Copy className="h-4 w-4 mr-1.5" />複製</>
                        )}
                      </Button>
                      <div className="flex-1">
                        <PoemTTSButton
                          poem={p.poem}
                          className="!h-9 !text-sm bg-transparent !border-amber-500/40 !text-amber-300 hover:!bg-amber-900/20"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {hasMore && poems.length > 0 && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={() => loadPage(cursor)} disabled={loading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />載入中…</>
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
