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
}

