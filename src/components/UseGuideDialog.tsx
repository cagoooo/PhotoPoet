"use client";

/**
 * 使用指南 modal — 夜空風
 * 對應首頁右上「說明」按鈕觸發、首次造訪自動彈出
 */
import {useEffect} from 'react';
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog';
import {nightTokens as t, GoldButton} from '@/components/night/atoms';

const SEEN_KEY = 'photopoet_guide_seen_v1';

interface UseGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS: {title: string; body: React.ReactNode}[] = [
  {
    title: '登入 Google 帳號',
    body: <>用來計算每日生詩額度（每人每日 20 首）。</>,
  },
  {
    title: '上傳照片',
    body: (
      <>
        從手機相簿選，或<span style={{color: t.gold}}>貼圖片網址</span>讓系統幫你抓。
      </>
    ),
  },
  {
    title: '選詩文風格',
    body: <>現代詩、七言絕句、五言絕句、俳句、台語白話、早安問候。</>,
  },
  {
    title: '提筆賦詩',
    body: (
      <>
        點 <span style={{color: t.gold}}>「提 筆 賦 詩」</span> 等 3-5 秒。不滿意？按{' '}
        <span style={{color: t.gold}}>「再 寫 一 首」</span> 同照片再生（消耗 1 次額度）。
      </>
    ),
  },
  {
    title: '複製・下載・分享',
    body: (
      <>
        詩成後可<span style={{color: t.gold}}>複製文字</span>、
        <span style={{color: t.gold}}>下載長輩圖</span>、
        <span style={{color: t.gold}}>列印 A4</span>、
        <span style={{color: t.gold}}>手機一鍵分享</span>。歷史在右上「我的詩」。
      </>
    ),
  },
];

export function UseGuideDialog({open, onOpenChange}: UseGuideDialogProps) {
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const seen = window.localStorage.getItem(SEEN_KEY);
      if (!seen) {
        const tid = setTimeout(() => onOpenChange(true), 800);
        return () => clearTimeout(tid);
      }
    } catch {
      /* 隱私模式可能 throw，忽略 */
    }
  }, [onOpenChange]);

  const handleClose = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {}
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent
        className="!max-w-lg !p-0 !gap-0 !border-0 !bg-transparent !shadow-none"
      >
        {/* 用 sr-only 標題滿足 Radix accessibility 要求；視覺標題在底下另寫 */}
        <DialogTitle className="sr-only">點亮詩意 使用指南</DialogTitle>

        <div
          style={{
            position: 'relative',
            background: 'var(--theme-modal-gradient)',
            border: `1px solid ${t.panelBorder}`,
            boxShadow:
              '0 30px 80px -20px rgba(0,0,0,0.45), 0 0 1px var(--theme-glow), inset 0 1px 0 rgba(255,240,200,0.06)',
            color: t.ink,
            padding: '28px 26px 24px',
            overflow: 'hidden',
          }}
        >
          {/* 角落微光裝飾（dark = 金光、light = 朱紅光） */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'var(--theme-modal-corner-glow)',
              pointerEvents: 'none',
            }}
          />

          {/* Header */}
          <div style={{position: 'relative', zIndex: 1, marginBottom: 18}}>
            <div
              style={{
                fontFamily: t.italic,
                fontStyle: 'italic',
                fontSize: 13,
                color: t.gold,
                letterSpacing: 1.5,
                marginBottom: 4,
              }}
            >
              a guide ⸺
            </div>
            <h2
              style={{
                fontFamily: t.serif,
                fontSize: 26,
                fontWeight: 300,
                letterSpacing: 6,
                color: 'var(--theme-hero-ink)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              使<span style={{color: 'var(--theme-hero-accent)'}}>用</span>指
              <span style={{color: 'var(--theme-hero-accent)'}}>南</span>
            </h2>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 12.5,
                fontWeight: 400,
                color: t.inkSoft,
                marginTop: 8,
                letterSpacing: 1,
                lineHeight: 1.7,
              }}
            >
              五個步驟，把照片化為一首詩 ✦
              <br />
              <span style={{color: t.inkMute, fontSize: 11}}>
                多風格 · 雲端歷史 · 公開詩牆
              </span>
            </div>
          </div>

          {/* 金色漸層分隔線 */}
          <div
            style={{
              height: 1,
              background:
                'linear-gradient(90deg, transparent, var(--theme-gold) 30%, var(--theme-gold) 70%, transparent)',
              opacity: 0.5,
              marginBottom: 18,
            }}
          />

          {/* Steps */}
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {STEPS.map((s, i) => (
              <li key={i} style={{display: 'flex', gap: 14, alignItems: 'flex-start'}}>
                {/* 數字徽章 */}
                <div
                  style={{
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    border: `1px solid ${t.gold}`,
                    background: 'var(--theme-badge-bg)',
                    color: t.gold,
                    fontFamily: t.italic,
                    fontStyle: 'italic',
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 12px var(--theme-glow)',
                  }}
                >
                  {i + 1}
                </div>
                <div style={{flex: 1, minWidth: 0, paddingTop: 1}}>
                  <div
                    style={{
                      fontFamily: t.serif,
                      fontSize: 14,
                      color: 'var(--theme-hero-ink)',
                      letterSpacing: 2,
                      marginBottom: 3,
                    }}
                  >
                    {s.title}
                  </div>
                  <div
                    style={{
                      fontFamily: t.serif,
                      fontSize: 12.5,
                      fontWeight: 400,
                      color: t.ink,
                      lineHeight: 1.85,
                      letterSpacing: 0.5,
                    }}
                  >
                    {s.body}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* Tip box — dashed gold border */}
          <div
            style={{
              marginTop: 22,
              padding: '12px 14px',
              border: `1px dashed ${t.gold}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 11.5,
              color: t.ink,
              background: 'var(--theme-badge-bg)',
            }}
          >
            <span style={{fontSize: 16, color: t.gold, fontFamily: t.serif, lineHeight: 1}}>
              ✦
            </span>
            <div style={{flex: 1, lineHeight: 1.75}}>
              <span style={{color: t.ink, fontWeight: 500}}>小提示</span>
              <span style={{color: t.inkSoft}}>
                　每張照片用不同風格各生一次，比較看看哪種最有感覺。
              </span>
            </div>
          </div>

          {/* CTA */}
          <div style={{marginTop: 22}}>
            <GoldButton onClick={handleClose}>開 始 使 用</GoldButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
