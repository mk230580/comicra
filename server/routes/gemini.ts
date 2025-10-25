import { Router } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../errors';
import { generateMangaPage } from '../services/gemini';

const router = Router();

const characterSchema = z.object({
  id: z.string(),
  name: z.string(),
  sheetImage: z.string(),
  referenceImages: z.array(z.string()),
  description: z.string().optional(),
});

const previousPageSchema = z
  .object({
    generatedImage: z.string(),
    sceneDescription: z.string(),
  })
  .optional();

const generatePageSchema = z.object({
  characters: z.array(characterSchema),
  panelLayoutImage: z.string(),
  sceneDescription: z.string(),
  colorMode: z.enum(['color', 'monochrome']),
  previousPage: previousPageSchema,
  generateEmptyBubbles: z.boolean().default(false),
});

router.post('/generate-manga-page', async (req, res, next) => {
  const parsed = generatePageSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new BadRequestError('Invalid payload for manga page generation'));
    return;
  }

  try {
    const result = await generateMangaPage(
      parsed.data.characters,
      parsed.data.panelLayoutImage,
      parsed.data.sceneDescription,
      parsed.data.colorMode,
      parsed.data.previousPage,
      parsed.data.generateEmptyBubbles,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export const geminiRouter = router;
