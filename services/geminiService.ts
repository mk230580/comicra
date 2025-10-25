import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import type { GeneratedContent, Character, Page, StorySuggestion, AnalysisResult, UsageRecord } from '../types';
import { PRICING, calculateTextCost } from './pricing';
import { apiPost } from '../lib/apiClient';

let ai: GoogleGenAI | null = null;

function ensureAiClient(): GoogleGenAI {
  if (ai) {
    return ai;
  }
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error("Gemini integration is not configured. Please set up the Comicra backend proxy or define VITE_GEMINI_API_KEY for local development.");
  }
  ai = new GoogleGenAI({ apiKey });
  return ai;
}

function base64ToGeminiPart(base64: string, mimeType: string) {
  return {
    inlineData: {
      data: base64.split(',')[1],
      mimeType,
    },
  };
}

const createTextUsageRecord = (task: string, response: GenerateContentResponse): Omit<UsageRecord, 'id' | 'timestamp'> => {
    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = promptTokens + completionTokens;

    return {
        task,
        tokens: totalTokens,
        costUSD: calculateTextCost(promptTokens, completionTokens),
    };
};

const createImageUsageRecord = (task: string, imageCount: number): Omit<UsageRecord, 'id' | 'timestamp'> => {
    return {
        task,
        images: imageCount,
        costUSD: imageCount * PRICING.IMAGEN_PER_IMAGE,
    };
};

export async function generateWorldview(characters: Character[]): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> {
    const prompt = `
As a creative world-builder, generate a compelling manga setting based on the provided characters.

**Characters:**
${characters.map(c => `- **${c.name}:** ${c.description || 'No description provided.'}`).join('\n')}

**Task:**
- Describe the world's core concepts and conflicts.
- Explain how the characters fit into this world.
- The tone should be inspiring for a manga artist.
- Respond in a single block of text.
`;
    
    const aiClient = ensureAiClient();
    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    return {
        data: response.text,
        usage: createTextUsageRecord('Generate Worldview', response)
    };
}


export async function generateDetailedStorySuggestion(
    premise: string,
    worldview: string,
    characters: Character[],
    previousPages?: Pick<Page, 'generatedImage' | 'sceneDescription'>[]
): Promise<{ data: StorySuggestion, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> {
    
    let contextPrompt = "You are a manga scriptwriter. Generate a single-page script based on the provided context.";

    if (worldview) {
        contextPrompt += `\n\n**WORLDVIEW:**\n${worldview}\nYour suggestions must be consistent with this worldview.`;
    }

    if (characters && characters.length > 0) {
        contextPrompt += "\n\n**CHARACTERS:**\n";
        characters.forEach(char => {
            contextPrompt += `- **${char.name}:** ${char.description || 'No description provided.'}\n`;
        });
    }


    const previousPagesContent: any[] = [];
    if (previousPages && previousPages.length > 0) {
        contextPrompt += "\n\n**PREVIOUS PAGES CONTEXT:**\nThis new page must be a direct continuation. Context from preceding pages (in order):";
        
        previousPages.forEach((page, index) => {
            if (page.generatedImage && page.sceneDescription) {
                contextPrompt += `\n\n**[Previous Page ${index + 1}]**\n*Script:* ${page.sceneDescription}\n*Image:* [Image ${index + 1} is attached]`;
                const mimeType = page.generatedImage.match(/data:(image\/.*?);/)?.[1] || 'image/png';
                previousPagesContent.push(base64ToGeminiPart(page.generatedImage, mimeType));
            }
        });
    }

    if (premise) {
        contextPrompt += `\n\n**USER'S PREMISE FOR NEW PAGE:**\n"${premise}"`;
    }

    contextPrompt += `\n\n**TASK:**
- Based on all provided context, write a script for a new manga page.
- If no premise is given, propose a logical next page.
- Structure the script into 2-4 panels.
- For each panel, provide a concise visual description and any dialogue (in English).
- Dialogue format: 'Character Name: "Line of dialogue"'.`;

    const contents = {
        parts: [{ text: contextPrompt }, ...previousPagesContent],
    };

    const aiClient = ensureAiClient();
    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: {
                        type: Type.STRING,
                        description: "A brief, one-sentence summary of the page's story."
                    },
                    panels: {
                        type: Type.ARRAY,
                        description: "An array of panel objects, describing the scene.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                panel: {
                                    type: Type.INTEGER,
                                    description: "The panel number (e.g., 1, 2, 3)."
                                },
                                description: {
                                    type: Type.STRING,
                                    description: "A description of the visual action, camera angle, character expressions, or environment in the panel."
                                },
                                dialogue: {
                                    type: Type.STRING,
                                    description: "The dialogue spoken by a character in the panel. Format as 'Character Name: \"Line of dialogue\"'. Can be empty."
                                }
                            },
                             required: ["panel", "description"]
                        }
                    }
                },
                required: ["summary", "panels"]
            }
        }
    });

    try {
        const jsonText = response.text;
        const suggestion = JSON.parse(jsonText) as StorySuggestion;
        if (suggestion && suggestion.summary && Array.isArray(suggestion.panels)) {
            return {
                data: suggestion,
                usage: createTextUsageRecord('Story Suggestion', response)
            };
        }
        throw new Error("Parsed JSON does not match the expected structure.");
    } catch (e) {
        console.error("Failed to parse story suggestion JSON:", e);
        throw new Error("The AI returned an invalid story structure. Please try again.");
    }
}


