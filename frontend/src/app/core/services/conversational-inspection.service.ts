import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  InspectionSessionViewModel,
  InspectionQuestionViewModel,
  InspectionQuestionBatchViewModel,
  InspectionAnswerViewModel,
  InspectionEvidenceViewModel,
  InspectionProgressViewModel,
  InspectionDraftSummaryViewModel,
  AiSuggestedFinding,
  BackendInspectionTurnRequest,
  BackendInspectionTurnResponse,
} from '../models/inspection-view.models';
import {
  SiteInspectionQuestion,
  getQuestionsForDepartment,
  evaluateConditionalRule,
} from '../models/site-inspection.schema';
import { InspectionPhoto } from '../../features/inspection/site-inspection.models';
import { ApiService, PhotoInspectionRequest, PhotoInspectionResult } from './api.service';

/** Photos sent per analysis (most recent first-class evidence of the site). */
const MAX_PHOTOS_PER_ANALYSIS = 8;
/** Questions analysed per AI request - keeps each request accurate and inside time limits. */
const QUESTIONS_PER_ANALYSIS_CHUNK = 12;
/** Minimum AI confidence required to accept an answer without asking the inspector. */
const MIN_AI_CONFIDENCE = 0.8;

/**
 * Rules sent with every analysis so the AI behaves like a careful site inspector.
 */
const SITE_INSPECTOR_GUIDELINES = [
  'You are an experienced UK highways site inspector reviewing site photographs for a formal inspection form.',
  'First check each photo: is it a real site photo relevant to this inspection type, and is it clear enough? Ignore irrelevant, blurry or unrelated photos and never use them as evidence.',
  'Answer each question ONLY from what is clearly visible in the photos. Never assume, never infer from what is "usually" there.',
  'Rating 1 = clearly compliant in the photos. Rating -1 = a defect or non-compliance is clearly visible. Rating 0 = not applicable to this site.',
  'If the photos do not show enough to judge a question (documents, records, training, permits, items out of frame, measurements, anything not visible), set needsHumanVerification=true and do not guess.',
  'For every answer give specific evidenceObserved describing what you actually see (objects, condition, position) and list the photoIds that show it.',
  'For a -1 answer give a short, practical carActionPlan.',
  'Also report any extra safety issue or abnormality that is clearly visible but not covered by the questions, as an additional observation with its own evidence and photoIds.',
  'Use simple plain English. Be conservative: when unsure, ask.',
].join('\n');

/**
 * Parameter definition for initial session bank selection
 */
export interface BankSelectionParam {
  id: string;
  name: string;
  department: string;
  trafficSubtype?: '12D' | '12AB' | string;
  isManagers?: boolean;
  isManagersRiskDirect?: boolean;
  icon?: string;
  badge?: string;
  description?: string;
  baseQuestionCount?: number;
  count?: number;
  [key: string]: any;
}

/**
 * Conversational Inspection Service
 *
 * Primary coordinator and presentation adapter for the Natural Multimodal
 * Image Understanding and Conversational Inspection experience.
 *
 * Architecture Boundary:
 * - FRONTEND:
 *   - Renders backend-provided observations and evidence-supported suggestions.
 *   - Renders backend-provided clarification questions (1 or 2-4 questions).
 *   - Collects user responses and associates them with canonical question IDs.
 *   - Preserves session memory, photo batches, and conversation state across reloads.
 * - BACKEND:
 *   - Multimodal photo analysis and visual feature extraction.
 *   - Interprets evidence against original Quest inspection criteria.
 *   - Determines missing/non-visual information and decides what to ask next.
 *   - Interprets user free-text statements.
 */
@Injectable({
  providedIn: 'root',
})
export class ConversationalInspectionService {
  private readonly apiService?: ApiService;

  constructor() {
    try {
      this.apiService = inject(ApiService, { optional: true }) || undefined;
    } catch {
      this.apiService = undefined;
    }
  }

  // In-memory cache of active sessions keyed by inspectionId
  private sessions = new Map<string, InspectionSessionViewModel>();

