/**
 * QuestAI — SSRA Local Draft & Offline Persistence Service
 *
 * Provides resilient client-side draft saving and offline submission tracking.
 * Strictly uses dedicated SSRA keys:
 * - questai_ssra_local_drafts
 * - questai_ssra_local_submissions
 * Zero mixing with Site Inspection or Internal Audit storage keys.
 */

import { Injectable, inject } from '@angular/core';
import { SsraAssessment, SsraPhase1Data } from '../models/ssra.models';
import { AuthService } from '../../../core/services/auth.service';
import { SsraEvidenceService } from './ssra-evidence.service';

const DRAFTS_KEY = 'questai_ssra_local_drafts';
const SUBMISSIONS_KEY = 'questai_ssra_local_submissions';

export interface SsraLocalDraft {
  clientReferenceId: string;
  userId: string;
  domainType: string;
  phase1Data: SsraPhase1Data;
  lastSavedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class SsraDraftService {
  private readonly authService = inject(AuthService, { optional: true });
  private readonly evidenceService = inject(SsraEvidenceService, { optional: true });

  private getActiveUserId(): string {
    return this.authService?.currentUser()?.uid || 'guest';
  }

  generateClientReferenceId(): string {
    return this.evidenceService?.generateUuid() || this.fallbackUuid();
  }

  private fallbackUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // --- Draft Management ---

  saveDraft(clientRefIdOrData: string | SsraPhase1Data, domainType?: string, data?: SsraPhase1Data): void {
    try {
      const uid = this.getActiveUserId();
      const all = this.getAllDrafts();

      let clientRefId: string;
      let dType: string;
      let payload: SsraPhase1Data;

      if (typeof clientRefIdOrData === 'object') {
        clientRefId = clientRefIdOrData.clientReferenceId;
        dType = clientRefIdOrData.domainType;
        payload = clientRefIdOrData;
      } else {
        clientRefId = clientRefIdOrData;
        dType = domainType || 'traffic-management';
        payload = data!;
      }

      const draft: SsraLocalDraft = {
        clientReferenceId: clientRefId,
        userId: uid,
        domainType: dType,
        phase1Data: payload,
        lastSavedAt: new Date().toISOString(),
      };

      const idx = all.findIndex((d) => d.clientReferenceId === clientRefId && d.userId === uid);
      if (idx >= 0) {
        all[idx] = draft;
      } else {
        all.unshift(draft);
      }

      localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[SsraDraft] Failed to save draft to localStorage', e);
    }
  }

  loadDraft(): SsraPhase1Data | null {
    const drafts = this.listUserDrafts();
    return drafts.length > 0 ? drafts[0].phase1Data : null;
  }

  clearDraft(): void {
    const drafts = this.listUserDrafts();
    if (drafts.length > 0) {
      this.deleteDraft(drafts[0].clientReferenceId);
    }
  }

  getDraft(clientRefId: string): SsraLocalDraft | null {
    const uid = this.getActiveUserId();
    const all = this.getAllDrafts();
    return all.find((d) => d.clientReferenceId === clientRefId && d.userId === uid) || null;
  }

  listUserDrafts(): SsraLocalDraft[] {
    const uid = this.getActiveUserId();
    return this.getAllDrafts().filter((d) => d.userId === uid);
  }

  deleteDraft(clientRefId: string): void {
    try {
      const uid = this.getActiveUserId();
      const all = this.getAllDrafts().filter(
        (d) => !(d.clientReferenceId === clientRefId && d.userId === uid)
      );
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
    } catch { }
  }

  private getAllDrafts(): SsraLocalDraft[] {
    try {
      const raw = localStorage.getItem(DRAFTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // --- Local Submissions Cache (Offline & Preview Testing) ---

  saveLocalSubmission(assessment: SsraAssessment): void {
    try {
      const all = this.getAllSubmissions();
      const idx = all.findIndex((a) => a.id === assessment.id || a.clientReferenceId === assessment.clientReferenceId);
      if (idx >= 0) {
        all[idx] = assessment;
      } else {
        all.unshift(assessment);
      }
      localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('[SsraDraft] Failed to save submission to localStorage', e);
    }
  }

  getLocalSubmissions(): SsraAssessment[] {
    const uid = this.getActiveUserId();
    return this.getAllSubmissions().filter((a) => a.userId === uid || !a.userId);
  }

  getLocalSubmissionById(id: string): SsraAssessment | null {
    return (
      this.getAllSubmissions().find(
        (a) => a.id === id || a.refno === id || a.clientReferenceId === id
      ) || null
    );
  }

  deleteLocalSubmission(id: string): void {
    try {
      const all = this.getAllSubmissions().filter((a) => a.id !== id && a.refno !== id);
      localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(all));
    } catch { }
  }

  private getAllSubmissions(): SsraAssessment[] {
    try {
      const raw = localStorage.getItem(SUBMISSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
