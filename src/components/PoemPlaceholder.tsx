"use client";

/**
 * 生詩中的詩意 loading placeholder：
 * 模擬詩文逐行浮現 + 光點漂浮，比單純 spinner 貼合主題。
 */
export function PoemPlaceholder() {
  return (
    <div className="mt-2 min-h-[150px] rounded-md shadow-sm relative overflow-hidden flex flex-col items-center justify-center gap-3 py-6"
      style={{ backgroundColor: '#222', color: '#fff' }}>
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white/30"
            style={{
              left: `${(i * 137) % 100}%`,
              top: `${(i * 71) % 100}%`,
              width: `${4 + (i % 3) * 3}px`,
              height: `${4 + (i % 3) * 3}px`,
              animation: `poem-twinkle ${2 + (i % 3) * 0.5}s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <div className="text-2xl tracking-widest text-purple-200 animate-pulse">✦ ✦ ✦</div>
      <div className="text-sm text-gray-300 tracking-wider">詩意醞釀中…</div>
      <div className="flex flex-col gap-1.5 items-center text-base text-gray-400">
        <span style={{ animation: 'poem-fadeline 2.4s ease-in-out 0s infinite' }}>—　筆鋒未動　—</span>
        <span style={{ animation: 'poem-fadeline 2.4s ease-in-out 0.6s infinite' }}>—　墨香先到　—</span>
        <span style={{ animation: 'poem-fadeline 2.4s ease-in-out 1.2s infinite' }}>—　字句翩翩　—</span>
      </div>
      <style jsx>{`
        @keyframes poem-twinkle {
          0%, 100% { opacity: 0.1; transform: scale(0.8); }
          50% { opacity: 0.85; transform: scale(1.4); }
        }
        @keyframes poem-fadeline {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
