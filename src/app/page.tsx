'use client';

import {useState, useCallback} from 'react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {generatePoem} from '@/ai/flows/generate-poem';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {cn} from '@/lib/utils';
import {useToast} from '@/hooks/use-toast';
import {toast} from '@/hooks/use-toast';

export default function Home() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [poem, setPoem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {toast} = useToast();

  const handleGeneratePoem = useCallback(async () => {
    if (!photo) {
      toast({
        title: 'Error',
        description: 'Please submit a photo first.',
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
        title: 'Error',
        description: error.message || 'Failed to generate poem. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [photo, toast]);

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
          title: 'Error',
          description: 'Failed to read the image. Please try again.',
        });
      };
      reader.readAsDataURL(file);
    },
    [toast]
  );

  const handleURLSubmission = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const url = event.target.value;
      if (!url) {
        return;
      }
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhoto(reader.result as string);
          setPoem(null); // Clear previous poem
        };
        reader.onerror = () => {
          toast({
            title: 'Error',
            description: 'Failed to read the image from URL. Please try again.',
          });
        };
        reader.readAsDataURL(blob);
      } catch (error: any) {
        console.error('URL submission error:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch image from URL. Please try again.',
        });
      }
    },
    [toast]
  );

  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-8 bg-background">
      <Card className="w-full max-w-2xl bg-card shadow-md rounded-lg overflow-hidden">
        <CardHeader className="p-6">
          <CardTitle className="text-2xl font-semibold tracking-tight">PhotoPoet</CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload a photo and let AI generate a poem inspired by it.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-4">
            {/* Photo Upload */}
            <div className="flex flex-col gap-2">
              <label htmlFor="photo-upload" className="text-sm font-medium leading-none">
                Upload Photo:
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
                Or submit a Photo URL:
              </label>
              <Input
                id="photo-url"
                type="url"
                placeholder="Enter image URL"
                onBlur={handleURLSubmission}
              />
            </div>

            {photo && (
              <div className="flex justify-center items-center rounded-md border border-muted aspect-square overflow-hidden">
                <img
                  src={photo}
                  alt="Uploaded"
                  className="object-cover w-full h-full"
                  style={{maxHeight: '200px', maxWidth: '200px'}}
                />
              </div>
            )}

            <Button onClick={handleGeneratePoem} disabled={loading} className="w-full">
              {loading ? 'Generating...' : 'Generate Poem'}
            </Button>

            {poem && (
              <div className="fade-in">
                <h2 className="text-xl font-semibold tracking-tight mt-4">Generated Poem:</h2>
                <Textarea
                  value={poem}
                  readOnly
                  className="mt-2 min-h-[150px] bg-secondary/50 rounded-md border-none shadow-sm resize-none"
                  style={{animation: 'fadeIn 1s ease-in-out'}}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
