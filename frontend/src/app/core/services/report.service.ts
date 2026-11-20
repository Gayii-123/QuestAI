import { Injectable, inject, signal, effect } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { PdfExportService, InspectionPdfData } from './pdf-export.service';
import {
  InspectionDraftSummaryViewModel,
  InspectionSessionViewModel,
} from '../models/inspection-view.models';
import { getQuestionsForDepartment } from '../models/site-inspection.schema';

/**
 * FIRESTORE STRUCTURE (inside existing `questai` root collection):
 * questai
 *  └── data
 *       └── users
 *            └── {uid}
 *                 ├── conversations/{conversationId}/messages/{messageId}
 *                 └── reports/{referenceNumber}
 */
const ROOT_COLLECTION = 'questai';
const DATA_DOC = 'data';
const USERS_COLLECTION = 'users';
const REPORTS_COLLECTION = 'reports';

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly apiService = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly pdfExportService = inject(PdfExportService);
  private readonly firestore: Firestore = this.authService.firestore;

  readonly inspectionHistoryList = signal<any[]>([]);
  readonly selectedHistoryRecord = signal<any | null>(null);
  readonly isLoadingReports = signal<boolean>(false);
  readonly reportSyncError = signal<string | null>(null);

  // Official Report Modal inline row editing
  readonly editingHistoryQuestionId = signal<string | null>(null);
  readonly editingHistoryRating = signal<'1' | '-1' | '0' | ''>('');
  readonly editingHistoryCarPlan = signal<string>('');
  readonly cachedHistoryCarPlans: Record<string, string> = {};
  readonly historyRowSaveSuccess = signal<string | null>(null);
  private historySaveSuccessTimeout: any = null;

  private lastLoadedUid: string | null = null;
  private activeSyncUid: string | null = null;

  constructor() {
    // Watch authentication changes to isolate reports per user directly from Firestore
    effect(() => {
      const user = this.authService.currentUser();
      const uid = user?.uid || null;
      if (uid !== this.lastLoadedUid) {
        this.lastLoadedUid = uid;
        if (uid) {
          void this.syncUserReports(uid);
        } else {
          this.clearUserReports();
        }
      }
    });
  }

  // --- Firestore Collection & Document References ---

  private getCurrentUserId(): string | null {
    return (
      this.authService.currentUser()?.uid ||
      this.authService.auth.currentUser?.uid ||
      null
    );
  }

  private getUserReportsCollection(uid: string) {
    return collection(
      this.firestore,
      ROOT_COLLECTION,
      DATA_DOC,
      USERS_COLLECTION,
      uid,
      REPORTS_COLLECTION
    );
  }

  private getReportDoc(uid: string, referenceNumber: string) {
    return doc(
      this.firestore,
      ROOT_COLLECTION,
      DATA_DOC,
      USERS_COLLECTION,
      uid,
      REPORTS_COLLECTION,
      referenceNumber
    );
  }

  private getAuthenticatedInspectorMeta() {
    const profile = this.authService.userProfile() as any;
    const fbUser = this.authService.currentUser();
    return {
      userId: fbUser?.uid || '',
      userEmail: fbUser?.email || profile?.email || null,
      inspectorName:
        profile?.name || fbUser?.displayName || fbUser?.email || 'Quest Inspector',
      inspectorRole: profile?.role || 'QHSE',
      contractor: profile?.contractor || 'Marlborough Highways',
    };
  }

  // --- User-Scoped Firestore Sync ---

  private getNormalizedInternalAudits(): any[] {
    try {
      const iaRaw = localStorage.getItem('questai_finalized_internal_audits');
      let iaList = iaRaw ? JSON.parse(iaRaw) : [];

      if (!Array.isArray(iaList) || iaList.length === 0) {
        iaList = [this.getSampleInternalAudit()];
        try {
          localStorage.setItem('questai_finalized_internal_audits', JSON.stringify(iaList));
        } catch { }
      }

      return iaList.map((audit: any) => {
        const obs = Array.isArray(audit.observations) ? audit.observations : [];
        const compliantCount = obs.filter(
          (o: any) => o.rating === 'Compliant' || o.rating === 'Good Practice'
        ).length;
        const carCount = obs.filter((o: any) => o.hasCar === 'Yes').length;
        const obsCount = obs.filter((o: any) => o.rating === 'Observations only').length;

        const dateStr = audit.completedAt || audit.createdAt || new Date().toISOString();
        const dateObj = new Date(dateStr);
        const formattedDate = dateObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const formattedDateTime = dateObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const formattedObs = obs.map((o: any) => {
          let resolveByDateFormatted = o.resolveByDateFormatted;
          if (o.hasCar === 'Yes' && !resolveByDateFormatted) {
            const rDate = o.resolveByDate
              ? new Date(o.resolveByDate)
              : new Date(dateObj.getTime() + 30 * 24 * 60 * 60 * 1000);
            resolveByDateFormatted = rDate.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          }
          return {
            ...o,
            resolveByDateFormatted,
            who: o.who || o.assignedTo || audit.siteIncharge || 'Warrick Oliver',
          };
        });

        return {
          ...audit,
          id: audit.referenceNumber || audit.sessionId,
          isInternalAudit: true,
          type: 'internal_audit',
          bankName: 'Internal Audit',
          department: 'HSEQ / Compliance',
          jobNo: audit.jobNo || audit.jobReference || 'LBH/01/200',
          siteLocation: audit.location || audit.siteName || 'Buckingham Road',
          contract: audit.contract || 'LB Hackney',
          auditedBy: audit.auditorName || audit.auditedBy || 'Dean Willsher',
          siteIncharge: audit.siteIncharge || audit.foreman || 'Warrick Oliver',
          managerSupervisor: audit.managerSupervisor || audit.supervisor || 'Tom Davis',
          auditedDateFormatted: formattedDateTime,
          reportDateFormatted: formattedDate,
          finalizedAt: dateStr,
          auditorComment: audit.auditorSummary || audit.comment || '',
          observations: formattedObs,
          photos: audit.photos || [],
          stats: {
            total: obs.length,
            answered: obs.length,
            passCount: compliantCount,
            carCount: carCount,
            naCount: 0,
            obsCount: obsCount,
          },
          totalScore: obs.length > 0 ? Math.round((compliantCount / obs.length) * 100) : 100,
        };
      });
    } catch {
      return [];
    }
  }

  loadInspectionHistory(): void {
    const uid = this.getCurrentUserId();
    if (uid) {
      void this.syncUserReports(uid);
      return;
    }

    try {
      const siteRaw = localStorage.getItem('questai_finalized_inspections');
      const siteList = siteRaw ? JSON.parse(siteRaw) : [];
      const normalizedIaList = this.getNormalizedInternalAudits();
      const combined = [...normalizedIaList, ...(Array.isArray(siteList) ? siteList : [])];
      combined.sort(
        (a, b) => new Date(b.finalizedAt || 0).getTime() - new Date(a.finalizedAt || 0).getTime()
      );
      this.inspectionHistoryList.set(combined);
    } catch (e) {
      console.error('Failed to load inspection history:', e);
      this.inspectionHistoryList.set([]);
    }
  }

  async syncUserReports(uid: string): Promise<void> {
    if (!uid) return;
    this.activeSyncUid = uid;
    this.isLoadingReports.set(true);
    this.reportSyncError.set(null);

    try {
      const reportsRef = this.getUserReportsCollection(uid);
      const q = query(reportsRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);

      if (this.activeSyncUid !== uid) {
        return;
      }

      const remoteReports: any[] = [];
      for (const d of snapshot.docs) {
        remoteReports.push(this.deserializeReport(d.id, d.data()));
      }

      const normalizedIaList = this.getNormalizedInternalAudits();
      const combined = [...normalizedIaList, ...remoteReports];
      combined.sort((a, b) => {
        const tA = new Date(a.updatedAt || a.finalizedAt || 0).getTime();
        const tB = new Date(b.updatedAt || b.finalizedAt || 0).getTime();
        return tB - tA;
      });

      this.inspectionHistoryList.set(combined);

      const openRef = this.selectedHistoryRecord()?.referenceNumber;
      if (openRef) {
        const updated = combined.find((r) => r.referenceNumber === openRef);
        if (updated) {
          this.selectedHistoryRecord.set({ ...updated });
        }
      }
    } catch (err) {
      console.error('[ReportService] Error loading reports from Firestore:', err);
      this.reportSyncError.set('Unable to load inspection reports from Firebase.');
    } finally {
      if (this.activeSyncUid === uid) {
        this.isLoadingReports.set(false);
      }
    }
  }

  clearUserReports(): void {
    this.activeSyncUid = null;
    this.inspectionHistoryList.set([]);
    this.selectedHistoryRecord.set(null);
    this.cancelEditingHistoryQuestion();
    this.reportSyncError.set(null);
  }

  deleteHistoryRecord(referenceNumber: string): void {
    if (!referenceNumber) return;

    this.inspectionHistoryList.update((list) =>
      list.filter(
        (item) =>
          item.referenceNumber !== referenceNumber &&
          item.id !== referenceNumber &&
          item.sessionId !== referenceNumber
      )
    );
    if (this.selectedHistoryRecord()?.referenceNumber === referenceNumber) {
      this.closeHistoryRecord();
    }

    try {
      const siteRaw = localStorage.getItem('questai_finalized_inspections');
      if (siteRaw) {
        const siteList = JSON.parse(siteRaw);
        const filtered = siteList.filter(
          (item: any) => item.referenceNumber !== referenceNumber && item.id !== referenceNumber
        );
        localStorage.setItem('questai_finalized_inspections', JSON.stringify(filtered));
      }

      const iaRaw = localStorage.getItem('questai_finalized_internal_audits');
      if (iaRaw) {
        const iaList = JSON.parse(iaRaw);
        const filtered = iaList.filter(
          (item: any) =>
            item.referenceNumber !== referenceNumber && item.sessionId !== referenceNumber
        );
        localStorage.setItem('questai_finalized_internal_audits', JSON.stringify(filtered));
      }
    } catch (e) {
      console.error('Failed to delete local inspection record', e);
    }

    const uid = this.getCurrentUserId();
    if (uid) {
      const docRef = this.getReportDoc(uid, referenceNumber);
      void deleteDoc(docRef).catch((err) => {
        console.error('[ReportService] Failed to delete report in Firestore:', err);
        this.reportSyncError.set('Failed to delete report from Firebase.');
      });
    }
  }

  saveInternalAuditRecord(record: any): void {
    try {
      const iaRaw = localStorage.getItem('questai_finalized_internal_audits');
      const iaList = iaRaw ? JSON.parse(iaRaw) : [];
      const idx = iaList.findIndex(
        (item: any) => item.referenceNumber === record.referenceNumber || item.sessionId === record.sessionId
      );

      const obs = Array.isArray(record.observations) ? record.observations : [];
      const compliantCount = obs.filter((o: any) => o.rating === 'Compliant' || o.rating === 'Good Practice').length;
      const carCount = obs.filter((o: any) => o.hasCar === 'Yes').length;
      const obsCount = obs.filter((o: any) => o.rating === 'Observations only').length;

      record.stats = {
        total: obs.length,
        answered: obs.length,
        passCount: compliantCount,
        carCount: carCount,
        naCount: 0,
        obsCount: obsCount,
      };
      record.totalScore = obs.length > 0 ? Math.round((compliantCount / obs.length) * 100) : 100;
      record.updatedAt = new Date().toISOString();
      record.isInternalAudit = true;

      if (idx >= 0) {
        iaList[idx] = record;
      } else {
        iaList.unshift(record);
      }

      localStorage.setItem('questai_finalized_internal_audits', JSON.stringify(iaList));
      this.loadInspectionHistory();
      this.selectedHistoryRecord.set({ ...record });

      // Sync to Firebase Cloud Functions backend
      this.apiService.saveFinalizedInternalAudit(record).subscribe({
        next: (res) => console.log('[QuestAI IA] Edited audit synced to backend:', res),
        error: (err) => console.warn('[QuestAI IA] Background sync notice:', err.message),
      });
    } catch (e) {
      console.error('Failed to save edited internal audit:', e);
    }
  }

  openHistoryRecord(record: any): void {
    this.cancelEditingHistoryQuestion();
    if (record) {
      this.recalculateRecordStats(record);
    }
    this.selectedHistoryRecord.set(record ? { ...record } : null);
  }

  closeHistoryRecord(): void {
    this.selectedHistoryRecord.set(null);
    this.cancelEditingHistoryQuestion();
  }

  recalculateRecordStats(record: any): void {
    if (!record) return;
    const answers = record.answers || {};
    let passCount = 0;
    let carCount = 0;
    let naCount = 0;

    let questions: any[] = [];
    if (record.questions && record.questions.length > 0) {
      questions = record.questions;
    } else {
      const canonical = getQuestionsForDepartment(record.department || 'Civil');
      if (canonical && canonical.length > 0) {
        questions = canonical;
      }
    }

    const questionIds = new Set<string>();
    for (const q of questions) {
      if (q.id) questionIds.add(q.id);
    }
    for (const qid of Object.keys(answers)) {
      questionIds.add(qid);
    }

    for (const qid of questionIds) {
      const rating = answers[qid]?.rating;
      if (rating === '1') {
        passCount++;
      } else if (rating === '-1') {
        carCount++;
      } else if (rating === '0') {
        naCount++;
      }
    }

    const answered = passCount + carCount + naCount;
    const total = questionIds.size > 0 ? questionIds.size : (record.stats?.total || answered);
    const unresolvedCount = Math.max(0, total - answered);

    record.stats = {
      ...(record.stats || {}),
      total,
      answered,
      passCount,
      carCount,
      naCount,
      needsReviewCount: unresolvedCount,
      unresolvedCount,
      verifiedCount: passCount,
    };
    record.totalScore = passCount;
    record.passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
  }

  startEditingHistoryQuestion(questionId: string): void {
    const record = this.selectedHistoryRecord();
    if (!record) return;
    const ans = record.answers?.[questionId];
    const currentRating = (ans?.rating || '') as '1' | '-1' | '0' | '';
    const currentPlan = ans?.carActionPlan || this.cachedHistoryCarPlans[questionId] || '';

    this.editingHistoryQuestionId.set(questionId);
    this.editingHistoryRating.set(currentRating);
    this.editingHistoryCarPlan.set(currentPlan);
    if (currentPlan) {
      this.cachedHistoryCarPlans[questionId] = currentPlan;
    }
  }

  setEditingHistoryRating(rating: '1' | '-1' | '0' | ''): void {
    this.editingHistoryRating.set(rating);
    const qid = this.editingHistoryQuestionId();
    if (qid && rating === '-1' && !this.editingHistoryCarPlan()) {
      if (this.cachedHistoryCarPlans[qid]) {
        this.editingHistoryCarPlan.set(this.cachedHistoryCarPlans[qid]);
      }
    }
  }

  onEditingCarPlanChange(plan: string): void {
    this.editingHistoryCarPlan.set(plan);
    const qid = this.editingHistoryQuestionId();
    if (qid) {
      this.cachedHistoryCarPlans[qid] = plan;
    }
  }

  cancelEditingHistoryQuestion(): void {
    this.editingHistoryQuestionId.set(null);
    this.editingHistoryRating.set('');
    this.editingHistoryCarPlan.set('');
  }

  saveEditingHistoryQuestion(questionId: string): void {
    const record = this.selectedHistoryRecord();
    if (!record) return;

    const authMeta = this.getAuthenticatedInspectorMeta();
    const nowIso = new Date().toISOString();

    if (!record.answers) {
      record.answers = {};
    }
    const currentAns = record.answers[questionId] || {};
    const newRating = this.editingHistoryRating();
    const newPlan =
      newRating === '-1'
        ? this.editingHistoryCarPlan()
        : currentAns.carActionPlan || this.cachedHistoryCarPlans[questionId] || '';

    // 1. Update in-memory answer
    record.answers = {
      ...record.answers,
      [questionId]: {
        ...currentAns,
        rating: newRating,
        carActionPlan: newPlan,
        answeredBy: 'human',
        isVerified: true,
        updatedAt: nowIso,
      },
    };

    // 2. Recalculate summary metrics & edit metadata
    this.recalculateRecordStats(record);
    record.editCount = (typeof record.editCount === 'number' ? record.editCount : 0) + 1;
    record.lastEditedBy = authMeta.inspectorName;
    record.updatedAt = nowIso;

    // 3. Update reactive signals immediately
    this.selectedHistoryRecord.set({ ...record });
    this.inspectionHistoryList.update((list) => {
      const idx = list.findIndex((item) => item.referenceNumber === record.referenceNumber);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = { ...record };
        return next;
      }
      return [{ ...record }, ...list];
    });

    // 4. Persist edit directly to Firestore under questai/data/users/{uid}/reports/{referenceNumber}
    const uid = this.getCurrentUserId();
    if (uid && record.referenceNumber) {
      const docRef = this.getReportDoc(uid, record.referenceNumber);
      const payload = this.serializeReportForFirestore(record, false);
      void setDoc(docRef, payload, { merge: true }).catch((err) => {
        console.error('[ReportService] Failed to save edited report to Firestore:', err);
        this.reportSyncError.set('Failed to save report changes to Firebase.');
      });
    }

    // 5. Background sync via apiService.saveFinalizedInspection
    try {
      this.apiService
        .saveFinalizedInspection({
          referenceNumber: record.referenceNumber,
          bankId: record.bankId,
          bankName: record.bankName,
          department: record.department,
          status: 'completed',
          summary: {
            referenceNumber: record.referenceNumber,
            bankId: record.bankId,
            bankName: record.bankName,
            totalApplicable: record.stats.total,
            passCount: record.stats.passCount,
            carCount: record.stats.carCount,
            naCount: record.stats.naCount,
            unresolvedCount: record.stats.unresolvedCount || 0,
            answers: record.answers,
            isConfirmedByInspector: true,
          },
          answers: record.answers,
        })
        .subscribe({ error: () => { } });
    } catch { }

    // 6. Temporary success indicator
    this.historyRowSaveSuccess.set(questionId);
    if (this.historySaveSuccessTimeout) {
      clearTimeout(this.historySaveSuccessTimeout);
    }
    this.historySaveSuccessTimeout = setTimeout(() => {
      this.historyRowSaveSuccess.set(null);
    }, 2500);

    // 7. Clear editing state
    this.editingHistoryQuestionId.set(null);
  }

  saveFinalizedReportToStorage(
    session: InspectionSessionViewModel | null | undefined,
    summary: InspectionDraftSummaryViewModel,
    conversationId?: string
  ): void {
    const authMeta = this.getAuthenticatedInspectorMeta();
    const nowIso = summary.confirmedAt || new Date().toISOString();
    const photos = session?.uploadedPhotos ? [...session.uploadedPhotos] : [];

    for (const p of photos) {
      if (p.id && p.url) {
        try {
          sessionStorage.setItem('questai_photo_' + p.id, p.url);
        } catch { }
      }
    }

    const questions = session
      ? Object.values(session.questionAssessments).map((q) => ({
        id: q.questionId,
        qnum: q.qnum,
        headername: q.headername,
        qtext: q.qtext,
        isDynamicObservation: !!q.isDynamicObservation,
        supportingPhotoIds: q.supportingPhotoIds || [],
      }))
      : [];

    const total = summary.totalApplicable || 0;
    const passCount = summary.passCount || 0;
    const carCount = summary.carCount || 0;
    const naCount = summary.naCount || 0;
    const answered = passCount + carCount + naCount;
    const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

    const existingRecord = this.inspectionHistoryList().find(
      (item) => item.referenceNumber === summary.referenceNumber
    );

    const record = {
      id: summary.referenceNumber,
      referenceNumber: summary.referenceNumber,
      userId: authMeta.userId,
      userEmail: authMeta.userEmail,
      inspectionId: session?.inspectionId || summary.inspectionId || '',
      conversationId: conversationId || '',
      jobNo: 'LBN-0029',
      jobReference: 'LBN-0029',
      bankId: summary.bankId,
      bankName: summary.bankName,
      department: summary.department,
      status: 'completed',
      finalizedAt: nowIso,
      updatedAt: nowIso,
      inspectorName: authMeta.inspectorName,
      inspectorRole: authMeta.inspectorRole,
      contractor: authMeta.contractor,
      supervisorName: authMeta.inspectorName,
      foremanName: 'Bekim Aliaj',
      contract: '140-Newham',
      operatives: `1. ${authMeta.inspectorName}, 2. Bekim Aliaj`,
      jobDescription: `${summary.bankName} - Highway safety & compliance inspection`,
      siteLocation: 'Romford Road',
      depot: 'N/A',
      totalScore: passCount,
      passRate,
      editCount: existingRecord?.editCount || 0,
      lastEditedBy: existingRecord?.lastEditedBy || null,
      stats: {
        total,
        answered,
        passCount,
        carCount,
        naCount,
        needsReviewCount: summary.needsVerificationCount || 0,
        unresolvedCount: Math.max(0, total - answered),
        verifiedCount: passCount,
      },
      answers: summary.answers || session?.answers || {},
      photoCount: photos.length,
      photos,
      questions,
      modelIdentifier: 'QuestAI Vision',
      isMock: false,
    };

    // 1. Update in-memory list immediately
    this.inspectionHistoryList.update((list) => {
      const idx = list.findIndex((item) => item.referenceNumber === record.referenceNumber);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = record;
        return next;
      }
      return [record, ...list];
    });

    // 2. Persist directly to Firestore under questai/data/users/{uid}/reports/{referenceNumber}
    const uid = this.getCurrentUserId();
    if (uid && record.referenceNumber) {
      const docRef = this.getReportDoc(uid, record.referenceNumber);
      const payload = this.serializeReportForFirestore(record, !existingRecord);
      void setDoc(docRef, payload, { merge: true }).catch((err) => {
        console.error('[ReportService] Failed to save finalized report to Firestore:', err);
        this.reportSyncError.set('Failed to save report to Firebase.');
      });
    }

    // 3. Optionally sync to backend API in background
    try {
      this.apiService
        .saveFinalizedInspection({
          inspectionId: session?.inspectionId || summary.inspectionId,
          referenceNumber: summary.referenceNumber,
          bankId: summary.bankId,
          bankName: summary.bankName,
          department: summary.department,
          status: 'completed',
          summary,
          answers: summary.answers || session?.answers || {},
        })
        .subscribe({
          error: () => { },
        });
    } catch { }
  }

  // --- Firestore Serialization & Deserialization ---

  private serializeReportForFirestore(
    record: any,
    isCreate: boolean
  ): Record<string, any> {
    const sanitizedPhotos = Array.isArray(record.photos)
      ? record.photos.map((p: any) => ({
        id: String(p?.id || ''),
        name: String(p?.name || 'photograph.jpg'),
        size: typeof p?.size === 'number' ? p.size : 0,
        timestamp: String(p?.timestamp || new Date().toISOString()),
        url: p?.url && typeof p.url === 'string' && !p.url.startsWith('data:') ? p.url : '',
      }))
      : [];

    const payload: Record<string, any> = {
      id: record.referenceNumber,
      referenceNumber: record.referenceNumber,
      userId: record.userId || this.getCurrentUserId() || '',
      userEmail: record.userEmail || null,
      inspectionId: record.inspectionId || '',
      conversationId: record.conversationId || '',
      jobNo: record.jobNo || 'LBN-0029',
      jobReference: record.jobReference || record.jobNo || 'LBN-0029',
      bankId: record.bankId || '',
      bankName: record.bankName || 'Site Inspection',
      department: record.department || 'Civil',
      status: record.status || 'completed',
      finalizedAt: record.finalizedAt || new Date().toISOString(),
      inspectorName: record.inspectorName || 'Quest Inspector',
      inspectorRole: record.inspectorRole || 'QHSE',
      contractor: record.contractor || 'Marlborough Highways',
      supervisorName: record.supervisorName || record.inspectorName || 'Quest Inspector',
      foremanName: record.foremanName || '',
      contract: record.contract || '',
      operatives: record.operatives || '',
      jobDescription: record.jobDescription || '',
      siteLocation: record.siteLocation || '',
      depot: record.depot || 'N/A',
      totalScore: typeof record.totalScore === 'number' ? record.totalScore : 0,
      passRate:
        typeof record.passRate === 'number'
          ? record.passRate
          : this.getRecordPassRate(record),
      editCount: typeof record.editCount === 'number' ? record.editCount : 0,
      lastEditedBy: record.lastEditedBy || null,
      stats: record.stats || {},
      answers: record.answers || {},
      photoCount:
        typeof record.photoCount === 'number'
          ? record.photoCount
          : sanitizedPhotos.length,
      photos: sanitizedPhotos,
      questions: Array.isArray(record.questions) ? record.questions : [],
      modelIdentifier: record.modelIdentifier || 'QuestAI Vision',
      isMock: !!record.isMock,
      updatedAt: serverTimestamp(),
    };

    if (isCreate) {
      payload['createdAt'] = serverTimestamp();
    }

    return this.cleanForFirestore(payload);
  }

  private deserializeReport(docId: string, data: any): any {
    const resolveTimestampIso = (raw: any): string => {
      if (raw?.toDate && typeof raw.toDate === 'function') {
        return raw.toDate().toISOString();
      }
      if (raw instanceof Date) return raw.toISOString();
      if (typeof raw === 'string' && raw) return raw;
      if (typeof raw === 'number') return new Date(raw).toISOString();
      return '';
    };

    const photos = Array.isArray(data?.photos)
      ? data.photos.map((p: any) => {
        let url = String(p?.url || '');
        if (!url && p?.id) {
          try {
            url = sessionStorage.getItem('questai_photo_' + p.id) || '';
          } catch { }
        }
        return {
          id: String(p?.id || ''),
          name: String(p?.name || 'photograph.jpg'),
          size: Number(p?.size || 0),
          timestamp: String(p?.timestamp || ''),
          url,
        };
      })
      : [];

    const finalizedAt =
      resolveTimestampIso(data?.finalizedAt) ||
      resolveTimestampIso(data?.createdAt) ||
      new Date().toISOString();
    const updatedAt = resolveTimestampIso(data?.updatedAt) || finalizedAt;

    return {
      id: String(data?.id || docId),
      referenceNumber: String(data?.referenceNumber || docId),
      userId: String(data?.userId || ''),
      userEmail: data?.userEmail || null,
      inspectionId: String(data?.inspectionId || ''),
      conversationId: String(data?.conversationId || ''),
      jobNo: String(data?.jobNo || 'LBN-0029'),
      jobReference: String(data?.jobReference || data?.jobNo || 'LBN-0029'),
      bankId: String(data?.bankId || ''),
      bankName: String(data?.bankName || 'Site Inspection'),
      department: String(data?.department || 'Civil'),
      status: String(data?.status || 'completed'),
      finalizedAt,
      updatedAt,
      inspectorName: String(data?.inspectorName || 'Quest Inspector'),
      inspectorRole: String(data?.inspectorRole || 'QHSE'),
      contractor: String(data?.contractor || 'Marlborough Highways'),
      supervisorName: String(data?.supervisorName || data?.inspectorName || 'Quest Inspector'),
      foremanName: String(data?.foremanName || ''),
      contract: String(data?.contract || ''),
      operatives: String(data?.operatives || ''),
      jobDescription: String(data?.jobDescription || ''),
      siteLocation: String(data?.siteLocation || ''),
      depot: String(data?.depot || 'N/A'),
      totalScore: typeof data?.totalScore === 'number' ? data.totalScore : 0,
      passRate: typeof data?.passRate === 'number' ? data.passRate : 0,
      editCount: typeof data?.editCount === 'number' ? data.editCount : 0,
      lastEditedBy: data?.lastEditedBy || null,
      stats: data?.stats || {
        total: 0,
        answered: 0,
        passCount: 0,
        carCount: 0,
        naCount: 0,
        needsReviewCount: 0,
        unresolvedCount: 0,
        verifiedCount: 0,
      },
      answers: data?.answers || {},
      photoCount:
        typeof data?.photoCount === 'number' ? data.photoCount : photos.length,
      photos,
      questions: Array.isArray(data?.questions) ? data.questions : [],
      modelIdentifier: String(data?.modelIdentifier || 'QuestAI Vision'),
      isMock: !!data?.isMock,
    };
  }

  private cleanForFirestore(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanForFirestore(item));
    }
    if (typeof obj.constructor === 'function' && obj.constructor.name !== 'Object') {
      return obj;
    }
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = this.cleanForFirestore(val);
      }
    }
    return result;
  }

  downloadReportPdf(summaryOrRecord: any): void {
    if (!summaryOrRecord) return;

    if (summaryOrRecord.isInternalAudit || summaryOrRecord.type === 'internal_audit') {
      this.pdfExportService.downloadInternalAuditPdf(summaryOrRecord);
      return;
    }

    const ref = summaryOrRecord.referenceNumber || 'SI638150';
    const jobNo = summaryOrRecord.jobNo || summaryOrRecord.jobReference || 'LBN-0029';
    const bankName = summaryOrRecord.bankName || 'Site Inspection';
    const dept = summaryOrRecord.department || 'Civil';
    const site = summaryOrRecord.siteLocation || 'Romford Road';
    const inspector = summaryOrRecord.inspectorName || 'Quest Inspector';
    const supervisor = summaryOrRecord.supervisorName || inspector || 'Quest Inspector';
    const foreman = summaryOrRecord.foremanName || 'Bekim Aliaj';
    const contract = summaryOrRecord.contract || '140-Newham';
    const operatives = summaryOrRecord.operatives || `1. ${inspector}, 2. Bekim Aliaj`;
    const jobDescription =
      summaryOrRecord.jobDescription || `${bankName} - Highway safety & compliance inspection`;
    const finalized =
      summaryOrRecord.finalizedAt ||
      summaryOrRecord.confirmedAt ||
      summaryOrRecord.generatedAt ||
      new Date().toISOString();

    const stats = summaryOrRecord.stats || {
      total: summaryOrRecord.totalApplicable || 0,
      passCount: summaryOrRecord.passCount || 0,
      carCount: summaryOrRecord.carCount || 0,
      naCount: summaryOrRecord.naCount || 0,
      answered:
        (summaryOrRecord.passCount || 0) +
        (summaryOrRecord.carCount || 0) +
        (summaryOrRecord.naCount || 0),
    };

    const answers = summaryOrRecord.answers || {};

    let questions: any[] = [];
    if (summaryOrRecord.questions && summaryOrRecord.questions.length > 0) {
      questions = summaryOrRecord.questions;
    } else {
      const canonical = getQuestionsForDepartment(dept);
      if (canonical && canonical.length > 0) {
        questions = canonical.map((q) => ({
          id: q.id,
          qnum: q.qnum,
          headername: q.headername,
          qtext: q.qtext,
        }));
      }
    }

    const photos = summaryOrRecord.photos || [];

    const pdfData: InspectionPdfData = {
      referenceNumber: ref,
      jobNo,
      bankName,
      department: dept,
      siteLocation: site,
      inspectorName: inspector,
      supervisorName: supervisor,
      foremanName: foreman,
      contract,
      operatives,
      jobDescription,
      totalScore:
        summaryOrRecord.totalScore !== undefined
          ? summaryOrRecord.totalScore
          : stats.passCount || 50,
      finalizedAt: finalized,
      photos,
      stats,
      answers,
      questions,
    };

    this.pdfExportService.downloadPdf(pdfData);
  }

  getRecordPassRate(record: any): number {
    if (!record?.stats?.total || record.stats.total === 0) return 0;
    return Math.round((record.stats.passCount / record.stats.total) * 100);
  }

  getRecordRiskClass(record: any): string {
    const pass = this.getRecordPassRate(record);
    if (pass >= 85) return 'risk-low';
    if (pass >= 60) return 'risk-medium';
    return 'risk-high';
  }

  formatHistoryDate(isoDate: string): string {
    if (!isoDate) return '';
    try {
      return new Date(isoDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  }

  getHistoryQuestionGroups(record: any): Array<{ headername: string; questions: any[] }> {
    if (!record) return [];
    let questions: any[] = [];
    if (record.questions && record.questions.length > 0) {
      questions = record.questions;
    } else {
      const canonical = getQuestionsForDepartment(record.department || 'Civil');
      if (canonical && canonical.length > 0) {
        questions = canonical.map((q: any) => ({
          id: q.id,
          qnum: q.qnum,
          headername: q.headername,
          qtext: q.qtext,
        }));
      }
    }

    const groups: Array<{ headername: string; questions: any[] }> = [];
    const groupMap: Record<string, any[]> = {};
    for (const q of questions) {
      const header = q.headername || 'General';
      if (!groupMap[header]) {
        groupMap[header] = [];
        groups.push({ headername: header, questions: groupMap[header] });
      }
      groupMap[header].push(q);
    }
    return groups;
  }

  getHistorySupportingPhotos(
    record: any,
    photoIds: string[] | undefined,
    question?: any
  ): any[] {
    if (!record?.photos || !photoIds || photoIds.length === 0) return [];

    const totalSitePhotos = record.photos.length;
    const isDefect = question?.id && record.answers?.[question.id]?.rating === '-1';
    const isDynamic = Boolean(question?.isDynamicObservation);
    const isGeneralSetup =
      question?.qnum === '01' ||
      /appropriate traffic management in place/i.test(question?.qtext || '');

    // Prevent bulk dumping all site photos onto non-defect, non-general individual checks
    if (
      !isDefect &&
      !isDynamic &&
      !isGeneralSetup &&
      totalSitePhotos > 1 &&
      photoIds.length >= totalSitePhotos
    ) {
      return [];
    }

    const idSet = new Set(photoIds);
    const matched = record.photos.filter(
      (p: any) =>
        idSet.has(p.id) && p.url && typeof p.url === 'string' && p.url.trim().length > 0
    );

    const maxThumbs = isGeneralSetup ? 3 : 2;
    return matched.slice(0, maxThumbs);
  }

  getHistoryRequirementStatus(rating: string | undefined): string {
    if (rating === '1') return 'Yes / Good';
    if (rating === '-1') return 'Action Required';
    if (rating === '0') return 'N/A';
    return 'Pending';
  }

  /**
   * Authoritative sample internal audit matching official screenshots (IA104368)
   */
  getSampleInternalAudit(): any {
    return {
      referenceNumber: 'IA104368',
      sessionId: 'ia_session_104368',
      jobNo: 'LBH/01/200',
      location: 'Buckingham Road',
      siteLocation: 'Buckingham Road',
      contract: 'LB Hackney',
      auditorName: 'Dean Willsher',
      auditedBy: 'Dean Willsher',
      siteIncharge: 'Warrick Oliver',
      foreman: 'Warrick Oliver',
      managerSupervisor: 'Tom Davis',
      supervisor: 'Tom Davis',
      auditedDateFormatted: '18 Nov, 2026, 04:40 PM',
      reportDateFormatted: '18 Nov, 2026',
      finalizedAt: '2026-11-18T16:40:00.000Z',
      completedAt: '2026-11-18T16:40:00.000Z',
      createdAt: '2026-11-18T16:40:00.000Z',
      auditorSummary:
        'This internal audit focused on a site undertaking the relaying of paving slabs and the application of tarmac around tree roots. The previous audit had raised a Corrective Action Request (CAR) regarding safety zones, which has reportedly been addressed, with cones now observed to be evenly spaced at no more than 9-meter intervals. However, during this visit, it was noted that several sections of the site barriers were displaced by a gust of wind, primarily due to the absence of sandbags or other securing measures. The primary focus of this audit was on safe working practices and traffic management. It was noted that all necessary paperwork, including Method Statements (MS), statistics, and permits, were audited during the last visit and found to be in place, as was emergency equipment.',
      comment:
        'This internal audit focused on a site undertaking the relaying of paving slabs and the application of tarmac around tree roots. The previous audit had raised a Corrective Action Request (CAR) regarding safety zones, which has reportedly been addressed, with cones now observed to be evenly spaced at no more than 9-meter intervals. However, during this visit, it was noted that several sections of the site barriers were displaced by a gust of wind, primarily due to the absence of sandbags or other securing measures. The primary focus of this audit was on safe working practices and traffic management. It was noted that all necessary paperwork, including Method Statements (MS), statistics, and permits, were audited during the last visit and found to be in place, as was emergency equipment.',
      photos: [
        { id: 'photo_1', name: 'Barriers & Cones Demarcation', url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18615f8?auto=format&fit=crop&w=400&q=80' },
        { id: 'photo_2', name: 'Tarmac & Tree Pit Zone', url: 'https://images.unsplash.com/photo-1508873696983-2df57046475a?auto=format&fit=crop&w=400&q=80' },
        { id: 'photo_3', name: 'Temporary Footway Clearance', url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=400&q=80' },
        { id: 'photo_4', name: 'Pavement Barrier Alignment', url: 'https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=400&q=80' },
        { id: 'photo_5', name: 'Pedestrian Walkway Segregation', url: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=400&q=80' },
        { id: 'photo_6', name: 'Road Works Access Point', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80' },
        { id: 'photo_7', name: 'Site Housekeeping & Leaves', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80' },
        { id: 'photo_8', name: 'Excavation Perimeter Fencing', url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18615f8?auto=format&fit=crop&w=400&q=80' },
        { id: 'photo_9', name: 'Traffic Guidance Signage', url: 'https://images.unsplash.com/photo-1508873696983-2df57046475a?auto=format&fit=crop&w=400&q=80' },
        { id: 'photo_10', name: 'Plant Parking & Storage', url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=400&q=80' },
      ],
      observations: [
        {
          focusArea: 'Appropriate PPE',
          focusAreaRef: 'FA01',
          finding:
            'Operatives on site were observed wearing appropriate high-visibility vests and trousers. No instances of shorts or inadequate high-visibility clothing were noted.',
          suggestedAction:
            'Ensure all operatives consistently wear full 6-point PPE, including high-visibility trousers and vests (shorts are strictly not permitted), safety footwear, and other required protective equipment relevant to the task.',
          rating: 'Compliant',
          hasCar: 'No',
          carStatus: 'Not Required',
          supportingPhotoIds: ['photo_1', 'photo_2', 'photo_3', 'photo_4', 'photo_5'],
        },
        {
          focusArea: 'Public is kept separate',
          focusAreaRef: 'FA02',
          finding:
            'The work area was generally demarcated using a combination of barriers and cones to separate the public from operatives. Signage, including \'PEDESTRIANS\' with an arrow and \'FOOTPATH CLOSED\', was in place to guide pedestrians safely around the works. The cone spacing appeared to be compliant with the previously raised CAR.',
          suggestedAction:
            'Continue to ensure that the public is effectively separated from the work area using appropriate fencing or cones. Pedestrian routes must be safely signed and protected, with barriers securely placed to prevent displacement.',
          rating: 'Compliant',
          hasCar: 'No',
          carStatus: 'Not Required',
          supportingPhotoIds: ['photo_1', 'photo_2', 'photo_3', 'photo_4', 'photo_5'],
        },
        {
          focusArea: 'Slips/Trips',
          focusAreaRef: 'FA18',
          finding:
            'The presence of numerous fallen leaves on both the pavement and road surfaces creates potential slip hazards, particularly if wet. Furthermore, the displaced temporary barriers, as observed in several images and noted in the audit context, could pose trip hazards to both operatives and the public.',
          suggestedAction:
            'Implement a proactive housekeeping regime to regularly clear fallen leaves and other debris from all walking and working surfaces. Ensure all temporary barriers are securely weighted or anchored to prevent displacement and eliminate potential trip hazards.',
          rating: 'Area for Improvement',
          hasCar: 'Yes',
          carStatus: 'Open',
          carRef: 'CA35138973',
          resolveByDate: '2026-12-18T17:05:00.000Z',
          resolveByDateFormatted: '18 Dec, 2026, 05:05 PM',
          assignedTo: 'Warrick Oliver',
          who: 'Warrick Oliver',
          supportingPhotoIds: ['photo_1', 'photo_2', 'photo_3', 'photo_4', 'photo_5', 'photo_6', 'photo_7', 'photo_8', 'photo_9', 'photo_10'],
        },
      ],
    };
  }
}
