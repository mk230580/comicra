import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import type { AISuggestions, SceneAnalysis, Character, VideoModelId, InitialSceneData, UsageRecord } from '../types';

// Development-time key from Vite env. For production, proxy via server.
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY is not set. Add it to .env.local.");
}
const ai = new GoogleGenAI({ apiKey });

function base64ToGeminiPart(base64: string, mimeType: string) {
  return {
    inlineData: {
      data: base64.split(',')[1],
      mimeType,
    },
  };
}

// FIX: Add usage record creation functions to enable usage tracking.
const createTextUsageRecord = (task: string, response: GenerateContentResponse): Omit<UsageRecord, 'id' | 'timestamp'> => {
    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = promptTokens + completionTokens;
    return { task, tokens: totalTokens, costUSD: 0 }; // Cost is 0 as pricing is unknown here
};

const createImageUsageRecord = (task: string, imageCount: number): Omit<UsageRecord, 'id' | 'timestamp'> => {
    return { task, images: imageCount, costUSD: 0 }; // Cost is 0 as pricing is unknown here
};

const createVideoUsageRecord = (task: string, durationSeconds: number): Omit<UsageRecord, 'id' | 'timestamp'> => {
    return { task, videoSeconds: durationSeconds, costUSD: 0 }; // Cost is 0 as pricing is unknown here
};


const createBlankCanvasAsBase64 = (width: number, height: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
    }
    return canvas.toDataURL('image/png');
};

const blank16x9Canvas = createBlankCanvasAsBase64(1280, 720);

// Schema for generating suggestions
const suggestionsSchema = {
    type: Type.OBJECT,
    properties: {
        transition: {
            type: Type.STRING,
            description: "A creative video transition name (e.g., 'Whip Pan', 'Glitch Cut', 'Morph')."
        },
        vfx: { 
            type: Type.STRING,
            description: "A visual effect to apply (e.g., '8mm Film Grain', 'Chromatic Aberration', 'Slow Motion')."
        },
        camera: { 
            type: Type.STRING,
            description: "A camera movement or angle (e.g., 'Dolly Zoom In', 'Low Angle Shot', 'Crane Shot Up')."
        },
        narrative: {
            type: Type.STRING,
            description: "A brief, one-sentence description of a dynamic action that connects the start and end frames, implying noticeable change over the scene's duration."
        }
    },
    required: ["transition", "vfx", "camera", "narrative"]
};

// Schema for the initial storyboard analysis from webtoon pages
export const webtoonStoryboardSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            sceneDescription: { 
                type: Type.STRING,
                description: 'A detailed, cinematic prompt for an AI image generator based on one webtoon panel. It should describe the characters, setting, action, and dialogue visible in the panel.'
            },
            narrative: {
                type: Type.STRING,
                description: 'A brief, one-sentence description of a dynamic action that should occur during the animated scene, implying movement or change.'
            },
            duration: {
                type: Type.NUMBER,
                description: 'The estimated duration of this specific scene in seconds (e.g., 3, 5, 7, 10). Must not exceed 10 seconds.'
            },
            charactersInScene: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'A list of character names present in this scene, based on the provided character list.'
            },
            sourcePageIndex: {
                type: Type.NUMBER,
                description: 'The 0-based index of the source webtoon page image this panel was extracted from.'
            }
        },
        required: ["sceneDescription", "narrative", "duration", "charactersInScene", "sourcePageIndex"]
    }
};

