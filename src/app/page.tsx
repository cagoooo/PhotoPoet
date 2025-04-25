'use client';

import {useState, useCallback, useRef} from 'react';
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

export default function Home() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [poem, setPoem] = useState<string>('');
  const [url, setUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        },
        body: JSON.stringify({photo}),
      });

      if (!response.ok) {
        let errorMessage = `HTTP 錯誤！狀態碼: ${response.status}`;
        if (response.status === 404) {
          errorMessage = '生成失敗！找不到產生詩詞的API，請稍後再試。';
        } else {
          const errorBody = await response.text();
          console.error('Error Body:', errorBody);
          errorMessage += `, 詳細訊息: ${errorBody}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setPoem(data.poem);
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

  const handleCopy = useCallback(() => {
    if (!poem) {
      toast({
        title: '錯誤！',
        description: '請先上傳照片並生成詩詞。',
      });
      return;
    }
  
    navigator.clipboard.writeText(poem)
      .then(() => {
        toast({
          title: '複製成功！',
          description: '詩詞已複製到剪貼簿。',
        });
      })
      .catch(err => {
        console.error('複製失敗：', err);
        toast({
          title: '複製失敗！',
          description: '無法複製詩詞，請稍後再試。',
          variant: 'destructive',
        });
      });
  }, [poem]);

  return (
    <div className="flex justify-center items-center min-h-screen py-12 bg-gradient-to-br from-sky-100 to-pink-100">
      <Card className="w-full max-w-md rounded-lg border shadow-md overflow-hidden bg-white/80 backdrop-blur-sm">
        <CardHeader className="p-6 text-center bg-gradient-to-br from-purple-700 to-pink-700 text-white shadow-md">
          <h1 className="rainbow-text text-3xl font-extrabold tracking-tight mb-2 drop-shadow-md">
            ✨ 靈感之詩，翩然降臨 ✨
          </h1>
          <CardDescription className="text-md text-gray-200 drop-shadow-md">
            讓 AI 為您的照片譜寫動人詩篇，分享您照片的詩意。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="upload" className="block text-sm font-medium text-gray-700">
                上傳你的照片：
              </label>
              <Button
                variant="outline"
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
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded transform transition-transform duration-300 hover:scale-105 shadow-md"
            >
              {isGenerating ? '詠唱中...' : '生成詩詞'}
            </Button>
            {poem && (
              <div className="mt-4">
                <h2 className="text-2xl font-semibold tracking-tight mt-4 text-center text-purple-700 drop-shadow-md">
                  ✨ 靈感之詩，翩然降臨 ✨
                </h2>
                <div className="mt-2 min-h-[150px] rounded-md shadow-sm resize-none poem-text" style={{ backgroundColor: '#222', color: '#fff' }}>
                  {poem.split('\n').map((line, index) => (
                    <span key={index} className="poem-line">
                      {line}
                    </span>
                  ))}
                </div>
                <Button variant="secondary" className="mt-4 w-full" onClick={handleCopy} disabled={!poem}>
                 複製
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

