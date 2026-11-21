import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGO_URI: z.string().default('mongodb://localhost:27017/ai_hotel_agent'),
  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  PINECONE_API_KEY: z.string().optional().default(''),
  PINECONE_INDEX_NAME: z.string().optional().default('hotel-knowledge'),
  PINECONE_DIMENSION: z.coerce.number().default(1024),
  LANGCHAIN_TRACING_V2: z.string().optional().default('false'),
  LANGCHAIN_API_KEY: z.string().optional().default(''),
  LANGCHAIN_PROJECT: z.string().optional().default('hotel-booking-agent'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
