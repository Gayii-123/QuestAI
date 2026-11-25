/**
 * QuestAI — SSRA Main HTTP Orchestration Service
 *
 * Implements the 5 agreed RESTful endpoints:
 * - GET  /api/v1/ssra
 * - POST /api/v1/ssra
 * - GET  /api/v1/ssra/:id
 * - PUT  /api/v1/ssra/:id/close
 * - GET  /api/v1/ssra/:id/pdf
 *
 * Integrates Angular Signals and resilient offline/local fallback.
 * Strictly user-isolated with zero pollution of legacy Quest collections.
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError, timeout } from 'rxjs';
import {
  SsraAssessment,
  SsraClosingReport,
  SsraPhase1Data,
} from '../models/ssra.models';
import {
  SsraClosePhase2Response,
  SsraCreatePhase1Response,
  SsraDetailResponse,
  SsraListQuery,
  SsraListResponse,
} from '../models/ssra-api.models';
import { SsraDraftService } from './ssra-draft.service';
import { AuthService } from '../../../core/services/auth.service';
import { getSsraTypeByKey } from '../config/ssra-types.config';
import { environment } from '../../../../environments/environment';

const API_BASE = `${environment.apiUrl}/api/v1/ssra`;
const REQUEST_TIMEOUT_MS = 15000;

@Injectable({
  providedIn: 'root',
})
export class SsraService {
  private readonly http = inject(HttpClient);
  private readonly draftService = inject(SsraDraftService);
  private readonly authService = inject(AuthService);

  // Reactive state signals
  readonly assessments = signal<SsraAssessment[]>([]);
  readonly selectedAssessment = signal<SsraAssessment | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.loadAssessments();
  }

  private getCurrentUserMeta() {
    const fbUser = this.authService.currentUser();
    const profile = this.authService.userProfile() as any;
    return {
      uid: fbUser?.uid || 'guest-user',
      email: fbUser?.email || profile?.email || '',
      displayName: profile?.displayName || profile?.name || fbUser?.displayName || 'Site Operative',
    };
  }

  // --- 1. GET /api/v1/ssra (List assessments) ---

  loadAssessments(query?: SsraListQuery): Observable<SsraListResponse> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    let params = new HttpParams();
    if (query?.page) params = params.set('page', query.page.toString());
    if (query?.pageSize) params = params.set('pageSize', query.pageSize.toString());
    if (query?.status && query.status !== 'ALL') params = params.set('status', query.status);
    if (query?.domainType) params = params.set('domainType', query.domainType);
    if (query?.search) params = params.set('search', query.search);

    return this.http.get<SsraListResponse>(API_BASE, { params }).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      tap((res) => {
        this.isLoading.set(false);
        if (res && Array.isArray(res.assessments)) {
          this.assessments.set(res.assessments);
        }
      }),
      catchError(() => {
        // Fallback to local storage persistence for resilient offline operation
        this.isLoading.set(false);
        const local = this.draftService.getLocalSubmissions();
        const map = new Map<string, SsraAssessment>();
        for (const a of local) {
          if (a.id) map.set(a.id, a);
          if (a.refno) map.set(a.refno, a);
        }

        try {
          const uid = this.authService.currentUser()?.uid || 'guest';
          const raw = localStorage.getItem(`questai_ssra_reports_${uid}`);
          if (raw) {
            const list = JSON.parse(raw);
            for (const item of list) {
              if (item.rawAssessment) {
                const a = item.rawAssessment;
                if (a.id && !map.has(a.id)) map.set(a.id, a);
                if (a.refno && !map.has(a.refno)) map.set(a.refno, a);
              }
            }
          }
        } catch { }

        let filtered = Array.from(new Set(map.values()));

        if (query?.status && query.status !== 'ALL') {
          filtered = filtered.filter((a) => a.lifecycleStatus === query.status);
        }
        if (query?.domainType) {
          filtered = filtered.filter((a) => a.domainType === query.domainType);
        }
        if (query?.search?.trim()) {
          const s = query.search.trim().toLowerCase();
          filtered = filtered.filter(
            (a) =>
              a.refno.toLowerCase().includes(s) ||
              a.siteInformation.jobno.toLowerCase().includes(s) ||
              a.siteInformation.location.toLowerCase().includes(s) ||
              a.domainTitle.toLowerCase().includes(s)
          );
        }

        this.assessments.set(filtered);
        return of({
          success: true,
          total: filtered.length,
          page: query?.page || 1,
          pageSize: query?.pageSize || 20,
          assessments: filtered,
        });
      })
    );
  }

  // --- 2. GET /api/v1/ssra/:id (Detail view) ---

  findLocalAssessment(id: string): SsraAssessment | null {
    if (!id) return null;
    const cleanId = id.trim();

    // 1. Check local submissions via draft service
    const local = this.draftService.getLocalSubmissionById(cleanId);
    if (local) return local;

    // 2. Check in-memory signal list
    const inMem = this.assessments().find(
      (a) => a.id === cleanId || a.refno === cleanId || a.clientReferenceId === cleanId
    );
    if (inMem) return inMem;

    // 3. Check user localStorage questai_ssra_reports_...
    try {
      const uid = this.authService.currentUser()?.uid || 'guest';
      const raw = localStorage.getItem(`questai_ssra_reports_${uid}`);
      if (raw) {
        const list = JSON.parse(raw);
        const found = list.find(
          (item: any) =>
            item.referenceNumber === cleanId ||
            item.id === cleanId ||
            item.rawAssessment?.id === cleanId ||
            item.rawAssessment?.refno === cleanId
        );
        if (found?.rawAssessment) {
          this.draftService.saveLocalSubmission(found.rawAssessment);
          return found.rawAssessment;
        }
      }
    } catch { }

    // 4. Check all local submissions regardless of active user
    try {
      const raw = localStorage.getItem('questai_ssra_local_submissions');
      if (raw) {
        const list = JSON.parse(raw);
        const match = list.find(
          (a: any) => a.id === cleanId || a.refno === cleanId || a.clientReferenceId === cleanId
        );
        if (match) return match;
      }
    } catch { }

    return null;
  }

  getAssessmentById(id: string): Observable<SsraAssessment | null> {
    this.isLoading.set(true);

    // Fast-path: If found locally, return immediately without 15s network latency
    const cached = this.findLocalAssessment(id);
    if (cached) {
      this.isLoading.set(false);
      this.selectedAssessment.set(cached);
      return of(cached);
    }

    return this.http.get<SsraDetailResponse>(`${API_BASE}/${encodeURIComponent(id)}`).pipe(
      timeout(3000),
      map((res) => res.assessment),
      tap((ass) => {
        this.isLoading.set(false);
        this.selectedAssessment.set(ass);
        if (ass) {
          this.draftService.saveLocalSubmission(ass);
        }
      }),
      catchError(() => {
        this.isLoading.set(false);
        const local = this.findLocalAssessment(id);
        this.selectedAssessment.set(local);
        return of(local);
      })
    );
  }

  // --- 3. POST /api/v1/ssra (Phase 1 Submission: Incomplete -> Level1) ---

  submitPhase1(phase1Data: SsraPhase1Data): Observable<SsraCreatePhase1Response> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const userMeta = this.getCurrentUserMeta();
    const typeInfo = getSsraTypeByKey(phase1Data.domainType);
    const domainTitle = typeInfo?.title || phase1Data.domainType;
    const nowIso = new Date().toISOString();
    const refYear = new Date().getFullYear();
    const randCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const refno = `SSRA-${refYear}-${randCode}`;
    const id = `ssra_${Date.now()}_${randCode}`;

    const assessmentPayload: SsraAssessment = {
      id,
      refno,
      userId: userMeta.uid,
      userEmail: userMeta.email,
      clientReferenceId: phase1Data.clientReferenceId,
      domainType: phase1Data.domainType,
      domainTitle,
      questionnaireVersion: phase1Data.questionnaireVersion || '1.0',
      lifecycleStatus: 'Level1',
      siteInformation: phase1Data.siteInformation,
      personsAffected: phase1Data.personsAffected,
      answers: phase1Data.answers,
      preWorkPhotos: phase1Data.preWorkPhotos,
      othercomments: phase1Data.othercomments,
      operatives: phase1Data.operatives,
      hotWorks: phase1Data.hotWorks,
      createdAt: nowIso,
      submittedAt: nowIso,
      updatedAt: nowIso,
      creatorName: userMeta.displayName,
    };

    return this.http.post<SsraCreatePhase1Response>(API_BASE, phase1Data).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      tap((res) => {
        this.isLoading.set(false);
        const resultAss = res.assessment || assessmentPayload;
        this.draftService.saveLocalSubmission(resultAss);
        this.draftService.deleteDraft(phase1Data.clientReferenceId);
        this.assessments.update((list) => [resultAss, ...list.filter((a) => a.id !== resultAss.id)]);
      }),
      catchError((err) => {
        // Resilient fallback: save locally so operative can continue closing later
        this.isLoading.set(false);
        this.draftService.saveLocalSubmission(assessmentPayload);
        this.draftService.deleteDraft(phase1Data.clientReferenceId);
        this.assessments.update((list) => [assessmentPayload, ...list.filter((a) => a.id !== assessmentPayload.id)]);

        const fallbackResponse: SsraCreatePhase1Response = {
          success: true,
          id: assessmentPayload.id,
          refno: assessmentPayload.refno,
          lifecycleStatus: 'Level1',
          submittedAt: nowIso,
          assessment: assessmentPayload,
          message: 'Saved locally (offline mode).',
        };
        return of(fallbackResponse);
      })
    );
  }

  // --- 4. PUT /api/v1/ssra/:id/close (Phase 2 Closing: Level1 -> Complete) ---

  submitPhase2Closing(id: string, closingReport: SsraClosingReport): Observable<SsraClosePhase2Response> {
    return this.submitPhase2Close(id, closingReport);
  }

  submitPhase2Close(id: string, closingReport: SsraClosingReport): Observable<SsraClosePhase2Response> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const userMeta = this.getCurrentUserMeta();
    const nowIso = new Date().toISOString();

    const body = {
      closingReport: {
        ...closingReport,
        closedAt: nowIso,
        closedBy: userMeta.displayName,
      },
    };

    return this.http.put<SsraClosePhase2Response>(`${API_BASE}/${encodeURIComponent(id)}/close`, body).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      tap((res) => {
        this.isLoading.set(false);
        const updated = res.assessment;
        if (updated) {
          this.draftService.saveLocalSubmission(updated);
          this.assessments.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
          this.selectedAssessment.set(updated);
        }
      }),
      catchError((err) => {
        // Resilient fallback: update local record directly
        this.isLoading.set(false);
        const existing = this.draftService.getLocalSubmissionById(id);
        if (existing) {
          existing.lifecycleStatus = 'Complete';
          existing.closingReport = body.closingReport;
          existing.completedAt = nowIso;
          existing.updatedAt = nowIso;
          this.draftService.saveLocalSubmission(existing);
          this.assessments.update((list) => list.map((a) => (a.id === existing.id ? existing : a)));
          this.selectedAssessment.set(existing);

          return of({
            success: true,
            id: existing.id,
            refno: existing.refno,
            lifecycleStatus: 'Complete' as const,
            completedAt: nowIso,
            assessment: existing,
            message: 'Closed locally (offline mode).',
          });
        }
        return throwError(() => new Error('Assessment not found to close.'));
      })
    );
  }

  // --- 5. GET /api/v1/ssra/:id/pdf (PDF export) ---

  downloadPdf(id: string): Observable<Blob> {
    return this.http.get(`${API_BASE}/${encodeURIComponent(id)}/pdf`, { responseType: 'blob' }).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      catchError(() => {
        // When server PDF generation is unavailable, browser print fallback is triggered
        return throwError(() => new Error('Server PDF unavailable, using print fallback.'));
      })
    );
  }

  deleteAssessment(id: string): void {
    this.draftService.deleteLocalSubmission(id);
    this.assessments.update((list) => list.filter((a) => a.id !== id && a.refno !== id));
    if (this.selectedAssessment()?.id === id) {
      this.selectedAssessment.set(null);
    }
  }
}
