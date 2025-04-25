/ src/pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { generatePoem, GeneratePoemInput } from '@/ai/flows/generate-poem';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { photo } = req.body;

  if (!photo) {
    return res.status(400).json({ error: 'Photo is required' });
  }

  try {
    const input: GeneratePoemInput = { photoDataUri: photo };
    const result = await generatePoem(input);
    res.status(200).json({ poem: result.poem });
  } catch (error: any) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate poem' });
  }
}
