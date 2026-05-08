"use client";

import {useEffect} from 'react';
import {toast} from '@/hooks/use-toast';
import {Button} from '@/components/ui/button';
import {RefreshCcw} from 'lucide-react';

/**
 * 1. 註冊 SW（root: Firebase Hosting / subpath: GitHub Pages 都 work）
 * 2. 偵測新版本 → toast 提示「點此載入新版」（V2-5）
 *
 * 注意配套：public/sw.js 不再 install 階段就 skipWaiting，等使用者按 toast
 * 才 postMessage SKIP_WAITING + reload，避免使用者頁面正在用舊 cache 時
 * 被新 SW 突襲取代。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const swUrl = `${basePath}/sw.js`;
    const scope = `${basePath}/`;

    navigator.serviceWorker
      .register(swUrl, {scope})
      .then(reg => {
        const promptForUpdate = (worker: ServiceWorker) => {
          toast({
            title: '✨ 有新版可用',
            description: '點選「重新載入」取得最新功能與修正',
            action: (
              <Button
                size="sm"
                onClick={() => {
                  worker.postMessage({type: 'SKIP_WAITING'});
                  // 等 controllerchange 觸發後 reload，避免太早 reload 拿到舊版
                  navigator.serviceWorker.addEventListener(
                    'controllerchange',
                    () => window.location.reload(),
                    {once: true}
                  );
                }}
              >
                <RefreshCcw className="h-4 w-4 mr-1" />
                重新載入
              </Button>
            ),
            duration: 60_000, // 給使用者 1 分鐘決定
          });
        };

        // 1) 已有 waiting worker（重新整理後遇到上次未升的版本）
        if (reg.waiting && navigator.serviceWorker.controller) {
          promptForUpdate(reg.waiting);
        }

        // 2) 新 worker 正在 install 中
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // 已有 active worker + 新 worker 已 installed = 真的有更新
              promptForUpdate(installing);
            }
          });
        });
      })
      .catch(err => console.warn('[sw] register failed:', err));
  }, []);

  return null;
}