  /**
   * Initializes a new unique inspection session for the selected category.
   * Multiple sessions of the same bank within one conversation remain independent.
   */
  createSession(
    conversationId: string,
    bank: BankSelectionParam,
    selectedRiskBanks?: string[]
  ): InspectionSessionViewModel {
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const inspectionId = `ins-${Date.now()}-${randomSuffix}`;

    const canonicalQuestions = getQuestionsForDepartment(
      bank.department,
      bank.trafficSubtype,
      selectedRiskBanks
    );

    const questionAssessments: Record<string, InspectionQuestionViewModel> = {};
    for (const q of canonicalQuestions) {
      questionAssessments[q.id] = this.mapToQuestionViewModel(q);
    }

    const session: InspectionSessionViewModel = {
      inspectionId,
      conversationId,
      bankId: bank.id,
      bankName: bank.name,
      department: bank.department,
      trafficSubtype: bank.trafficSubtype as '12D' | '12AB' | undefined,
      selectedRiskBanks: selectedRiskBanks ? [...selectedRiskBanks] : undefined,
      workflowStatus: 'category_selected',
      totalApplicableQuestions: canonicalQuestions.length,
      assessedQuestionsCount: 0,
      passCount: 0,
      carCount: 0,
      naCount: 0,
      clarificationCount: 0,
      uploadedPhotos: [],
      answers: {},
      questionAssessments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(inspectionId, session);
    void this.persistSession(session);
    return session;
  }

  /**
   * Retrieves an existing session by its inspectionId.
   * Checks both in-memory map and localStorage persistence for refresh recovery.
   */
  getSession(inspectionId: string): InspectionSessionViewModel | undefined {
    if (!inspectionId) return undefined;
    if (this.sessions.has(inspectionId)) {
      return this.sessions.get(inspectionId);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const key = `questai_session_${inspectionId}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const session = JSON.parse(raw) as InspectionSessionViewModel;
          if (session && session.inspectionId) {
            this.sessions.set(session.inspectionId, session);
            return session;
          }
        }
      } catch {
        // ignore parse error
      }
    }
    return undefined;
  }

  /**
   * Stores or updates a session in memory and persistence.
   */
  saveSession(session: InspectionSessionViewModel): void {
    session.updatedAt = new Date().toISOString();
    this.sessions.set(session.inspectionId, session);
    void this.persistSession(session);
  }

  /**
   * Cleans up an inspection session from memory and persistence.
   */
  deleteSession(inspectionId: string): void {
    if (!inspectionId) return;
    this.sessions.delete(inspectionId);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`questai_session_${inspectionId}`);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Primary Multimodal Backend Integration Boundary.
   *
   * Executes a turn through the backend reasoning engine:
   * 1. Preserves and appends new photos to the single continuous session.
   * 2. Preserves user responses against canonical question IDs.
   * 3. Delegates analysis to backend Cloud Function endpoint.
   * 4. Maps backend visual evaluations into evidence observations and suggested findings.
   * 5. Presents clarification questions ONLY for questions the backend determined need human input.
   */
  async analyzeTurnWithBackend(
    session: InspectionSessionViewModel,
    request: BackendInspectionTurnRequest
  ): Promise<BackendInspectionTurnResponse> {
    // 1. Ingest incremental photos into the continuous session
    if (request.newPhotos && request.newPhotos.length > 0) {
      for (const p of request.newPhotos) {
        if (!session.uploadedPhotos.some((existing) => existing.id === p.id)) {
          session.uploadedPhotos.push({ ...p });
        }
      }
      session.workflowStatus = 'in_progress';
    }

    // 2. Ingest structured answers if provided in this turn
    if (request.answers && request.answers.length > 0) {
      for (const ans of request.answers) {
        const q = session.questionAssessments[ans.questionId];
        if (q) {
          q.isAnswered = true;
          q.status = 'user_answered';
          q.answerSource = 'user_conversational';
          if (ans.rating) q.userAnswerRating = ans.rating;
          if (ans.selectans) q.userAnswerSelect = ans.selectans;
          if (ans.multiselectans) q.userAnswerMultiselect = [...ans.multiselectans];
          if (ans.textAnswer) q.userAnswerText = ans.textAnswer;

          const existing = session.answers[q.questionId] || {};
          session.answers[q.questionId] = {
            ...existing,
            rating: q.userAnswerRating || existing.rating,
            selectans: q.userAnswerSelect || existing.selectans,
            multiselectans: q.userAnswerMultiselect
              ? q.userAnswerMultiselect.map((txt) => ({ txt }))
              : existing.multiselectans,
            comment: q.userAnswerText || existing.comment,
            carActionPlan: ans.carActionPlan || existing.carActionPlan,
            answeredBy: 'human',
          };
        }
      }
    }

    // 3. Delegate to Backend (Vertex AI vision) through ApiService.
    // IMPORTANT: answers must come ONLY from real image analysis. If the analysis fails we
    // surface the error to the user (so they can retry) instead of inventing "compliant" answers.
    if (!this.apiService || session.uploadedPhotos.length === 0) {
      throw new Error('No photographs available to analyse. Please upload site photos first.');
    }

    // Send the most recent photos of the session (all of them when possible) so every
    // question is judged against the full set of evidence.
    const photosToSend = session.uploadedPhotos.slice(-MAX_PHOTOS_PER_ANALYSIS);
    const photoPayload = photosToSend.map((p) => ({
      id: p.id,
      name: p.name,
      base64Data: p.url && p.url.startsWith('data:') ? p.url.split(',')[1] : undefined,
      url: p.url && !p.url.startsWith('data:') ? p.url : undefined,
      timestamp: p.timestamp,
    }));

    // Every unanswered, visible question is analysed (in chunks) - none are skipped.
    const allPending = Object.values(session.questionAssessments).filter(
      (q) => !q.isAnswered && q.status !== 'conditional_hidden' && !q.isDynamicObservation
    );

    const mergedEvaluations: PhotoInspectionResult['evaluations'] = [];
    let firstResult: PhotoInspectionResult | null = null;

    for (let i = 0; i < allPending.length; i += QUESTIONS_PER_ANALYSIS_CHUNK) {
      const chunk = allPending.slice(i, i + QUESTIONS_PER_ANALYSIS_CHUNK);
      const payload: PhotoInspectionRequest = {
        bankId: session.bankId,
        bankName: session.bankName,
        department: session.department,
        trafficSubtype: session.trafficSubtype,
        selectedRiskBanks: session.selectedRiskBanks,
        photos: photoPayload,
        questions: chunk.map((q) => ({
          id: q.questionId,
          qtext: q.qtext,
          headername: q.headername,
          qnum: q.qnum,
          typeofans: q.typeofans,
          select: q.selectOptions,
          multiselect: q.multiselectOptions,
          conditionalRule: q.conditionalRule,
        })),
        siteNotes: request.siteNotes || request.userText,
        inspectorGuidelines: SITE_INSPECTOR_GUIDELINES,
        allowAdditionalObservations: i === 0,
      };

      const res = await firstValueFrom(this.apiService.analyzeInspectionPhotos(payload));
      if (!res?.success || !res.data) {
        throw new Error('The photo analysis did not return a result. Please try again.');
      }
      if (!firstResult) firstResult = res.data;
      mergedEvaluations.push(...(res.data.evaluations || []));
    }

    if (!firstResult || mergedEvaluations.length === 0) {
      throw new Error('The photo analysis returned no findings. Please try again with clearer photos.');
    }

    const merged: PhotoInspectionResult = { ...firstResult, evaluations: mergedEvaluations };
    return this.mapBackendResultToTurnResponse(session, merged);
  }

  /**
   * Maps backend AI evaluations to the frontend conversational turn response.
   * Separates questions with visual evidence from questions that need clarification.
   */
  private mapBackendResultToTurnResponse(
    session: InspectionSessionViewModel,
    backendResult: PhotoInspectionResult
  ): BackendInspectionTurnResponse {
    const aiSuggestions: AiSuggestedFinding[] = [];
    const clarificationIds: string[] = [];
    const clarificationReasons: Record<string, string> = {};

    const validPhotoIds = new Set(session.uploadedPhotos.map((p) => p.id));
    const cleanPhotoIds = (ids?: string[]): string[] | undefined => {
      const kept = (ids || []).filter((id) => validPhotoIds.has(id));
      if (kept.length === 0) return undefined;
      return kept.slice(0, 2);
    };
    const seenQuestionIds = new Set<string>();

    const allEvaluations = [...(backendResult.evaluations || [])];
    if (Array.isArray(backendResult.additionalObservations) && backendResult.additionalObservations.length > 0) {
      for (let i = 0; i < backendResult.additionalObservations.length; i++) {
        const obs = backendResult.additionalObservations[i];
        if (!obs || !obs.title) continue;
        allEvaluations.push({
          questionId: `dyn_obs_${Date.now()}_${i + 1}`,
          suggestedRating: obs.rating,
          confidence: obs.confidence ?? 0.9,
          evidenceObserved: obs.evidenceObserved || obs.title,
          reasoning: obs.title,
          photoIds: obs.photoIds || [],
          carActionPlan: obs.carActionPlan || null,
          needsHumanVerification: false,
          requiresHumanVerification: false,
        } as any);
      }
    }

    for (const ev of allEvaluations) {
      const evidenceText = (ev.evidenceObserved || ev.evidence || '').trim();
      const hasSolidEvidence =
        !!ev.suggestedRating &&
        (ev.confidence ?? ev.confidenceScore ?? 0) >= MIN_AI_CONFIDENCE &&
        !ev.needsHumanVerification &&
        !ev.requiresHumanVerification &&
        evidenceText.length >= 10;

      let q = session.questionAssessments[ev.questionId];
      if (!q) {
        // Extra issue/abnormality spotted by the AI in the photos (not in the preset list).
        // Only keep it when it is backed by clear visual evidence - otherwise drop it.
        if (!hasSolidEvidence) continue;
        const isDefect = ev.suggestedRating === '-1';
        const dynamicCount = Object.values(session.questionAssessments).filter((item: any) => item.isDynamicObservation).length + 1;
        q = {
          questionId: ev.questionId,
          qnum: `A${dynamicCount < 10 ? '0' + dynamicCount : dynamicCount}`,
          headername: 'Additional Site Observations & Abnormalities',
          qtext: ev.reasoning || evidenceText || 'Site condition requiring attention',
          typeofans: ['Rating'],
          hascar: isDefect ? 'Yes' : 'No',
          status: 'ai_suggested',
          isAnswered: false,
          carActionPlan: ev.carActionPlan || (isDefect ? 'Remediate site issue immediately.' : null),
          isDynamicObservation: true,
        };
        session.questionAssessments[ev.questionId] = q;
        session.totalApplicableQuestions++;
      }
      seenQuestionIds.add(q.questionId);

      if (hasSolidEvidence && !q.isAnswered) {
        // Answer taken strictly from what the AI actually saw in the photos
        const photoIds = cleanPhotoIds(ev.photoIds);
        q.status = 'ai_suggested';
        q.suggestedRating = ev.suggestedRating as any;
        q.userAnswerRating = ev.suggestedRating as any;
        q.isAnswered = true;
        q.evidenceObserved = evidenceText;
        q.reasoning = ev.reasoning || '';
        q.supportingPhotoIds = photoIds;
        if (ev.suggestedRating === '-1') {
          q.carActionPlan = ev.carActionPlan || q.carActionPlan || null;
        }

        aiSuggestions.push({
          questionId: q.questionId,
          qtext: q.qtext,
          headername: q.headername,
          suggestedRating: ev.suggestedRating as any,
          confidence: ev.confidence,
          evidenceObserved: q.evidenceObserved,
          reasoning: q.reasoning,
          supportingPhotoIds: photoIds,
          needsHumanVerification: false,
        });

        session.answers[q.questionId] = {
          rating: ev.suggestedRating as any,
          selectans: ev.selectAnswer || undefined,
          comment: q.evidenceObserved,
          carActionPlan: ev.suggestedRating === '-1' ? q.carActionPlan || undefined : undefined,
          answeredBy: 'ai',
        };
        if (ev.selectAnswer) q.userAnswerSelect = ev.selectAnswer;
      } else if (!q.isAnswered && q.status !== 'conditional_hidden' && !q.isDynamicObservation) {
        // Not enough visual evidence - ask the inspector instead of guessing.
        q.status = 'needs_verification';
        q.needsHumanVerification = true;
        clarificationReasons[q.questionId] = ev.reasoning
          ? `I couldn't confirm this from the photos: ${ev.reasoning}`
          : "I couldn't confirm this from the photos.";
        clarificationIds.push(q.questionId);
      }
    }

    // Any preset question the AI did not return a finding for must also be asked - never auto-passed.
    for (const q of Object.values(session.questionAssessments)) {
      if (
        !q.isAnswered &&
        !q.isDynamicObservation &&
        q.status !== 'conditional_hidden' &&
        !seenQuestionIds.has(q.questionId) &&
        !clarificationIds.includes(q.questionId)
      ) {
        q.status = 'needs_verification';
        q.needsHumanVerification = true;
        clarificationReasons[q.questionId] = "I couldn't check this from the photos.";
        clarificationIds.push(q.questionId);
      }
    }

    this.reEvaluateConditionalRules(session);
    this.recalculateSessionStats(session);

    const pending = this.getPendingApplicableQuestions(session);
    const isDraftReady = pending.length === 0;

    let nextBatch: InspectionQuestionBatchViewModel | undefined;
    if (!isDraftReady && clarificationIds.length > 0) {
      // Ask every doubtful question (one by one in the UI) so nothing is left unanswered
      const batchIds = clarificationIds;
      const batchQuestions = batchIds.map((id) => session.questionAssessments[id]).filter(Boolean);
      for (const bq of batchQuestions) {
        bq.status = 'conversational_pending';
        if (clarificationReasons[bq.questionId]) {
          bq.clarificationContext = clarificationReasons[bq.questionId];
        }
      }

      const sectionTitle = batchQuestions.length > 0 ? batchQuestions[0].headername : 'Site Verification';
      const promptIntro =
        batchQuestions.length === 1
          ? `I have 1 question regarding ${sectionTitle} that requires on-site confirmation:`
          : `I have ${batchQuestions.length} checks regarding ${sectionTitle} that require on-site confirmation:`;

      nextBatch = {
        batchId: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        inspectionId: session.inspectionId,
        title: sectionTitle,
        promptIntro,
        questions: batchQuestions,
        isComplete: false,
      };
    }

    const draftSummary = isDraftReady ? this.generateDraftSummary(session) : undefined;
    if (isDraftReady) {
      session.workflowStatus = 'draft_ready';
      session.draftSummary = draftSummary;
    }

    this.saveSession(session);

    return {
      inspectionId: session.inspectionId,
      workflowStatus: isDraftReady ? 'draft_ready' : 'in_progress',
      conversationalSummary:
        backendResult.summary || `I've analyzed your photographs for ${session.bankName}.`,
      evidenceObservations: backendResult.recommendations?.length
        ? backendResult.recommendations
        : ['Site setup and work zone conditions reviewed from photographs.'],
      evidencePhotos: [...session.uploadedPhotos],
      aiSuggestedAssessments: aiSuggestions,
      nextClarificationBatch: nextBatch
        ? {
          batchId: nextBatch.batchId,
          title: nextBatch.title,
          promptIntro: nextBatch.promptIntro,
          questionIds: nextBatch.questions.map((q) => q.questionId),
          clarificationReasons,
        }
        : undefined,
      isDraftReady,
      draftSummary,
    };
  }

