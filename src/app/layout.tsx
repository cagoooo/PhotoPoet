import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import {Noto_Sans_TC} from 'next/font/google';
import './globals.css';

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

export const metadata: Metadata = {
  title: '點亮詩意~『早安長輩圖產生器』',
  description: '產出超實用長輩圖！',
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
      <body className={`${geistSans.variable} ${geistMono.variable} ${notoSansTC.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}