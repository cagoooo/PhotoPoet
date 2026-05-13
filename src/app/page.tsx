'use client';

import {useState, useCallback, useRef, useEffect, type CSSProperties} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';

import {toast} from '@/hooks/use-toast';
import {useIsMobile} from '@/hooks/use-mobile';
import {useAuth} from '@/hooks/useAuth';
import {useUsage, todayKeyTaipei} from '@/hooks/useUsage';

import {TurnstileGate} from '@/components/TurnstileGate';
import {UseGuideDialog} from '@/components/UseGuideDialog';
import {PoemTTSButton} from '@/components/PoemTTSButton';

import {compressImage} from '@/lib/compress-image';
import {
  renderPoemImage,
  triggerDownload,
  FORMAT_LABELS,
  FORMAT_FILENAMES,
  type PoemFormat,
} from '@/lib/poem-image';

import {
  nightTokens as t,
  NightShell,
  TopBar,
  GoldButton,
  OutlineButton,
  Panel,
  GlowRule,
} from '@/components/night/atoms';
import {NightAuthBar} from '@/components/night/NightAuthBar';
import {NightSiteFooter} from '@/components/night/NightSiteFooter';
import {ThemeToggle} from '@/components/night/ThemeToggle';
import {useTheme} from '@/components/night/ThemeProvider';

const DAILY_LIMIT_FALLBACK = 20;

interface PoemStyleOption {
  value: string;
  zh: string;
  en: string;
  vertical: boolean;
}

const POEM_STYLE_OPTIONS = [
  {value: 'modern', zh: '現代詩', en: 'Free Verse', vertical: false},
  {value: 'seven-jueju', zh: '七言絕句', en: 'Quatrain · 7', vertical: true},
  {value: 'five-jueju', zh: '五言絕句', en: 'Quatrain · 5', vertical: true},
  {value: 'haiku', zh: '俳句', en: 'Haiku 5-7-5', vertical: false},
  {value: 'taigi', zh: '台語白話', en: 'Taigi Verse', vertical: false},
  {value: 'elder', zh: '早安問候', en: 'Morning Greeting', vertical: false},
] as const satisfies readonly PoemStyleOption[];
type PoemStyleValue = (typeof POEM_STYLE_OPTIONS)[number]['value'];

function findStyle(v: string): PoemStyleOption {
  return POEM_STYLE_OPTIONS.find(o => o.value === v) ?? POEM_STYLE_OPTIONS[0];
}

