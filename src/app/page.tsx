'use client';

import {useState, useCallback, useRef, useEffect} from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {toast} from '@/hooks/use-toast';
import {useRouter} from 'next/navigation';
import Image from 'next/image';
import {Check, Download} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

type ExportLayout = 'sideBySide' | 'igStory' | 'wallpaper' | 'postcard' | 'overlay';

const PAPER = '#f5eddd';
const INK = '#4b3a2b';
const SEAL = '#c0392b';
const LINE = '#d8c7a8';
const POEM_COLORS = [
  '#ef5350',
  '#f48fb1',
  '#7e57c2',
  '#2196f3',
  '#26a69a',
  '#43a047',
  '#D97706',
  '#f9a825',
];

const loadImage = async (src: string) => {
  const image = new window.Image();
  image.src = src;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load image'));
  });
  return image;
};

const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
};

const drawImageContain = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) => {
  const wrapped: string[] = [];
  text.split('\n').forEach((rawLine) => {
    const chars = Array.from(rawLine.trim());
    let line = '';
    chars.forEach((char) => {
      const next = line + char;
      if (line && ctx.measureText(next).width > maxWidth) {
        wrapped.push(line);
        line = char;
      } else {
        line = next;
      }
    });
    wrapped.push(line);
  });
  return wrapped.filter(Boolean);
};

const fitPoem = (
  ctx: CanvasRenderingContext2D,
  poem: string,
  maxWidth: number,
  maxHeight: number,
  maxFontSize: number,
  minFontSize: number
) => {
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    ctx.font = `${fontSize}px "Noto Serif TC", "PingFang TC", "Microsoft JhengHei", serif`;
    const lines = wrapText(ctx, poem, maxWidth);
    const lineHeight = fontSize * 1.55;
    if (lines.length * lineHeight <= maxHeight && lines.every((line) => ctx.measureText(line).width <= maxWidth)) {
      return {fontSize, lineHeight, lines};
    }
  }

  const fontSize = minFontSize;
  ctx.font = `${fontSize}px "Noto Serif TC", "PingFang TC", "Microsoft JhengHei", serif`;
  return {fontSize, lineHeight: fontSize * 1.55, lines: wrapText(ctx, poem, maxWidth)};
};

const drawPoemBlock = (
  ctx: CanvasRenderingContext2D,
  poem: string,
  box: {x: number; y: number; width: number; height: number},
  options: {maxFontSize: number; minFontSize: number; align?: CanvasTextAlign; seal?: boolean}
) => {
  const padding = Math.min(box.width, box.height) * 0.08;
  const textWidth = box.width - padding * 2 - (options.seal ? 84 : 0);
  const textHeight = box.height - padding * 2;
  const fitted = fitPoem(ctx, poem, textWidth, textHeight, options.maxFontSize, options.minFontSize);
  const totalHeight = fitted.lines.length * fitted.lineHeight;
  const startY = box.y + (box.height - totalHeight) / 2 + fitted.fontSize * 0.86;
  const align = options.align ?? 'center';
  const textX = align === 'left'
    ? box.x + padding
    : align === 'right'
      ? box.x + box.width - padding - (options.seal ? 84 : 0)
      : box.x + box.width / 2 - (options.seal ? 34 : 0);

  ctx.save();
  ctx.font = `${fitted.fontSize}px "Noto Serif TC", "PingFang TC", "Microsoft JhengHei", serif`;
  ctx.fillStyle = INK;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  fitted.lines.forEach((line, index) => {
    ctx.fillText(line, textX, startY + index * fitted.lineHeight);
  });

  if (options.seal) {
    const sealSize = Math.max(44, Math.min(64, box.width * 0.055));
    ctx.fillStyle = SEAL;
    ctx.fillRect(box.x + box.width - padding - sealSize, box.y + box.height - padding - sealSize, sealSize, sealSize);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${sealSize * 0.56}px "Microsoft JhengHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('詩', box.x + box.width - padding - sealSize / 2, box.y + box.height - padding - sealSize / 2);
  }
  ctx.restore();
};

