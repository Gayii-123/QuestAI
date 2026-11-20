import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timeout, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  InternalAuditPhoto,
  InternalAuditObservation,
  InternalAuditSession,
  InternalAuditAnalysisResult,
  InternalAuditAnalyzeRequest,
  InternalAuditAnalyzeResponse,
  InternalAuditSaveRequest,
  InternalAuditSaveResponse,
} from './internal-audit.models';
import {
  INTERNAL_AUDIT_CONDITIONS,
  INTERNAL_AUDIT_RATINGS,
  InternalAuditRating,
  normalizeAuditRating,
  ratingTriggersCar,
} from './internal-audit-conditions.config';
import {
  isHeicFile,
  isSupportedImageFile,
  convertHeicToJpeg,
} from '../../core/utils/image-utils';
import { AuthService } from '../../core/services/auth.service';

const LOCAL_STORAGE_KEY_DRAFTS = 'questai_internal_audit_drafts';
const LOCAL_STORAGE_KEY_COMPLETED = 'questai_finalized_internal_audits';
const MAX_IMAGE_DIMENSION = 1600;
const COMPRESSION_QUALITY = 0.85;
const MAX_RAW_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

@Injectable({
  providedIn: 'root',
})
export class InternalAuditService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService, { optional: true });

  // Active session signal
  readonly currentSession = signal<InternalAuditSession | null>(null);

  // Saved / completed audit drafts list signal
  readonly savedAudits = signal<InternalAuditSession[]>([]);

  constructor() {
    this.loadSavedAuditsList();
  }

  // ==========================================================================
  // Session Creation & Lifecycle
  // ==========================================================================

  createSession(siteName = '', location = '', auditorName = 'Auditor'): InternalAuditSession {
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 7);
    const year = new Date().getFullYear();
    const refNum = `IA-${year}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    const user = this.authService?.currentUser?.() || null;
    const profile = this.authService?.userProfile?.() as any;
    const resolvedAuditor =
      auditorName && auditorName !== 'Auditor'
        ? auditorName
        : profile?.name || user?.displayName || user?.email || 'Auditor';

    const newSession: InternalAuditSession = {
      sessionId: `ia_sess_${timestamp}_${randomHex}`,
      referenceNumber: refNum,
      status: 'uploading',
      location: location,
      siteName: siteName,
      auditorName: resolvedAuditor,
      auditorSummary: '',
      photos: [],
      observations: [],
      userId: user?.uid || '',
      userEmail: user?.email || profile?.email || '',
      createdBy: user?.uid || '',
      createdByEmail: user?.email || profile?.email || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.currentSession.set(newSession);
    return newSession;
  }

  setCurrentSession(session: InternalAuditSession | null): void {
    this.currentSession.set(session);
  }

  // ==========================================================================
  // Photo Processing & Compression
  // ==========================================================================

  validatePhotoFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided.' };
    }
    if (!isSupportedImageFile(file)) {
      return { valid: false, error: `Unsupported file format (${file.type || 'unknown'}). Please upload JPG, PNG, WebP, or HEIC.` };
    }
    if (file.size > MAX_RAW_FILE_SIZE_BYTES) {
      return { valid: false, error: `File "${file.name}" exceeds maximum allowed size of 15MB.` };
    }
    return { valid: true };
  }

  async compressPhoto(file: File): Promise<InternalAuditPhoto> {
    const validation = this.validatePhotoFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    let processedFile = file;
    if (isHeicFile(file)) {
      processedFile = await convertHeicToJpeg(file);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Failed to read file "${processedFile.name}".`));
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        const img = new Image();
        img.onerror = () => reject(new Error(`Failed to decode image data for "${processedFile.name}".`));
        img.onload = () => {
          let { width, height } = img;
          if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
              width = MAX_IMAGE_DIMENSION;
            } else {
              width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
              height = MAX_IMAGE_DIMENSION;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Fallback to raw data URL if canvas 2D context is unavailable
            resolve({
              id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: processedFile.name,
              url: rawDataUrl,
              mimeType: processedFile.type || 'image/jpeg',
              size: processedFile.size,
              timestamp: new Date().toISOString(),
            });
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const targetMime = 'image/jpeg';
          const compressedDataUrl = canvas.toDataURL(targetMime, COMPRESSION_QUALITY);
          const estimatedSize = Math.round((compressedDataUrl.length * 3) / 4);

          resolve({
            id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: processedFile.name.replace(/\.[^/.]+$/, '.jpg'),
            url: compressedDataUrl,
            mimeType: targetMime,
            size: estimatedSize,
            timestamp: new Date().toISOString(),
          });
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(processedFile);
    });
  }

  // ==========================================================================
  // Backend AI Analysis
  // ==========================================================================

  analyzeAuditPhotos(session: InternalAuditSession): Observable<InternalAuditAnalysisResult> {
    if (!session || !session.photos || session.photos.length === 0) {
      return throwError(() => new Error('Cannot start AI analysis without site photographs.'));
    }

    const endpoint =
      environment.endpoints && (environment.endpoints as any).internalAuditInspect
        ? (environment.endpoints as any).internalAuditInspect
        : `${environment.apiUrl}/questAiInspectInternalAudit`;

    const requestPayload: InternalAuditAnalyzeRequest = {
      sessionId: session.sessionId,
      siteName: session.siteName || '',
      location: session.location || '',
      auditorName: session.auditorName || 'Auditor',
      notes: session.auditorSummary || '',
      photos: session.photos.map((p) => ({
        id: p.id,
        name: p.name,
        base64Data: p.url.includes(',') ? p.url.split(',')[1] : p.url,
        mimeType: p.mimeType || 'image/jpeg',
      })),
    };

    return this.http
      .post<InternalAuditAnalyzeResponse>(endpoint, requestPayload)
      .pipe(
        timeout(240000),
        map((response) => {
          if (!response || !response.success || !response.data) {
            throw new Error(response?.message || 'Invalid or empty response received from backend.');
          }
          return this.mapBackendResponseToResult(response, session);
        }),
        catchError((err: HttpErrorResponse | Error) => {
          if (err instanceof HttpErrorResponse) {
            if (err.status === 404) {
              return throwError(
                () =>
                  new Error(
                    'The Internal Audit AI analysis endpoint (/questAiInspectInternalAudit) is not yet available on the backend server. Please coordinate with the backend team.'
                  )
              );
            }
            if (err.status === 0) {
              return throwError(
                () =>
                  new Error(
                    'Unable to contact the QuestAI backend server. Please check your network connection or server availability.'
                  )
              );
            }
            return throwError(
              () =>
                new Error(
                  `Backend error (${err.status}): ${err.error?.message || err.message || 'Analysis request failed.'}`
                )
            );
          }
          return throwError(() => err);
        })
      );
  }

  saveAuditToBackend(session: InternalAuditSession): Observable<InternalAuditSaveResponse> {
    const endpoint =
      environment.endpoints && (environment.endpoints as any).internalAuditSave
        ? (environment.endpoints as any).internalAuditSave
        : `${environment.apiUrl}/questAiSaveInternalAudit`;

    const payload: InternalAuditSaveRequest = { session };
    return this.http.post<InternalAuditSaveResponse>(endpoint, payload).pipe(
      timeout(30000),
      catchError((err: HttpErrorResponse | Error) => {
        if (err instanceof HttpErrorResponse) {
          return throwError(
            () =>
              new Error(
                `Backend save error (${err.status}): ${err.error?.message || err.message || 'Save request failed.'}`
              )
          );
        }
        return throwError(() => err);
      })
    );
  }

  private mapBackendResponseToResult(
    response: InternalAuditAnalyzeResponse,
    session: InternalAuditSession
  ): InternalAuditAnalysisResult {
    const data = response.data;
    const rawObs = Array.isArray(data.observations) ? data.observations : [];

    const mappedObservations: InternalAuditObservation[] = rawObs.map((obs, idx) => {
      const normalizedRating = normalizeAuditRating(obs.rating);
      const isCar = ratingTriggersCar(normalizedRating);
      const refCode = obs.focusAreaRef || `FA${String(idx + 1).padStart(2, '0')}`;

      // Associate photo URLs from photo indices
      const associatedPhotoIds: string[] = [];
      const associatedPhotoUrls: string[] = [];

      if (Array.isArray(obs.evidencePhotoIndices)) {
        obs.evidencePhotoIndices.forEach((photoIdx) => {
          if (photoIdx >= 0 && photoIdx < session.photos.length) {
            const p = session.photos[photoIdx];
            associatedPhotoIds.push(p.id);
            associatedPhotoUrls.push(p.url);
          }
        });
      }

      // Default to all photos if none specifically mapped
      if (associatedPhotoUrls.length === 0 && session.photos.length > 0) {
        associatedPhotoIds.push(session.photos[0].id);
        associatedPhotoUrls.push(session.photos[0].url);
      }

      const now = Date.now();
      const carRef = isCar ? `CA-IA-${now.toString().slice(-6)}-${idx + 1}` : undefined;
      const resolveBy = isCar ? now + 30 * 24 * 60 * 60 * 1000 : null; // 30 day standard

      return {
        id: `obs_${now}_${idx + 1}`,
        focusArea: obs.focusArea || 'General Safety Condition',
        focusAreaRef: refCode,
        finding: obs.finding || 'Condition observed during site walkthrough.',
        suggestedAction: obs.suggestedAction || 'Maintain existing control measures.',
        rating: normalizedRating,
        photoIds: associatedPhotoIds,
        photoUrls: associatedPhotoUrls,
        hasCar: isCar ? 'Yes' : 'No',
        carRefNo: carRef,
        resolveByDate: resolveBy,
        isEdited: false,
      };
    });

    // Compute summary counts
    let goodPracticeCount = 0;
    let compliantCount = 0;
    let observationsOnlyCount = 0;
    let areaForImprovementCount = 0;
    let minorNcrCount = 0;
    let majorNcrCount = 0;

    for (const o of mappedObservations) {
      switch (o.rating) {
        case 'Good Practice':
          goodPracticeCount++;
          break;
        case 'Compliant':
          compliantCount++;
          break;
        case 'Observations only':
          observationsOnlyCount++;
          break;
        case 'Area for Improvement':
          areaForImprovementCount++;
          break;
        case 'Minor Non-Conformance':
          minorNcrCount++;
          break;
        case 'Major Non-Conformance':
          majorNcrCount++;
          break;
      }
    }

    const totalCars = areaForImprovementCount + minorNcrCount + majorNcrCount;
    const totalCount = mappedObservations.length;
    const positiveCount = goodPracticeCount + compliantCount + observationsOnlyCount;
    const complianceScore = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 100;

    return {
      location: data.location || session.location || 'Site Location Not Specified',
      auditorSummary:
        data.auditorSummary ||
        `Internal audit visual scan completed on ${session.photos.length} site photograph(s).`,
      observations: mappedObservations,
      totalPhotosAnalyzed: session.photos.length,
      goodPracticeCount,
      compliantCount,
      observationsOnlyCount,
      areaForImprovementCount,
      minorNcrCount,
      majorNcrCount,
      totalCarCount: totalCars,
      overallComplianceScore: complianceScore,
      analyzedAt: data.analyzedAt || new Date().toISOString(),
      modelIdentifier: data.modelIdentifier || 'Gemini Vision',
    };
  }

  // ==========================================================================
  // Local Draft & Finalized Audit Persistence
  // ==========================================================================

  getCurrentUserId(): string | null {
    return this.authService?.currentUser?.()?.uid || null;
  }

  getStorageKeyDrafts(uid?: string): string {
    const userId = uid || this.getCurrentUserId();
    return userId ? `${LOCAL_STORAGE_KEY_DRAFTS}_${userId}` : LOCAL_STORAGE_KEY_DRAFTS;
  }

  getStorageKeyCompleted(uid?: string): string {
    const userId = uid || this.getCurrentUserId();
    return userId ? `${LOCAL_STORAGE_KEY_COMPLETED}_${userId}` : LOCAL_STORAGE_KEY_COMPLETED;
  }

  saveDraft(session: InternalAuditSession): void {
    if (!session) return;
    const uid = session.userId || this.getCurrentUserId();
    if (uid && !session.userId) {
      session.userId = uid;
    }
    const user = this.authService?.currentUser?.();
    const profile = this.authService?.userProfile?.() as any;
    if (user?.email && !session.userEmail) {
      session.userEmail = user.email;
    }
    if (uid && !session.createdBy) {
      session.createdBy = uid;
      session.createdByEmail = user?.email || profile?.email || '';
    }

    session.updatedAt = new Date().toISOString();
    session.status = 'draft_saved';

    try {
      const drafts = this.getStoredDraftsList(uid || undefined);
      const existingIdx = drafts.findIndex((d) => d.sessionId === session.sessionId);
      if (existingIdx >= 0) {
        drafts[existingIdx] = session;
      } else {
        drafts.unshift(session);
      }
      const key = this.getStorageKeyDrafts(uid || undefined);
      localStorage.setItem(key, JSON.stringify(drafts));
      this.currentSession.set({ ...session });
      this.loadSavedAuditsList();
    } catch (e) {
      console.error('Failed to save internal audit draft to localStorage:', e);
    }
  }

  finalizeAudit(session: InternalAuditSession): InternalAuditSession {
    const uid = session.userId || this.getCurrentUserId();
    if (uid && !session.userId) {
      session.userId = uid;
    }
    const user = this.authService?.currentUser?.();
    const profile = this.authService?.userProfile?.() as any;
    if (user?.email && !session.userEmail) {
      session.userEmail = user.email;
    }
    if (uid && !session.createdBy) {
      session.createdBy = uid;
      session.createdByEmail = user?.email || profile?.email || '';
    }

    session.updatedAt = new Date().toISOString();
    session.completedAt = new Date().toISOString();
    session.status = 'completed';

    try {
      // 1. Remove from drafts
      const draftKey = this.getStorageKeyDrafts(uid || undefined);
      const drafts = this.getStoredDraftsList(uid || undefined).filter((d) => d.sessionId !== session.sessionId);
      localStorage.setItem(draftKey, JSON.stringify(drafts));

      // 2. Add to completed
      const compKey = this.getStorageKeyCompleted(uid || undefined);
      const completed = this.getStoredCompletedList(uid || undefined);
      const existingIdx = completed.findIndex(
        (c) =>
          c.sessionId === session.sessionId ||
          (session.referenceNumber && c.referenceNumber === session.referenceNumber)
      );
      if (existingIdx >= 0) {
        completed[existingIdx] = session;
      } else {
        completed.unshift(session);
      }
      localStorage.setItem(compKey, JSON.stringify(completed));

      this.currentSession.set({ ...session });
      this.loadSavedAuditsList();
    } catch (e) {
      console.error('Failed to persist completed internal audit:', e);
    }
    return session;
  }

  getStoredDraftsList(uid?: string): InternalAuditSession[] {
    try {
      const key = this.getStorageKeyDrafts(uid);
      const raw = localStorage.getItem(key);
      const list: InternalAuditSession[] = raw ? JSON.parse(raw) : [];
      const currentUid = uid || this.getCurrentUserId();
      if (!currentUid) return list;
      return list.filter((s) => !s.userId || s.userId === currentUid);
    } catch {
      return [];
    }
  }

  getStoredCompletedList(uid?: string): InternalAuditSession[] {
    try {
      const key = this.getStorageKeyCompleted(uid);
      const raw = localStorage.getItem(key);
      const list: InternalAuditSession[] = raw ? JSON.parse(raw) : [];
      const currentUid = uid || this.getCurrentUserId();
      if (!currentUid) return list;
      return list.filter((s) => !s.userId || s.userId === currentUid);
    } catch {
      return [];
    }
  }

  loadSavedAuditsList(): void {
    const uid = this.getCurrentUserId();
    const drafts = this.getStoredDraftsList(uid || undefined);
    const completed = this.getStoredCompletedList(uid || undefined);
    this.savedAudits.set([...completed, ...drafts]);
  }

  deleteAudit(sessionId: string): void {
    const uid = this.getCurrentUserId();
    try {
      const draftKey = this.getStorageKeyDrafts(uid || undefined);
      const drafts = this.getStoredDraftsList(uid || undefined).filter((d) => d.sessionId !== sessionId);
      localStorage.setItem(draftKey, JSON.stringify(drafts));

      const compKey = this.getStorageKeyCompleted(uid || undefined);
      const completed = this.getStoredCompletedList(uid || undefined).filter((d) => d.sessionId !== sessionId);
      localStorage.setItem(compKey, JSON.stringify(completed));

      if (this.currentSession()?.sessionId === sessionId) {
        this.currentSession.set(null);
      }
      this.loadSavedAuditsList();
    } catch (e) {
      console.error('Failed to delete internal audit session:', e);
    }
  }
}
