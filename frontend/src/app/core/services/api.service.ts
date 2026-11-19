import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
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
  /** Rules telling the AI to act as a careful site inspector and answer strictly from the photos */
  inspectorGuidelines?: string;
  /** Whether the AI may add extra observations for issues not covered by the questions */
  allowAdditionalObservations?: boolean;
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

export interface PhotoAssessmentItem {
  photoId: string;
  description: string;
  relevant: boolean;
  quality: 'clear' | 'partial' | 'poor';
  usable: boolean;
}

export interface AdditionalObservationItem {
  title: string;
  rating: '1' | '-1';
  confidence: number;
  evidenceObserved: string;
  photoIds?: string[];
  carActionPlan?: string | null;
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
  photoAssessments?: PhotoAssessmentItem[];
  additionalObservations?: AdditionalObservationItem[];
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

export interface StartSessionRequest {
  conversationId?: string;
  bankId: string;
  trafficSubtype?: '12D' | '12AB';
  selectedRiskBanks?: string[];
  siteContext?: {
    siteName?: string;
    location?: string;
    jobReference?: string;
    initialNotes?: string;
  };
  ownerUid?: string;
}

export interface NextActionData {
  type: 'ask_question' | 'request_photo' | 'draft_ready';
  questionId?: string;
  headername?: string;
  qnum?: string | number;
  canonicalText?: string;
  conversationalPrompt?: string;
  prompt?: string;
  inputType?: 'text' | 'rating' | 'select' | 'multiselect';
  allowedChoices?: string[];
  draftReady?: boolean;
  unresolvedCount?: number;
  message?: string;
}

export interface StartSessionResponse {
  success: boolean;
  data: {
    inspectionId: string;
    conversationId: string;
    bankId: string;
    bankName: string;
    department: string;
    workflowStatus: string;
    message: { type: string; text: string };
    stats: any;
    createdAt: string;
  };
  timestamp: string;
}

export interface EvidenceBatchResponse {
  success: boolean;
  data: {
    inspectionId: string;
    batchId: string;
    visualSummary: string;
    newObservationsCount: number;
    updatedQuestionIds: string[];
    workflowStatus: string;
    nextAction: NextActionData;
  };
  timestamp: string;
}

export interface SubmitAnswerResponse {
  success: boolean;
  data: {
    inspectionId: string;
    updatedQuestionId: string;
    interpretation: any;
    nextAction: NextActionData;
  };
  timestamp: string;
}

export interface SaveInspectionResponse {
  success: boolean;
  id: string;
  referenceNumber: string;
  collection: string;
  message: string;
  timestamp: string;
}

export interface GetInspectionsResponse {
  success: boolean;
  count: number;
  data: any[];
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Resolves endpoint URL dynamically based on whether backend is hosted as
   * individual Cloud Functions (us-central1-quest-uk898.cloudfunctions.net/questAi...),
   * a unified Express proxy (/questAiApi or /api), or custom endpoint map.
   */
  private getEndpointUrl(
    action:
      | 'health'
      | 'status'
      | 'generate'
      | 'inspect'
      | 'inspectPhotos'
      | 'saveInspection'
      | 'sessionStart'
      | 'evidenceBatch'
      | 'submitAnswer'
      | 'getSession'
      | 'prepareDraft'
      | 'confirmDraft'
  ): string {
    const custom = (environment as { endpoints?: Record<string, string> }).endpoints;
    if (custom && custom[action]) {
      return custom[action];
    }

    const base = (this.apiUrl || '').replace(/\/+$/, '');
    const isCloudFunctionsRoot =
      base.includes('cloudfunctions.net') && !base.endsWith('/questAiApi');

    if (isCloudFunctionsRoot) {
      switch (action) {
        case 'health': return `${base}/questAiHealth`;
        case 'status': return `${base}/questAiStatus`;
        case 'generate': return `${base}/questAiGenerateText`;
        case 'inspect': return `${base}/questAiInspect`;
        case 'inspectPhotos': return `${base}/questAiInspectPhotos`;
        case 'saveInspection': return `${base}/questAiSaveInspection`;
        case 'sessionStart': return `${base}/questAiSessionStart`;
        case 'evidenceBatch': return `${base}/questAiEvidenceBatch`;
        case 'submitAnswer': return `${base}/questAiSubmitAnswer`;
        case 'getSession': return `${base}/questAiGetSession`;
        case 'prepareDraft': return `${base}/questAiPrepareDraft`;
        case 'confirmDraft': return `${base}/questAiConfirmDraft`;
      }
    }

    switch (action) {
      case 'health': return `${base}/health`;
      case 'status': return `${base}/ai/status`;
      case 'generate': return `${base}/ai/generate`;
      case 'inspect': return `${base}/ai/inspect`;
      case 'inspectPhotos': return `${base}/ai/inspect-photos`;
      case 'saveInspection': return `${base}/api/inspections`;
      case 'sessionStart': return `${base}/session/start`;
      case 'evidenceBatch': return `${base}/session/evidence`;
      case 'submitAnswer': return `${base}/session/answer`;
      case 'getSession': return `${base}/session`;
      case 'prepareDraft': return `${base}/session/draft`;
      case 'confirmDraft': return `${base}/session/confirm`;
    }
  }

