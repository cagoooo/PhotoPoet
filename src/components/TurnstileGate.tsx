"use client";

import {useEffect, useRef} from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: string | HTMLElement, opts: TurnstileRenderOpts) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface TurnstileRenderOpts {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

interface TurnstileGateProps {
  onToken: (token: string) => void;
  resetSignal?: number;
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function TurnstileGate({onToken, resetSignal}: TurnstileGateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY) {
      // Turnstile 未啟用 → 直接回空 token；後端 fail-open 會放行。
      onTokenRef.current('');
      return;
    }

    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const tryRender = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return false;
      if (widgetIdRef.current) return true;
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme: 'dark',
          size: 'flexible',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
        return true;
      } catch (e) {
        console.warn('[TurnstileGate] render failed:', e);
        return false;
      }
    };

    if (!tryRender()) {
      pollId = setInterval(() => {
        if (tryRender() && pollId) {
          clearInterval(pollId);
          pollId = null;
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (resetSignal === undefined || resetSignal === 0) return;
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {}
    }
  }, [resetSignal]);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className="my-2 flex justify-center" />;
}
