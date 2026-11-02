import dotenv from 'dotenv';
import path from 'path';

// Load .env file from backend root if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  FRONTEND_URL: string;
  MAX_REQUEST_SIZE: string;
  GEMINI_API_KEY?: string;
  IS_GEMINI_CONFIGURED: boolean;
}

/**
 * Validates and parses environment variables.
 * Fails early and loudly if required variables are misconfigured.
 */
function validateEnv(): AppConfig {
  const errors: string[] = [];

  // NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push(`Invalid NODE_ENV: "${nodeEnv}". Expected one of: development, production, test.`);
  }

  // PORT
  const rawPort = process.env.PORT || '5001';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    errors.push(`Invalid PORT: "${rawPort}". Expected a number between 1 and 65535.`);
  }

  // FRONTEND_URL
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  try {
    new URL(frontendUrl);
  } catch {
    errors.push(`Invalid FRONTEND_URL: "${frontendUrl}". Expected a valid URL (e.g. http://localhost:4200).`);
  }

  // MAX_REQUEST_SIZE
  const maxRequestSize = process.env.MAX_REQUEST_SIZE || '10mb';

  // GEMINI_API_KEY (placeholder / optional for current phase)
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const isGeminiConfigured = Boolean(
    geminiApiKey &&
    geminiApiKey !== 'your_gemini_api_key_placeholder' &&
    geminiApiKey.length > 10
  );

  if (errors.length > 0) {
    const message = `Environment configuration error(s):\n  - ${errors.join('\n  - ')}`;
    console.error(`[QuestAI Config Error] ${message}`);
    throw new Error(message);
  }

  return {
    NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
    PORT: port,
    FRONTEND_URL: frontendUrl,
    MAX_REQUEST_SIZE: maxRequestSize,
    GEMINI_API_KEY: geminiApiKey,
    IS_GEMINI_CONFIGURED: isGeminiConfigured,
  };
}

export const env: AppConfig = validateEnv();

