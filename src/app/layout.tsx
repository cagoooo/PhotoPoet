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
        {/* 主題 SSR-safe 預設：在 React hydration 前先讀 localStorage / system pref
            設好 <html data-theme>，避免從預設 dark flash 到使用者選的 light */}
        <script
          dangerouslySetInnerHTML={{__html: THEME_INLINE_SCRIPT}}
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