'use client';

import {useState, useCallback} from 'react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {generatePoem} from '@/ai/flows/generate-poem';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {cn} from '@/lib/utils';
import {useToast} from '@/hooks/use-toast';
import {useRouter} from 'next/navigation';
import {Share2} from 'lucide-react';

export default function Home() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [poem, setPoem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {toast} = useToast();
  const router = useRouter();

  const handleGeneratePoem = useCallback(async () => {
    if (!photo) {
      toast({
        title: '錯誤',
        description: '請先上傳一張照片。',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await generatePoem({photoDataUri: photo});
      setPoem(result.poem);
    } catch (error: any) {
      console.error('Poem generation error:', error);
      toast({
        title: '錯誤',
        description: error.message || '生成詩詞失敗，請重試。',
      });
    } finally {
      setLoading(false);
    }
    router.refresh(); // Refresh the route to clear the promises
  }, [photo, toast, router]);

  const handlePhotoUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
        setPoem(null); // Clear previous poem
      };
      reader.onerror = () => {
        toast({
          title: '錯誤',
          description: '讀取圖片失敗，請重試。',
        });
      };
      reader.readAsDataURL(file);
    },
    [toast]
  );

  const handleURLSubmission = useCallback(
    async (url: string) => {
      if (!url) {
        return;
      }

      setLoading(true);
      try {
        // Check if the URL is an absolute URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          throw new Error('請輸入有效的圖片網址 (http:// 或 https:// 開頭)。');
        }

        const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);

        if (!response.ok) {
          throw new Error(`圖片網址載入失敗: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhoto(reader.result as string);
          setPoem(null); // Clear previous poem
        };
        reader.onerror = () => {
          toast({
            title: '錯誤',
            description: '從 URL 讀取圖片失敗，請重試。',
          });
        };
        reader.readAsDataURL(blob);
      } catch (error: any) {
        console.error('URL submission error:', error);
        toast({
          title: '錯誤',
          description:
            error.message ||
            '無法從 URL 取得圖片，請重試。 確定該網址可以公開存取。',
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const handleShare = useCallback(() => {
    if (!photo || !poem) {
      toast({
        title: '錯誤',
        description: '請先上傳照片並生成詩詞。',
      });
      return;
    }

    const shareText = `詠圖詩人：\n\n我為這張照片創作了一首詩：\n\n${poem}\n\n圖片連結：${photo}`;

    const shareData = {
      title: '詠圖詩人',
      text: shareText,
      url: photo, // Consider if sharing the photo URL is appropriate
    };

    if (navigator.share) {
      navigator
        .share(shareData)
        .then(() => {
          toast({
            title: '分享成功！',
            description: '感謝您的分享。',
          });
        })
        .catch((error) => {
          console.error('分享失敗:', error);
          if (error.name === 'AbortError') {
            toast({
              title: '分享取消',
              description: '分享已取消。',
            });
          } else if (error.name === 'SecurityError') {
            // Handle permission issues (e.g., user denied sharing)
            navigator.clipboard
              .writeText(shareText)
              .then(() => {
                toast({
                  title: '權限錯誤',
                  description: '因權限問題無法使用分享功能，內容已複製到剪貼簿。',
                });
              })
              .catch(() => {
                toast({
                  title: '分享失敗',
                  description: '分享失敗，且無法複製到剪貼簿，請稍後再試。',
                });
              });
          }
          else {
            toast({
              title: '分享失敗',
              description:
                '分享時發生錯誤，請檢查您的瀏覽器設定或稍後再試。',
            });
          }

        });
    } else {
      // Fallback for browsers that don't support the share API.
      navigator.clipboard
        .writeText(shareText)
        .then(() => {
          toast({
            title: '複製成功！',
            description: '詩詞和圖片連結已複製到剪貼簿，您可以手動分享。',
          });
        })
        .catch((err) => {
          console.error('無法複製到剪貼簿:', err);
          toast({
            title: '分享失敗',
            description:
              '您的瀏覽器不支持分享功能，也無法複製到剪貼簿，請嘗試其他方式分享。',
          });
        });
    }
  }, [photo, poem, toast]);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-8 bg-background">
      <Card className="w-full max-w-2xl bg-card shadow-md rounded-lg overflow-hidden">
        <CardHeader className="p-6">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            詠圖詩人：讓 AI 點綴您的照片，譜寫出獨一無二的詩意篇章
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            上傳一張照片，讓 AI 為你創作一首繁體中文詩詞，分享您照片的詩意。</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-4">
            {/* Photo Upload */}
            <div className="flex flex-col gap-2">
              <label htmlFor="photo-upload" className="text-sm font-medium leading-none">
                上傳照片：
              </label>
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="file:border-0 file:bg-muted file:text-muted-foreground"
              />
            </div>

            {/* URL Submission */}
            <div className="flex flex-col gap-2">
              <label htmlFor="photo-url" className="text-sm font-medium leading-none">
                或提交照片網址：
              </label>
              <Input
                id="photo-url"
                type="url"
                placeholder="請輸入圖片網址 (http:// 或 https:// 開頭)"
                onBlur={(e) => handleURLSubmission(e.target.value)}
              />
            </div>

            {photo && (
              <div className="flex justify-center items-center rounded-md border border-muted overflow-hidden">
                <img
                  src={photo}
                  alt="Uploaded"
                  className="object-contain max-h-96 max-w-full"
                />
              </div>
            )}

            <Button onClick={handleGeneratePoem} disabled={loading} className="w-full">
              {loading ? '生成中...' : '生成詩詞'}
            </Button>

            {poem && (
              <div className="fade-in">
                <h2 className="text-xl font-semibold tracking-tight mt-4">生成的詩詞：</h2>
                <Textarea
                  value={poem}
                  readOnly
                  className={cn(
                    "mt-2 min-h-[150px] bg-secondary/50 rounded-md border-none shadow-sm resize-none poem-text",
                    "poem-text"
                  )}
                  style={{animation: 'fadeIn 1s ease-in-out'}}
                />
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={handleShare}
                  disabled={loading}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  分享
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Toast component for displaying notifications */}
    </div>
  );
}
