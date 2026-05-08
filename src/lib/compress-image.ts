/**
 * Resize + JPEG-encode an image client-side.
 *
 * Why:
 *   - 減少 quota 流量（原圖 4-8 MB → 壓縮 100-300 KB）
 *   - 加速 Gemini 處理（小圖更快）
 *   - 副作用：canvas 重繪會自動 strip EXIF（GPS 位置、相機 serial 等隱私）
 *
 * 注意：對極小或極大圖都安全（scale 自動 cap 在 1）。
 */
export async function compressImage(
  input: Blob | File,
  maxDim = 1024,
  quality = 0.85
): Promise<string> {
  // createImageBitmap 比 Image.onload 快，且支援 OffscreenCanvas friendly
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(input);
  } catch (err) {
    // Safari / 舊瀏覽器 fallback：用 <img> + dataURL
    return await fallbackResize(input, maxDim, quality);
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('無法建立畫布以壓縮圖片');
  }

  // 白底（PNG 透明背景在轉 JPEG 時會變黑）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', quality);
}

async function fallbackResize(input: Blob | File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('無法建立畫布以壓縮圖片'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('無法載入圖片'));
    };
    img.src = url;
  });
}
