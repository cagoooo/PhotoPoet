"use client";

import {useEffect, useState} from 'react';
import {Volume2, VolumeX} from 'lucide-react';
import {Button} from '@/components/ui/button';

interface PoemTTSButtonProps {
  poem: string;
  className?: string;
}

/**
 * 用 Web Speech API 朗讀詩文（裝置內建 TTS，0 token 成本）。
 *
 * iOS Safari 限制：必須在 user gesture 內觸發 — 由按鈕 click handler 直接呼叫
 * 即可，這裡已滿足。
 */
export function PoemTTSButton({poem, className}: PoemTTSButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggle = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!poem) return;
    const u = new SpeechSynthesisUtterance(poem);
    u.lang = 'zh-TW';
    u.rate = 0.85;
    u.pitch = 1.0;
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
    setIsSpeaking(true);
  };

  if (!supported) return null;

  return (
    <Button
      variant="outline"
      className={`w-full border-amber-300 text-amber-700 hover:bg-amber-50 ${className ?? ''}`}
      onClick={handleToggle}
      disabled={!poem}
    >
      {isSpeaking ? (
        <>
          <VolumeX className="mr-2 h-4 w-4" />
          停止朗讀
        </>
      ) : (
        <>
          <Volume2 className="mr-2 h-4 w-4" />
          🔊 朗讀詩句
        </>
      )}
    </Button>
  );
}
