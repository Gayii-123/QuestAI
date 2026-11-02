/**
 * Types and interfaces for the QuestAI Site Inspection AI service.
 * These will be backed by the Google Gemini API in subsequent development phases.
 */

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

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

export interface AIServiceStatus {
  serviceName: string;
  configured: boolean;
  model: string;
  version: string;
  ready: boolean;
  notes: string;
}

/**
 * Contract for Site Inspection AI services.
 * Allows switching between Gemini implementation, mocks for testing, or future multi-model pipelines.
 */
export interface IAIService {
  getStatus(): Promise<AIServiceStatus>;
  analyzeInspection(request: SiteInspectionAnalysisRequest): Promise<SiteInspectionAnalysisResult>;
}