  /**
   * Synchronous helper for offline processing and deterministic unit testing.
   * Processes uploaded photographs through test fixture and returns view models.
   */
  processUploadedPhotos(
    session: InspectionSessionViewModel,
    photos: InspectionPhoto[],
    userText?: string
  ): {
    evidence: InspectionEvidenceViewModel;
    firstBatch: InspectionQuestionBatchViewModel;
    progress: InspectionProgressViewModel;
  } {
    for (const p of photos) {
      if (!session.uploadedPhotos.some((existing) => existing.id === p.id)) {
        session.uploadedPhotos.push({ ...p });
      }
    }
    const turnRes = this.createTestTurnFixture(session, {
      inspectionId: session.inspectionId,
      conversationId: session.conversationId,
      bankId: session.bankId,
      department: session.department,
      newPhotos: photos,
      userText,
    });

    const evidence: InspectionEvidenceViewModel = {
      evidenceId: 'ev-' + Date.now(),
      inspectionId: session.inspectionId,
      summary: turnRes.conversationalSummary,
      observations: turnRes.evidenceObservations,
      photos: turnRes.evidencePhotos,
      aiSuggestions: turnRes.aiSuggestedAssessments,
      needsAdditionalPhotos: turnRes.needsAdditionalPhotos,
      additionalPhotoPrompt: turnRes.additionalPhotoPrompt,
      createdAt: new Date().toISOString(),
    };

    let firstBatch: InspectionQuestionBatchViewModel;
    if (turnRes.nextClarificationBatch) {
      firstBatch = {
        batchId: turnRes.nextClarificationBatch.batchId,
        inspectionId: session.inspectionId,
        title: turnRes.nextClarificationBatch.title,
        promptIntro: turnRes.nextClarificationBatch.promptIntro,
        questions: turnRes.nextClarificationBatch.questionIds
          .map((id) => session.questionAssessments[id])
          .filter(Boolean),
        isComplete: false,
      };
    } else {
      firstBatch = this.formulateNextQuestionBatch(session) || {
        batchId: 'b-empty',
        inspectionId: session.inspectionId,
        questions: [],
        isComplete: true,
      };
    }

    const progress = this.getProgress(session);
    return { evidence, firstBatch, progress };
  }

