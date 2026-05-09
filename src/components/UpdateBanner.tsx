"use client";

import {RefreshCcw, X, Sparkles} from 'lucide-react';

interface UpdateBannerProps {
  show: boolean;
  buildSha?: string | null;
  onUpdate: () => void;
  onDismiss: () => void;
}

/**
 * 頂部固定漸層 banner — 偵測到新版 SW 時顯示。
 * 比 toast 持久（不會自動消失），且色彩醒目。
 */
export function UpdateBanner({show, buildSha, onUpdate, onDismiss}: UpdateBannerProps) {
  if (!show) return null;
  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white shadow-lg animate-slide-down"
    >
      <div className="max-w-2xl mx-auto px-3 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-200 shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm sm:text-base leading-tight">
            ✨ PhotoPoet Pro 有新版了！
          </div>
          <div className="text-xs text-white/90 leading-tight mt-0.5">
            更新內容已下載完成{buildSha ? ` · 版本 ${buildSha}` : ''}，點此立即套用。
          </div>
        </div>
        <button
          onClick={onUpdate}
          className="shrink-0 bg-white text-purple-700 hover:bg-yellow-50 active:scale-95 transition font-bold px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm shadow inline-flex items-center gap-1"
        >
          <RefreshCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          立即更新
        </button>
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 hover:bg-white/20 rounded-full transition"
          aria-label="稍後再說"
          title="稍後再說"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
