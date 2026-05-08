"use client";

import {useEffect, useState} from 'react';
import {QrCode, Copy, Check} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {toast} from '@/hooks/use-toast';

/**
 * 顯示當前網站 URL 的 QR code + 複製按鈕。
 *
 * 教學情境的最佳幫手：投影機顯示 QR，學生手機掃一下就進來。
 * QR 用 `qrcode` 套件 dynamic import — 只在 Dialog 開時才載入，不增加首屏 bundle。
 */
export function ShareLinkButton() {
  const [open, setOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    setShareUrl(`${window.location.origin}${basePath}/`);
  }, []);

  useEffect(() => {
    if (!open || !shareUrl) return;
    let cancelled = false;
    import('qrcode')
      .then(mod => mod.toDataURL(shareUrl, {width: 320, margin: 1, color: {dark: '#1f1f1f'}}))
      .then(url => {
        if (!cancelled) setQrSrc(url);
      })
      .catch(err => {
        console.warn('[qrcode] generate failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [open, shareUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({title: '已複製連結', description: shareUrl});
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({title: '複製失敗', description: '請手動選取連結複製。'});
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 hover:underline"
      >
        <QrCode className="h-3.5 w-3.5" />
        QR 邀請
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>📱 把 PhotoPoet 分享給別人</DialogTitle>
            <DialogDescription>掃描 QR 或複製連結，立刻開始寫詩 ✨</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrSrc ? (
              <img
                src={qrSrc}
                alt="QR Code"
                className="rounded-lg shadow border border-purple-100"
                width={320}
                height={320}
              />
            ) : (
              <div className="w-[320px] h-[320px] flex items-center justify-center text-sm text-gray-500">
                生成 QR 中…
              </div>
            )}
            <div className="text-sm text-center text-gray-700 break-all px-2 py-1 bg-purple-50 rounded">
              {shareUrl}
            </div>
            <Button onClick={handleCopy} className="w-full">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  已複製
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  複製連結
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