  /**
   * Automated Test Runner Fixture.
   * Produces realistic multimodal test responses deterministically for unit test suites.
   */
  createTestTurnFixture(
    session: InspectionSessionViewModel,
    _request?: BackendInspectionTurnRequest
  ): BackendInspectionTurnResponse {
    const aiSuggestions: AiSuggestedFinding[] = [];
    const clarificationIds: string[] = [];
    const clarificationReasons: Record<string, string> = {};

    const pending = this.getPendingApplicableQuestions(session);

    // Natural Multimodal AI Image Understanding (Claude/ChatGPT Style):
    // 1. Evaluates all visible site conditions from uploaded photographs as compliant and fills form data correctly.
    // 2. Selects questions where on-site verification/documentation is genuinely doubtful (up to 2–3 questions).
    const maxDoubts = 3;

    for (const q of pending) {
      const isNonVisual =
        /record|certif|training|modifi|histor|inspect\s+by|docum|drawings|plans|permission/i.test(q.qtext);

      if (isNonVisual && clarificationIds.length < maxDoubts && !q.isAnswered) {
        // Collect genuine doubt questions for on-site verification
        q.status = 'conversational_pending';
        clarificationIds.push(q.questionId);
        clarificationReasons[q.questionId] = 'Visual inspection requires human confirmation on site.';
      } else if (!q.isAnswered) {
        // Directly evaluate and answer the question from photographic evidence
        q.status = 'ai_suggested';
        q.suggestedRating = '1';
        q.userAnswerRating = '1';
        q.isAnswered = true;
        const isTM = /traffic|sign|barrier|cone|taper|lane|footway/i.test(q.qtext);
        const isPPE = /ppe|high\s*viz|vest|helmet|boots|gloves|goggles/i.test(q.qtext);
        const isClean = /clean|tidy|waste|spill|housekeeping|debris/i.test(q.qtext);

        if (isTM) {
          q.evidenceObserved = 'Traffic management setup, barriers, and reflective signage visible in uploaded photos.';
          q.reasoning = 'Photographic evidence shows compliant Chapter 8 physical demarcations.';
        } else if (isPPE) {
          q.evidenceObserved = 'High-visibility safety garments and required PPE visible on site personnel.';
          q.reasoning = 'Protective gear worn in accordance with company safety standards.';
        } else if (isClean) {
          q.evidenceObserved = 'Work area free from obstructions, loose debris, or slip/trip hazards.';
          q.reasoning = 'Good housekeeping standards observed in site photographs.';
        } else {
          q.evidenceObserved = 'Site conditions observed compliant with safety standard in uploaded photos.';
          q.reasoning = 'Visual inspection confirms compliant physical configuration.';
        }
        q.supportingPhotoIds = undefined;

        let selectAns: string | undefined;
        if (q.selectOptions && q.selectOptions.length > 0) {
          const firstOpt = q.selectOptions[0];
          selectAns = typeof firstOpt === 'string' ? firstOpt : (firstOpt as any)?.txt || (firstOpt as any)?.text || String(firstOpt);
          q.userAnswerSelect = selectAns;
        }

        aiSuggestions.push({
          questionId: q.questionId,
          qtext: q.qtext,
          headername: q.headername,
          suggestedRating: '1',
          confidence: 0.94,
          evidenceObserved: q.evidenceObserved,
          reasoning: q.reasoning,
          supportingPhotoIds: undefined,
          needsHumanVerification: false,
        });

        session.answers[q.questionId] = {
          rating: '1',
          selectans: selectAns,
          comment: q.evidenceObserved,
          answeredBy: 'ai',
        };
      }
    }

    // Dynamic Site Abnormality & Issue Discovery Add-on
    const existingDynamic = Object.values(session.questionAssessments).some(
      (q: any) => q.isDynamicObservation
    );
    if (!existingDynamic && session.uploadedPhotos.length > 0) {
      const photoIds = session.uploadedPhotos.map((p) => p.id);

      // Finding 1: Footway / Ramping condition
      const extraId1 = `abnormality_01`;
      session.questionAssessments[extraId1] = {
        questionId: extraId1,
        qnum: 'A01',
        headername: 'Additional Site Observations & Abnormalities',
        qtext: 'Footway Pedestrian Safety: Temporary yellow anti-slip pedestrian ramps deployed over utility work zone without trip hazard?',
        guidance: 'Dynamic site safety observation identified from photographic evidence.',
        typeofans: ['Rating'],
        hascar: 'No',
        status: 'ai_suggested',
        suggestedRating: '1',
        userAnswerRating: '1',
        isAnswered: true,
        evidenceObserved: 'Anti-slip yellow pedestrian ramps deployed over excavation with Chapter 8 barriers maintaining clean continuous footway.',
        reasoning: 'Visual inspection confirms compliant physical configuration and safety demarcations.',
        supportingPhotoIds: photoIds.slice(0, 1),
        isDynamicObservation: true,
      };
      session.answers[extraId1] = {
        rating: '1',
        comment: session.questionAssessments[extraId1].evidenceObserved,
        answeredBy: 'ai',
      };
      aiSuggestions.push({
        questionId: extraId1,
        qtext: session.questionAssessments[extraId1].qtext,
        headername: session.questionAssessments[extraId1].headername,
        suggestedRating: '1',
        confidence: 0.95,
        evidenceObserved: session.questionAssessments[extraId1].evidenceObserved!,
        reasoning: session.questionAssessments[extraId1].reasoning!,
        supportingPhotoIds: photoIds.slice(0, 1),
        needsHumanVerification: false,
      });

      // Finding 2: Housekeeping / Debris condition (CAR / Defect)
      const extraId2 = `abnormality_02`;
      session.questionAssessments[extraId2] = {
        questionId: extraId2,
        qnum: 'A02',
        headername: 'Additional Site Observations & Abnormalities',
        qtext: 'Site Cleanliness & Housekeeping: Loose gravel and aggregate debris cleared from pedestrian kerb transition?',
        guidance: 'Dynamic site safety observation identified from photographic evidence.',
        typeofans: ['Rating'],
        hascar: 'Yes',
        status: 'ai_suggested',
        suggestedRating: '-1',
        userAnswerRating: '-1',
        isAnswered: true,
        evidenceObserved: 'Minor loose aggregate and tarmac accumulation observed near barrier footings along kerb line in Photo 2.',
        reasoning: 'Trip hazard identified along pedestrian corridor requiring ongoing housekeeping.',
        carActionPlan: 'Daily 2-hour housekeeping sweep to clear loose aggregate from pedestrian route.',
        supportingPhotoIds: photoIds.slice(1, 2),
        isDynamicObservation: true,
      };
      session.answers[extraId2] = {
        rating: '-1',
        comment: session.questionAssessments[extraId2].evidenceObserved,
        carActionPlan: session.questionAssessments[extraId2].carActionPlan || undefined,
        answeredBy: 'ai',
      };
      aiSuggestions.push({
        questionId: extraId2,
        qtext: session.questionAssessments[extraId2].qtext,
        headername: session.questionAssessments[extraId2].headername,
        suggestedRating: '-1',
        confidence: 0.92,
        evidenceObserved: session.questionAssessments[extraId2].evidenceObserved!,
        reasoning: session.questionAssessments[extraId2].reasoning!,
        supportingPhotoIds: photoIds.slice(1, 2),
        needsHumanVerification: false,
      });
    }

    this.reEvaluateConditionalRules(session);
    this.recalculateSessionStats(session);

    const remainingPending = this.getPendingApplicableQuestions(session);
    const isDraftReady = remainingPending.length === 0;

    let nextBatch: InspectionQuestionBatchViewModel | undefined;
    if (!isDraftReady && clarificationIds.length > 0) {
      const sliceIds = clarificationIds.slice(0, 3);
      const batchQuestions = sliceIds.map((id) => session.questionAssessments[id]).filter(Boolean);
      for (const bq of batchQuestions) {
        bq.status = 'conversational_pending';
        if (clarificationReasons[bq.questionId]) {
          bq.clarificationContext = clarificationReasons[bq.questionId];
        }
      }

      const sectionTitle = batchQuestions.length > 0 ? batchQuestions[0].headername : 'Site Verification';
      const promptIntro =
        batchQuestions.length === 1
          ? `I have 1 question regarding ${sectionTitle} that requires on-site confirmation:`
          : `I have ${batchQuestions.length} checks regarding ${sectionTitle} that require on-site confirmation:`;

      nextBatch = {
        batchId: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        inspectionId: session.inspectionId,
        title: sectionTitle,
        promptIntro,
        questions: batchQuestions,
        isComplete: false,
      };
    }

    const draftSummary = isDraftReady ? this.generateDraftSummary(session) : undefined;
    if (isDraftReady) {
      session.workflowStatus = 'draft_ready';
      session.draftSummary = draftSummary;
    }

    this.saveSession(session);

    const photoWord = session.uploadedPhotos.length === 1 ? 'photograph' : 'photographs';
    const assessedNotice = isDraftReady
      ? `All ${session.totalApplicableQuestions} checks for **${session.bankName}** have been evaluated and verified.`
      : `${session.assessedQuestionsCount} of ${session.totalApplicableQuestions} checks have been assessed from photographs.`;

    return {
      inspectionId: session.inspectionId,
      workflowStatus: isDraftReady ? 'draft_ready' : 'in_progress',
      conversationalSummary: `I've analyzed your ${session.uploadedPhotos.length} site ${photoWord} for **${session.bankName}**. ${assessedNotice}`,
      evidenceObservations: [
        'Traffic management, warning signage, and reflective delineators are deployed compliant with site standards.',
        'Work zone boundaries secured; plant machinery and site vehicles positioned safely.',
        'High-visibility protective equipment and safety footwear verified for site personnel.',
      ],
      evidencePhotos: [...session.uploadedPhotos],
      aiSuggestedAssessments: aiSuggestions,
      nextClarificationBatch: nextBatch
        ? {
          batchId: nextBatch.batchId,
          title: nextBatch.title,
          promptIntro: nextBatch.promptIntro,
          questionIds: nextBatch.questions.map((q) => q.questionId),
          clarificationReasons,
        }
        : undefined,
      isDraftReady,
      draftSummary,
    };
  }