export default function Home() {
  // ─── 後端 / 業務狀態（保留原邏輯）─────────────────────────────────
  const [photo, setPhoto] = useState<string | null>(null);
  const [poem, setPoem] = useState<string>('');
  const [url, setUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloadGenerating, setIsDownloadGenerating] = useState(false);
  const [isEmbedGenerating, setIsEmbedGenerating] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState<number>(0);
  const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [poemStyle, setPoemStyle] = useState<PoemStyleValue>('modern');
  const [publishToWall, setPublishToWall] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<PoemFormat>('embed');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [welcomedUid, setWelcomedUid] = useState<string | null>(null);
  const {user, configured: authConfigured, getIdToken, signIn} = useAuth();
  const {usage} = useUsage(user?.uid);

  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const {theme} = useTheme();

  // 登入後一次性把 Firestore 上的今日用量同步到 UI，並 toast 一次
  useEffect(() => {
    if (!user || !usage) return;
    if (welcomedUid === user.uid) return;
    const today = todayKeyTaipei();
    const usedToday = usage.date === today ? usage.count : 0;
    const remainingToday = Math.max(0, DAILY_LIMIT_FALLBACK - usedToday);
    setRemaining(prev => (prev === null ? remainingToday : prev));
    setDailyLimit(prev => (prev === null ? DAILY_LIMIT_FALLBACK : prev));
    if (usedToday > 0) {
      toast({
        title: `歡迎回來，${user.displayName?.split(' ')[0] ?? '詩人'} ✨`,
        description: `今日已生成 ${usedToday} 首，還剩 ${remainingToday} 首。`,
      });
    }
    setWelcomedUid(user.uid);
  }, [user, usage, welcomedUid]);

  // LINE in-app browser 跳外部 + 強制 viewport
  useEffect(() => {
    if (
      navigator.userAgent.indexOf('Line') > -1 &&
      window.location.search.indexOf('openExternalBrowser=1') === -1
    ) {
      window.location.href = window.location.href + '?openExternalBrowser=1';
    }
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
    }
  }, []);

  // ─── 圖片載入 ─────────────────────────────────────────────────────
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
      setPoem('');
    } catch (err: any) {
      console.error('compress failed', err);
      toast({title: '無法處理圖片', description: err?.message || '請換一張圖片再試。'});
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleURLSubmission = useCallback(async () => {
    if (!url) {
      toast({title: '錯誤！', description: '請輸入照片網址。'});
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch(`${API_BASE}/api/proxy?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        let errorMessage = `HTTP 錯誤！狀態碼: ${response.status}`;
        if (response.status === 404) {
          errorMessage = '讀取圖片失敗！找不到該圖片網址。';
        } else {
          try {
            const errorBody = await response.json();
            errorMessage = errorBody?.error
              ? `讀取圖片失敗！${errorBody.error}`
              : '讀取圖片失敗！未知錯誤。';
          } catch {
            errorMessage = '讀取圖片失敗！無法解析錯誤訊息。';
          }
        }
        throw new Error(errorMessage);
      }
      const blob = await response.blob();
      try {
        const dataUrl = await compressImage(blob);
        setPhoto(dataUrl);
        setPoem('');
      } catch (err: any) {
        toast({title: '無法處理圖片', description: err?.message || '請換一張圖再試。'});
      }
    } catch (error: any) {
      console.error('Error fetching image:', error);
      toast({title: '圖片讀取失敗！', description: error.message || '無法從提供的網址讀取圖片。'});
    } finally {
      setIsGenerating(false);
    }
  }, [url, API_BASE]);

  // ─── 主流程：生詩 ─────────────────────────────────────────────────
  const handleSubmit = async (
    arg?: {regenerate?: boolean} | number,
    delay = 1000,
  ) => {
    const isRegen = typeof arg === 'object' && !!arg?.regenerate;
    let retries = typeof arg === 'number' ? arg : 3;
    if (!photo) {
      toast({title: '錯誤！', description: '請先上傳一張照片。'});
      return;
    }
    if (authConfigured && !user) {
      toast({title: '請先登入', description: '請使用上方按鈕以 Google 帳號登入後再試。'});
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      toast({title: '尚未通過人機驗證', description: '請等待上方驗證框出現綠色勾勾後再試。'});
      return;
    }
    if (isRegen) setIsRegenerating(true);
    else setIsGenerating(true);
    const idToken = authConfigured ? await getIdToken() : null;
    const buildBody = () =>
      JSON.stringify({photo, turnstileToken, style: poemStyle, regenerate: isRegen, publishToWall});
    const buildHeaders = () => {
      const h: Record<string, string> = {'Content-Type': 'application/json', Accept: 'application/json'};
      if (idToken) h.Authorization = `Bearer ${idToken}`;
      return h;
    };
    try {
      let response = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: buildHeaders(),
        body: buildBody(),
      });
      while (!response.ok && response.status === 503 && retries > 0) {
        console.warn(`AI模型目前過載，重試中... 剩餘 ${retries} 次`);
        await new Promise(resolve => setTimeout(resolve, delay));
        response = await fetch(`${API_BASE}/api/generate`, {
          method: 'POST',
          headers: buildHeaders(),
          body: buildBody(),
        });
        retries--;
        delay *= 3;
      }
      if (!response.ok) {
        let errorMessage = `HTTP 錯誤！狀態碼: ${response.status}`;
        if (response.status === 404) {
          errorMessage = '生成失敗！找不到產生詩詞的API，請稍後再試。';
        } else if (response.status === 503) {
          errorMessage = 'AI模型目前過載，請稍後再試。';
        } else if (response.status === 401 || response.status === 403 || response.status === 429) {
          try {
            const errBody = await response.json();
            if (errBody?.error) errorMessage = errBody.error;
            if (typeof errBody?.dailyLimit === 'number') setDailyLimit(errBody.dailyLimit);
            if (typeof errBody?.remaining === 'number') setRemaining(errBody.remaining);
          } catch {}
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setPoem(data.poem);
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (typeof data.dailyLimit === 'number') setDailyLimit(data.dailyLimit);
      toast({title: '詩成 ✦', description: '靈感之詩翩然降臨。'});
    } catch (error: any) {
      console.error('Error:', error);
      toast({title: '生成失敗！', description: error.message || '無法生成詩詞，請稍後再試。'});
    } finally {
      setIsGenerating(false);
      setIsRegenerating(false);
      setTurnstileToken('');
      setTurnstileResetSignal(s => s + 1);
    }
  };

  const handleRegenerate = () => handleSubmit({regenerate: true});

  // ─── 下載 / 列印 / 分享 ───────────────────────────────────────────
  const handleFormatDownload = useCallback(async () => {
    if (!photo || !poem) {
      toast({title: '錯誤！', description: '請先上傳照片並生成詩詞。'});
      return;
    }
    setIsDownloadGenerating(true);
    try {
      const dataUrl = await renderPoemImage(photo, poem, downloadFormat, {
        isMobile,
        theme,
      });
      triggerDownload(dataUrl, FORMAT_FILENAMES[downloadFormat]);
      toast({
        title: '下載成功！',
        description: `已產出${FORMAT_LABELS[downloadFormat].replace(/^[\p{Emoji}\s]+/u, '')}版型。`,
      });
    } catch (err: any) {
      console.error(err);
      toast({title: '下載失敗', description: err?.message || '產出圖片失敗。'});
    } finally {
      setIsDownloadGenerating(false);
    }
  }, [photo, poem, downloadFormat, isMobile, theme]);

  const handlePrint = () => {
    if (!photo || !poem) {
      toast({title: '錯誤！', description: '請先上傳照片並生成詩詞。'});
      return;
    }
    window.print();
  };

  // 用於 navigator.share 的內嵌詩圖（保留舊 canvas 算法以維持手機分享相容）
  const generateEmbedImageDataUrl = useCallback(async () => {
    if (!photo || !poem) {
      toast({title: '錯誤！', description: '請先上傳照片並生成詩詞。'});
      return null;
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast({title: '錯誤！', description: '無法建立畫布。'});
      return null;
    }
    const image = new window.Image();
    image.src = photo;
    await new Promise((resolve, reject) => {
      image.onload = () => resolve(null);
      image.onerror = () => reject(new Error('Failed to load image'));
    });
    const canvasWidth = image.width;
    const canvasHeight = image.height;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
    const fontSize = Math.max(20, Math.min(canvasWidth / 18, canvasHeight / 18));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    const lines = poem.split('\n');
    const lineHeight = fontSize * 1.2;
    let y = canvasHeight - 10;
    const poemColors = ['#ef5350', '#f48fb1', '#7e57c2', '#2196f3', '#26a69a', '#43a047', '#D97706', '#f9a825'];
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.lineWidth = isMobile ? 12 : 8;
    ctx.strokeStyle = 'white';
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillStyle = poemColors[i % poemColors.length];
      ctx.strokeText(lines[i], canvasWidth - 10, y);
      ctx.fillText(lines[i], canvasWidth - 10, y);
      y -= lineHeight;
    }
    return canvas.toDataURL('image/jpeg', isMobile ? 0.7 : 0.9);
  }, [photo, poem, isMobile]);

  const handleShare = useCallback(async () => {
    if (!navigator.share) {
      toast({title: '分享失敗！', description: '分享功能僅支援行動裝置瀏覽器。'});
      return;
    }
    setIsEmbedGenerating(true);
    try {
      const dataURL = await generateEmbedImageDataUrl();
      if (dataURL) {
        const blob = await (await fetch(dataURL)).blob();
        const file = new File([blob], 'poem_image.png', {type: 'image/png'});
        await navigator.share({files: [file], title: '我的 AI 詩詞圖片'});
        toast({title: '分享成功！', description: '圖片已成功分享！'});
      }
    } catch {
      toast({title: '分享失敗！', description: '分享圖片時發生錯誤。'});
    } finally {
      setIsEmbedGenerating(false);
    }
  }, [generateEmbedImageDataUrl]);

  const handleCopy = () => {
    if (!poem) return;
    navigator.clipboard
      .writeText(poem)
      .then(() => {
        setIsCopied(true);
        toast({title: '已複製！', description: '完整詩句已複製到剪貼簿。'});
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(err => {
        console.error('clipboard fail', err);
        toast({title: '複製失敗！', description: '請手動選取複製。'});
      });
  };

  const handleClearPhoto = () => {
    setPhoto(null);
    setPoem('');
  };

  const handleBackFromResult = () => {
    setPoem('');
  };

  // ─── 派生狀態 ─────────────────────────────────────────────────────
  const styleMeta = findStyle(poemStyle);
  const showResult = !!poem && !isGenerating && !isRegenerating;
  const showOverlay = isGenerating || isRegenerating;
  const isBusy = isGenerating || isRegenerating;
  const needsLogin = authConfigured && !user;
  const canSubmit =
    !!photo &&
    !isBusy &&
    (!turnstileEnabled || !!turnstileToken) &&
    !needsLogin;

  // 主 CTA：未登入時點下去觸發 Google 登入；登入後才走生詩流程
  const handleCtaClick = () => {
    if (needsLogin) {
      signIn().catch(e => {
        console.error('signIn failed', e);
        toast({
          title: '登入失敗',
          description: e?.message || '請稍後再試。',
        });
      });
      return;
    }
    handleSubmit();
  };
  // 「請先登入」狀態下按鈕仍可按（按下去登入），其餘 disabled 條件照舊
  const ctaDisabled = isBusy || (!needsLogin && !canSubmit);

  // ─── 渲染 ────────────────────────────────────────────────────────
  return (
    <>
      <UseGuideDialog open={showGuide} onOpenChange={setShowGuide} />

      <div style={{padding: '24px 12px', minHeight: '100vh'}}>
        <NightShell>
          {showResult ? (
            <ResultView
              photo={photo!}
              poem={poem}
              styleMeta={styleMeta}
              publish={publishToWall}
              onBack={handleBackFromResult}
              onCopy={handleCopy}
              isCopied={isCopied}
              onRegenerate={handleRegenerate}
              isRegenerating={isRegenerating}
              onPrint={handlePrint}
              onFormatDownload={handleFormatDownload}
              isDownloadGenerating={isDownloadGenerating}
              downloadFormat={downloadFormat}
              setDownloadFormat={setDownloadFormat}
              onShare={handleShare}
              isEmbedGenerating={isEmbedGenerating}
              poemTTS={<PoemTTSButton poem={poem} className="!h-9 !text-sm !bg-transparent !border-amber-500/40 !text-amber-300 hover:!bg-amber-900/20" />}
            />
          ) : (
            <HomeView
              photo={photo}
              onUploadClick={handleUploadClick}
              onClearPhoto={handleClearPhoto}
              onFileChange={handleFileChange}
              fileInputRef={fileInputRef}
              url={url}
              setUrl={setUrl}
              onUrlSubmit={handleURLSubmission}
              isGenerating={isGenerating}
              poemStyle={poemStyle}
              setPoemStyle={setPoemStyle}
              publishToWall={publishToWall}
              setPublishToWall={setPublishToWall}
              remaining={remaining}
              dailyLimit={dailyLimit}
              turnstileEnabled={turnstileEnabled}
              setTurnstileToken={setTurnstileToken}
              turnstileResetSignal={turnstileResetSignal}
              needsLogin={needsLogin}
              hasPhoto={!!photo}
              ctaDisabled={ctaDisabled}
              onCta={handleCtaClick}
              onShowGuide={() => setShowGuide(true)}
            />
          )}
        </NightShell>
      </div>

      {showOverlay && (
        <GeneratingOverlay
          photo={photo}
          formZh={styleMeta.zh}
          onCancel={() => {
            setIsGenerating(false);
            setIsRegenerating(false);
          }}
        />
      )}

      {/* 列印 A4 專用版型（保留原 print CSS 對應的 DOM） */}
      {photo && poem && (
        <div id="poem-print-area" aria-hidden="true">
          <div className="poem-print-frame">
            <div className="poem-print-header">
              <span className="poem-print-deco">❀</span>
              <h1 className="poem-print-title">點亮詩意 Pro</h1>
              <span className="poem-print-deco">❀</span>
            </div>
            <div className="poem-print-subtitle">{styleMeta.zh}</div>
            <div className="poem-print-photo-wrap">
              <img src={photo} alt="" className="poem-print-photo" />
            </div>
            <div className="poem-print-divider" data-deco="✦" />
            <div className="poem-print-poem">
              {poem.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="poem-print-divider" data-deco="✦" />
            {user?.displayName && <div className="poem-print-author">— {user.displayName} —</div>}
            <div className="poem-print-footer">
              <div className="poem-print-footer-brand">PhotoPoet Pro · 點亮詩意</div>
              <div className="poem-print-footer-meta">
                <span>
                  {new Date().toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <span className="poem-print-footer-sep">·</span>
                <span>cagoooo.github.io/PhotoPoet</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// HomeView — 上傳 / 選詩體 / 公開 toggle / CTA
// ────────────────────────────────────────────────────────────────────
interface HomeViewProps {
  photo: string | null;
  onUploadClick: () => void;
  onClearPhoto: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  url: string;
  setUrl: (v: string) => void;
  onUrlSubmit: () => void;
  isGenerating: boolean;
  poemStyle: PoemStyleValue;
  setPoemStyle: (v: PoemStyleValue) => void;
  publishToWall: boolean;
  setPublishToWall: (v: boolean) => void;
  remaining: number | null;
  dailyLimit: number | null;
  turnstileEnabled: boolean;
  setTurnstileToken: (v: string) => void;
  turnstileResetSignal: number;
  needsLogin: boolean;
  hasPhoto: boolean;
  ctaDisabled: boolean;
  onCta: () => void;
  onShowGuide: () => void;
}

function HomeView(p: HomeViewProps) {
  return (
    <div style={{position: 'relative', zIndex: 1, padding: '0 22px 24px'}}>
      <TopBar
        rightSlot={
          <>
            <Link href="/wall" style={{color: t.inkSoft, textDecoration: 'none', cursor: 'pointer'}}>
              詩牆
            </Link>
            <span onClick={p.onShowGuide} style={{cursor: 'pointer'}}>
              說明
            </span>
            <ThemeToggle />
          </>
        }
      />

      {/* Hero */}
      <div style={{marginTop: 36, position: 'relative', zIndex: 2}}>
        <div
          style={{
            fontFamily: t.italic,
            fontStyle: 'italic',
            fontSize: 14,
            color: t.gold,
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          by night, a verse
        </div>
        <h1
          style={{
            fontFamily: t.serif,
            fontSize: 46,
            fontWeight: 300,
            lineHeight: 1.05,
            letterSpacing: 6,
            color: 'var(--theme-hero-ink)',
            margin: 0,
            textShadow: '0 0 30px var(--theme-glow)',
          }}
        >
          夜<span style={{color: 'var(--theme-hero-accent)'}}>讀</span>
          <br />
          影<span style={{color: 'var(--theme-hero-accent)'}}>詩</span>
        </h1>
        <div
          style={{
            fontFamily: t.serif,
            fontSize: 12.5,
            fontWeight: 300,
            color: t.inkSoft,
            lineHeight: 1.9,
            marginTop: 18,
            maxWidth: '90%',
          }}
        >
          上傳一張照片，月光替你謄寫詩句。
          <br />
          一張影像，一首屬於你的繁體中文詩。
        </div>
      </div>

      <GlowRule style={{margin: '24px 0 18px'}} />

      <NightAuthBar remaining={p.remaining} dailyLimit={p.dailyLimit} />

      {/* I. photograph */}
      <Panel label="i. photograph" style={{marginBottom: 16}}>
        {p.photo ? (
          <PhotoPreview photo={p.photo} onClear={p.onClearPhoto} />
        ) : (
          <UploadEmpty
            onUploadClick={p.onUploadClick}
            onFileChange={p.onFileChange}
            fileInputRef={p.fileInputRef}
            url={p.url}
            setUrl={p.setUrl}
            onUrlSubmit={p.onUrlSubmit}
            isGenerating={p.isGenerating}
          />
        )}
      </Panel>

      {/* II. form */}
      <Panel label="ii. form">
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
          {POEM_STYLE_OPTIONS.map(s => {
            const active = s.value === p.poemStyle;
            return (
              <div
                key={s.value}
                onClick={() => p.setPoemStyle(s.value)}
                style={{
                  padding: '10px 12px',
                  border: `1px solid ${active ? t.gold : 'rgba(141,138,120,0.25)'}`,
                  background: active ? 'rgba(184,154,74,0.10)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all .2s',
                }}
              >
                <span
                  style={{
                    fontFamily: t.serif,
                    fontSize: 13,
                    color: t.ink,
                    letterSpacing: 2,
                  }}
                >
                  {s.zh}
                </span>
                <span
                  style={{
                    fontFamily: t.italic,
                    fontStyle: 'italic',
                    fontSize: 10,
                    color: t.inkMute,
                    marginTop: 2,
                  }}
                >
                  {s.en}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Share toggle */}
      <div
        onClick={() => p.setPublishToWall(!p.publishToWall)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 18,
          padding: '12px 14px',
          border: `1px solid ${t.divider}`,
          cursor: 'pointer',
        }}
      >
        <div>
          <div style={{fontSize: 11.5, color: t.ink}}>分享至詩牆</div>
          <div style={{fontSize: 10, color: t.inkMute, marginTop: 2}}>
            以暱稱公開展示，其他人看得到
          </div>
        </div>
        <div
          style={{
            width: 38,
            height: 20,
            borderRadius: 999,
            background: p.publishToWall ? t.gold : 'rgba(141,138,120,0.3)',
            position: 'relative',
            flexShrink: 0,
            boxShadow: p.publishToWall ? '0 0 14px rgba(184,154,74,0.5)' : 'none',
            transition: 'all .25s',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: p.publishToWall ? 20 : 2,
              width: 16,
              height: 16,
              background: '#0a0c14',
              borderRadius: '50%',
              transition: 'left .25s',
            }}
          />
        </div>
      </div>

      {/* Turnstile */}
      <div style={{marginTop: 14}}>
        <TurnstileGate onToken={p.setTurnstileToken} resetSignal={p.turnstileResetSignal} />
      </div>

      <GoldButton onClick={p.onCta} disabled={p.ctaDisabled} style={{marginTop: 22}}>
        {p.needsLogin
          ? '以 Google 登 入'
          : !p.hasPhoto
          ? '先 選 一 張 照 片'
          : '提 筆 賦 詩'}
      </GoldButton>

      <NightSiteFooter />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// UploadEmpty / PhotoPreview — 對應 prototype upload 區塊
// ────────────────────────────────────────────────────────────────────
function UploadEmpty(props: {
  onUploadClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  url: string;
  setUrl: (v: string) => void;
  onUrlSubmit: () => void;
  isGenerating: boolean;
}) {
  return (
    <>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 5,
          textTransform: 'uppercase',
          color: t.inkMute,
          marginBottom: 10,
          fontWeight: 500,
        }}
      >
        upload
      </div>
      <button
        type="button"
        onClick={props.onUploadClick}
        style={{
          width: '100%',
          background: 'transparent',
          border: `1px solid ${t.panelBorder}`,
          color: t.ink,
          padding: '14px 16px',
          fontFamily: t.serif,
          fontSize: 13,
          letterSpacing: 4,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all .2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = t.gold;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = t.panelBorder;
        }}
      >
        <span>從相簿選擇照片</span>
        <span style={{color: t.gold}}>↗</span>
      </button>
      <input
        ref={props.fileInputRef}
        type="file"
        accept="image/*"
        onChange={props.onFileChange}
        style={{display: 'none'}}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          margin: '12px 0',
          fontSize: 10,
          color: t.inkFaint,
          letterSpacing: 3,
        }}
      >
        <div style={{flex: 1, height: 1, background: 'rgba(141,138,120,0.25)'}} />
        <span>OR</span>
        <div style={{flex: 1, height: 1, background: 'rgba(141,138,120,0.25)'}} />
      </div>

      <div style={{display: 'flex', borderBottom: `1px solid ${t.panelBorder}`}}>
        <input
          value={props.url}
          onChange={e => props.setUrl(e.target.value)}
          // 瀏覽器擴充（password manager / form-filler）常會偷偷在 input 上加
          // data-* attribute，造成 React hydration mismatch warning。input 本來就
          // 會被外部動，跳過 hydration 比對是業界標準做法。
          suppressHydrationWarning
          style={{
            flex: 1,
            background: 'transparent',
            border: 0,
            padding: '8px 0',
            color: t.ink,
            fontFamily: t.serif,
            fontSize: 12,
            outline: 'none',
          }}
          placeholder="貼上圖片網址"
        />
        <button
          type="button"
          onClick={props.onUrlSubmit}
          disabled={props.isGenerating}
          style={{
            background: 'transparent',
            border: 0,
            color: t.gold,
            fontSize: 11.5,
            padding: '8px 4px',
            cursor: props.isGenerating ? 'wait' : 'pointer',
            fontFamily: t.italic,
            fontStyle: 'italic',
          }}
        >
          fetch ↗
        </button>
      </div>
    </>
  );
}

function PhotoPreview({photo, onClear}: {photo: string; onClear: () => void}) {
  return (
    <div style={{position: 'relative'}}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 5,
          textTransform: 'uppercase',
          color: t.inkMute,
          marginBottom: 10,
          fontWeight: 500,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>photograph · selected</span>
        <span
          onClick={onClear}
          style={{
            cursor: 'pointer',
            color: t.gold,
            letterSpacing: 1,
            textTransform: 'none',
            fontFamily: t.italic,
            fontStyle: 'italic',
            fontSize: 11,
          }}
        >
          再換一張 ↻
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          aspectRatio: '4/3',
          border: `1px solid ${t.panelBorder}`,
          overflow: 'hidden',
          animation: 'scaleFadeIn .4s ease forwards',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt="你的照片"
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, transparent 60%, rgba(10,12,20,0.55) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            padding: '2px 8px',
            background: 'rgba(10,12,20,0.6)',
            border: `1px solid ${t.panelBorder}`,
            fontFamily: t.italic,
            fontStyle: 'italic',
            fontSize: 10,
            color: t.gold,
            letterSpacing: 1,
          }}
        >
          ready
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// ResultView — 照片 + 詩疊在底部 + 行動列
// ────────────────────────────────────────────────────────────────────
interface ResultViewProps {
  photo: string;
  poem: string;
  styleMeta: PoemStyleOption;
  publish: boolean;
  onBack: () => void;
  onCopy: () => void;
  isCopied: boolean;
  onRegenerate: () => void;
  isRegenerating: boolean;
  onPrint: () => void;
  onFormatDownload: () => void;
  isDownloadGenerating: boolean;
  downloadFormat: PoemFormat;
  setDownloadFormat: (v: PoemFormat) => void;
  onShare: () => void;
  isEmbedGenerating: boolean;
  poemTTS: React.ReactNode;
}

function ResultView(p: ResultViewProps) {
  const lines = p.poem.split('\n').filter(l => l.trim().length > 0);
  const dt = new Date();
  const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(
    dt.getDate(),
  ).padStart(2, '0')} · ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

  return (
    <div style={{position: 'relative', zIndex: 1, padding: '0 22px 24px'}}>
      <TopBar onBack={p.onBack} backLabel="另作" rightSlot={<ThemeToggle />} />

      <div style={{padding: '8px 0 24px'}}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4/5',
            marginTop: 14,
            overflow: 'hidden',
            border: `1px solid ${t.panelBorder}`,
            animation: 'scaleFadeIn .5s ease forwards',
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.photo}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.85) contrast(1.05)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, transparent 30%, rgba(10,12,20,0.95) 100%)',
            }}
          />
          {/* form label */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              padding: '4px 12px',
              background: 'rgba(10,12,20,0.5)',
              border: `1px solid ${t.panelBorder}`,
              backdropFilter: 'blur(8px)',
              fontFamily: t.italic,
              fontStyle: 'italic',
              fontSize: 11,
              color: t.gold,
              letterSpacing: 1.5,
            }}
          >
            {p.styleMeta.zh}
          </div>
          <PoemReveal lines={lines} vertical={p.styleMeta.vertical} />
        </div>

        {/* metadata */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: t.inkMute,
            letterSpacing: 2,
            marginTop: 14,
            paddingBottom: 10,
            borderBottom: `1px solid ${t.divider}`,
          }}
        >
          <span>{dateStr}</span>
          <span>{p.publish ? '已分享至詩牆 ✦' : '私人收藏'}</span>
        </div>

        {/* Actions */}
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14}}>
          <OutlineButton onClick={p.onCopy}>{p.isCopied ? '已複製 ✓' : '複製詩句'}</OutlineButton>
          <OutlineButton onClick={p.onPrint}>列印 A4 紙本 🖨</OutlineButton>
        </div>

        {/* TTS button (uses existing dark-styled component) */}
        <div style={{marginTop: 8}}>{p.poemTTS}</div>

        {/* Download format */}
        <div
          style={{
            marginTop: 14,
            padding: 12,
            border: `1px solid ${t.panelBorder}`,
            background: t.panel,
          }}
        >
          <div
            style={{
              fontFamily: t.italic,
              fontStyle: 'italic',
              fontSize: 11,
              color: t.gold,
              letterSpacing: 1.5,
              marginBottom: 8,
            }}
          >
            download as ⸺
          </div>
          <select
            value={p.downloadFormat}
            onChange={e => p.setDownloadFormat(e.target.value as PoemFormat)}
            style={{
              width: '100%',
              background: t.bgSoft,
              color: t.ink,
              border: `1px solid ${t.panelBorder}`,
              padding: '10px 12px',
              fontFamily: t.serif,
              fontSize: 13,
              letterSpacing: 1,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {(Object.keys(FORMAT_LABELS) as PoemFormat[]).map(k => (
              <option key={k} value={k}>
                {FORMAT_LABELS[k]}
              </option>
            ))}
          </select>
          <OutlineButton
            onClick={p.onFormatDownload}
            disabled={p.isDownloadGenerating}
            style={{width: '100%', marginTop: 8}}
          >
            {p.isDownloadGenerating ? '產出中…' : '下載這個版型 ↓'}
          </OutlineButton>
        </div>

        {/* Mobile share */}
        {typeof navigator !== 'undefined' && (
          <OutlineButton
            onClick={p.onShare}
            disabled={p.isEmbedGenerating}
            style={{width: '100%', marginTop: 10}}
          >
            {p.isEmbedGenerating ? '產出中…' : '一鍵分享長輩圖（行動端）↗'}
          </OutlineButton>
        )}

        {/* Re-write */}
        <GoldButton onClick={p.onRegenerate} disabled={p.isRegenerating} style={{marginTop: 18}}>
          {p.isRegenerating ? '重 詠 中 …' : '再 寫 一 首'}
        </GoldButton>

        <div
          style={{
            marginTop: 22,
            padding: '12px 14px',
            border: `1px dashed ${t.panelBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 11,
            color: t.inkSoft,
          }}
        >
          <span style={{fontSize: 18, fontFamily: t.serif}}>✦</span>
          <div style={{flex: 1, lineHeight: 1.6}}>
            <div style={{color: t.ink, marginBottom: 2}}>喜歡這首詩？</div>
            <div style={{fontSize: 10, color: t.inkMute}}>
              更換詩體、再寫一首，會有不同感覺的版本。
            </div>
          </div>
        </div>

        <NightSiteFooter />
      </div>
    </div>
  );
}

/** 詩句逐字 inkRise reveal；vertical=true 用直書（從右到左） */
function PoemReveal({lines, vertical}: {lines: string[]; vertical: boolean}) {
  let totalDelay = 0;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '18px 24px 24px',
        display: 'flex',
        flexDirection: vertical ? 'row-reverse' : 'column',
        gap: vertical ? 14 : 6,
        alignItems: vertical ? 'flex-start' : 'flex-start',
        justifyContent: vertical ? 'center' : 'flex-end',
        minHeight: '55%',
      }}
    >
      {lines.map((line, li) => {
        const chars = Array.from(line);
        const lineDelay = totalDelay;
        totalDelay += chars.length * 0.08 + 0.25;
        const lineStyle: CSSProperties = {
          writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
          fontFamily: t.serif,
          fontSize: vertical ? 21 : 17,
          fontWeight: 400,
          color: '#f0e8c8',
          letterSpacing: vertical ? 8 : 3,
          lineHeight: vertical ? 1.4 : 1.7,
          textShadow: '0 1px 6px rgba(0,0,0,0.7), 0 0 24px rgba(232,210,140,0.2)',
        };
        return (
          <div key={li} style={lineStyle}>
            {chars.map((c, ci) => (
              <span
                key={ci}
                style={{
                  display: 'inline-block',
                  opacity: 0,
                  animation: 'inkRise 0.7s ease both',
                  animationDelay: `${lineDelay + ci * 0.08}s`,
                }}
              >
                {c === ' ' ? ' ' : c}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// GeneratingOverlay — 全屏覆蓋，月亮 + shimmer 文字
// ────────────────────────────────────────────────────────────────────
function GeneratingOverlay({
  photo,
  formZh,
  onCancel,
}: {
  photo: string | null;
  formZh: string;
  onCancel: () => void;
}) {
  const messages = ['凝視這張照片 ⸺', '收集光與影 ⸺', '為你譜下詩句 ⸺'];
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase(p => (p + 1) % messages.length), 1200);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        background: t.bg,
      }}
    >
      {photo && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${photo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px) brightness(0.35)',
            opacity: 0.6,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(10,12,20,0.4) 0%, rgba(10,12,20,0.95) 100%)',
        }}
      />

      <TopBar onBack={onCancel} backLabel="取消" rightSlot={<ThemeToggle />} />

      <div
        style={{
          position: 'relative',
          zIndex: 3,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 32px',
        }}
      >
        {/* Big moon */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 35% 30%, #fff5d8 0%, #f0e4b8 40%, #b89a4a 100%)',
            boxShadow:
              '0 0 80px rgba(232,210,140,0.5), 0 0 140px rgba(232,210,140,0.3)',
            marginBottom: 36,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '24%',
              left: '30%',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'rgba(120,90,40,0.25)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '55%',
              left: '58%',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'rgba(120,90,40,0.2)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '18%',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'rgba(120,90,40,0.18)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: -20,
              borderRadius: '50%',
              border: '1px solid rgba(232,210,140,0.3)',
              animation: 'moonPulse 3s ease-in-out infinite',
            }}
          />
        </div>

        <div
          style={{
            fontFamily: t.italic,
            fontStyle: 'italic',
            fontSize: 14,
            color: t.gold,
            letterSpacing: 2,
            marginBottom: 14,
          }}
        >
          composing ⸺ {formZh}
        </div>

        <div
          className="shimmer-text"
          style={{
            fontFamily: t.serif,
            fontSize: 22,
            letterSpacing: 6,
            fontWeight: 300,
            textAlign: 'center',
            minHeight: 32,
          }}
        >
          {messages[phase]}
        </div>

        <div
          style={{
            fontFamily: t.serif,
            fontSize: 12,
            color: t.inkMute,
            letterSpacing: 2,
            marginTop: 36,
            lineHeight: 1.9,
            textAlign: 'center',
          }}
        >
          月光緩緩落入字裡行間，
          <br />
          請稍候片刻。
        </div>

        <div style={{display: 'flex', gap: 8, marginTop: 32}}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: t.gold,
                opacity: phase === i ? 1 : 0.3,
                transition: 'opacity .4s',
                boxShadow: phase === i ? '0 0 10px rgba(184,154,74,0.8)' : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