  /**
   * Check backend health status (GET /health or /questAiHealth)
   */
  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(this.getEndpointUrl('health'));
  }

  /**
   * Get AI service status & readiness (GET /ai/status or /questAiStatus)
   */
  getAiStatus(): Observable<AIServiceStatusResponse> {
    return this.http.get<AIServiceStatusResponse>(this.getEndpointUrl('status'));
  }

  /**
   * Send text prompt to Gemini AI model (POST /ai/generate or /questAiGenerateText)
   */
  generateText(prompt: string): Observable<GenerateTextResponse> {
    return this.http.post<GenerateTextResponse>(this.getEndpointUrl('generate'), { prompt });
  }

  /**
   * Send site inspection request to AI service (POST /ai/inspect or /questAiInspect)
   */
  runInspection(siteName: string, notes?: string): Observable<InspectionResponse> {
    const payload = {
      inspectionId: `INSP-${Date.now()}`,
      siteName,
      notes: notes || 'Baseline site inspection',
    };
    return this.http.post<InspectionResponse>(this.getEndpointUrl('inspect'), payload);
  }

  /**
   * Multimodal inspection evaluation of site photographs (POST /ai/inspect-photos or /questAiInspectPhotos)
   */
  analyzeInspectionPhotos(payload: PhotoInspectionRequest): Observable<PhotoInspectionResponseWrapper> {
    return this.http
      .post<PhotoInspectionResponseWrapper>(this.getEndpointUrl('inspectPhotos'), payload)
      .pipe(timeout(35000));
  }

  /**
   * Save finalized inspection report to Quest Firestore collection 'quest-ai-inspections'
   */
  saveFinalizedInspection(report: any): Observable<SaveInspectionResponse> {
    return this.http.post<SaveInspectionResponse>(this.getEndpointUrl('saveInspection'), { report });
  }

  /**
   * Fetch stored inspections from Quest Firestore collection 'quest-ai-inspections'
   */
  getStoredInspections(bankId?: string): Observable<GetInspectionsResponse> {
    const url = this.getEndpointUrl('saveInspection');
    const params = bankId ? `?bankId=${encodeURIComponent(bankId)}` : '';
    return this.http.get<GetInspectionsResponse>(`${url}${params}`);
  }

  /**
   * Guided Conversational: Start a new inspection session
   */
  startInspectionSession(payload: StartSessionRequest): Observable<StartSessionResponse> {
    return this.http.post<StartSessionResponse>(this.getEndpointUrl('sessionStart'), payload);
  }

  /**
   * Guided Conversational: Ingest a new evidence photograph batch into session
   */
  addEvidenceBatch(payload: { inspectionId: string; batchId?: string; photos: any[] }): Observable<EvidenceBatchResponse> {
    return this.http.post<EvidenceBatchResponse>(this.getEndpointUrl('evidenceBatch'), payload);
  }

  /**
   * Guided Conversational: Submit natural language user reply for current active question
   */
  submitInspectionAnswer(payload: { inspectionId: string; questionId?: string; reply: { text: string; selectedValue?: string } }): Observable<SubmitAnswerResponse> {
    return this.http.post<SubmitAnswerResponse>(this.getEndpointUrl('submitAnswer'), payload);
  }

  /**
   * Guided Conversational: Retrieve session state and all assessments
   */
  getInspectionSession(inspectionId: string): Observable<any> {
    const url = this.getEndpointUrl('getSession');
    return this.http.get<any>(`${url}?id=${encodeURIComponent(inspectionId)}`);
  }

  /**
   * Guided Conversational: Prepare structured review draft
   */
  prepareInspectionDraft(inspectionId: string): Observable<any> {
    const url = this.getEndpointUrl('prepareDraft');
    return this.http.get<any>(`${url}?id=${encodeURIComponent(inspectionId)}`);
  }

  /**
   * Guided Conversational: Confirm inspection draft by human inspector
   */
  confirmInspectionDraft(inspectionId: string, details?: any): Observable<any> {
    return this.http.post<any>(this.getEndpointUrl('confirmDraft'), { inspectionId, ...details });
  }
}

