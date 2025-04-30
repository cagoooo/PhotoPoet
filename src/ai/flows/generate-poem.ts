'use server';
/**
 * @fileOverview Generates a poem from an image.
 *
 * - generatePoem - A function that generates a poem from an image.
 * - GeneratePoemInput - The input type for the generatePoem function.
 * - GeneratePoemOutput - The return type for the generatePoem function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit'; // Correct import for Zod

const GeneratePoemInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GeneratePoemInput = z.infer<typeof GeneratePoemInputSchema>;

const GeneratePoemOutputSchema = z.object({
  poem: z.string().describe('A poem generated from the image, in Traditional Chinese.'),
});
export type GeneratePoemOutput = z.infer<typeof GeneratePoemOutputSchema>;

// Exported wrapper function calling the flow
export async function generatePoem(input: GeneratePoemInput): Promise<GeneratePoemOutput> {
  return generatePoemFlow(input);
}

// Define the prompt
const prompt = ai.definePrompt({
  name: 'generatePoemPrompt',
  input: { // Correct: Using input.schema
    schema: GeneratePoemInputSchema, // Use the defined input schema
  },
  output: { // Correct: Using output.schema
    schema: GeneratePoemOutputSchema, // Use the defined output schema
  },
  prompt: `你是一位詩人。 根據照片，創作一首反映其內容、氣氛和關鍵元素的詩。 這首詩必須是繁體中文。\n\nPhoto: {{media url=photoDataUri}}`,
});

// Define the flow
const generatePoemFlow = ai.defineFlow<
  typeof GeneratePoemInputSchema,
  typeof GeneratePoemOutputSchema
>(
  {
    name: 'generatePoemFlow',
    inputSchema: GeneratePoemInputSchema,
    outputSchema: GeneratePoemOutputSchema,
  },
  async input => {
    const {output} = await prompt(input); // Call the defined prompt
    if (!output) {
        // Throw a specific error if the AI model doesn't return a valid output
        throw new Error("AI 模型未能產生有效的輸出。");
    }
    return output;
  }
);