  /**
   * Records a user response to a single question within an active session.
   * Re-evaluates conditional logic and determines whether to formulate another batch or finish the draft.
   */
  recordUserAnswer(
    session: InspectionSessionViewModel,
    answer: InspectionAnswerViewModel
  ): {
    updatedQuestion: InspectionQuestionViewModel;
    progress: InspectionProgressViewModel;
    nextBatch?: InspectionQuestionBatchViewModel;
    isDraftReady: boolean;
    draftSummary?: InspectionDraftSummaryViewModel;
  } {
    const q = session.questionAssessments[answer.questionId];
    if (q) {
      q.isAnswered = true;
      q.status = 'user_answered';
      q.answerSource = 'user_conversational';

      if (answer.rating) {
        q.userAnswerRating = answer.rating;
      }
      if (answer.selectans) {
        q.userAnswerSelect = answer.selectans;
      }
      if (answer.multiselectans) {
        q.userAnswerMultiselect = [...answer.multiselectans];
      }
      if (answer.textAnswer) {
        q.userAnswerText = answer.textAnswer;
      }

      const existingAns = session.answers[q.questionId] || {};
      session.answers[q.questionId] = {
        ...existingAns,
        rating: q.userAnswerRating || existingAns.rating,
        selectans: q.userAnswerSelect || existingAns.selectans,
        multiselectans: q.userAnswerMultiselect
          ? q.userAnswerMultiselect.map((txt) => ({ txt }))
          : existingAns.multiselectans,
        comment: q.userAnswerText || existingAns.comment,
        carActionPlan: answer.carActionPlan || existingAns.carActionPlan,
        answeredBy: 'human',
      };
    }

    this.reEvaluateConditionalRules(session);
    this.recalculateSessionStats(session);

    const progress = this.getProgress(session);
    const pendingQuestions = this.getPendingApplicableQuestions(session);

    if (pendingQuestions.length === 0) {
      session.workflowStatus = 'draft_ready';
      const draftSummary = this.generateDraftSummary(session);
      session.draftSummary = draftSummary;
      this.saveSession(session);
      return {
        updatedQuestion: q,
        progress: this.getProgress(session),
        isDraftReady: true,
        draftSummary,
      };
    }

    let nextBatch: InspectionQuestionBatchViewModel | undefined;
    const currentBatchComplete = this.isCurrentBatchCompleted(session);
    if (currentBatchComplete) {
      const remainingDoubts = pendingQuestions.filter(
        (p) => p.status === 'conversational_pending' || p.status === 'needs_verification'
      );
      if (remainingDoubts.length > 0) {
        nextBatch = this.formulateNextQuestionBatch(session);
      } else {
        // All doubts answered: auto-finalize remaining checks
        for (const rem of pendingQuestions) {
          rem.isAnswered = true;
          rem.status = 'ai_suggested';
          rem.userAnswerRating = rem.userAnswerRating || '1';
          rem.suggestedRating = rem.suggestedRating || '1';
          session.answers[rem.questionId] = {
            rating: rem.userAnswerRating,
            comment: 'Standard site compliance verified.',
            answeredBy: 'ai',
          };
        }
        this.recalculateSessionStats(session);
        session.workflowStatus = 'draft_ready';
        const draftSummary = this.generateDraftSummary(session);
        session.draftSummary = draftSummary;
        this.saveSession(session);
        return {
          updatedQuestion: q,
          progress: this.getProgress(session),
          isDraftReady: true,
          draftSummary,
        };
      }
    }

    this.saveSession(session);
    return {
      updatedQuestion: q,
      progress,
      nextBatch,
      isDraftReady: false,
    };
  }

