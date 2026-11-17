import type {Metadata, Viewport} from 'next';
import Script from 'next/script';
import {Geist, Geist_Mono} from 'next/font/google';
import {Noto_Sans_TC, Noto_Serif_TC, Cormorant_Garamond} from 'next/font/google';
import './globals.css';
import {ServiceWorkerRegister} from '@/components/ServiceWorkerRegister';
import {ThemeProvider} from '@/components/night/ThemeProvider';
import {THEME_INLINE_SCRIPT} from '@/lib/theme';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const notoSansTC = Noto_Sans_TC({
  variable: '--font-noto-sans-tc',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
});

const notoSerifTC = Noto_Serif_TC({
  variable: '--font-noto-serif-tc',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '900'],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: '--font-cormorant-garamond',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['300', '400', '500', '600'],
});

// 雙部署 SITE_URL 由 build-time env 決定：
//   Firebase Hosting build  → 預設 https://photopoet-ha364.web.app
//   GitHub Pages   build    → NEXT_PUBLIC_SITE_URL=https://cagoooo.github.io/PhotoPoet
// 這樣 og:image 永遠指當前 host 自己的 og.png，FB / LINE 抓 og:image 不必跨域，
// 解決「以非同步方式處理新圖像」的 OG image 抓不到問題。
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://photopoet-ha364.web.app';
const OG_IMAGE = `${SITE_URL}/og.png`;
// og:url / canonical 必須用「最終 URL」(含 trailing slash) 跟 GitHub Pages 的
// 301 規範化對齊，否則 FB 會看到 redirect chain 卡住舊 cache。
const CANONICAL_URL = `${SITE_URL}/`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '點亮詩意 Pro · PhotoPoet Pro（早安長輩圖產生器）',
  description: '上傳照片，AI 為你寫一首繁體中文詩，一鍵產出超實用長輩圖。Pro 版升級：6 種詩風、雲端歷史、社群詩文牆。',
  applicationName: 'PhotoPoet Pro',
  authors: [{name: '阿凱老師', url: 'https://github.com/cagoooo'}],
  keywords: ['PhotoPoet', '點亮詩意', '長輩圖', '繁體中文詩', 'Gemini', '早安圖', 'AI 生詩'],
  alternates: {canonical: CANONICAL_URL},
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: CANONICAL_URL,
    siteName: 'PhotoPoet Pro · 點亮詩意',
    title: '點亮詩意 Pro · 照亮靈感',
    description: '上傳照片，AI 為你寫一首繁體中文詩。Pro 版多風格 / 雲端歷史 / 詩文牆。',
    images: [
      {
        url: OG_IMAGE,
        secureUrl: OG_IMAGE,
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'PhotoPoet Pro · 點亮詩意 · 照亮靈感',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '點亮詩意 Pro · 照亮靈感',
    description: '上傳照片，AI 為你寫一首繁體中文詩。Pro 版多風格 / 雲端歷史 / 詩文牆。',
    images: [OG_IMAGE],
  },
  icons: {
    // 用 absolute URL 才能在 GitHub Pages（basePath /PhotoPoet）下正確指
    // 到 /PhotoPoet/icon.png 而不是 root /icon.png（會 404）。
    icon: [{url: `${SITE_URL}/icon.png`, type: 'image/png', sizes: '512x512'}],
    apple: [{url: `${SITE_URL}/icon.png`, type: 'image/png', sizes: '512x512'}],
  },
  // dev 模式 (NODE_ENV !== 'production') 用本地 path 避免 CORS noise；
  // production build 仍指向 SITE_URL（GitHub Pages / Firebase Hosting 各自指自己 host）
  manifest:
    process.env.NODE_ENV === 'production'
      ? `${SITE_URL}/manifest.webmanifest`
      : '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PhotoPoet Pro',
  },
};

