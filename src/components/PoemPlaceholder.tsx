"use client";

import {useEffect, useRef} from 'react';

/**
 * 生詩中的詩意 loading placeholder（v2 繽紛版）：
 * - 動態紫紅藍漸層背景
 * - 16 顆彩色光點漂浮（紫粉藍金）+ 4 種獨立飄移動畫
 * - 3 圈漣漪從中央向外擴散
 * - ✨✦✧ 標題用彩虹漸層流動字
 * - 三句詩意 hint 各自不同顏色循環淡入
 * - 底部彩虹進度條流動
 *
 * Mount 時自動 scrollIntoView。
 */

const PARTICLES = Array.from({length: 16}, (_, i) => ({
  // 預先計算位置，render time 不再 random
  left: `${(i * 137) % 100}%`,
  top: `${(i * 71) % 100}%`,
  size: 4 + (i % 4) * 4,
  variant: i % 4,
  delay: i * 0.15,
  duration: 3 + (i % 5) * 0.5,
  colorClass: [
    'poem-dot-purple',
    'poem-dot-pink',
    'poem-dot-blue',
    'poem-dot-amber',
    'poem-dot-rose',
    'poem-dot-indigo',
    'poem-dot-teal',
    'poem-dot-fuchsia',
  ][i % 8],
}));