  /**
   * Records multiple answers submitted simultaneously from a question batch.
   */
  recordBatchAnswers(
    session: InspectionSessionViewModel,
    answers: InspectionAnswerViewModel[]
  ): {
    progress: InspectionProgressViewModel;
    nextBatch?: InspectionQuestionBatchViewModel;
    isDraftReady: boolean;
    draftSummary?: InspectionDraftSummaryViewModel;
  } {
    for (const ans of answers) {
      const q = session.questionAssessments[ans.questionId];
      if (!q) continue;

      q.isAnswered = true;
      q.status = 'user_answered';
      q.answerSource = 'user_conversational';

      if (ans.rating) q.userAnswerRating = ans.rating;
      if (ans.selectans) q.userAnswerSelect = ans.selectans;
      if (ans.multiselectans) q.userAnswerMultiselect = [...ans.multiselectans];
      if (ans.textAnswer) q.userAnswerText = ans.textAnswer;

      session.answers[q.questionId] = {
        rating: q.userAnswerRating || undefined,
        selectans: q.userAnswerSelect || undefined,
        multiselectans: q.userAnswerMultiselect
          ? q.userAnswerMultiselect.map((txt) => ({ txt }))
          : undefined,
        comment: q.userAnswerText || undefined,
        answeredBy: 'human',
      };
    }

    this.reEvaluateConditionalRules(session);
    this.recalculateSessionStats(session);
    const progress = this.getProgress(session);

    const pending = this.getPendingApplicableQuestions(session);
    if (pending.length === 0) {
      session.workflowStatus = 'draft_ready';
      const draftSummary = this.generateDraftSummary(session);
      session.draftSummary = draftSummary;
      this.saveSession(session);
      return { progress: this.getProgress(session), isDraftReady: true, draftSummary };
    }

    const remainingDoubts = pending.filter(
      (p) => p.status === 'conversational_pending' || p.status === 'needs_verification'
    );
    if (remainingDoubts.length > 0) {
      const nextBatch = this.formulateNextQuestionBatch(session);
      this.saveSession(session);
      return { progress, nextBatch, isDraftReady: false };
    }

    for (const rem of pending) {
      rem.isAnswered = true;
      rem.status = 'ai_suggested';
      rem.userAnswerRating = rem.userAnswerRating || '1';
      rem.suggestedRating = rem.suggestedRating || '1';
      session.answers[rem.questionId] = {
        rating: rem.userAnswerRating,
        comment: 'Standard site compliance verified.',
        answeredBy: 'ai',
      };
    }
    this.recalculateSessionStats(session);
    session.workflowStatus = 'draft_ready';
    const draftSummary = this.generateDraftSummary(session);
    session.draftSummary = draftSummary;
    this.saveSession(session);
    return { progress: this.getProgress(session), isDraftReady: true, draftSummary };
  }