export const recommendVideoModel = async (
    sceneDescription: string,
    narrative: string,
): Promise<{ data: { model: VideoModelId, reasoning: string }, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> => {
    const prompt = `
You are an AI video generation consultant. Recommend the best model for a scene based on their strengths.

**Models & Specialties:**
- **Seedance Pro 1.0**: Multi-shot narrative sequences, high character/style consistency.
- **Hailuo 02**: Complex physics, dynamic motion, action (sports, water, cloth).
- **Veo 3**: Synchronized video and audio (dialogue, SFX, music). Up to 4K.
- **Kling**: Maintains consistency with multiple reference images. Good for bulk generation.

**Scene to Analyze:**
- **Visuals:** "${sceneDescription}"
- **Action:** "${narrative}"

Choose the single best model from ['seedance', 'hailuo', 'veo', 'kling'] and provide brief reasoning.
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    model: { 
                        type: Type.STRING,
                        description: "The recommended model ID. Must be one of: 'seedance', 'hailuo', 'veo', 'kling'."
                    },
                    reasoning: {
                        type: Type.STRING,
                        description: "A brief explanation for why this model was chosen for the given scene."
                    }
                },
                required: ["model", "reasoning"]
            }
        }
    });

    try {
        const result = JSON.parse(response.text.trim());
        return {
            data: result as { model: VideoModelId, reasoning: string },
            usage: createTextUsageRecord('Recommend Video Model', response)
        };
    } catch (e) {
        console.error("Failed to parse model recommendation JSON:", e);
        // Fallback in case of failure
        return {
            data: { model: 'seedance', reasoning: 'Default recommendation due to an error.' },
            usage: createTextUsageRecord('Recommend Video Model (Failed)', response)
        };
    }
}


// 1. Generate the initial storyboard structure from manga pages
export const generateStoryboardFromPages = async (
    pageImages: { data: string, mimeType: string }[],
    characters: Pick<Character, 'name' | 'description'>[]
): Promise<{ data: InitialSceneData[], usage: Omit<UsageRecord, 'id' | 'timestamp'> }> => {
    const characterList = characters.map(c => `- ${c.name}: ${c.description || 'No description'}`).join('\n');

    const systemInstruction = `As a storyboard artist, analyze the provided manga pages and break them into individual animated scenes. For each scene (panel), provide the following in JSON format:
1.  **sceneDescription**: A detailed, cinematic prompt for an AI image generator to create the first frame in a modern anime style. Describe characters, setting, action, mood, lighting, and camera angle. Invent a plausible, detailed background if the original is simple or missing. **Ignore all text, speech bubbles, and sound effects.** The result should be a dynamic 16:9 frame, not a static comic panel.
2.  **narrative**: A single sentence describing the key action that occurs *during* the scene.
3.  **duration**: Scene duration in seconds (integer, 3-10).
4.  **charactersInScene**: A list of character names present in the scene, matching the provided character list.
5.  **sourcePageIndex**: The 0-based index of the source page image.

**Available Characters:**
${characterList}
`;

    const imageParts = pageImages.map(img => base64ToGeminiPart(img.data, img.mimeType));

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{text: systemInstruction}, ...imageParts] },
        config: {
            responseMimeType: "application/json",
            responseSchema: webtoonStoryboardSchema,
        },
    });
    
    const usage = createTextUsageRecord('Storyboard Generation', response);

    try {
        const panels = JSON.parse(response.text.trim()) as Omit<InitialSceneData, 'recommendedModel' | 'reasoning'>[];
        
        const enrichedPanels = await Promise.all(panels.map(async (panel) => {
            const { data: { model, reasoning }, usage: recommendUsage } = await recommendVideoModel(panel.sceneDescription, panel.narrative);
            usage.tokens = (usage.tokens || 0) + (recommendUsage.tokens || 0);
            usage.costUSD += recommendUsage.costUSD;

            return {
                ...panel,
                duration: Math.min(Math.round(panel.duration), 10),
                recommendedModel: model,
                reasoning: reasoning,
            };
        }));

        return { data: enrichedPanels, usage };
    } catch (e) {
        console.error("Failed to parse webtoon storyboard or get recommendations:", e);
        throw new Error("Failed to get a valid storyboard from AI.");
    }
};

// 2. Generate a single image (start frame)
export const generateVideoFrame = async (prompt: string, referenceImage: {data: string, mimeType: string}): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
            parts: [
                base64ToGeminiPart(blank16x9Canvas, 'image/png'),
                base64ToGeminiPart(referenceImage.data, referenceImage.mimeType),
                { text: `On the provided blank 16:9 canvas, create a new, full-screen animation frame based on the provided manga panel and this description: "${prompt}".
                If the original panel's background is simple or white, you MUST generate a complete, detailed, and fitting background.
                IMPORTANT: The output must be a single, undivided 16:9 scene, NOT a comic panel layout.
                Strictly adhere to the art style, character designs, and colors of the original webtoon page. Do not produce a real photo.` },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imagePart?.inlineData) {
        return {
            data: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
            usage: createImageUsageRecord('Generate Video Frame', 1)
        };
    }
    const textPart = response.candidates?.[0]?.content?.parts.find(p => p.text);
    if (textPart?.text) {
        throw new Error(`AI did not return an image. Response: "${textPart.text}"`);
    }
    throw new Error("AI did not return an image for the video frame.");
};

// 3. Generate the end frame based on the start frame and narrative
export const generateWebtoonEndFrame = async (startFrameBase64: string, narrative: string, duration: number): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> => {
    const mimeType = startFrameBase64.match(/data:(image\/.*?);/)?.[1] || 'image/png';
    const startFramePart = base64ToGeminiPart(startFrameBase64, mimeType);
    const prompt = `As an expert animator, use the provided blank 16:9 canvas to create a dynamic end frame for a ${duration}-second scene. The goal is to show clear change from the start frame.
    
    **Instructions:**
    1.  **Analyze Start Frame:** Understand character pose, expression, and setting from the provided start frame.
    2.  **Action:** The key action during the scene is: "${narrative}".
    3.  **Generate End Frame:** Depict the clear *result* of this action.
    
    **Requirements:**
    - The end frame MUST be visually distinct from the start frame (changed pose, expression, or position).
    - Maintain perfect consistency for character design, clothing, and background.
    - Style MUST match the start frame (vibrant, modern webtoon/anime).
    - Output ONLY the edited 16:9 image.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [base64ToGeminiPart(blank16x9Canvas, 'image/png'), startFramePart, { text: prompt }] },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imagePart?.inlineData) {
        return {
            data: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
            usage: createImageUsageRecord('Generate End Frame', 1)
        };
    }
    const textPart = response.candidates?.[0]?.content?.parts.find(p => p.text);
    if (textPart?.text) {
        throw new Error(`AI did not return an image. Response: "${textPart.text}"`);
    }
    throw new Error("AI did not return an end frame for the webtoon scene.");
};

