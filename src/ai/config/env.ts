import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Mastra / AI 
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).describe('Gemini API Key'),
  EXA_API_KEY: z.string().min(1).optional().describe('Exa search for researchAgent'),

  // Turso (LibSQL)
  TURSO_DATABASE_URL: z.string().min(1).optional().describe('Remote LibSQL/Turso URL'),
  TURSO_AUTH_TOKEN: z.string().min(1).optional().describe('Turso Auth Token'),

  // Redis (If you decide to use it for agent job queues later)
  REDIS_URL: z.string().url().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Agent Environment Validation Failed:');
  console.table(result.error.flatten().fieldErrors);
}

export const env = result.data || {} as z.infer<typeof envSchema>;