export function PoemPlaceholder() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({behavior: 'smooth', block: 'center'});
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      ref={ref}
      className="mt-2 min-h-[210px] rounded-md shadow-xl relative overflow-hidden flex flex-col items-center justify-center gap-3 py-8"
    >
      {/* 動態紫紅藍漸層底 */}
      <div className="absolute inset-0 poem-bg" />

      {/* 散落彩色光點 */}
      <div className="absolute inset-0 pointer-events-none">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`absolute rounded-full ${p.colorClass} poem-float-${p.variant}`}
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {/* 漣漪三圈 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="poem-ripple" />
        <div className="poem-ripple" style={{animationDelay: '1s'}} />
        <div className="poem-ripple" style={{animationDelay: '2s'}} />
      </div>

      {/* 中央內容 */}
      <div className="relative z-10 flex flex-col items-center gap-3 text-white">
        <div className="text-3xl tracking-widest poem-shimmer-text font-bold">
          ✨ ✦ ✧ ✨
        </div>
        <div className="text-base font-bold text-white/95 tracking-wider drop-shadow">
          詩意醞釀中…
        </div>
        <div className="flex flex-col gap-1.5 items-center text-sm sm:text-base">
          <span className="poem-hint poem-hint-amber">— ✨ 筆鋒未動 ✨ —</span>
          <span className="poem-hint poem-hint-pink">— 🌸 墨香先到 🌸 —</span>
          <span className="poem-hint poem-hint-blue">— 🍃 字句翩翩 🍃 —</span>
        </div>
      </div>

      {/* 底部彩虹進度條 */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 poem-rainbow-bar" />

      <style jsx>{`
        .poem-bg {
          background: linear-gradient(135deg, #4c1d95, #831843, #1e3a8a, #4c1d95, #6d28d9, #be185d);
          background-size: 400% 400%;
          animation: poem-bg-shift 9s ease infinite;
        }
        @keyframes poem-bg-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* 8 種光點顏色 */
        .poem-dot-purple   { background: rgba(167, 139, 250, 0.6); box-shadow: 0 0 8px rgba(167, 139, 250, 0.5); }
        .poem-dot-pink     { background: rgba(244, 114, 182, 0.6); box-shadow: 0 0 8px rgba(244, 114, 182, 0.5); }
        .poem-dot-blue     { background: rgba(96, 165, 250, 0.6);  box-shadow: 0 0 8px rgba(96, 165, 250, 0.5); }
        .poem-dot-amber    { background: rgba(252, 211, 77, 0.7);  box-shadow: 0 0 10px rgba(252, 211, 77, 0.6); }
        .poem-dot-rose     { background: rgba(251, 113, 133, 0.6); box-shadow: 0 0 8px rgba(251, 113, 133, 0.5); }
        .poem-dot-indigo   { background: rgba(129, 140, 248, 0.6); box-shadow: 0 0 8px rgba(129, 140, 248, 0.5); }
        .poem-dot-teal     { background: rgba(94, 234, 212, 0.6);  box-shadow: 0 0 8px rgba(94, 234, 212, 0.5); }
        .poem-dot-fuchsia  { background: rgba(232, 121, 249, 0.6); box-shadow: 0 0 8px rgba(232, 121, 249, 0.5); }

        /* 4 種飄移動畫 */
        .poem-float-0 { animation: poem-float-0 ease-in-out infinite; }
        .poem-float-1 { animation: poem-float-1 ease-in-out infinite; }
        .poem-float-2 { animation: poem-float-2 ease-in-out infinite; }
        .poem-float-3 { animation: poem-float-3 ease-in-out infinite; }
        @keyframes poem-float-0 {
          0%, 100% { opacity: 0.15; transform: translate(0, 0) scale(0.7); }
          50%      { opacity: 0.95; transform: translate(12px, -16px) scale(1.6); }
        }
        @keyframes poem-float-1 {
          0%, 100% { opacity: 0.2; transform: translate(0, 0) scale(0.8); }
          50%      { opacity: 1;   transform: translate(-14px, -10px) scale(1.4); }
        }
        @keyframes poem-float-2 {
          0%, 100% { opacity: 0.2; transform: translate(0, 0) scale(0.6); }
          50%      { opacity: 0.9; transform: translate(10px, 14px) scale(1.5); }
        }
        @keyframes poem-float-3 {
          0%, 100% { opacity: 0.3; transform: translate(0, 0) scale(0.9); }
          50%      { opacity: 1;   transform: translate(-10px, -16px) scale(1.7); }
        }

        /* 漣漪 */
        .poem-ripple {
          position: absolute;
          width: 100px; height: 100px;
          border: 2px solid rgba(255, 255, 255, 0.45);
          border-radius: 50%;
          animation: poem-ripple-anim 3s ease-out infinite;
        }
        @keyframes poem-ripple-anim {
          0%   { transform: scale(0.4); opacity: 0.85; border-color: rgba(244, 114, 182, 0.6); }
          50%  { border-color: rgba(167, 139, 250, 0.4); }
          100% { transform: scale(4.5); opacity: 0; border-color: rgba(96, 165, 250, 0); }
        }

        /* 標題彩虹文字 */
        .poem-shimmer-text {
          background: linear-gradient(90deg, #fbbf24, #f472b6, #a5b4fc, #34d399, #f87171, #fbbf24);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: poem-shimmer 3.5s linear infinite;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        }
        @keyframes poem-shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        /* 詩意 hint 三句 */
        .poem-hint {
          animation: poem-hint-anim 2.4s ease-in-out infinite;
          opacity: 0;
          font-weight: 500;
          letter-spacing: 0.5pt;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        .poem-hint-amber { color: #fde68a; animation-delay: 0s; }
        .poem-hint-pink  { color: #fbcfe8; animation-delay: 0.6s; }
        .poem-hint-blue  { color: #bfdbfe; animation-delay: 1.2s; }
        @keyframes poem-hint-anim {
          0%, 100% { opacity: 0.15; transform: translateY(3px); }
          25%      { opacity: 1;    transform: translateY(0); }
          50%      { opacity: 1;    transform: translateY(0); }
        }

        /* 底部彩虹進度條 */
        .poem-rainbow-bar {
          background: linear-gradient(90deg,
            #ef4444, #f59e0b, #eab308, #22c55e,
            #06b6d4, #6366f1, #a855f7, #ec4899, #ef4444);
          background-size: 200% 100%;
          animation: poem-rainbow-flow 2s linear infinite;
        }
        @keyframes poem-rainbow-flow {
          0%   { background-position: 0% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
