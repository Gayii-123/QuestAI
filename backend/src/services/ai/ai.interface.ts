/**
 * Types and interfaces for the QuestAI Site Inspection AI service.
 */

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Standard Quest rating values for AI suggestions:
 * "1"  = Pass / Compliant
 * "-1" = CAR Required / Non-compliant
 * "0"  = Not Applicable
 * null = Insufficient evidence / Requires human verification
 */
export type AiSuggestedRating = '1' | '-1' | '0' | null;

export interface InspectionFinding {
  id: string;
  category: 'safety' | 'structural' | 'finish' | 'compliance' | 'other';
  severity: SeverityLevel;
  title: string;
  description: string;
  location?: string;
  recommendation: string;
  confidenceScore: number; // 0.0 to 1.0
}

export interface SiteInspectionAnalysisRequest {
  inspectionId: string;
  siteName: string;
  notes?: string;
  imageUrls?: string[];
  metadata?: Record<string, unknown>;
}

export interface SiteInspectionAnalysisResult {
  inspectionId: string;
  summary: string;
  overallRiskLevel: SeverityLevel;
  findings: InspectionFinding[];
  analyzedAt: string;
  modelIdentifier: string;
  isMock: boolean;
}

export type AIConnectionState =
  | 'not_configured' // required env variables missing
  | 'configured' // config present, no real request verified yet
  | 'connected' // a real Gemini request succeeded recently
  | 'auth_error' // key invalid / permission denied
  | 'model_not_found'
  | 'quota_exceeded'
  | 'unreachable'; // network / timeout / service unavailable

export interface AIServiceStatus {
  provider: string;
  serviceName: string;
  configured: boolean;
  sdkInitialized: boolean;
  connectionVerified: boolean;
  model: string | null;
  status: AIConnectionState;
  missingConfig: string[];
  lastVerifiedAt: string | null;
  lastError: string | null;
  notes: string;
  // Kept for backward compatibility with the existing frontend contract
  version: string;
  ready: boolean;
}

export interface TextGenerationResult {
  text: string;
  model: string;
  generatedAt: string;
  latencyMs: number;
}

export type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface InspectionPhotoPayload {
  id: string;
  name: string;
  /** Base64 data URL (e.g. data:image/jpeg;base64,...) or raw base64 string */
  url?: string;
  base64Data?: string;
  mimeType?: string;
  size?: number;
  timestamp?: string;
}

export interface InspectionQuestionPayload {
  id: string;
  qtext?: string;
  headername?: string;
  qnum?: string | number;
  typeofans?: string[];
  select?: unknown[];
  multiselect?: unknown[];
  conditionalRule?: unknown;
}

export interface PhotoInspectionRequest {
  bankId: string;
  bankName: string;
  department: string;
  /** Canonical Quest questions belonging to the selected bank */
  questions: InspectionQuestionPayload[];
  trafficSubtype?: '12D' | '12AB';
  selectedRiskBanks?: string[];
  photos: InspectionPhotoPayload[];
  siteName?: string;
  inspectionDate?: string;
  siteNotes?: string;
  inspectorName?: string;
  jobReference?: string;
}

export interface QuestionAiEvaluation {
  questionId: string;
  rating: AiSuggestedRating;
  /** Kept in sync with rating ('' when null) for existing contract compatibility */
  suggestedRating: '1' | '-1' | '0' | '';
  selectAnswer: string | null;
  multiselectAnswers: string[] | null;
  confidence: number;
  /** Kept in sync with confidence for existing contract compatibility */
  confidenceScore: number;
  evidenceObserved: string;
  /** Kept in sync with evidenceObserved for existing contract compatibility */
  evidence: string;
  reasoning: string;
  needsHumanVerification: boolean;
  /** Kept in sync with needsHumanVerification for existing contract compatibility */
  requiresHumanVerification: boolean;
  carActionPlan: string | null;
  photoIds?: string[];
}

export interface PhotoInspectionResult {
  inspectionBankId: string;
  inspectionBankName: string;
  bankId: string;
  bankName: string;
  department: string;
  photoCount: number;
  summary: string;
  overallSiteRisk: SeverityLevel;
  totalEvaluated: number;
  passCount: number;
  carCount: number;
  naCount: number;
  needsReviewCount: number;
  evaluations: QuestionAiEvaluation[];
  evaluationsMap: Record<string, QuestionAiEvaluation>;
  recommendations: string[];
  analyzedAt: string;
  modelIdentifier: string;
  isMock: boolean;
  notes: string;
}

/**
 * Contract for Site Inspection AI services.
 */
export interface IAIService {
  getStatus(options?: { forceVerify?: boolean }): Promise<AIServiceStatus>;
  generateText(prompt: string): Promise<TextGenerationResult>;
  analyzeInspection(request: SiteInspectionAnalysisRequest): Promise<SiteInspectionAnalysisResult>;
  analyzeInspectionPhotos(request: PhotoInspectionRequest): Promise<PhotoInspectionResult>;
}