export const regenerateVideoFrame = async (
    originalFrameBase64: string,
    editPrompt: string,
    originalSceneDescription: string
): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> => {
    const mimeType = originalFrameBase64.match(/data:(image\/.*?);/)?.[1] || 'image/png';
    const originalFramePart = base64ToGeminiPart(originalFrameBase64, mimeType);

    const prompt = editPrompt
        ? `As an animator, revise this frame.
        **Base Image:** The original frame.
        **Instruction:** "${editPrompt}".
        **Context:** Original scene: "${originalSceneDescription}".
        **Task:** Re-render the image with the modification, maintaining original style, character design, and composition. Output ONLY the edited 16:9 image.`
        : `As an animator, create an alternative version of this frame.
        **Base Image:** Original frame.
        **Context:** Original scene: "${originalSceneDescription}".
        **Task:** Generate a new, different version based on the original context. Reinterpret it creatively while maintaining the art style, character designs, and 16:9 aspect ratio. Output ONLY the new 16:9 image.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalFramePart, { text: prompt }] },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imagePart?.inlineData) {
        return {
            data: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
            usage: createImageUsageRecord('Regenerate Frame', 1)
        };
    }
    const textPart = response.candidates?.[0]?.content?.parts.find(p => p.text);
    if (textPart?.text) {
        throw new Error(`AI did not return an image for regeneration. Response: "${textPart.text}"`);
    }
    throw new Error("AI did not return a regenerated image.");
};


// 4. Generate AI Suggestions
export const generateSuggestionsForScene = async (sceneDescription: string, duration: number): Promise<{ data: AISuggestions, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> => {
    const promptContent = `For a ${duration}-second anime-style scene based on "${sceneDescription}", generate creative suggestions. The narrative must describe a clear, dynamic action.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptContent,
        config: {
            responseMimeType: "application/json",
            responseSchema: suggestionsSchema,
        },
    });

    try {
        return {
            data: JSON.parse(response.text.trim()) as AISuggestions,
            usage: createTextUsageRecord('Generate Scene Suggestions', response)
        };
    } catch (e) {
        console.error("Failed to parse suggestions JSON:", e);
        throw new Error("Failed to get valid suggestions from AI.");
    }
};