export const viewport: Viewport = {
  themeColor: [
    {media: '(prefers-color-scheme: dark)', color: '#06070d'},
    {media: '(prefers-color-scheme: light)', color: '#efe6d2'},
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        {/* 🛡️ App 內建瀏覽器防護：Google OAuth 禁止在 WebView 登入（403 disallowed_useragent）
            LINE → 自動帶 openExternalBrowser=1 跳系統預設瀏覽器
            FB/IG/Messenger/微信/Kakao → Android 自動用 intent:// 叫出 Chrome 開本頁（只試一次），並顯示引導與「用 Chrome 開啟」按鈕；iPhone 只能顯示引導 */}
        <script
          dangerouslySetInnerHTML={{
            __html: String.raw`
                (function () {
                    var ua = navigator.userAgent || "";
                    var isLine = /\bLine\//i.test(ua);
                    var isOtherInApp = /FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|KAKAOTALK/i.test(ua);
                    var isAndroid = /Android/i.test(ua);

                    if (isLine && location.search.indexOf("openExternalBrowser=1") === -1) {
                        // LINE 官方參數：自動改用外部瀏覽器重開本頁（保留原有 query 與 hash）
                        var sep = location.search ? "&" : "?";
                        location.replace(location.href.split("#")[0] + sep + "openExternalBrowser=1" + location.hash);
                        return;
                    }
                    if (!isOtherInApp && !isLine) return;

                    // Android：用 intent:// 指定 Chrome 開啟本頁（保留 query 與 hash）。
                    // 沒裝 Chrome 時改回內建瀏覽器開「帶 iabEscape=1 的本頁」，不再重試，避免無限跳轉。
                    var chromeIntent = "";
                    if (isAndroid) {
                        var fallback = location.href.split("#")[0]
                            + (location.search ? "&" : "?") + "iabEscape=1" + location.hash;
                        chromeIntent = "intent://" + location.host + location.pathname + location.search + location.hash
                            + "#Intent;scheme=" + location.protocol.replace(":", "")
                            + ";package=com.android.chrome"
                            + ";S.browser_fallback_url=" + encodeURIComponent(fallback) + ";end";
                    }
                    var autoJump = false;
                    if (chromeIntent) {
                        autoJump = location.search.indexOf("iabEscape=1") === -1;
                        try { autoJump = autoJump && sessionStorage.getItem("iabEscapeTried") !== "1"; } catch (e) { }
                    }

                    // 自動跳轉沒生效（舊版 App、沒裝 Chrome、iPhone）→ 顯示全版引導，避免使用者白撞 Google 封鎖
                    document.addEventListener("DOMContentLoaded", function () {
                        var d = document.createElement("div");
                        d.id = "inapp-browser-guide";
                        d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,'Microsoft JhengHei',sans-serif;";
                        var chromeBtn = chromeIntent
                            ? '<a id="inapp-open-chrome" href="' + chromeIntent.replace(/"/g, "&quot;") + '" style="display:block;margin:22px 0 4px;padding:14px 18px;border-radius:999px;background:#22c55e;color:#052e16;font-size:17px;font-weight:800;text-decoration:none;">用 Chrome 開啟</a>'
                                + '<p style="font-size:13px;color:#94a3b8;margin:8px 0 18px;">按了沒反應，再照下面的方法</p>'
                            : "";
                        d.innerHTML = '<div style="max-width:420px;width:100%;box-sizing:border-box;text-align:center;background:#1e293b;border-radius:16px;padding:32px 26px;">'
                            + '<div style="font-size:52px;">🌐</div>'
                            + '<h4 style="font-weight:800;margin:14px 0 10px;">請改用瀏覽器開啟</h4>'
                            + '<p style="font-size:15px;line-height:1.8;color:#cbd5e1;margin:0;">您目前在 <b style="color:#fbbf24;">App 內建瀏覽器</b>（LINE／FB 等）中開啟本頁，Google 基於安全政策<b>禁止在此環境登入</b>。</p>'
                            + chromeBtn
                            + '<p style="font-size:15px;line-height:1.8;color:#cbd5e1;margin:' + (chromeIntent ? "0" : "14px 0 0") + ';">請點右上／右下角「<b>⋯</b>」→ 選「<b style="color:#4ade80;">用預設瀏覽器開啟</b>」。<br><br>💡 也可以把本站「加入主畫面」，之後從桌面圖示開啟最穩定。</p>'
                            + '</div>';
                        document.body.appendChild(d);
                        // 先把引導畫出來再自動叫 Chrome：就算跳轉被 App 擋下，畫面也不會停在空白
                        if (autoJump) {
                            try { sessionStorage.setItem("iabEscapeTried", "1"); } catch (e) { }
                            setTimeout(function () { location.href = chromeIntent; }, 300);
                        }
                    });
                })();
        `,
          }}
        />
        {/* 主題 SSR-safe 預設：在 React hydration 前先讀 localStorage / system pref
            設好 <html data-theme>，避免從預設 dark flash 到使用者選的 light */}
        <script
          dangerouslySetInnerHTML={{__html: THEME_INLINE_SCRIPT}}
        />
        {/* ─────────────────────────────────────────────────────────── */}
        {/* Akai 排行榜流量歸因 beacon (cagoooo/Akai · toolId 14 早安長輩圖) */}
        {/* 進站時送一次像素 beacon 給 Akai Cloud Function 累計 totalClicks */}
        {/* 同分頁 sessionStorage 去重；reload 不重複計數 */}
        {/* 完全異步、零阻塞、失敗不影響主流程 */}
        {/* ─────────────────────────────────────────────────────────── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var T=14,K='akai_beacon_'+T+'_sent';if(sessionStorage.getItem(K))return;var SK='akai_beacon_sid',s=sessionStorage.getItem(SK);if(!s){s='poet-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);sessionStorage.setItem(SK,s);}var d=window.innerWidth<768?'mobile':(window.innerWidth<1024?'tablet':'desktop');var u='https://asia-east1-akai-e693f.cloudfunctions.net/beaconToolClick?toolId='+T+'&referrer='+encodeURIComponent(document.referrer||'')+'&device='+d+'&sessionId='+encodeURIComponent(s);new Image().src=u;sessionStorage.setItem(K,'1');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${notoSansTC.variable} ${notoSerifTC.variable} ${cormorantGaramond.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegister />
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}