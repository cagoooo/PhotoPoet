"use client";

/**
 * 詩牆 — 夜空風（night theme）
 * 對應 prototype sheet-wall.jsx
 */
import {useEffect, useMemo, useState} from 'react';
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

import {firebaseDb, isFirebaseConfigured} from '@/lib/firebase';
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
const STYLE_PALETTE: Record<string, string> = {
  modern: '#3a3a4a',
  'seven-jueju': '#3a4e62',
  'five-jueju': '#4f5238',
  haiku: '#3c4a40',
  taigi: '#4f413a',
  elder: '#4a3c52',
};

const FILTERS: {value: string | null; label: string}[] = [
  {value: null, label: '全部'},
  {value: 'modern', label: '現代詩'},
  {value: 'five-jueju', label: '五言絕句'},
  {value: 'seven-jueju', label: '七言絕句'},
  {value: 'haiku', label: '俳句'},
  {value: 'taigi', label: '台語'},
  {value: 'elder', label: '早安語'},
];

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
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

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
      setError(e?.message || '無法載入詩牆');
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

  const visible = useMemo(
    () => (activeFilter ? poems.filter(p => p.style === activeFilter) : poems),
    [poems, activeFilter],
  );

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
              the wall
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
              詩牆
            </h1>
          </div>

          <div
            style={{
              fontSize: 11,
              color: t.inkMute,
              letterSpacing: 1,
              marginBottom: 18,
              lineHeight: 1.7,
            }}
          >
            這裡是大家公開分享的詩篇 ⸺ 共有{' '}
            <span style={{color: t.gold}}>{poems.length}</span> 首{' '}
            {activeFilter ? (
              <span style={{color: t.inkSoft}}>
                · 篩選「{STYLE_LABEL[activeFilter] || activeFilter}」（{visible.length}）
              </span>
            ) : null}
          </div>

          {/* Filter row */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              marginBottom: 14,
              paddingBottom: 4,
            }}
          >
            {FILTERS.map(f => {
              const active = f.value === activeFilter;
              return (
                <span
                  key={f.label}
                  onClick={() => setActiveFilter(f.value)}
                  style={{
                    padding: '5px 12px',
                    border: `1px solid ${active ? t.gold : t.panelBorder}`,
                    background: active ? 'rgba(184,154,74,0.08)' : 'transparent',
                    color: active ? t.gold : t.inkSoft,
                    fontFamily: t.serif,
                    fontSize: 11,
                    letterSpacing: 2,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {f.label}
                </span>
              );
            })}
          </div>

          {error && (
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

          {!error && visible.length === 0 && !loading && (
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
              {activeFilter ? (
                <>
                  「{STYLE_LABEL[activeFilter] || activeFilter}」還沒有詩。
                  <br />
                  <span
                    onClick={() => setActiveFilter(null)}
                    style={{
                      color: t.gold,
                      cursor: 'pointer',
                      fontFamily: t.italic,
                      fontStyle: 'italic',
                    }}
                  >
                    看全部 ↗
                  </span>
                </>
              ) : (
                <>
                  還沒有人公開分享。
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
                    回主頁寫第一首 ↗
                  </Link>
                </>
              )}
            </div>
          )}

          {visible.length > 0 && (
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
              {visible.map(p => (
                <WallCard
                  key={p.id}
                  poem={p}
                  copied={copiedId === p.id}
                  onCopy={() => handleCopy(p.id, p.poem, p.displayName)}
                />
              ))}
            </div>
          )}

          {hasMore && poems.length > 0 && (
            <div style={{display: 'flex', justifyContent: 'center', marginTop: 18}}>
              <OutlineButton onClick={() => loadPage(cursor)} disabled={loading}>
                {loading ? '載入中…' : '載入更多 ↓'}
              </OutlineButton>
            </div>
          )}

          {!hasMore && poems.length > 0 && (
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
              ⸺ 已到夜的盡頭 ⸺
            </div>
          )}

          <NightSiteFooter />
        </div>
      </NightShell>
    </div>
  );
}

function WallCard({
  poem,
  copied,
  onCopy,
}: {
  poem: PublicPoem;
  copied: boolean;
  onCopy: () => void;
}) {
  const palette = poem.style ? STYLE_PALETTE[poem.style] || '#2a3148' : '#2a3148';
  const lines = poem.poem.split('\n').slice(0, 4);
  const styleLabel = poem.style ? STYLE_LABEL[poem.style] || poem.style : '詩';
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${palette} 0%, rgba(10,12,20,0.95) 100%)`,
        border: `1px solid ${t.panelBorder}`,
        padding: '14px 12px 12px',
        minHeight: 180,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'border-color .2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = t.gold;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = t.panelBorder;
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontFamily: t.italic,
              fontStyle: 'italic',
              fontSize: 10,
              color: t.gold,
              letterSpacing: 1,
            }}
          >
            {styleLabel}
          </div>
          <div style={{fontSize: 9, color: t.inkMute, letterSpacing: 1}}>
            {formatDate(poem.createdAt)}
          </div>
        </div>
        <div
          style={{
            fontFamily: t.serif,
            fontSize: 13,
            color: '#f0e8c8',
            lineHeight: 1.7,
            letterSpacing: 2,
            whiteSpace: 'pre-wrap',
          }}
        >
          {lines.join('\n')}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 10,
          paddingTop: 8,
          borderTop: `1px solid ${t.divider}`,
        }}
      >
        <span style={{fontSize: 10, color: t.inkSoft, letterSpacing: 1}}>
          —— {poem.displayName || '匿名'}
        </span>
        <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
          <button
            type="button"
            onClick={onCopy}
            title={copied ? '已複製' : '複製詩句'}
            style={{
              background: 'transparent',
              border: 0,
              color: copied ? t.gold : t.inkMute,
              fontSize: 12,
              cursor: 'pointer',
              padding: '0 4px',
              fontFamily: t.italic,
              fontStyle: 'italic',
            }}
          >
            {copied ? '✓' : '複製'}
          </button>
          <PoemTTSButton
            poem={poem.poem}
            className="!h-7 !min-h-0 !text-[10px] !px-2 !py-0 !bg-transparent !border-amber-500/30 !text-amber-300/80 hover:!bg-amber-900/20"
          />
        </div>
      </div>
    </div>
  );
}