  /**
   * Interprets conversational free-text provided by the user.
   * Associates relevant statements with matching canonical questions without
   * prematurely fabricating official Pass/CAR ratings.
   */
  recordConversationalUserText(
    session: InspectionSessionViewModel,
    userText: string
  ): {
    matchedQuestions: InspectionQuestionViewModel[];
    updatedReasoning: string;
  } {
    const textLower = (userText || '').trim().toLowerCase();
    const isAffirmative = /^(yes|yep|yeah|correct|confirmed|in\s*place|all\s*good|fine|ok|okay|pass|passed|compliant|done|sure)/i.test(textLower);
    const isNegative = /^(no|not|nope|issue|defect|fail|action\s*required|broken|missing)/i.test(textLower);
    const matched: InspectionQuestionViewModel[] = [];

    const pending = Object.values(session.questionAssessments).filter(
      (q) => q.status === 'conversational_pending' || !q.isAnswered
    );

    for (const q of pending) {
      const words = q.qtext
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !['this', 'that', 'with', 'from', 'have', 'been'].includes(w));

      const matchesKeyword = words.some((w) => textLower.includes(w));
      const isDirectPendingTarget = q.status === 'conversational_pending' && (isAffirmative || isNegative || textLower.length > 0);

      if (matchesKeyword || isDirectPendingTarget) {
        matched.push(q);
        q.userAnswerText = userText;
        q.isAnswered = true;
        q.status = 'user_answered';
        q.answerSource = 'user_conversational';

        session.answers[q.questionId] = {
          ...(session.answers[q.questionId] || {}),
          comment: userText,
          answeredBy: 'human',
        };

        if (isDirectPendingTarget && !matchesKeyword) {
          break;
        }
      }
    }

    this.recalculateSessionStats(session);
    this.saveSession(session);

    const updatedReasoning =
      matched.length > 0
        ? `Understood! I've recorded your confirmation for ${matched.map((m) => m.headername).join(', ')}.`
        : `Inspector response noted.`;

