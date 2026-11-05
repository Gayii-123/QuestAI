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

export interface InspectionPhotoPayload {
  id: string;
  name: string;
  url: string;
  size?: number;
  timestamp?: string;
}

export interface PhotoInspectionRequest {
  bankId: string;
  bankName?: string;
  department: string;
  trafficSubtype?: '12D' | '12AB';
  selectedRiskBanks?: string[];
  photos: InspectionPhotoPayload[];
  siteNotes?: string;
  inspectorName?: string;
  jobReference?: string;
}

export interface QuestionAiEvaluation {
  questionId: string;
  suggestedRating: '1' | '-1' | '0' | '';
  evidence: string;
  reasoning: string;
  confidenceScore: number;
  requiresHumanVerification: boolean;
  carActionPlan?: string;
  photoIds?: string[];
}

export interface PhotoInspectionResult {
  bankId: string;
  department: string;
  totalEvaluated: number;
  passCount: number;
  carCount: number;
  naCount: number;
  needsReviewCount: number;
  photoCount: number;
  evaluations: Record<string, QuestionAiEvaluation>;
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

