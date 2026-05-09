"use client";

import {useEffect, useState} from 'react';
import {UpdateBanner} from './UpdateBanner';

/**
 * SW 註冊 + 偵測新版本 + 顯示頂部 banner（取代 toast，比較顯眼且持久）
 *
 * 流程：
 *   1. 註冊 sw.js (basePath aware)
 *   2. 監聽 updatefound + statechange
 *   3. 新 SW installed (且有舊 controller) → setShowBanner(true)
 *   4. 使用者按「立即更新」→ postMessage SKIP_WAITING → controllerchange → reload
 *   5. 使用者按 X → setShowBanner(false)，下次造訪會再偵測
 *
 * 配套：public/sw.js 不在 install 時 skipWaiting，等 message 觸發
 */
export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showBanner, setShowBanner] = useState(false);

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
          setWaitingWorker(worker);
          setShowBanner(true);
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
              promptForUpdate(installing);
            }
          });
        });
      })
      .catch(err => console.warn('[sw] register failed:', err));
  }, []);

  const handleUpdate = () => {
    if (!waitingWorker) {
      // 萬一 worker 引用遺失，直接 reload 也能拿到新版
      window.location.reload();
      return;
    }
    waitingWorker.postMessage({type: 'SKIP_WAITING'});
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      {once: true}
    );
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // 不改 SW state — 下次造訪 / reload 時會再偵測，再次顯示
  };

  // SHA 顯示用：剪短前 7 字
  const buildSha = (process.env.NEXT_PUBLIC_BUILD_SHA || '').slice(0, 7) || null;

  return (
    <UpdateBanner
      show={showBanner}
      buildSha={buildSha}
      onUpdate={handleUpdate}
      onDismiss={handleDismiss}
    />
  );
}
