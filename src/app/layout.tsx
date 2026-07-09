import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import {Noto_Sans_TC} from 'next/font/google';
import {SwUpdateNotifier} from '@/components/sw-update-notifier';
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
    <html lang="zh-Hant" className="light" style={{colorScheme: 'light'}}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#fce7f3" />
        {/* ─────────────────────────────────────────────────────────── */}
        {/* 🛡️ App 內建瀏覽器防護（救 Google 登入 403 disallowed_useragent）*/}
        {/* LINE → 自動帶 openExternalBrowser=1 跳系統預設瀏覽器（保留 query+hash）*/}
        {/* FB/IG/Messenger/微信/Kakao → 顯示全版引導提示 */}
        {/* 必須放在 head 最前、早於任何 Google 登入邏輯 */}
        {/* ─────────────────────────────────────────────────────────── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var ua=navigator.userAgent||"";var isLine=/\\bLine\\//i.test(ua);var isOtherInApp=/FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|KAKAOTALK/i.test(ua);if(isLine&&location.search.indexOf("openExternalBrowser=1")===-1){var sep=location.search?"&":"?";location.replace(location.href.split("#")[0]+sep+"openExternalBrowser=1"+location.hash);return;}if(isOtherInApp||isLine){document.addEventListener("DOMContentLoaded",function(){var d=document.createElement("div");d.style.cssText="position:fixed;inset:0;z-index:99999;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,'Microsoft JhengHei',sans-serif;";d.innerHTML='<div style="max-width:420px;text-align:center;background:#1e293b;border-radius:16px;padding:32px 26px;"><div style="font-size:52px;">\\uD83C\\uDF10</div><h4 style="font-weight:800;margin:14px 0 10px;">\\u8ACB\\u6539\\u7528\\u700F\\u89BD\\u5668\\u958B\\u555F</h4><p style="font-size:15px;line-height:1.8;color:#cbd5e1;margin:0;">\\u60A8\\u76EE\\u524D\\u5728 <b style="color:#fbbf24;">App \\u5167\\u5EFA\\u700F\\u89BD\\u5668</b>\\uFF08LINE\\uFF0FFB \\u7B49\\uFF09\\u4E2D\\u958B\\u555F\\u672C\\u9801\\uFF0CGoogle \\u57FA\\u65BC\\u5B89\\u5168\\u653F\\u7B56<b>\\u7981\\u6B62\\u5728\\u6B64\\u74B0\\u5883\\u767B\\u5165</b>\\u3002<br><br>\\u8ACB\\u9EDE\\u53F3\\u4E0A\\uFF0F\\u53F3\\u4E0B\\u89D2\\u300C<b>\\u22EF</b>\\u300D\\u2192 \\u9078\\u300C<b style="color:#4ade80;">\\u7528\\u9810\\u8A2D\\u700F\\u89BD\\u5668\\u958B\\u555F</b>\\u300D\\u3002</p></div>';document.body.appendChild(d);});}})();`,
          }}
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
      <body className={`${geistSans.variable} ${geistMono.variable} ${notoSansTC.variable} antialiased`}>
        {children}
        <SwUpdateNotifier />
      </body>
    </html>
  );
}