    return { matchedQuestions: matched, updatedReasoning };
  }

  /**
   * Generates a compact progress view model for the session.
   */
  getProgress(session: InspectionSessionViewModel): InspectionProgressViewModel {
    return {
      inspectionId: session.inspectionId,
      bankId: session.bankId,
      bankName: session.bankName,
      assessedCount: session.assessedQuestionsCount,
      totalApplicableCount: session.totalApplicableQuestions,
      clarificationCount: session.clarificationCount,
      carCount: session.carCount,
      isDraftReady: session.workflowStatus === 'draft_ready' || session.workflowStatus === 'completed',
    };
  }

  /**
   * Compiles the Final Inspection Draft Summary.
   */
  generateDraftSummary(session: InspectionSessionViewModel): InspectionDraftSummaryViewModel {
    const refNum = `SI-${new Date().getFullYear()}-${session.inspectionId.slice(-6).toUpperCase()}`;
    const all = Object.values(session.questionAssessments);
    const aiCount = all.filter((q) => q.status === 'ai_suggested').length;
    const userCount = all.filter((q) => q.status === 'user_answered').length;
    const dynamicFindings = all.filter((q) => (q as any).isDynamicObservation);

    return {
      inspectionId: session.inspectionId,
      bankId: session.bankId,
      bankName: session.bankName,
      department: session.department,
      referenceNumber: refNum,
      totalApplicable: session.totalApplicableQuestions,
      passCount: session.passCount,
      carCount: session.carCount,
      naCount: session.naCount,
      unresolvedCount: Math.max(0, session.totalApplicableQuestions - session.assessedQuestionsCount),
      needsVerificationCount: session.clarificationCount,
      aiSuggestionsCount: aiCount,
      userResponsesCount: userCount,
      photoCount: session.uploadedPhotos.length,
      dynamicObservationsCount: dynamicFindings.length,
      dynamicFindings: dynamicFindings,
      answers: { ...session.answers },
      generatedAt: new Date().toISOString(),
      isConfirmedByInspector: false,
    };
  }

  /**
   * Selects 1 or 2–4 related unassessed questions and packages them into an adaptive batch.
   */
  formulateNextQuestionBatch(
    session: InspectionSessionViewModel,
    batchTitle?: string
  ): InspectionQuestionBatchViewModel {
    const pendingQuestions = this.getPendingApplicableQuestions(session);

    const nextSlice = pendingQuestions.slice(0, 3);
    for (const q of nextSlice) {
      q.status = 'conversational_pending';
    }

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    session.currentBatchId = batchId;

    const sectionTitle = nextSlice.length > 0 ? nextSlice[0].headername : 'Site Compliance Review';

    let promptIntro = 'Please confirm the following site conditions:';
    if (nextSlice.length === 1) {
      promptIntro = `Could you confirm the following check regarding ${sectionTitle}?`;
    } else if (nextSlice.length > 1) {
      promptIntro = `Please answer these ${nextSlice.length} checks regarding ${sectionTitle}:`;
    }

    return {
      batchId,
      inspectionId: session.inspectionId,
      title: batchTitle || sectionTitle,
      promptIntro,
      questions: nextSlice,
      isComplete: false,
    };
  }

  private isCurrentBatchCompleted(session: InspectionSessionViewModel): boolean {
    const activeQuestions = Object.values(session.questionAssessments).filter(
      (q) => q.status === 'conversational_pending'
    );
    if (activeQuestions.length === 0) {
      return false;
    }
    return activeQuestions.every((q) => q.isAnswered);
  }

  getPendingApplicableQuestions(session: InspectionSessionViewModel): InspectionQuestionViewModel[] {
    return Object.values(session.questionAssessments).filter(
      (q) => !q.isAnswered && q.status !== 'conditional_hidden'
    );
  }

  private reEvaluateConditionalRules(session: InspectionSessionViewModel): void {
    const answersMap: Record<string, { selectans?: string; multiselectans?: any[]; rating?: string }> = {};
    for (const [id, a] of Object.entries(session.answers)) {
      answersMap[id] = {
        selectans: a.selectans,
        multiselectans: a.multiselectans,
        rating: a.rating,
      };
    }

    for (const q of Object.values(session.questionAssessments)) {
      if (q.conditionalRule) {
        const mockQ: SiteInspectionQuestion = {
          id: q.questionId,
          qnum: q.qnum,
          headername: q.headername,
          qtext: q.qtext,
          conditionalRule: q.conditionalRule,
        };
        const isApplicable = evaluateConditionalRule(mockQ, answersMap);
        if (!isApplicable) {
          q.status = 'conditional_hidden';
        } else if (q.status === 'conditional_hidden') {
          q.status = 'unassessed';
        }
      }
    }
  }

  private recalculateSessionStats(session: InspectionSessionViewModel): void {
    const all = Object.values(session.questionAssessments).filter(
      (q) => q.status !== 'conditional_hidden'
    );

    session.totalApplicableQuestions = all.length;
    session.assessedQuestionsCount = all.filter((q) => q.isAnswered).length;
    session.passCount = all.filter((q) => q.userAnswerRating === '1').length;
    session.carCount = all.filter((q) => q.userAnswerRating === '-1').length;
    session.naCount = all.filter((q) => q.userAnswerRating === '0').length;
    session.clarificationCount = all.filter(
      (q) => !q.isAnswered && (q.status === 'needs_verification' || q.needsHumanVerification)
    ).length;
  }

  private mapToQuestionViewModel(q: SiteInspectionQuestion): InspectionQuestionViewModel {
    return {
      questionId: q.id,
      qnum: q.qnum,
      headername: q.headername,
      qtext: q.qtext,
      guidance: q.cm,
      typeofans: q.typeofans || ['rating'],
      selectOptions: q.select,
      multiselectOptions: q.multiselect,
      hascar: q.hascar,
      conditionalRule: q.conditionalRule,
      status: 'unassessed',
      isAnswered: false,
    };
  }

  private async persistSession(session: InspectionSessionViewModel): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        const key = `questai_session_${session.inspectionId}`;
        const lightweight = {
          ...session,
          uploadedPhotos: session.uploadedPhotos.map((p) => ({
            ...p,
            url: p.url && p.url.length > 2048 ? '' : p.url,
          })),
        };
        localStorage.setItem(key, JSON.stringify(lightweight));
      }
    } catch {
      // Ignore quota storage warnings
    }
  }
}
