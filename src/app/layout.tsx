import type {Metadata, Viewport} from 'next';
import Script from 'next/script';
import {Geist, Geist_Mono} from 'next/font/google';
import {Noto_Sans_TC} from 'next/font/google';
import './globals.css';
import {ServiceWorkerRegister} from '@/components/ServiceWorkerRegister';

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
  weight: ['400', '500', '700'],
});

const SITE_URL = 'https://photopoet-ha364.web.app';
const OG_IMAGE = `${SITE_URL}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '點亮詩意 · PhotoPoet（早安長輩圖產生器）',
  description: '上傳照片，AI 為你寫一首繁體中文詩，一鍵產出超實用長輩圖。',
  applicationName: 'PhotoPoet',
  authors: [{name: '阿凱老師', url: 'https://github.com/cagoooo'}],
  keywords: ['PhotoPoet', '點亮詩意', '長輩圖', '繁體中文詩', 'Gemini', '早安圖', 'AI 生詩'],
  alternates: {canonical: SITE_URL},
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: SITE_URL,
    siteName: 'PhotoPoet · 點亮詩意',
    title: '點亮詩意，照亮靈感',
    description: '上傳照片，AI 為你寫一首繁體中文詩。',
    images: [
      {
        url: OG_IMAGE,
        secureUrl: OG_IMAGE,
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'PhotoPoet · 點亮詩意，照亮靈感',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '點亮詩意，照亮靈感',
    description: '上傳照片，AI 為你寫一首繁體中文詩。',
    images: [OG_IMAGE],
  },
  icons: {
    // Next.js App Router 會自動把 src/app/icon.png 編成 favicon。
    // 這裡再保險加上明確的 PNG 與 apple-touch-icon。
    icon: [{url: '/icon.png', type: 'image/png', sizes: '512x512'}],
    apple: [{url: '/icon.png', type: 'image/png', sizes: '512x512'}],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PhotoPoet',
  },
};

export const viewport: Viewport = {
  themeColor: '#7e22ce',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${notoSansTC.variable} antialiased`}>
        {children}
        <ServiceWorkerRegister />
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}