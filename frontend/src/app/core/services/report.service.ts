import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { PdfExportService, InspectionPdfData } from './pdf-export.service';
import {
  InspectionDraftSummaryViewModel,
  InspectionSessionViewModel,
} from '../models/inspection-view.models';
import { getQuestionsForDepartment } from '../models/site-inspection.schema';

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly apiService = inject(ApiService);
  private readonly pdfExportService = inject(PdfExportService);

  readonly inspectionHistoryList = signal<any[]>([]);
  readonly selectedHistoryRecord = signal<any | null>(null);

  // Official Report Modal inline row editing
  readonly editingHistoryQuestionId = signal<string | null>(null);
  readonly editingHistoryRating = signal<'1' | '-1' | '0' | ''>('');
  readonly editingHistoryCarPlan = signal<string>('');
  readonly cachedHistoryCarPlans: Record<string, string> = {};
  readonly historyRowSaveSuccess = signal<string | null>(null);
  private historySaveSuccessTimeout: any = null;

  constructor() {
    this.loadInspectionHistory();
  }

  loadInspectionHistory(): void {
    try {
      const raw = localStorage.getItem('questai_finalized_inspections');
      if (raw) {
        const list = JSON.parse(raw);
        this.inspectionHistoryList.set(Array.isArray(list) ? list : []);
      } else {
        this.inspectionHistoryList.set([]);
      }
    } catch {
      this.inspectionHistoryList.set([]);
    }
  }

  deleteHistoryRecord(referenceNumber: string): void {
    try {
      const existing = JSON.parse(
        localStorage.getItem('questai_finalized_inspections') || '[]'
      );
      const filtered = existing.filter(
        (item: any) => item.referenceNumber !== referenceNumber
      );
      localStorage.setItem('questai_finalized_inspections', JSON.stringify(filtered));
      this.loadInspectionHistory();
      if (this.selectedHistoryRecord()?.referenceNumber === referenceNumber) {
        this.closeHistoryRecord();
      }
    } catch (e) {
      console.error('Failed to delete inspection record', e);
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
    record.answers[questionId] = {
      ...currentAns,
      rating: newRating,
      carActionPlan: newPlan,
      answeredBy: 'human',
      isVerified: true,
      updatedAt: new Date().toISOString(),
    };

    // 2. Recalculate summary metrics
    this.recalculateRecordStats(record);

    // 3. Persist to localStorage
    try {
      const existing = JSON.parse(
        localStorage.getItem('questai_finalized_inspections') || '[]'
      );
      const idx = existing.findIndex(
        (item: any) => item.referenceNumber === record.referenceNumber
      );
      if (idx >= 0) {
        existing[idx] = { ...record };
      } else {
        existing.unshift({ ...record });
      }
      localStorage.setItem(
        'questai_finalized_inspections',
        JSON.stringify(existing)
      );
      this.loadInspectionHistory();
    } catch (e) {
      console.error(
        'Failed to persist edited inspection record to localStorage',
        e
      );
    }

    // 4. Update reactive selectedHistoryRecord signal
    this.selectedHistoryRecord.set({ ...record });

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
        .subscribe({ error: () => {} });
    } catch {}

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
    try {
      const existing = JSON.parse(
        localStorage.getItem('questai_finalized_inspections') || '[]'
      );
      const idx = existing.findIndex(
        (item: any) => item.referenceNumber === summary.referenceNumber
      );

      const photos = session?.uploadedPhotos ? [...session.uploadedPhotos] : [];
      const questions = session
        ? Object.values(session.questionAssessments).map((q) => ({
            id: q.questionId,
            qnum: q.qnum,
            headername: q.headername,
            qtext: q.qtext,
            isDynamicObservation: q.isDynamicObservation,
            supportingPhotoIds: q.supportingPhotoIds,
          }))
        : [];

      const record = {
        referenceNumber: summary.referenceNumber,
        jobNo: 'LBN-0029',
        jobReference: 'LBN-0029',
        conversationId: conversationId || '',
        bankId: summary.bankId,
        bankName: summary.bankName,
        department: summary.department,
        finalizedAt: summary.confirmedAt || new Date().toISOString(),
        inspectorName: 'Dan Kennett',
        supervisorName: 'Dan Kennett',
        foremanName: 'Bekim Aliaj',
        contract: '140-Newham',
        operatives: '1. Dan Kennett, 2. Bekim Aliaj',
        jobDescription: `${summary.bankName} - Highway safety & compliance inspection`,
        siteLocation: 'Romford Road',
        depot: 'N/A',
        totalScore: summary.passCount || 50,
        stats: {
          total: summary.totalApplicable,
          answered:
            summary.passCount + summary.carCount + summary.naCount,
          passCount: summary.passCount,
          carCount: summary.carCount,
          naCount: summary.naCount,
          needsReviewCount: summary.needsVerificationCount || 0,
          verifiedCount: summary.passCount,
        },
        answers: summary.answers || session?.answers || {},
        photoCount: photos.length,
        photos,
        questions,
        modelIdentifier: 'QuestAI Vision',
        isMock: false,
      };

      if (idx >= 0) {
        existing[idx] = record;
      } else {
        existing.unshift(record);
      }

      localStorage.setItem(
        'questai_finalized_inspections',
        JSON.stringify(existing)
      );
      this.loadInspectionHistory();
    } catch {}

    // Optionally save to Firebase backend in background
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
          error: () => {},
        });
    } catch {}
  }

  downloadReportPdf(summaryOrRecord: any): void {
    if (!summaryOrRecord) return;

    const ref = summaryOrRecord.referenceNumber || 'SI638150';
    const jobNo = summaryOrRecord.jobNo || summaryOrRecord.jobReference || 'LBN-0029';
    const bankName = summaryOrRecord.bankName || 'Site Inspection';
    const dept = summaryOrRecord.department || 'Civil';
    const site = summaryOrRecord.siteLocation || 'Romford Road';
    const inspector = summaryOrRecord.inspectorName || 'Dan Kennett';
    const supervisor = summaryOrRecord.supervisorName || inspector || 'Dan Kennett';
    const foreman = summaryOrRecord.foremanName || 'Bekim Aliaj';
    const contract = summaryOrRecord.contract || '140-Newham';
    const operatives = summaryOrRecord.operatives || '1. Dan Kennett, 2. Bekim Aliaj';
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
    const isGeneralSetup = question?.qnum === '01' || /appropriate traffic management in place/i.test(question?.qtext || '');

    // Prevent bulk dumping all site photos onto non-defect, non-general individual checks
    if (!isDefect && !isDynamic && !isGeneralSetup && totalSitePhotos > 1 && photoIds.length >= totalSitePhotos) {
      return [];
    }

    const idSet = new Set(photoIds);
    const matched = record.photos.filter(
      (p: any) => idSet.has(p.id) && p.url && typeof p.url === 'string' && p.url.trim().length > 0
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
}
