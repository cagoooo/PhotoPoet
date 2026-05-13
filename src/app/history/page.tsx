"use client";

/**
 * 我的詩 — 夜空風（night theme）
 * 對應 prototype sheet-mypoems.jsx
 */
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

import {firebaseDb, isFirebaseConfigured} from '@/lib/firebase';
import {useAuth} from '@/hooks/useAuth';
import {toast} from '@/hooks/use-toast';
import {PoemTTSButton} from '@/components/PoemTTSButton';

import {
  nightTokens as t,
  NightShell,
  TopBar,
  OutlineButton,
} from '@/components/night/atoms';
import {NightSiteFooter} from '@/components/night/NightSiteFooter';
import {ThemeToggle} from '@/components/night/ThemeToggle';

const PAGE_SIZE = 20;
const STYLE_LABEL: Record<string, string> = {
  modern: '現代詩',
  'seven-jueju': '七言絕句',
  'five-jueju': '五言絕句',
  haiku: '俳句',
  taigi: '台語白話',
  elder: '早安語',
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
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const {user, loading: authLoading, configured} = useAuth();
  const router = useRouter();
  const [poems, setPoems] = useState<Poem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopy(id: string, poem: string) {
    try {
      await navigator.clipboard.writeText(poem);
      setCopiedId(id);
      toast({title: '已複製', description: '詩文已複製到剪貼簿。'});
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 2000);
    } catch (err) {
      console.error('clipboard write failed', err);
      toast({title: '複製失敗', description: '請手動選取複製。'});
    }
  }

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

  useEffect(() => {
    if (!authLoading && configured && !user) {
      router.replace('/');
    }
  }, [authLoading, configured, user, router]);

  return (
    <div style={{padding: '24px 12px', minHeight: '100vh'}}>
      <NightShell>
        <div style={{position: 'relative', zIndex: 1, padding: '0 22px 24px'}}>
          <TopBar
            onBack={() => (window.location.href = '/')}
            backLabel="回首頁"
            rightSlot={<ThemeToggle />}
          />

          {/* Header */}
          <div style={{marginTop: 32, marginBottom: 6}}>
            <div
              style={{
                fontFamily: t.italic,
                fontStyle: 'italic',
                fontSize: 13,
                color: t.gold,
                letterSpacing: 1,
              }}
            >
              my poems
            </div>
            <h1
              style={{
                fontFamily: t.serif,
                fontWeight: 300,
                fontSize: 38,
                letterSpacing: 8,
                margin: '4px 0 0',
                color: '#f0e8c8',
              }}
            >
              我的詩
            </h1>
          </div>

          <div
            style={{
              fontSize: 11,
              color: t.inkMute,
              letterSpacing: 1,
              marginBottom: 18,
            }}
          >
            {configured && user ? (
              <>
                共 <span style={{color: t.gold}}>{poems.length}</span> 首詩，依時間排序
              </>
            ) : (
              <>登入後可在此查看你的歷史詩篇</>
            )}
          </div>

          {!configured && (
            <EmptyState>Firebase 尚未設定</EmptyState>
          )}
          {configured && authLoading && (
            <EmptyState>登入狀態檢查中…</EmptyState>
          )}
          {configured && !authLoading && !user && (
            <EmptyState>未登入。即將返回主頁…</EmptyState>
          )}

          {configured && user && error && (
            <div
              style={{
                textAlign: 'center',
                color: '#ef9b8a',
                fontSize: 12,
                padding: '24px 0',
              }}
            >
              {error}
            </div>
          )}

          {configured && user && !error && poems.length === 0 && !loading && (
            <EmptyState>
              還沒有任何詩。
              <br />
              <Link
                href="/"
                style={{
                  color: t.gold,
                  textDecoration: 'none',
                  fontFamily: t.italic,
                  fontStyle: 'italic',
                }}
              >
                回主頁上傳第一張照片 ↗
              </Link>
            </EmptyState>
          )}

          {configured && user && poems.length > 0 && (
            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              {poems.map(p => (
                <PoemRow
                  key={p.id}
                  poem={p}
                  copied={copiedId === p.id}
                  onCopy={() => handleCopy(p.id, p.poem)}
                />
              ))}
            </div>
          )}

          {configured && user && hasMore && poems.length > 0 && (
            <div style={{display: 'flex', justifyContent: 'center', marginTop: 18}}>
              <OutlineButton onClick={() => loadPage(cursor)} disabled={loading}>
                {loading ? '載入中…' : '載入更多 ↓'}
              </OutlineButton>
            </div>
          )}

          {configured && user && !hasMore && poems.length > 0 && (
            <div
              style={{
                textAlign: 'center',
                marginTop: 18,
                padding: 12,
                color: t.inkMute,
                fontSize: 10,
                letterSpacing: 2,
              }}
            >
              ⸺ 已是最早的一首 ⸺
            </div>
          )}

          <NightSiteFooter />
        </div>
      </NightShell>
    </div>
  );
}

function EmptyState({children}: {children: React.ReactNode}) {
  return (
    <div
      style={{
        textAlign: 'center',
        color: t.inkMute,
        fontSize: 12,
        padding: '40px 0',
        lineHeight: 1.9,
      }}
    >
      <div style={{fontSize: 32, color: t.gold, marginBottom: 10}}>✦</div>
      {children}
    </div>
  );
}

function PoemRow({
  poem,
  copied,
  onCopy,
}: {
  poem: Poem;
  copied: boolean;
  onCopy: () => void;
}) {
  const styleLabel = poem.style ? STYLE_LABEL[poem.style] || poem.style : '詩';
  const previewLines = poem.poem.split('\n').slice(0, 3);
  return (
    <div
      style={{
        background: t.panel,
        border: `1px solid ${t.panelBorder}`,
        padding: '12px 14px',
        transition: 'border-color .2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = t.gold;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = t.panelBorder;
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: t.italic,
            fontStyle: 'italic',
            fontSize: 11,
            color: t.gold,
            letterSpacing: 1,
          }}
        >
          {styleLabel}
        </span>
        <span style={{fontSize: 10, color: t.inkMute, letterSpacing: 1}}>
          {formatDate(poem.createdAt)}
        </span>
      </div>
      <div
        style={{
          fontFamily: t.serif,
          fontSize: 13,
          color: '#f0e8c8',
          lineHeight: 1.8,
          letterSpacing: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        {previewLines.join('\n')}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 10,
          paddingTop: 8,
          borderTop: `1px solid ${t.divider}`,
        }}
      >
        <button
          type="button"
          onClick={onCopy}
          style={{
            flex: 1,
            background: 'transparent',
            border: `1px solid ${t.panelBorder}`,
            color: copied ? t.gold : t.inkSoft,
            padding: '7px 10px',
            fontFamily: t.italic,
            fontStyle: 'italic',
            fontSize: 11,
            letterSpacing: 1.5,
            cursor: 'pointer',
            transition: 'all .2s',
          }}
        >
          {copied ? '已複製 ✓' : '複製詩句 ↗'}
        </button>
        <div style={{flex: 1}}>
          <PoemTTSButton
            poem={poem.poem}
            className="!h-9 !text-xs !w-full !bg-transparent !border-amber-500/40 !text-amber-300 hover:!bg-amber-900/20"
          />
        </div>
      </div>
    </div>
  );
}
