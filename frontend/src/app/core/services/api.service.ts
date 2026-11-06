import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
}

export interface AIServiceStatusResponse {
  success: boolean;
  data: {
    serviceName: string;
    configured: boolean;
    model: string;
    version: string;
    ready: boolean;
    notes: string;
  };
  timestamp: string;
}

export interface GenerateTextResponse {
  success: boolean;
  data: {
    text: string;
    model: string;
    generatedAt: string;
    latencyMs: number;
  };
  timestamp: string;
}

export interface InspectionResponse {
  success: boolean;
  data: {
    inspectionId: string;
    summary: string;
    overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    findings: Array<{
      id: string;
      category: string;
      severity: string;
      title: string;
      description: string;
      location?: string;
      recommendation: string;
      confidenceScore: number;
    }>;
    analyzedAt: string;
    modelIdentifier: string;
    isMock: boolean;
  };
  timestamp: string;
}

export type AiSuggestedRating = '1' | '-1' | '0' | null;

export interface InspectionPhotoPayload {
  id: string;
  name: string;
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
  suggestedRating: '1' | '-1' | '0' | '';
  selectAnswer: string | null;
  multiselectAnswers: string[] | null;
  confidence: number;
  confidenceScore: number;
  evidenceObserved: string;
  evidence: string;
  reasoning: string;
  needsHumanVerification: boolean;
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
  overallSiteRisk: 'low' | 'medium' | 'high' | 'critical';
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

export interface PhotoInspectionResponseWrapper {
  success: boolean;
  data: PhotoInspectionResult;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Check backend health status (GET /api/health)
   */
  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.apiUrl}/health`);
  }

  /**
   * Get AI service status & readiness (GET /api/ai/status)
   */
  getAiStatus(): Observable<AIServiceStatusResponse> {
    return this.http.get<AIServiceStatusResponse>(`${this.apiUrl}/ai/status`);
  }

  /**
   * Send text prompt to Gemini AI model via backend proxy (POST /api/ai/generate)
   */
  generateText(prompt: string): Observable<GenerateTextResponse> {
    return this.http.post<GenerateTextResponse>(`${this.apiUrl}/ai/generate`, { prompt });
  }

  /**
   * Send site inspection request to AI service placeholder (POST /api/ai/inspect)
   */
  runInspection(siteName: string, notes?: string): Observable<InspectionResponse> {
    const payload = {
      inspectionId: `INSP-${Date.now()}`,
      siteName,
      notes: notes || 'Baseline site inspection',
    };
    return this.http.post<InspectionResponse>(`${this.apiUrl}/ai/inspect`, payload);
  }

  /**
   * Multimodal inspection evaluation of site photographs (POST /api/ai/inspect-photos)
   */
  analyzeInspectionPhotos(payload: PhotoInspectionRequest): Observable<PhotoInspectionResponseWrapper> {
    return this.http.post<PhotoInspectionResponseWrapper>(`${this.apiUrl}/ai/inspect-photos`, payload);
  }
}

