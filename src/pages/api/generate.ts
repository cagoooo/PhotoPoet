import type {NextApiRequest, NextApiResponse} from 'next';
import { generatePoem, GeneratePoemInput } from '@/ai/flows/generate-poem';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Set desired value here
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { photo } = req.body;

  if (!photo) {
    return res.status(400).json({ error: '照片為必填欄位' }); // Translated error message
  }

  try {
    const input: GeneratePoemInput = { photoDataUri: photo };
    const result = await generatePoem(input);
    res.status(200).json({ poem: result.poem });
  } catch (error: any) {
    console.error('API 錯誤:', error); // Log the actual error with a translated prefix
    // Return the specific error message from the flow or a generic message
    res.status(500).json({ error: error.message || '生成詩詞失敗' }); // Translated error message
  }
}
