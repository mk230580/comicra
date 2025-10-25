import { GoogleGenAI, Modality } from '@google/genai';
import type { Character, GeneratedContent, Page, UsageRecord } from '../../types';
import { PRICING } from '../../services/pricing';
import { hasGeminiKey, requireGeminiKey } from '../config';
import { ServiceUnavailableError, UpstreamServiceError } from '../errors';

let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!hasGeminiKey) {
    throw new ServiceUnavailableError('Gemini API key is not configured on the server');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: requireGeminiKey() });
  }
  return aiClient;
};

const base64ToGeminiPart = (base64: string, mimeType: string) => ({
  inlineData: {
    data: base64.split(',')[1],
    mimeType,
  },
});

const createImageUsageRecord = (
  task: string,
  imageCount: number,
): Omit<UsageRecord, 'id' | 'timestamp'> => ({
  task,
  images: imageCount,
  costUSD: imageCount * PRICING.IMAGEN_PER_IMAGE,
});

export const generateMangaPage = async (
  characters: Character[],
  panelLayoutImageBase64: string,
  sceneDescription: string,
  colorMode: 'color' | 'monochrome',
  previousPage: Pick<Page, 'generatedImage' | 'sceneDescription'> | undefined,
  generateEmptyBubbles: boolean,
): Promise<{ data: GeneratedContent; usage: Omit<UsageRecord, 'id' | 'timestamp'> }> => {
  const ai = getAiClient();

  try {
    const panelMimeType = panelLayoutImageBase64.match(/data:(image\/.*?);/)?.[1] || 'image/png';
    const panelLayoutPart = base64ToGeminiPart(panelLayoutImageBase64, panelMimeType);

    const characterParts = characters.map((char) => {
      const mimeType = char.sheetImage.match(/data:(image\/.*?);/)?.[1] || 'image/png';
      return base64ToGeminiPart(char.sheetImage, mimeType);
    });

    const characterReferencePrompt = characters
      .map(
        (char, index) =>
          `- **${char.name}:** Use the character sheet provided as "Character Reference ${index + 1}".`,
      )
      .join('\n');

    const hasPreviousPage = Boolean(previousPage?.generatedImage);
    const continuationInstruction = hasPreviousPage
      ? `
**STORY CONTINUATION:** This page MUST be a direct continuation of the previous page provided. Analyze the "Previous Page Image" and its script for narrative and artistic continuity.
**Previous Page Script:**
---
${previousPage!.sceneDescription}
---
`
      : '';

    const prompt = `
You are an expert manga artist. Create a single manga page based on the provided assets.

**Assets Provided:**
${hasPreviousPage ? '1.  **Previous Page Image**' : ''}
${hasPreviousPage ? '2.' : '1.'}  **Character Sheets**
${hasPreviousPage ? '3.' : '2.'}  **Panel Layout with Poses:** An image showing panel composition and pose guides for each named character.
${hasPreviousPage ? '4.' : '3.'}  **Scene Script:** A panel-by-panel description for the NEW page.

**Character References:**
${characterReferencePrompt}
    
${continuationInstruction}

**Instructions for the NEW page:**
1.  **Match Poses to Characters:** The Panel Layout image labels poses with character names. You MUST draw the correct character in that pose. Follow any text comments next to a pose.
2.  **Follow Script:** Execute the Scene Script's details for expressions, composition, and narrative precisely. If a scene has no characters (e.g., landscape), draw that scene.
3.  **Character Consistency:** Draw characters strictly according to their reference sheets. Only draw the number of characters specified per panel. Do not add or omit characters.
4.  **Panel Layout:** Use the provided panel layout. The relative size of each panel indicates its importance; draw larger panels with more detail and focus.
5.  **Style:** Create the manga in ${colorMode}. All text and speech bubbles must have bold, thick black outlines.
6.  **Speech Bubbles:** ${
      generateEmptyBubbles
        ? 'Draw speech bubbles from the layout but leave them COMPLETELY EMPTY. Do NOT add any text or sound effects.'
        : 'If the script includes dialogue, place it inside speech bubbles from the layout. If no bubbles exist in the layout, create them.'
    }
7.  **Final Output:** Generate ONLY the final manga page as a single image. No text or descriptions.

**Scene Script for the NEW Page:**
---
${sceneDescription}
---
  `;

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { text: prompt },
    ];

    if (hasPreviousPage && previousPage?.generatedImage) {
      const prevPageMimeType =
        previousPage.generatedImage.match(/data:(image\/.*?);/)?.[1] || 'image/png';
      parts.push(base64ToGeminiPart(previousPage.generatedImage, prevPageMimeType));
    }

    parts.push(...characterParts, panelLayoutPart);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    if (!response.candidates?.length) {
      throw new UpstreamServiceError(
        `The AI did not return a valid response. It may have been blocked. ${response.text || ''}`,
      );
    }

    const result: GeneratedContent = { image: null, text: null };
    for (const part of response.candidates[0].content.parts) {
      if ('inlineData' in part && part.inlineData) {
        const mimeType = part.inlineData.mimeType;
        result.image = `data:${mimeType};base64,${part.inlineData.data}`;
      } else if ('text' in part && part.text) {
        result.text = part.text;
      }
    }

    if (!result.image) {
      throw new UpstreamServiceError(
        `The AI did not return an image. It might have refused the request. ${result.text || ''}`,
      );
    }

    return {
      data: result,
      usage: createImageUsageRecord('Comicra Page Generation', 1),
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableError || error instanceof UpstreamServiceError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : 'Unexpected error during manga page generation';
    throw new UpstreamServiceError(message);
  }
};
