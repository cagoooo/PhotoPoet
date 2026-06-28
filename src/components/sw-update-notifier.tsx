'use client';

import {useEffect, useRef, useState} from 'react';
import {RefreshCw, X} from 'lucide-react';
import {APP_VERSION} from '@/generated/app-version';

type UpdateState = {
  waitingWorker: ServiceWorker | null;
  source: 'service-worker' | 'version-check';
};

export function SwUpdateNotifier() {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    const showUpdate = (
      waitingWorker: ServiceWorker | null,
      source: UpdateState['source']
    ) => {
      setUpdateState((current) => current ?? {waitingWorker, source});
    };

    const watchWorker = (worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdate(worker, 'service-worker');
        }
      });
    };

    const registerWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none',
        });

        if (registration.waiting) {
          showUpdate(registration.waiting, 'service-worker');
        }

        if (registration.installing) {
          watchWorker(registration.installing);
        }

        registration.addEventListener('updatefound', () => {
          if (registration.installing) {
            watchWorker(registration.installing);
          }
        });

        await registration.update();
      } catch (error) {
        console.warn('[SW] 註冊失敗，網站仍可正常使用。', error);
      }
    };

    const checkVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {version?: string};
        if (data.version && data.version !== APP_VERSION) {
          showUpdate(null, 'version-check');
        }
      } catch {
        // Ignore transient network failures; the next focus/interval check will retry.
      }
    };

    const handleControllerChange = () => {
      if (reloadedRef.current) {
        return;
      }
      reloadedRef.current = true;
      window.location.reload();
    };

    const handleMessage = (event: MessageEvent) => {
      if (
        event.data?.type === 'SW_ACTIVATED' &&
        event.data.version &&
        event.data.version !== APP_VERSION
      ) {
        showUpdate(null, 'service-worker');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkVersion();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.addEventListener('message', handleMessage);
    window.addEventListener('focus', checkVersion);
    window.addEventListener('online', checkVersion);
    window.addEventListener('pageshow', checkVersion);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    void registerWorker();
    const firstCheck = window.setTimeout(checkVersion, 5000);
    const interval = window.setInterval(checkVersion, 3 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      window.removeEventListener('focus', checkVersion);
      window.removeEventListener('online', checkVersion);
      window.removeEventListener('pageshow', checkVersion);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearTimeout(firstCheck);
      window.clearInterval(interval);
    };
  }, []);

  if (!updateState) {
    return null;
  }

  const handleReload = () => {
    setIsReloading(true);

    if (updateState.waitingWorker) {
      updateState.waitingWorker.postMessage({type: 'SKIP_WAITING'});
      return;
    }

    window.location.reload();
  };

  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-4 z-50 mx-auto grid max-w-md grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-xl"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold">網站有新版本</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
          更新後可以使用最新功能與修正，建議現在重新載入。
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleReload}
          disabled={isReloading}
          className="inline-flex h-9 items-center gap-1 rounded-md bg-sky-600 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-70"
        >
          <RefreshCw className={`h-4 w-4 ${isReloading ? 'animate-spin' : ''}`} />
          更新
        </button>
        <button
          type="button"
          aria-label="稍後再說"
          onClick={() => setUpdateState(null)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
