import dotenv from 'dotenv';
import path from 'path';

// Load .env file from backend root regardless of current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  FRONTEND_URL: string;
  MAX_REQUEST_SIZE: string;
  MAX_PHOTOS_PER_REQUEST: number;
  MAX_IMAGE_SIZE_BYTES: number;
  MAX_TOTAL_IMAGES_BYTES: number;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  GOOGLE_CLOUD_LOCATION?: string;
  /** Names (never values) of required Gemini variables that are missing or still placeholders. */
  GEMINI_MISSING_VARS: string[];
  /** True only when every required Gemini variable is present. Does NOT mean Gemini is reachable. */
  IS_GEMINI_CONFIGURED: boolean;
}

const PLACEHOLDER_PATTERN = /^your_|_placeholder$/i;

function readVar(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || PLACEHOLDER_PATTERN.test(value)) return undefined;
  return value;
}

/**
 * Validates and parses environment variables.
 * Core server variables fail fast. Gemini variables are validated and reported by name only,
 * so the server (and /api/health) still starts and /api/ai/status can explain what is missing.
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
  const maxRequestSize = process.env.MAX_REQUEST_SIZE || '50mb';
  const maxPhotos = Math.max(1, parseInt(process.env.MAX_PHOTOS_PER_REQUEST || '10', 10) || 10);
  const maxImageSizeMb = Math.max(1, parseFloat(process.env.MAX_IMAGE_SIZE_MB || '10') || 10);
  const maxTotalImagesMb = Math.max(1, parseFloat(process.env.MAX_TOTAL_IMAGES_MB || '25') || 25);

  // Gemini / Agent Platform configuration
  const geminiApiKey = readVar('GEMINI_API_KEY');
  const geminiModel = readVar('GEMINI_MODEL');
  const project = readVar('GOOGLE_CLOUD_PROJECT');
  const location = readVar('GOOGLE_CLOUD_LOCATION');

  const missing: string[] = [];
  if (!geminiApiKey) missing.push('GEMINI_API_KEY');
  if (!geminiModel) missing.push('GEMINI_MODEL');
  if (!project) missing.push('GOOGLE_CLOUD_PROJECT');
  if (!location) missing.push('GOOGLE_CLOUD_LOCATION');

  if (missing.length > 0) {
    console.warn(
      `[QuestAI Config Warning] Gemini is not fully configured. Missing or placeholder variable(s): ${missing.join(', ')}. ` +
        'Set them in backend/.env.'
    );
  }

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
    MAX_PHOTOS_PER_REQUEST: maxPhotos,
    MAX_IMAGE_SIZE_BYTES: Math.round(maxImageSizeMb * 1024 * 1024),
    MAX_TOTAL_IMAGES_BYTES: Math.round(maxTotalImagesMb * 1024 * 1024),
    GEMINI_API_KEY: geminiApiKey,
    GEMINI_MODEL: geminiModel,
    GOOGLE_CLOUD_PROJECT: project,
    GOOGLE_CLOUD_LOCATION: location,
    GEMINI_MISSING_VARS: missing,
    IS_GEMINI_CONFIGURED: missing.length === 0,
  };
}

export const env: AppConfig = validateEnv();