const ASPECT_RATIO_CONFIG: { [key: string]: { w: number, h: number, value: string } } = {
    'A4': { w: 595, h: 842, value: '210:297' },
    'Portrait (3:4)': { w: 600, h: 800, value: '3:4' },
    'Square (1:1)': { w: 800, h: 800, value: '1:1' },
    'Widescreen (16:9)': { w: 1280, h: 720, value: '16:9' }
};

export async function generateLayoutProposal(
    story: string,
    characters: Character[],
    aspectRatioKey: string,
    previousPage?: { proposalImage: string, sceneDescription: string },
    currentCanvasImage?: string
): Promise<{ data: { proposalImage: string }, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> {
    const config = ASPECT_RATIO_CONFIG[aspectRatioKey] || ASPECT_RATIO_CONFIG['A4'];
    const aspectRatioValue = config.value;
    const hasCharacters = characters.length > 0;

    const characterParts = hasCharacters
      ? characters.map(char => {
          const mimeType = char.sheetImage.match(/data:(image\/.*?);/)?.[1] || 'image/png';
          return base64ToGeminiPart(char.sheetImage, mimeType);
        })
      : [];
    
    const prompt = `
You are a manga storyboard artist. Create a single, rough, grayscale sketch of a manga page layout.

**Inputs:**
1.  **Story:** The narrative for the page.
2.  **Canvas Image:** The user's drawing surface (may be blank or contain work).
3.  **Character Sheets:** ${hasCharacters ? 'Provided.' : 'Not provided.'}
${previousPage ? '4.  **Previous Page Image:** For context.' : ''}

**CRITICAL INSTRUCTIONS:**
1.  **Dimensions:** Output MUST be a full-canvas sketch with an aspect ratio of ${aspectRatioValue} (${config.w}x${config.h}px). No margins.
2.  **Layout:** AVOID simple grids. Use dynamic techniques: angled/overlapping panels, varied sizes, and panel breaks for impact.
3.  **Canvas Integration:** Use the provided "Canvas Image" as your drawing surface. Integrate any existing drawings into your new layout. If blank, create from scratch.
4.  **Content:** Use rough lines. Place characters according to the story and their reference sheets. For character-free panels, sketch the environment.
5.  **NO TEXT:** Output image must be a pure visual sketch. No text, labels, or numbers.
${previousPage ? `6.  **Continuity:** Ensure a smooth visual transition from the "Previous Page Image".` : ''}

**Story to Illustrate:**
---
${story}
---
    `;

    const parts: ({ text: string; } | { inlineData: { data: string; mimeType: string; }})[] = [{ text: prompt }];
    
    if (currentCanvasImage) {
        const mimeType = currentCanvasImage.match(/data:(image\/.*?);/)?.[1] || 'image/png';
        parts.push(base64ToGeminiPart(currentCanvasImage, mimeType));
    }

    if (previousPage?.proposalImage) {
        const mimeType = previousPage.proposalImage.match(/data:(image\/.*?);/)?.[1] || 'image/png';
        parts.push(base64ToGeminiPart(previousPage.proposalImage, mimeType));
    }
    parts.push(...characterParts);

    const contents = { parts };

    const aiClient = ensureAiClient();
    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    if (!response.candidates?.length) {
        throw new Error("The AI did not return a valid response for the layout proposal.");
    }
    
    const imagePartResponse = response.candidates[0].content.parts.find(part => part.inlineData);
    const textPartResponse = response.candidates[0].content.parts.find(part => part.text);

    if (!imagePartResponse?.inlineData) {
        if (textPartResponse?.text) {
            throw new Error(`The AI did not return an image. Response: "${textPartResponse.text}"`);
        }
        throw new Error("The AI did not return an image for the layout proposal.");
    }

    const proposalImage = `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`;
    
    return { 
        data: { proposalImage },
        usage: createImageUsageRecord('Layout Proposal', 1)
    };
}


export async function generateCharacterSheet(
    referenceImagesBase64: string[],
    characterName: string,
    colorMode: 'color' | 'monochrome'
): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> {
    const imageParts = referenceImagesBase64.map(base64 => {
        const mimeType = base64.match(/data:(image\/.*?);/)?.[1] || 'image/png';
        return base64ToGeminiPart(base64, mimeType);
    });

    const prompt = `
You are a manga artist. Create a character reference sheet for "${characterName}".

**Instructions:**
1.  **Synthesize:** Combine key features from ALL provided reference images into one cohesive character design.
2.  **Style:** Clean, ${colorMode} manga style.
3.  **Layout:** The sheet must contain exactly six poses in two rows:
    - **Top Row:** Three headshots (e.g., front, side, expressive).
    - **Bottom Row:** Three full-body views (front, side, back).
4.  **Output:** Generate ONLY the character sheet image. No text, labels, or names.
    `;

    const contents = {
        parts: [{ text: prompt }, ...imageParts],
    };

    const aiClient = ensureAiClient();
    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

     if (!response.candidates?.length) {
        throw new Error("The AI did not return a valid response for the character sheet. It may have been blocked.");
    }
    
    const imagePartResponse = response.candidates[0].content.parts.find(part => part.inlineData);

    if (imagePartResponse?.inlineData) {
        const base64ImageBytes: string = imagePartResponse.inlineData.data;
        const responseMimeType = imagePartResponse.inlineData.mimeType;
        return {
            data: `data:${responseMimeType};base64,${base64ImageBytes}`,
            usage: createImageUsageRecord('Character Sheet', 1)
        };
    }

    const textPartResponse = response.candidates[0].content.parts.find(part => part.text);
    if(textPartResponse?.text) {
        throw new Error(`The AI did not return an image. Response: "${textPartResponse.text}"`);
    }

    throw new Error("The AI did not return an image for the character sheet.");
}

export async function generateCharacterFromReference(
    referenceSheetImagesBase64: string[],
    characterName: string,
    characterConcept: string,
    colorMode: 'color' | 'monochrome'
): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> {
    const imageParts = referenceSheetImagesBase64.map(base64 => {
        const mimeType = base64.match(/data:(image\/.*?);/)?.[1] || 'image/png';
        return base64ToGeminiPart(base64, mimeType);
    });

    const prompt = `
You are a manga artist. Create a NEW character named "${characterName}" using existing sheets for ART STYLE reference ONLY.

**CRITICAL INSTRUCTIONS:**
1.  **ART STYLE ONLY:** The provided sheets are for art style reference (lines, coloring, shading).
2.  **DO NOT COPY REFERENCE CHARACTERS.** Create a NEW character. Do not copy designs, features, or clothing from references.
3.  **NEW CHARACTER CONCEPT:** The new character, "${characterName}", MUST be based ENTIRELY on this description: "${characterConcept}".
4.  **Style:** Generate in a clean, ${colorMode} manga style, matching the reference styles.
5.  **Layout:** The sheet must contain exactly six poses in two rows:
    - **Top Row:** Three headshots (e.g., front, side, expressive).
    - **Bottom Row:** Three full-body views (front, side, back).
6.  **Output:** Generate ONLY the character sheet image. No text, labels, or names.
    `;

    const contents = {
        parts: [{ text: prompt }, ...imageParts],
    };

    const aiClient = ensureAiClient();
    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

     if (!response.candidates?.length) {
        throw new Error("The AI did not return a valid response for the character sheet. It may have been blocked.");
    }
    
    const imagePartResponse = response.candidates[0].content.parts.find(part => part.inlineData);

    if (imagePartResponse?.inlineData) {
        const base64ImageBytes: string = imagePartResponse.inlineData.data;
        const responseMimeType = imagePartResponse.inlineData.mimeType;
        return {
            data: `data:${responseMimeType};base64,${base64ImageBytes}`,
            usage: createImageUsageRecord('Character (from Ref)', 1)
        };
    }

    const textPartResponse = response.candidates[0].content.parts.find(part => part.text);
    if(textPartResponse?.text) {
        throw new Error(`The AI did not return an image. Response: "${textPartResponse.text}"`);
    }

    throw new Error("The AI did not return an image for the character sheet.");
}


export async function editCharacterSheet(
    sheetImageBase64: string,
    characterName: string,
    editPrompt: string
): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> {
    const mimeType = sheetImageBase64.match(/data:(image\/.*?);/)?.[1] || 'image/png';
    const imagePart = base64ToGeminiPart(sheetImageBase64, mimeType);

    const prompt = `
You are a manga artist. Edit the character sheet for "${characterName}".

**Instructions:**
1.  **Base Image:** Use the provided character sheet.
2.  **Edit Request:** "${editPrompt}".
3.  **Execution:** Apply the change to the character across all poses, maintaining the existing style and layout.
4.  **Output:** Generate ONLY the updated character sheet image. No text or labels.
    `;
    
    const contents = {
        parts: [{ text: prompt }, imagePart],
    };

    const aiClient = ensureAiClient();
    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    if (!response.candidates?.length) {
        throw new Error("The AI did not return a valid response for the character sheet edit.");
    }
    
    const imagePartResponse = response.candidates[0].content.parts.find(part => part.inlineData);
    if (imagePartResponse?.inlineData) {
        return {
            data: `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`,
            usage: createImageUsageRecord('Edit Character Sheet', 1)
        };
    }

    throw new Error("The AI did not return an updated image for the character sheet.");
}

export async function generateMangaPage(
  characters: Character[],
  panelLayoutImageBase64: string,
  sceneDescription: string,
  colorMode: 'color' | 'monochrome',
  previousPage: Pick<Page, 'generatedImage' | 'sceneDescription'> | undefined,
  generateEmptyBubbles: boolean
): Promise<{ data: GeneratedContent, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> {
  const payload: Record<string, unknown> = {
    characters,
    panelLayoutImage: panelLayoutImageBase64,
    sceneDescription,
    colorMode,
    generateEmptyBubbles,
  };

  if (previousPage) {
    payload.previousPage = previousPage;
  }

  return apiPost<{ data: GeneratedContent; usage: Omit<UsageRecord, 'id' | 'timestamp'> }>(
    '/ai/generate-manga-page',
    payload,
  );
}

export async function colorizeMangaPage(
    monochromePageBase64: string,
    characters: Character[]
): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> {
    const pageMimeType = monochromePageBase64.match(/data:(image\/.*?);/)?.[1] || 'image/png';
    const pagePart = base64ToGeminiPart(monochromePageBase64, pageMimeType);

    const characterParts: { inlineData: { data: string; mimeType: string; } }[] = [];
    const characterReferencePrompt = characters.map(char => {
        char.referenceImages.forEach(refImg => {
            const mimeType = refImg.match(/data:(image\/.*?);/)?.[1] || 'image/png';
            characterParts.push(base64ToGeminiPart(refImg, mimeType));
        });
        const sheetMimeType = char.sheetImage.match(/data:(image\/.*?);/)?.[1] || 'image/png';
        characterParts.push(base64ToGeminiPart(char.sheetImage, sheetMimeType));
        
        return `- **${char.name}:** Use the provided full-color reference images for ACCURATE color information (hair, eyes, clothing). Use the black-and-white sheet for design/line art reference.`
    }).join('\n');

    const prompt = `
You are a professional digital colorist. Your task is to fully color a monochrome manga page.

**Assets Provided:**
1.  **Monochrome Manga Page:** The page to be colored.
2.  **Character References:** Full-color images and B&W sheets for each character.

**Character References:**
${characterReferencePrompt}

**Instructions:**
1.  **Full Colorization:** Color the ENTIRE page (characters, objects, backgrounds).
2.  **CRUCIAL - Accurate Colors:** You MUST use the provided ORIGINAL, FULL-COLOR reference images to ensure each character is colored with their correct scheme.
3.  **Maintain Line Art:** Preserve the original black line art. Do not redraw it.
4.  **Cohesive Palette:** Ensure background and environment colors create a cohesive mood.
5.  **Output:** Generate ONLY the final, fully colored manga page image.
    `;

    const contents = {
        parts: [{ text: prompt }, pagePart, ...characterParts],
    };

    const aiClient = ensureAiClient();
    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    if (!response.candidates?.length) {
        throw new Error("The AI did not return a valid response for colorization.");
    }
    
    const imagePartResponse = response.candidates[0].content.parts.find(part => part.inlineData);
    if (imagePartResponse?.inlineData) {
        return {
            data: `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`,
            usage: createImageUsageRecord('Colorize Page', 1)
        };
    }

    throw new Error("The AI did not return a colored image.");
}

export async function editMangaPage(
    originalImageBase64: string,
    prompt: string,
    maskImageBase64?: string,
    referenceImagesBase64?: string[]
): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> {
    const originalMimeType = originalImageBase64.match(/data:(image\/.*?);/)?.[1] || 'image/png';
    const originalImagePart = base64ToGeminiPart(originalImageBase64, originalMimeType);

    let fullPrompt = `You are a professional manga artist and digital editor. Edit the provided manga page image based on the user's instructions.`;

    if (maskImageBase64) {
        fullPrompt += `

**MASKING INSTRUCTIONS:**
- You have been provided with an original image and a mask image.
- **COMPLETELY RE-RENDER** the area of the original image that is **WHITE** in the mask.
- The **BLACK** areas of the mask must remain **UNCHANGED**.
- Apply the user's text prompt to the entire white masked area.
- Ensure the result blends seamlessly with the unchanged parts.

**User's Request:** "${prompt}"
`;
    } else {
        fullPrompt += `
**User's Request:** "${prompt}"
Apply the requested changes to the entire image as appropriate.
`;
    }

    if (referenceImagesBase64 && referenceImagesBase64.length > 0) {
        fullPrompt += `
**REFERENCE IMAGES:**
Use the provided reference images as the primary source of truth for style and content (especially character design).`;
    }

    fullPrompt += `\n**Final Output:** Generate ONLY the final, edited image. No text or labels.`;

    const parts: ({ text: string } | { inlineData: { data: string, mimeType: string } })[] = [
        { text: fullPrompt },
        originalImagePart
    ];

    if (maskImageBase64) {
        const maskMimeType = maskImageBase64.match(/data:(image\/.*?);/)?.[1] || 'image/png';
        parts.push(base64ToGeminiPart(maskImageBase64, maskMimeType));
    }
    if (referenceImagesBase64) {
        referenceImagesBase64.forEach(refImg => {
            const refMimeType = refImg.match(/data:(image\/.*?);/)?.[1] || 'image/png';
            parts.push(base64ToGeminiPart(refImg, refMimeType));
        });
    }
    
    const contents = { parts };

    const aiClient = ensureAiClient();
    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    if (!response.candidates?.length) {
        throw new Error("The AI did not return a valid response for the image edit.");
    }
    
    const imagePartResponse = response.candidates[0].content.parts.find(part => part.inlineData);
    if (imagePartResponse?.inlineData) {
        return {
            data: `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`,
            usage: createImageUsageRecord('Edit Page', 1)
        };
    }

    const textPartResponse = response.candidates[0].content.parts.find(part => part.text);
    if (textPartResponse?.text) {
      throw new Error(`The AI did not return an image. Response: "${textPartResponse.text}"`);
    }

    throw new Error("The AI did not return an edited image.");
}


export async function analyzeAndSuggestCorrections(
    panelLayoutImage: string,
    generatedImage: string,
    sceneDescription: string,
    characters: Character[]
): Promise<{ data: AnalysisResult, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> {
    const layoutMimeType = panelLayoutImage.match(/data:(image\/.*?);/)?.[1] || 'image/png';
    const layoutPart = base64ToGeminiPart(panelLayoutImage, layoutMimeType);
    const generatedMimeType = generatedImage.match(/data:(image\/.*?);/)?.[1] || 'image/png';
    const generatedPart = base64ToGeminiPart(generatedImage, generatedMimeType);

    const characterInfo = characters.map(c => `- ${c.name}`).join('\n');

    const prompt = `
You are a QA assistant for a manga creation tool. Analyze a generated manga page for deviations from the plan.

**Assets:**
1.  **Layout & Pose Guide (Image 1):** The user's plan.
2.  **Generated Manga Page (Image 2):** The final AI-generated image.
3.  **Scene Script:** The text description.
4.  **Character List:** Names of characters involved.

**Analysis Task:**
Compare the "Generated Manga Page" against the "Layout & Pose Guide" and "Scene Script". Look for these discrepancies:
-   **Incorrect Characters:** Wrong character used, or character missing/added.
-   **Incorrect Poses:** Final pose differs significantly from the skeleton guide.
-   **Layout Deviations:** Panel shapes/arrangement differs from the guide.
-   **Script Contradictions:** Image contradicts the script's actions or descriptions.
-   **Character Duplication/Placement Errors:** A character appearing illogically (e.g., in two places at once, in a contextually inappropriate situation).

**Output:**
Respond with a single JSON object with the following structure:
{
  "analysis": "A brief summary of your findings. Describe discrepancies or state that the image is accurate.",
  "has_discrepancies": boolean, // true if issues were found, otherwise false.
  "correction_prompt": "If true, write a detailed, specific instruction prompt for an image editing AI to fix ALL identified issues at once. If false, this should be an empty string."
}

**Example Correction Prompt:** "In the top-left panel, redraw 'Kaito' to match the skeleton pose, holding a sword. In the bottom panel, add the missing character 'Anya', looking surprised. Remove the duplicate 'Kaito' on the right."

**Scene Script:**
---
${sceneDescription}
---

**Characters in Scene:**
${characterInfo}
`;
    const contents = {
        parts: [{ text: prompt }, layoutPart, generatedPart],
    };

    const aiClient = ensureAiClient();
    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    analysis: { type: Type.STRING },
                    has_discrepancies: { type: Type.BOOLEAN },
                    correction_prompt: { type: Type.STRING },
                },
                required: ["analysis", "has_discrepancies", "correction_prompt"]
            }
        }
    });
    
    try {
        const jsonText = response.text;
        const result = JSON.parse(jsonText) as AnalysisResult;
        return {
            data: result,
            usage: createTextUsageRecord('Analyze Page', response)
        };
    } catch (e) {
        console.error("Failed to parse analysis JSON:", e);
        throw new Error("The AI returned an invalid analysis structure.");
    }
}
