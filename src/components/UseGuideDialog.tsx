"use client";

import {useEffect} from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';

const SEEN_KEY = 'photopoet_guide_seen_v1';

interface UseGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UseGuideDialog({open, onOpenChange}: UseGuideDialogProps) {
  // 第一次開啟自動彈出（只彈一次，靠 localStorage 記住）
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const seen = window.localStorage.getItem(SEEN_KEY);
      if (!seen) {
        // 等使用者載入 UI 完成後才彈，比較不嚇人
        const t = setTimeout(() => onOpenChange(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      /* 隱私模式可能 throw，忽略 */
    }
  }, [onOpenChange]);

  const handleClose = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {}
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">📖 PhotoPoet Pro 使用指南</DialogTitle>
          <DialogDescription>
            5 個步驟，把照片變成詩文 ✨（升級版含多風格 / 雲端歷史 / 詩文牆）
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 text-sm text-gray-700 my-2">
          <li className="flex gap-3">
            <span className="font-bold text-purple-600 shrink-0">1.</span>
            <span>
              <span className="font-semibold">登入 Google 帳號</span> — 用來計算每日生詩額度（每人每日 20 首）。
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-purple-600 shrink-0">2.</span>
            <span>
              <span className="font-semibold">上傳照片</span>（從手機相簿選），或<span className="font-semibold">貼圖片網址</span>讓系統幫你抓。
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-purple-600 shrink-0">3.</span>
            <span>
              <span className="font-semibold">選詩文風格</span>：現代詩、七言絕句、五言絕句、俳句、台語白話、早安問候語。
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-purple-600 shrink-0">4.</span>
            <span>
              點 <span className="font-semibold">「生成詩詞」</span> 等 3-5 秒。不滿意？按 <span className="font-semibold">「✨ 換一首」</span> 同照片再生（消耗 1 次額度）。
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-purple-600 shrink-0">5.</span>
            <span>
              詩生出來後可<span className="font-semibold">複製文字</span>、<span className="font-semibold">下載長輩圖</span>、<span className="font-semibold">手機一鍵分享</span>。歷史紀錄在右上角「📜 我的詩」。
            </span>
          </li>
        </ol>

        <div className="rounded-md bg-purple-50 border border-purple-200 px-3 py-2 text-xs text-purple-900">
          💡 提示：每張照片用不同風格各生一次，比較看看哪種最有感覺！
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            開始使用 ✨
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
