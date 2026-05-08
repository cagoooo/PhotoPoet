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
import {Textarea} from '@/components/ui/textarea';
import {toast} from '@/hooks/use-toast';
import {useRouter} from 'next/navigation';
import Image from 'next/image';
import {cn} from '@/lib/utils';
import {Check, Download, Sparkles, BookOpen, History, RefreshCcw} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/use-mobile';
import { TurnstileGate } from '@/components/TurnstileGate';
import { AuthBar } from '@/components/AuthBar';
import { useAuth } from '@/hooks/useAuth';
import { UseGuideDialog } from '@/components/UseGuideDialog';
import { SiteFooter } from '@/components/SiteFooter';
import { PoemPlaceholder } from '@/components/PoemPlaceholder';

const POEM_STYLE_OPTIONS = [
  { value: 'modern', label: '🌸 現代詩' },
  { value: 'seven-jueju', label: '🏯 七言絕句' },
  { value: 'five-jueju', label: '🎋 五言絕句' },
  { value: 'haiku', label: '🍃 俳句（5-7-5）' },
  { value: 'taigi', label: '🌾 台語白話詩' },
  { value: 'elder', label: '🌅 早安問候語' },
] as const;
type PoemStyleValue = (typeof POEM_STYLE_OPTIONS)[number]['value'];