// 5. Generate Final Consolidated Prompt
export const generateFinalVideoPrompt = async (sceneDescription: string, suggestions: AISuggestions, duration: number): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> => {
     const systemInstruction = `As a prompt engineer for an AI video generator, combine a scene idea and suggestions into a single, cohesive, detailed prompt for a ${duration}-second anime style scene.`;
    
    const userPrompt = `
      Scene Idea: "${sceneDescription}"
      Transition: "${suggestions.transition}"
      VFX: "${suggestions.vfx}"
      Camera: "${suggestions.camera}"
      Narrative Action: "${suggestions.narrative}"

      Combine these into one detailed video prompt.
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: { systemInstruction },
    });

    return {
        data: response.text.trim(),
        usage: createTextUsageRecord('Generate Final Prompt', response)
    };
};


// 6. Generate Model-Specific Prompts

const getCharacterAnchors = (scene: InitialSceneData, allCharacters: Pick<Character, 'name' | 'description'>[]): string => {
    return scene.charactersInScene.map(charName => {
        const charData = allCharacters.find(c => c.name === charName);
        return `- character: ${charName}, ${charData?.description || 'No description'}`;
    }).join('\n');
};

export const generateSeedancePrompt = (scene: InitialSceneData, allCharacters: Pick<Character, 'name' | 'description'>[]): string => {
    const charAnchors = getCharacterAnchors(scene, allCharacters);
    return `Title: Scene ${scene.sourcePageIndex + 1}
Duration: ${scene.duration}s  Aspect: 16:9  Style: cinematic, modern webtoon/anime style
Consistency anchors:
${charAnchors}
- mood: [auto-detect from scene]

Shot 1 (0-${scene.duration}s):
- action: ${scene.sceneDescription}. ${scene.narrative}.
- camera: [auto-detect from scene, cinematic]
- include anchors: all characters in scene

Negative:
- avoid: text artifacts, logos, watermarks, bad anatomy
`;
};

export const generateHailuoPrompt = (scene: InitialSceneData, allCharacters: Pick<Character, 'name' | 'description'>[]): string => {
    return `Task: Animate a short clip from a webtoon panel: ${scene.sceneDescription}
Length: ${scene.duration}s  Aspect: 16:9
Action physics:
- body mechanics: ${scene.narrative}, with realistic weight and momentum.
- speed profile: natural acceleration and deceleration.
- environment forces: subtle ambient motion.

Camera:
- rig: cinematic, dynamic camera that enhances the action.
- lens: 35mm
- move: subtle dolly or pan to follow action.

Look:
- style: vibrant, modern webtoon/anime, high contrast.
- lighting: cinematic lighting, rim lights, detailed shadows.

Negative:
- avoid: limb bending artifacts, background wobble, static comic look
`;
};

export const generateVeoPrompt = (scene: InitialSceneData, allCharacters: Pick<Character, 'name' | 'description'>[]): string => {
    return `Title: Webtoon Scene ${scene.sourcePageIndex + 1}
Duration: ${scene.duration}s  Aspect: 16:9  Style: High-quality anime scene, cinematic, detailed background.
Visual:
- Shot 1 (0-${scene.duration}s): ${scene.sceneDescription}. Action to perform: ${scene.narrative}.

Audio:
- sfx: [appropriate ambient sounds for the scene]
- music: [instrumental music matching the mood]

Negative:
- avoid: text, speech bubbles, panel borders, photorealism.
`;
};

export const generateKlingPrompt = (scene: InitialSceneData, allCharacters: Pick<Character, 'name' | 'description'>[]): string => {
    const charLocks = scene.charactersInScene.join(', ');
    return `Mode: High  Length: ${scene.duration}s  Aspect: 16:9  Style: anime, cinematic
Reference images:
- subject: [The provided webtoon panel is the primary style and character reference]
Lock:
- keep: [${charLocks} hairstyle, color, outfit, face]
- do not change: character designs from reference.

Shot plan:
- Shot 1 (0-${scene.duration}s): ${scene.sceneDescription}. During the shot, ${scene.narrative}.

Camera & Look:
- lens [35mm], movement [subtle, cinematic], lighting [dramatic, source-aware]

Negative:
- avoid: ref drift, extra accessories, background text
`;
};

export const generateAllModelPrompts = async (
    scene: InitialSceneData,
    characters: Pick<Character, 'name' | 'description'>[]
): Promise<Record<VideoModelId, string>> => {
    return {
        seedance: generateSeedancePrompt(scene, characters),
        hailuo: generateHailuoPrompt(scene, characters),
        veo: generateVeoPrompt(scene, characters),
        kling: generateKlingPrompt(scene, characters),
    };
};

export const generateVeoVideo = async (
    prompt: string,
    onProgressUpdate: (progress: string) => void,
    startFrame: { data: string; mimeType: string } | undefined,
    duration: number
): Promise<{ data: string, usage: Omit<UsageRecord, 'id' | 'timestamp'> }> => {
    onProgressUpdate("Starting video generation...");
    
    type VeoRequestPayload = {
        model: string;
        prompt: string;
        image?: { imageBytes: string; mimeType: string; };
        config: { numberOfVideos: number; };
    };

    const requestPayload: VeoRequestPayload = {
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        config: {
            numberOfVideos: 1
        }
    };

    if (startFrame?.data) {
        requestPayload.image = {
            imageBytes: startFrame.data.split(',')[1],
            mimeType: startFrame.mimeType,
        };
    }

    let operation = await ai.models.generateVideos(requestPayload);

    let pollCount = 0;
    const progressMessages = [
        "Casting characters...",
        "Setting up the scene...",
        "Director is shouting 'Action!'...",
        "Rendering photons...",
        "Compositing layers...",
        "Adding final touches..."
    ];

    while (!operation.done) {
        onProgressUpdate(progressMessages[pollCount % progressMessages.length]);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
        operation = await ai.operations.getVideosOperation({ operation: operation });
        pollCount++;
    }

    if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message}`);
    }

    onProgressUpdate("Fetching video...");
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation completed, but no download link was provided.");
    }
    
    // IMPORTANT: Appending the API key as a query parameter is required by the video download URI
    // but is an insecure practice in general web development. This assumes a secure, controlled
    // environment for this application. In a typical production scenario, this download should
    // be handled by a backend proxy.
    const response = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const videoBlob = await response.blob();
    return {
        data: URL.createObjectURL(videoBlob),
        usage: createVideoUsageRecord('Generate VEO Video', duration)
    };
};