const drawPoemHeader = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1
) => {
  ctx.save();
  ctx.fillStyle = '#9a3a25';
  ctx.beginPath();
  ctx.arc(x, y, 9 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b5a48';
  ctx.font = `${15 * scale}px "Microsoft JhengHei", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('點亮詩意', x + 20 * scale, y);
  ctx.restore();
};

export default function Home() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [poem, setPoem] = useState<string>('');
  const [url, setUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [activeExport, setActiveExport] = useState<ExportLayout | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const poemRef = useRef<HTMLDivElement>(null);

    const isMobile = useIsMobile();

    useEffect(() => {
        // Check if running in a mobile environment and if the Line browser is detected
        if (navigator.userAgent.indexOf('Line') > -1 && window.location.search.indexOf('openExternalBrowser=1') === -1) {
            // Redirect to the same URL with the "openExternalBrowser=1" parameter
            window.location.href = window.location.href + '?openExternalBrowser=1';
        }

        //Forcing viewport scale to fix WebView rendering issues
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
        } else {
            const newViewportMeta = document.createElement('meta');
            newViewportMeta.name = 'viewport';
            newViewportMeta.content = 'width=device-width, initial-scale=1.0';
            document.head.appendChild(newViewportMeta);
        }

    }, []);

  useEffect(() => {
    console.log('useEffect triggered, poem:', poem, 'poemRef.current:', poemRef.current);
    if (poem && poemRef.current) {
      console.log('Scrolling into view...');
      poemRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      console.log('Scrolled into view');
    } else if (poem && !poemRef.current) {
      console.log('poemRef.current is null but poem is set!');
    }
  }, [poem]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPhoto(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!photo) {
      toast({
        title: '錯誤！',
        description: '請先上傳一張照片。',
      });
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ photo }),
      });

      if (!response.ok) {
        let errorMessage = `產生失敗，狀態碼：${response.status}`;
        try {
          const errorBody = await response.json();
          if (errorBody && errorBody.error) {
            errorMessage = errorBody.error;
          }
        } catch (e) {
          // The response body is not JSON or is unreadable, use the default error message
        }
        if (response.status === 404) {
          errorMessage = '生成失敗！找不到產生詩詞的API，請稍後再試。';
        } else if (response.status === 429) {
          errorMessage = '已達本小時產生上限。為了避免 AI API 額度被快速耗盡，每位使用者每小時最多可產生 5 次，請稍後再試。';
        } else if (response.status === 503) {
          errorMessage = 'AI模型目前過載，請稍後再試。';
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setPoem(data.poem);

      if (poemRef.current) {
        toast({
          title: '產生成功！',
          description: '靈感之詩翩然降臨，請往下滑動檢視',
        });
      }

    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: '生成失敗！',
        description: error.message || '無法生成詩詞，請稍後再試。',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleURLSubmission = useCallback(async () => {
    if (!url) {
      toast({
        title: '錯誤！',
        description: '請輸入照片網址。',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);

      if (!response.ok) {
        let errorMessage = `HTTP 錯誤！狀態碼: ${response.status}`;
        if (response.status === 404) {
          errorMessage = '讀取圖片失敗！找不到該圖片網址。';
        } else {
          try {
            const errorBody = await response.json();
            if (errorBody && errorBody.error) {
              errorMessage = `讀取圖片失敗！${errorBody.error}`;
            } else {
              errorMessage = `讀取圖片失敗！未知錯誤。`;
            }
          } catch (e) {
            errorMessage = `讀取圖片失敗！無法解析錯誤訊息。`;
          }
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPhoto(base64String);
      };
      reader.readAsDataURL(blob);
    } catch (error: any) {
      console.error('Error fetching image:', error);
      toast({
        title: '圖片讀取失敗！',
        description: error.message || '無法從提供的網址讀取圖片。請檢查網址是否正確。',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [url, router]);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

    const generateExportImageDataUrl = useCallback(async (layout: ExportLayout) => {
        if (!photo || !poem) {
            toast({
                title: '錯誤！',
                description: '請先上傳照片並生成詩詞。',
            });
            return null;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            toast({
                title: '錯誤！',
                description: '無法建立畫布。',
            });
            return null;
        }

        const image = await loadImage(photo);

        if (layout === 'sideBySide') {
            canvas.width = 1200;
            canvas.height = 600;
            ctx.fillStyle = PAPER;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawImageCover(ctx, image, 0, 0, 600, 600);
            drawPoemHeader(ctx, 646, 52, 1);
            drawPoemBlock(ctx, poem, {x: 620, y: 110, width: 540, height: 350}, {maxFontSize: 48, minFontSize: 24, seal: true});
            ctx.strokeStyle = LINE;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(680, 540);
            ctx.lineTo(1140, 540);
            ctx.stroke();
            return canvas.toDataURL('image/png');
        }

        if (layout === 'igStory') {
            canvas.width = 1080;
            canvas.height = 1920;
            ctx.fillStyle = PAPER;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawImageCover(ctx, image, 0, 0, canvas.width, 980);
            const fade = ctx.createLinearGradient(0, 830, 0, 1080);
            fade.addColorStop(0, 'rgba(245,237,221,0)');
            fade.addColorStop(1, PAPER);
            ctx.fillStyle = fade;
            ctx.fillRect(0, 830, canvas.width, 250);
            drawPoemBlock(ctx, poem, {x: 90, y: 1080, width: 900, height: 520}, {maxFontSize: 58, minFontSize: 30, seal: true});
            ctx.strokeStyle = LINE;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(260, 1730);
            ctx.lineTo(820, 1730);
            ctx.stroke();
            ctx.fillStyle = '#8f806f';
            ctx.font = '22px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText('by night, a verse', 540, 1782);
            return canvas.toDataURL('image/png');
        }

        if (layout === 'wallpaper') {
            canvas.width = 1920;
            canvas.height = 1080;
            drawImageCover(ctx, image, 0, 0, canvas.width, canvas.height);
            const card = {x: 980, y: 670, width: 820, height: 300};
            ctx.fillStyle = 'rgba(245, 237, 221, 0.88)';
            ctx.beginPath();
            ctx.roundRect(card.x, card.y, card.width, card.height, 18);
            ctx.fill();
            ctx.strokeStyle = 'rgba(174, 126, 67, 0.65)';
            ctx.lineWidth = 2;
            ctx.stroke();
            drawPoemHeader(ctx, card.x + 58, card.y + 46, 1.05);
            drawPoemBlock(ctx, poem, {x: card.x + 42, y: card.y + 68, width: card.width - 84, height: card.height - 92}, {maxFontSize: 40, minFontSize: 24, seal: true});
            return canvas.toDataURL('image/png');
        }

        if (layout === 'postcard') {
            canvas.width = 1200;
            canvas.height = 1600;
            ctx.fillStyle = PAPER;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = LINE;
            ctx.lineWidth = 3;
            ctx.strokeRect(58, 58, canvas.width - 116, canvas.height - 116);
            ctx.strokeRect(70, 70, canvas.width - 140, canvas.height - 140);
            drawPoemHeader(ctx, 520, 95, 1.15);
            ctx.fillStyle = '#8f806f';
            ctx.font = '22px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText('a verse for you', 600, 142);
            const imageBox = {x: 110, y: 190, width: 980, height: 680};
            ctx.fillStyle = '#fffaf0';
            ctx.fillRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height);
            drawImageContain(ctx, image, imageBox.x, imageBox.y, imageBox.width, imageBox.height);
            ctx.strokeStyle = LINE;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(180, 980);
            ctx.lineTo(1020, 980);
            ctx.stroke();
            drawPoemBlock(ctx, poem, {x: 130, y: 1030, width: 940, height: 360}, {maxFontSize: 48, minFontSize: 28});
            return canvas.toDataURL('image/png');
        }

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const fontSize = Math.max(20, Math.min(canvas.width / 18, canvas.height / 18));
        ctx.font = `bold ${fontSize}px "Microsoft JhengHei", sans-serif`;
        const lines = wrapText(ctx, poem, canvas.width * 0.74);
        const lineHeight = fontSize * 1.25;
        let y = canvas.height - Math.max(16, canvas.height * 0.025);

        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = isMobile ? 12 : 8;
        ctx.strokeStyle = 'white';

        for (let i = lines.length - 1; i >= 0; i--) {
            ctx.fillStyle = POEM_COLORS[i % POEM_COLORS.length];
            ctx.strokeText(lines[i], canvas.width - Math.max(16, canvas.width * 0.025), y);
            ctx.fillText(lines[i], canvas.width - Math.max(16, canvas.width * 0.025), y);
            y -= lineHeight;
        }

        return canvas.toDataURL('image/jpeg', isMobile ? 0.78 : 0.92);
    }, [photo, poem, isMobile]);

    const handleExport = useCallback(async (layout: ExportLayout, filename: string) => {
        setActiveExport(layout);
        try {
            const dataURL = await generateExportImageDataUrl(layout);
            if (dataURL) {
                const link = document.createElement('a');
                link.href = dataURL;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({
                    title: '下載成功！',
                    description: '版型已重新排好並下載。',
                });
            }
        } catch (error: any) {
            console.error('Error creating export image:', error);
            toast({
                title: '錯誤！',
                description: '產出圖片失敗。',
            });
        } finally {
            setActiveExport(null);
        }
    }, [generateExportImageDataUrl]);

    const handleShare = useCallback(async () => {
        if (!navigator.share) {
            toast({
                title: '分享失敗！',
                description: '分享功能僅支援行動裝置瀏覽器。',
            });
            return;
        }

        setActiveExport('overlay');
        try {
            const dataURL = await generateExportImageDataUrl('overlay');
            if (dataURL) {
                const blob = await (await fetch(dataURL)).blob();
                const file = new File([blob], 'poem_image.png', {type: 'image/png'});
                await navigator.share({
                    files: [file],
                    title: '我的AI詩詞圖片',
                });
                toast({ title: '分享成功！', description: '圖片已成功分享！' });
            }
        } catch (error) {
            toast({ title: '分享失敗！', description: '分享圖片時發生錯誤。' });
        } finally { setActiveExport(null); }
    }, [generateExportImageDataUrl]);

  const handleCopy = () => {
    if (poemRef.current) {
      const poemText = poemRef.current.innerText;
      navigator.clipboard.writeText(poemText)
        .then(() => {
          setIsCopied(true);
          toast({
            title: '已複製！',
            description: '完整詩句已複製到剪貼簿。',
          });
          setTimeout(() => {
            setIsCopied(false);
          }, 2000);
        })
        .catch(err => {
          console.error("無法複製詩句: ", err);
          toast({
            title: '複製失敗！',
            description: '無法複製詩句到剪貼簿，請稍後再試。',
          });
        });
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen py-12 bg-gradient-to-br from-sky-100 to-pink-100">
      <Card className="w-full max-w-md rounded-lg border shadow-md overflow-hidden bg-white/80 backdrop-blur-sm">
        <CardHeader className="p-6 text-center bg-gradient-to-br from-purple-700 to-pink-700 text-white shadow-md">
          <h1 className="rainbow-text text-3xl font-extrabold tracking-tight mb-2 drop-shadow-md">
            ✨ 點亮詩意，照亮靈感 ✨
          </h1>
          <CardDescription className="text-md text-gray-200 drop-shadow-md">
            上傳一張照片，<br/>
            讓 AI 為你創作一首繁體中文詩詞，<br/>
            分享您照片的詩意。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="upload" className="block text-sm font-medium text-gray-700">
                上傳你的照片：
              </label>
              <Button
                variant="upload"
                className="mt-1 w-full"
                onClick={handleUploadClick}
              >
                選擇照片
              </Button>
              <Input
                type="file"
                id="upload"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                ref={fileInputRef}
              />
            </div>
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                或提交照片網址：
              </label>
              <div className="flex mt-1 rounded-md shadow-sm">
                <Input
                  type="url"
                  id="url"
                  placeholder="請輸入圖片網址"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="rounded-r-none"
                />
                <Button
                  type="button"
                  onClick={handleURLSubmission}
                  disabled={isGenerating}
                  className="rounded-l-none bg-indigo-500 text-white hover:bg-indigo-600 transition-colors duration-300 transform hover:scale-105"
                >
                  讀取圖片
                </Button>
              </div>
            </div>
            {photo && (
              <div className="flex justify-center items-center rounded-md border border-muted overflow-hidden" style={{ height: '300px' }}>
                <Image
                  src={photo}
                  alt="Uploaded"
                  width={500}
                  height={500}
                  style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                />
              </div>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!photo || isGenerating}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded transform transition-transform duration-300 hover:scale-105 shadow-md text-lg"
            >
              {isGenerating ? '詠唱中...' : '生成詩詞'}
            </Button>
            <p className="text-xs leading-relaxed text-slate-600">
              為了讓大家都能穩定使用，AI 產生功能每位使用者每小時最多 5 次。請在真的要使用作品時再生成，避免連續測試耗盡 API 額度。
            </p>
            {poem && (
              <div className="mt-4">
                <h2 className="text-2xl font-semibold tracking-tight mt-4 text-center text-purple-700 drop-shadow-md">
                  ✨ 靈感之詩，翩然降臨 ✨
                </h2>
                <div className="mt-2 min-h-[150px] rounded-md shadow-sm resize-none poem-text" style={{ backgroundColor: '#222', color: '#fff', fontSize: '1.5em' }} ref={poemRef}>
                  {poem.split('\n').map((line, index) => {
                    const poemColors = [
                        '#ef5350', // Red
                        '#f48fb1', // Pink
                        '#7e57c2', // Purple
                        '#2196f3', // Blue
                        '#26a69a', // Teal
                        '#43a047', // Green
                        '#eeff41', // Yellow
                        '#f9a825', // Amber',
                    ]; return (<span key={index} className="poem-line" style={{ color: poemColors[index % poemColors.length], display: 'block' }}>{line}</span>);
})}
                </div>
                <div className="flex flex-col gap-2 mt-4">
                  <Button variant="lightgreen" className="w-full" onClick={handleCopy} disabled={!poem}>
                    {isCopied ? (
                      <>
                        已複製 <Check className="ml-2 h-4 w-4" />
                      </>
                    ) : (
 '複製完整詩句'
                    )}
                  </Button>
                  <Button
                    variant="lightblue"
                    className="w-full"
                    onClick={() => handleExport('sideBySide', 'photopoet-side-by-side.png')}
                    disabled={!poem || activeExport !== null}
                  >
                    {activeExport === 'sideBySide' ? '下載中...' : '下載圖左詩右'}
                    <Download className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="lightblue"
                    className="w-full"
                    onClick={() => handleExport('igStory', 'photopoet-ig-9x16.png')}
                    disabled={!poem || activeExport !== null}
                  >
                    {activeExport === 'igStory' ? '下載中...' : '下載 IG 9:16'}
                    <Download className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="lightblue"
                    className="w-full"
                    onClick={() => handleExport('wallpaper', 'photopoet-wallpaper-16x9.png')}
                    disabled={!poem || activeExport !== null}
                  >
                    {activeExport === 'wallpaper' ? '下載中...' : '下載桌布 16:9'}
                    <Download className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="lightblue"
                    className="w-full"
                    onClick={() => handleExport('postcard', 'photopoet-postcard.png')}
                    disabled={!poem || activeExport !== null}
                  >
                    {activeExport === 'postcard' ? '下載中...' : '下載明信片'}
                    <Download className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="gradient"
                    style={{ '--gradient-start': '#a78bfa', '--gradient-end': '#f472b6' } as React.CSSProperties}
                    className="w-full"
                    onClick={() => handleExport('overlay', 'photopoet-overlay.png')}
                    disabled={!poem || activeExport !== null}
                  >
                    {activeExport === 'overlay' ? '下載中...請稍待片刻' : '下載照片嵌詩'}
                    <Download className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="gradient"
                  style={{ '--gradient-start': '#f472b6', '--gradient-end': '#f472b6' } as React.CSSProperties} // Pink to Pink gradient
                  className="w-full mt-2" // Add margin top for spacing
                  onClick={handleShare} // Assuming this button also triggers embedding or sharing
                  disabled={!poem || activeExport !== null} // Disable if no poem is generated
                >
                  一鍵分享長輩圖(僅支援手機端)😊
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
