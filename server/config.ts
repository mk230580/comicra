import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid server configuration', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid server configuration');
}

export const appConfig = parsed.data;

export const hasGeminiKey = Boolean(appConfig.GEMINI_API_KEY);

export const requireGeminiKey = () => {
  if (!appConfig.GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured on the server');
  }
  return appConfig.GEMINI_API_KEY;
};
