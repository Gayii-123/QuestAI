import { Injectable, inject, signal } from '@angular/core';
import { ApiService, NextActionData } from './api.service';
import { Observable, firstValueFrom } from 'rxjs';

export interface ConversationalInspectionState {
  inspectionId: string | null;
  bankId: string | null;
  bankName: string | null;
  department: string | null;
  workflowStatus: string;
  activeQuestion: NextActionData | null;
  evidenceSummary: string | null;
  totalApplicable: number;
  userAnswered: number;
  aiSuggested: number;
  needsVerification: number;
  draftReady: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ConversationalInspectionService {
  private readonly api = inject(ApiService);

  readonly state = signal<ConversationalInspectionState>({
    inspectionId: null,
    bankId: null,
    bankName: null,
    department: null,
    workflowStatus: 'idle',
    activeQuestion: null,
    evidenceSummary: null,
    totalApplicable: 0,
    userAnswered: 0,
    aiSuggested: 0,
    needsVerification: 0,
    draftReady: false,
  });

  readonly isProcessing = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Starts a new inspection session for the selected category.
   */
  async startSession(bankId: string, siteContext?: { siteName?: string; jobReference?: string }): Promise<string> {
    this.isProcessing.set(true);
    this.errorMessage.set(null);

    try {
      const res = await firstValueFrom(
        this.api.startInspectionSession({
          bankId,
          siteContext,
          conversationId: `conv_${Date.now()}`,
        })
      );

      const data = res.data;
      this.state.update((s) => ({
        ...s,
        inspectionId: data.inspectionId,
        bankId: data.bankId,
        bankName: data.bankName,
        department: data.department,
        workflowStatus: data.workflowStatus,
        totalApplicable: data.stats?.totalApplicable || 0,
        needsVerification: data.stats?.needsVerification || 0,
      }));

      return data.inspectionId;
    } catch (err: any) {
      const msg = err.error?.message || err.message || 'Failed to start inspection session.';
      this.errorMessage.set(msg);
      throw err;
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Ingests a new photograph batch into the active session.
   */
  async addEvidenceBatch(photos: Array<{ id: string; name: string; base64Data: string; mimeType?: string }>): Promise<NextActionData> {
    const inspectionId = this.state().inspectionId;
    if (!inspectionId) {
      throw new Error('No active inspection session. Call startSession first.');
    }

    this.isProcessing.set(true);
    this.errorMessage.set(null);

    try {
      const res = await firstValueFrom(
        this.api.addEvidenceBatch({
          inspectionId,
          photos,
        })
      );

      const data = res.data;
      this.state.update((s) => ({
        ...s,
        workflowStatus: data.workflowStatus,
        evidenceSummary: data.visualSummary,
        activeQuestion: data.nextAction,
        draftReady: Boolean(data.nextAction?.draftReady),
      }));

      return data.nextAction;
    } catch (err: any) {
      const msg = err.error?.message || err.message || 'Failed to process evidence batch.';
      this.errorMessage.set(msg);
      throw err;
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Submits the user's natural language reply to the active question.
   */
  async submitAnswer(text: string, selectedValue?: string): Promise<NextActionData> {
    const currentState = this.state();
    const inspectionId = currentState.inspectionId;
    const activeQuestion = currentState.activeQuestion;

    if (!inspectionId || !activeQuestion?.questionId) {
      throw new Error('No active question to answer.');
    }

    this.isProcessing.set(true);
    this.errorMessage.set(null);

    try {
      const res = await firstValueFrom(
        this.api.submitInspectionAnswer({
          inspectionId,
          questionId: activeQuestion.questionId,
          reply: {
            text,
            selectedValue,
          },
        })
      );

      const data = res.data;
      this.state.update((s) => ({
        ...s,
        activeQuestion: data.nextAction,
        userAnswered: s.userAnswered + 1,
        draftReady: Boolean(data.nextAction?.draftReady),
      }));

      return data.nextAction;
    } catch (err: any) {
      const msg = err.error?.message || err.message || 'Failed to submit answer.';
      this.errorMessage.set(msg);
      throw err;
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Retrieves the structured draft for the active session.
   */
  async prepareDraft(): Promise<any> {
    const inspectionId = this.state().inspectionId;
    if (!inspectionId) {
      throw new Error('No active inspection session.');
    }

    this.isProcessing.set(true);
    try {
      const res = await firstValueFrom(this.api.prepareInspectionDraft(inspectionId));
      return res.data;
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Confirms the draft by the human inspector.
   */
  async confirmDraft(inspectorName: string, notes?: string): Promise<any> {
    const inspectionId = this.state().inspectionId;
    if (!inspectionId) {
      throw new Error('No active inspection session.');
    }

    this.isProcessing.set(true);
    try {
      const res = await firstValueFrom(
        this.api.confirmInspectionDraft(inspectionId, { inspectorName, notes })
      );
      this.state.update((s) => ({ ...s, workflowStatus: 'inspector_confirmed' }));
      return res.data;
    } finally {
      this.isProcessing.set(false);
    }
  }
}