export default function Home() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [poem, setPoem] = useState<string>('');
  const [url, setUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
    const [isEmbedGenerating, setIsEmbedGenerating] = useState(false); // New state for embed generation
    const [isDownloadGenerating, setIsDownloadGenerating] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState<number>(0);
  const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  // For GitHub Pages deploy, NEXT_PUBLIC_API_BASE points at the Firebase Hosting
  // origin so /api/* still resolves to the Cloud Functions behind the rewrites.
  // For Firebase Hosting deploy, this is empty so calls stay same-origin.
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [poemStyle, setPoemStyle] = useState<PoemStyleValue>('modern');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const { user, configured: authConfigured, getIdToken } = useAuth();
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

  const handleSubmit = async (
    arg?: { regenerate?: boolean } | number,
    delay = 1000
  ) => {
    const isRegen = typeof arg === 'object' && !!arg?.regenerate;
    let retries = typeof arg === 'number' ? arg : 3;
    if (!photo) {
      toast({
        title: '錯誤！',
        description: '請先上傳一張照片。',
      });
      return;
    }
    if (authConfigured && !user) {
      toast({
        title: '請先登入',
        description: '請使用上方按鈕以 Google 帳號登入後再試。',
      });
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      toast({
        title: '尚未通過人機驗證',
        description: '請等待上方驗證框出現綠色勾勾後再試。',
      });
      return;
    }
    if (isRegen) setIsRegenerating(true);
    else setIsGenerating(true);
    const idToken = authConfigured ? await getIdToken() : null;
    const buildBody = () =>
      JSON.stringify({
        photo,
        turnstileToken,
        style: poemStyle,
        regenerate: isRegen,
      });
    const buildHeaders = () => {
      const h: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (idToken) h.Authorization = `Bearer ${idToken}`;
      return h;
    };
    try {
      let response = await fetch(`${API_BASE}/api/generate`, {
 method: 'POST',
 headers: buildHeaders(),
 body: buildBody(),
      });

 while (!response.ok && response.status === 503 && retries > 0) {
 console.warn(`AI模型目前過載，重試中... 剩餘 ${retries} 次`);
 await new Promise(resolve => setTimeout(resolve, delay));
 response = await fetch(`${API_BASE}/api/generate`, {
 method: 'POST',
 headers: buildHeaders(),
 body: buildBody(),
        });
 retries--;
 delay *= 3; // Exponential backoff
      }

      if (!response.ok) {
        let errorMessage = `HTTP 錯誤！狀態碼: ${response.status}`;
        if (response.status === 404) {
          errorMessage = '生成失敗！找不到產生詩詞的API，請稍後再試。';
        } else if (response.status === 503) {
 errorMessage = 'AI模型目前過載，請稍後再試。';
        } else if (response.status === 401 || response.status === 403 || response.status === 429) {
          try {
            const errBody = await response.json();
            if (errBody?.error) errorMessage = errBody.error;
            if (typeof errBody?.dailyLimit === 'number') setDailyLimit(errBody.dailyLimit);
            if (typeof errBody?.remaining === 'number') setRemaining(errBody.remaining);
          } catch {}
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setPoem(data.poem);
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (typeof data.dailyLimit === 'number') setDailyLimit(data.dailyLimit);

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
      setIsRegenerating(false);
      // Token 已被後端用掉（無論成功失敗），重新驗證以準備下次提交
      setTurnstileToken('');
      setTurnstileResetSignal(s => s + 1);
    }
  };

  const handleRegenerate = () => handleSubmit({ regenerate: true });

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
      const response = await fetch(`${API_BASE}/api/proxy?url=${encodeURIComponent(url)}`);

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

    const generateDownloadImageDataUrl = useCallback(async () => {
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

        const image = new window.Image();
        image.src = photo;

        await new Promise((resolve, reject) => {
            image.onload = () => resolve(null);
            image.onerror = () => reject(new Error('Failed to load image'));
        });

        const imageAspectRatio = image.width / image.height;
        const canvasWidth = 1200;
        const canvasHeight = 600;

        let imageWidth = 600; // Reduced image width
        let imageHeight = canvasHeight;

        if (imageAspectRatio > 1) {
            imageHeight = imageWidth / imageAspectRatio;
        } else {
            imageWidth = imageHeight * imageAspectRatio;
        }

        const imageX = 0;
        const imageY = (canvasHeight - imageHeight) / 2;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Draw the image on the left
        ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);

        // Style and draw the poem on the right
        ctx.fillStyle = '#222';
        ctx.fillRect(imageWidth, 0, canvasWidth - imageWidth, canvasHeight); // Adjust fill rect width
        ctx.font = 'bold 40px Arial'; // Larger font size
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // Vertically center the text

        const lines = poem.split('\n');
        const lineHeight = 48; // Space between lines
        const startY = (canvasHeight - lines.length * lineHeight) / 2; // Center the poem vertically

        const poemColors = [
            '#ef5350', // Red
            '#f48fb1', // Pink
            '#7e57c2', // Purple
            '#2196f3', // Blue
            '#26a69a', // Teal
            '#43a047', // Green
            '#D97706', // Dark Orange
            '#f9a825', // Amber
        ];

        // Add white stroke
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 10;

        ctx.font = 'bold 48px Arial';

        for (let i = 0; i < lines.length; i++) {
            ctx.fillStyle = poemColors[i % poemColors.length];
            ctx.fillText(lines[i], imageWidth + (canvasWidth - imageWidth) / 2, startY + i * lineHeight); // Adjust X position for right side
        }

        // Convert canvas to data URL
        return canvas.toDataURL('image/png');

    }, [photo, poem]);

    const handleDownload = useCallback(async () => {
        setIsDownloadGenerating(true);
        try {
            const dataURL = await generateDownloadImageDataUrl();
            if (dataURL) {
                const link = document.createElement('a');
                link.href = dataURL;
                link.download = 'poem_image.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({
                    title: '下載成功！',
                    description: '圖片已成功下載。',
                });
            }
        } catch (error: any) {
            console.error('Error creating download image:', error);
            toast({
                title: '錯誤！',
                description: '產出圖片失敗。',
            });
        } finally {
            setIsDownloadGenerating(false);
        }
    }, [generateDownloadImageDataUrl, isMobile]);

    const generateEmbedImageDataUrl = useCallback(async () => {
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

        const image = new window.Image();
        image.src = photo;

        await new Promise((resolve, reject) => {
            image.onload = () => resolve(null);
            image.onerror = () => reject(new Error('Failed to load image'));
        });


        const canvasWidth = image.width;
        const canvasHeight = image.height;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

        // Font size calculation
        const fontSize = Math.max(20, Math.min(canvasWidth / 18, canvasHeight / 18)); // Increased base font size
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        const lines = poem.split('\n');
        const lineHeight = fontSize * 1.2;
        let y = canvasHeight - 10;

        const poemColors = [
            '#ef5350', // Red
            '#f48fb1', // Pink
            '#7e57c2', // Purple
            '#2196f3', // Blue
            '#26a69a', // Teal
            '#43a047', // Green
            '#D97706', // Dark Orange
            '#f9a825', // Amber
        ];

        // Set font before setting stroke style and width
        ctx.font = `bold ${fontSize}px Arial`; // Set font again after modifying stroke style

        // Increased stroke width for better visibility on mobile
        ctx.lineWidth = isMobile ? 12 : 8; // Set the width of the stroke
        ctx.strokeStyle = 'white'; // Set stroke color to white

        for (let i = lines.length - 1; i >= 0; i--) {
            const color = poemColors[i % poemColors.length];
            ctx.fillStyle = color;
            ctx.strokeText(lines[i], canvasWidth - 10, y); // Stroke text
            ctx.fillText(lines[i], canvasWidth - 10, y);
            y -= lineHeight;
        }

        // Reduce quality for faster download on mobile. Adjust the quality as needed
        return canvas.toDataURL('image/jpeg', isMobile ? 0.7 : 0.9);

    }, [photo, poem, isMobile]);


    const handleEmbed = useCallback(async () => {
        setIsEmbedGenerating(true);

        try {
            const dataURL = await generateEmbedImageDataUrl();
            if (dataURL) {
                const link = document.createElement('a');
                link.href = dataURL;
                link.download = 'poem_image.png'; // Filename for the downloaded image
                document.body.appendChild(link); // Required for Firefox

                link.click();

                document.body.removeChild(link);

                toast({
                    title: '嵌入成功！',
                    description: '圖片已成功嵌入詩詞並下載。',
                });
            }
        } catch (error: any) {
            console.error('Error creating embed image:', error);
            toast({
                title: '錯誤！',
                description: '嵌入圖片失敗。',
            });
        } finally {
            setIsEmbedGenerating(false);
        }
    }, [generateEmbedImageDataUrl, isMobile]);

    const handleShare = useCallback(async () => {
        if (!navigator.share) {
            toast({
                title: '分享失敗！',
                description: '分享功能僅支援行動裝置瀏覽器。',
            });
            return;
        }

        setIsEmbedGenerating(true); // Use the same state as embed generation
        try {
            const dataURL = await generateEmbedImageDataUrl();
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
        } finally { setIsEmbedGenerating(false); }
    }, [generateEmbedImageDataUrl]);

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
    <div className="flex flex-col justify-center items-center min-h-screen py-12 px-4 bg-gradient-to-br from-sky-100 to-pink-100">
      <UseGuideDialog open={showGuide} onOpenChange={setShowGuide} />
      <Card className="w-full max-w-md rounded-lg border shadow-md overflow-hidden bg-white/80 backdrop-blur-sm">
        <CardHeader className="p-6 text-center bg-gradient-to-br from-purple-700 to-pink-700 text-white shadow-md relative">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            aria-label="使用說明"
            className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/15 hover:bg-white/25 transition px-3 py-1 text-xs font-medium border border-white/25"
          >
            <BookOpen className="h-3.5 w-3.5" />
            使用說明
          </button>
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
            <AuthBar remaining={remaining} dailyLimit={dailyLimit} />
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
            <div>
              <label htmlFor="poem-style" className="block text-sm font-medium text-gray-700 mb-1">
                詩文風格：
              </label>
              <Select value={poemStyle} onValueChange={(v) => setPoemStyle(v as PoemStyleValue)}>
                <SelectTrigger id="poem-style" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POEM_STYLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TurnstileGate
              onToken={setTurnstileToken}
              resetSignal={turnstileResetSignal}
            />
            <Button
              onClick={() => handleSubmit()}
              disabled={
                !photo ||
                isGenerating ||
                isRegenerating ||
                (turnstileEnabled && !turnstileToken) ||
                (authConfigured && !user)
              }
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded transform transition-transform duration-300 hover:scale-105 shadow-md text-lg"
            >
              {isGenerating ? '詠唱中...' : (authConfigured && !user ? '請先登入' : '生成詩詞')}
            </Button>
            {(isGenerating || isRegenerating) && !poem && <PoemPlaceholder />}
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
                  <Button
                    variant="outline"
                    className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                    onClick={handleRegenerate}
                    disabled={!poem || isRegenerating || isGenerating || (turnstileEnabled && !turnstileToken) || (authConfigured && !user)}
                  >
                    {isRegenerating ? (
                      <>
                        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                        重新詠唱中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        ✨ 換一首（同照片不同詩）
                      </>
                    )}
                  </Button>
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
                    onClick={handleDownload}
 disabled={!poem || isDownloadGenerating}
                  >
下載圖文組合
                    <Download className="ml-2 h-4 w-4" /> {/* Keep the download icon here */}
                  </Button>
                  <Button
 variant="gradient"
 style={{ '--gradient-start': '#a78bfa', '--gradient-end': '#f472b6' } as React.CSSProperties} // Pink to Pink gradient
                    className="w-full"

                    onClick={handleEmbed}
                    disabled={!poem || isEmbedGenerating}  // Disable while generating
                  >
                      {isEmbedGenerating ? '下載中...請稍待片刻' : '下載妙用長輩圖！'}  {/* Change text while generating */}
                    <Download className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="gradient"
                  style={{ '--gradient-start': '#f472b6', '--gradient-end': '#f472b6' } as React.CSSProperties} // Pink to Pink gradient
                  className="w-full mt-2" // Add margin top for spacing
                  onClick={handleShare} // Assuming this button also triggers embedding or sharing
                  disabled={!poem} // Disable if no poem is generated
                >
                  一鍵分享長輩圖(僅支援手機端)😊
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <SiteFooter />
    </div>
  );
}

