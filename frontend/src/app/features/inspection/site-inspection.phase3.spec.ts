/**
 * Phase 3 Verification Test Suite:
 * 1. Existing 374-question / 12-bank Quest schema verification
 * 2. Legacy mock AI workflow isolation
 * 3. localStorage draft migration & stale mock evidence removal (preserving human answers)
 * 4. Request payload construction & conditional rule filtering
 * 5. Gemini response mapping (1, -1, 0, null ratings, confidence, evidence, reasoning, CAR plan, options)
 * 6. Mandatory human review workflow (Accept, Edit, Reject, explicit overwrite protection)
 * 7. Scanning animation lifecycle (start, duplicate-guard, success stop, error stop, cancel stop, ngOnDestroy)
 */

import '@angular/compiler';
import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';
import { AppComponent } from '../../app.component';
import { verifySiteInspectionSchema } from '../../core/models/site-inspection.schema.spec';
import {
  isLegacyMockAnswerEntry,
  isLegacyMockString,
  AiInspectionFillService,
} from '../../core/services/ai-inspection-fill.service';
import {
  ApiService,
  PhotoInspectionRequest,
  PhotoInspectionResponseWrapper,
  PhotoInspectionResult,
} from '../../core/services/api.service';
import { ChatPersistenceService } from '../../core/services/chat-persistence.service';
import { QuestionAnswer } from './site-inspection.models';
import { SiteInspectionComponent } from './site-inspection.component';

// Polyfill in-memory localStorage for Node testing environments
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
}

const assert = {
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        message || `Assertion failed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      );
    }
  },
  deepEqual<T>(actual: T, expected: T, message?: string): void {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
      throw new Error(message || `Deep assertion failed: expected ${e}, got ${a}`);
    }
  },
};

const pendingTests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function describe(suiteName: string, fn: () => void): void {
  console.log(`▶ ${suiteName}`);
  fn();
  (async () => {
    for (const t of pendingTests) {
      await t.fn();
      console.log(`  ✔ ${t.name}`);
    }
    console.log(`✔ ${suiteName}`);
  })().catch((err) => {
    console.error('✖ Test suite failed:', err);
    throw err;
  });
}

function it(testName: string, fn: () => void | Promise<void>): void {
  pendingTests.push({ name: testName, fn });
}

/**
 * Minimal 1x1 valid JPEG data URL (binary starts with FF D8 FF)
 */
export const VALID_TEST_JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

function createComponentWithMockApi(
  analyzeFn: (req: PhotoInspectionRequest) => any
): { component: SiteInspectionComponent; injector: EnvironmentInjector } {
  const mockApiPartial: Partial<ApiService> = {
    analyzeInspectionPhotos: analyzeFn,
  };
  const injector = createEnvironmentInjector(
    [{ provide: ApiService, useValue: mockApiPartial }],
    null as any
  );
  const component = runInInjectionContext(injector, () => new SiteInspectionComponent());
  return { component, injector };
}

function createAppComponentWithMockApi(
  generateTextFn: (prompt: string) => any,
  analyzePhotosFn?: (req: PhotoInspectionRequest) => any,
  persistenceService?: ChatPersistenceService
): { app: AppComponent; injector: EnvironmentInjector; persistence: ChatPersistenceService } {
  const persistence = persistenceService || new ChatPersistenceService();
  const mockApiPartial: Partial<ApiService> = {
    generateText: generateTextFn,
    analyzeInspectionPhotos:
      analyzePhotosFn ||
      ((req: PhotoInspectionRequest) =>
        of({
          success: true,
          data: {
            bankId: req.bankId,
            bankName: req.bankName,
            analyzedAt: new Date().toISOString(),
            modelIdentifier: 'QuestAI Vision',
            photoCount: req.photos.length,
            visualSummary: 'Site photographs reviewed for compliance.',
            overallRiskLevel: 'low',
            questionsEvaluated: req.questions.length,
            evaluations: req.questions.slice(0, 2).map((q) => ({
              questionId: q.id,
              suggestedRating: 1 as const,
              confidence: 0.91,
              requiresHumanVerification: false,
              visibleEvidence: 'Verified in site photograph.',
              explanation: 'Meets safety requirements.',
              suggestedComment: 'Compliant in uploaded photograph.',
              relevantPhotoIndices: [0],
            })),
          },
          timestamp: new Date().toISOString(),
        })),
  };
  const mockSanitizer: Partial<DomSanitizer> = {
    bypassSecurityTrustHtml: (val: string) => val as any,
  };
  const injector = createEnvironmentInjector(
    [
      { provide: ApiService, useValue: mockApiPartial },
      { provide: DomSanitizer, useValue: mockSanitizer },
      { provide: ChatPersistenceService, useValue: persistence },
    ],
    null as any
  );
  const app = runInInjectionContext(injector, () => new AppComponent());
  return { app, injector, persistence };
}

describe('QuestAI Phase 3 – Frontend Gemini Integration & Scanning Lifecycle Suite', () => {
  it('1. verifies all 374 questions across all 12 official Quest inspection banks', () => {
    const schemaResult = verifySiteInspectionSchema();
    assert.equal(schemaResult.passed, true, schemaResult.errors.join('; '));
    assert.equal(schemaResult.totalQuestions, 374);
    assert.equal(schemaResult.banksCount, 12);
  });

  it('2. isolates legacy AiInspectionFillService so it generates 0 mock answers and 0 photo attachments', () => {
    const legacyService = new AiInspectionFillService();
    const stubResult = legacyService.generateAiInspectionAnswers(
      'ladder-stepladder',
      'Ladder/Stepladder',
      [],
      [
        {
          id: 'photo_1',
          name: 'test.jpg',
          url: VALID_TEST_JPEG_DATA_URL,
          timestamp: new Date().toISOString(),
        },
      ],
      'Test note'
    );
    assert.equal(Object.keys(stubResult.answers).length, 0);
    assert.equal(stubResult.totalEvaluated, 0);
    assert.equal(
      isLegacyMockString(
        'Class 1 industrial ladder stiles, rungs, and anti-slip rubber feet intact. 1:4 angle positioning verified in uploaded site photo.'
      ),
      true
    );
    assert.equal(
      isLegacyMockString('Inspector observed bent bottom rung on 3m aluminium ladder.'),
      false
    );
  });

  it('3. sanitizes & migrates localStorage drafts: removes stale mock comments/photos while preserving genuine human answers', () => {
    const { component } = createComponentWithMockApi(() => new Subject().asObservable());

    const staleDraftPayload = {
      bankId: 'ladder-stepladder',
      uploadedPhotos: [
        {
          id: 'photo_avatar',
          name: 'avatar.png',
          url: VALID_TEST_JPEG_DATA_URL,
          timestamp: '2026-11-05T10:00:00Z',
        },
      ],
      aiSummary: {
        photoCount: 1,
        totalEvaluated: 9,
        passedCount: 8,
        carCount: 1,
        naCount: 0,
        needsReviewCount: 0,
        bankName: 'Ladder/Stepladder',
        timestamp: '2026-11-05T10:00:00Z',
      },
      answers: {
        'Ladder/Stepladder_01': {
          rating: '1',
          comment:
            'Class 1 industrial ladder stiles, rungs, and anti-slip rubber feet intact. 1:4 angle positioning verified in uploaded site photo.',
          photoAttached: true,
          photos: [
            {
              id: 'photo_avatar',
              name: 'avatar.png',
              url: VALID_TEST_JPEG_DATA_URL,
              timestamp: '2026-11-05T10:00:00Z',
            },
          ],
          aiSuggestedRating: '1',
          aiEvidence:
            'Visual inspection of photo confirms equipment in satisfactory condition, properly installed.',
          aiReasoning:
            'Compliant with standard operating procedures and site safety handbook requirements.',
          aiConfidence: 0.93,
          requiresHumanVerification: false,
          isHumanVerified: false,
        },
        'Ladder/Stepladder_02': {
          rating: '-1',
          comment: 'Genuine inspector note: right upright stile dented at 1.2m height.',
          carActionPlan: 'Quarantine ladder immediately and tag DO NOT USE.',
          isHumanVerified: true,
          answeredBy: 'human',
          photoAttached: true,
          photos: [
            {
              id: 'manual_photo_99',
              name: 'stile_dent.jpg',
              url: VALID_TEST_JPEG_DATA_URL,
              timestamp: '2026-11-06T08:00:00Z',
              attachedBy: 'inspector',
            },
          ],
        },
      },
    };

    const migrationOutcome = component.sanitizeAndMigrateDraft(
      'ladder-stepladder',
      staleDraftPayload
    );
    assert.equal(migrationOutcome.migrated, true);
    assert.equal(migrationOutcome.answers['Ladder/Stepladder_01'], undefined);
    assert.equal(migrationOutcome.answers['Ladder/Stepladder_02']?.rating, '-1');
    assert.equal(
      migrationOutcome.answers['Ladder/Stepladder_02']?.comment,
      'Genuine inspector note: right upright stile dented at 1.2m height.'
    );
    assert.equal(migrationOutcome.answers['Ladder/Stepladder_02']?.photos?.length, 1);
    assert.equal(migrationOutcome.aiSummary, null);
    component.ngOnDestroy();
  });

  it('4. builds photo inspection request with only selected bank questions and active conditional rules', () => {
    const { component } = createComponentWithMockApi(() => new Subject().asObservable());
    component.selectBank('road-surfacing');
    const rsDefaultReq = component.buildPhotoInspectionRequest();
    assert.equal(rsDefaultReq.bankId, 'road-surfacing');
    assert.equal(rsDefaultReq.questions.length, 23);

    component.setSelect('Task Specific Risks_18', 'No');
    const rsTriggeredReq = component.buildPhotoInspectionRequest();
    assert.equal(rsTriggeredReq.questions.length, 24);
    assert.equal(
      rsTriggeredReq.questions.some((q) => q.id === 'Task Specific Risks_18 a'),
      true
    );
    component.ngOnDestroy();
  });

  it('5. manages scanning animation lifecycle, maps Gemini evaluations, keeps null unanswered, and protects manual answers', () => {
    const capturedRequests: PhotoInspectionRequest[] = [];
    const apiSubject = new Subject<PhotoInspectionResponseWrapper>();
    const { component } = createComponentWithMockApi((req) => {
      capturedRequests.push(req);
      return apiSubject.asObservable();
    });

    component.selectBank('ladder-stepladder');
    component.uploadedPhotos.set([
      {
        id: 'photo_ladder_1',
        name: 'ladder.jpg',
        url: VALID_TEST_JPEG_DATA_URL,
        size: 160,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Pre-existing manual inspector answer on Ladder/Stepladder_02
    component.setRating('Ladder/Stepladder_02', '-1');
    component.setComment('Ladder/Stepladder_02', 'Manual inspector finding: worn foot pad.');

    component.startAiPhotoScanning();
    assert.equal(component.activeStep(), 'ai-scanning');
    assert.equal(component.isScanning(), true);
    assert.equal(capturedRequests.length, 1);
    assert.equal(capturedRequests[0].questions.length, 9);

    // Duplicate submission must be blocked while scanning
    component.startAiPhotoScanning();
    assert.equal(capturedRequests.length, 1);

    const mockGeminiResult: PhotoInspectionResult = {
      inspectionBankId: 'ladder-stepladder',
      inspectionBankName: 'Ladder/Stepladder',
      bankId: 'ladder-stepladder',
      bankName: 'Ladder/Stepladder',
      department: 'Ladder/Stepladder',
      photoCount: 1,
      summary: 'Aluminium stepladder inspected on paved area.',
      overallSiteRisk: 'medium',
      totalEvaluated: 9,
      passCount: 2,
      carCount: 1,
      naCount: 1,
      needsReviewCount: 5,
      evaluations: [
        {
          questionId: 'Ladder/Stepladder_01',
          rating: '1',
          suggestedRating: '1',
          selectAnswer: null,
          multiselectAnswers: null,
          confidence: 0.91,
          confidenceScore: 0.91,
          evidenceObserved: 'Unpainted aluminium stiles visible with original manufacturer finish.',
          evidence: 'Unpainted aluminium stiles visible with original manufacturer finish.',
          reasoning: 'No paint or modification seen on ladder frame.',
          needsHumanVerification: false,
          requiresHumanVerification: false,
          carActionPlan: null,
        },
        {
          questionId: 'Ladder/Stepladder_02',
          rating: '1',
          suggestedRating: '1',
          selectAnswer: null,
          multiselectAnswers: null,
          confidence: 0.85,
          confidenceScore: 0.85,
          evidenceObserved: 'Uprights appear straight from front angle.',
          evidence: 'Uprights appear straight from front angle.',
          reasoning: 'No visible bend from camera viewpoint.',
          needsHumanVerification: false,
          requiresHumanVerification: false,
          carActionPlan: null,
        },
        {
          questionId: 'Ladder/Stepladder_03',
          rating: '-1',
          suggestedRating: '-1',
          selectAnswer: null,
          multiselectAnswers: null,
          confidence: 0.88,
          confidenceScore: 0.88,
          evidenceObserved: 'Mud and wet mortar accumulation visible on third rung.',
          evidence: 'Mud and wet mortar accumulation visible on third rung.',
          reasoning: 'Contaminated rungs create a slip hazard.',
          needsHumanVerification: true,
          requiresHumanVerification: true,
          carActionPlan: 'Clean mud/mortar from rungs before use.',
        },
        {
          questionId: 'Ladder/Stepladder_04',
          rating: null,
          suggestedRating: '',
          selectAnswer: null,
          multiselectAnswers: null,
          confidence: 0.3,
          confidenceScore: 0.3,
          evidenceObserved: 'Base of ladder is cropped out of the photograph.',
          evidence: 'Base of ladder is cropped out of the photograph.',
          reasoning: 'Slip-resistant feet cannot be seen in the frame.',
          needsHumanVerification: true,
          requiresHumanVerification: true,
          carActionPlan: null,
        },
        {
          questionId: 'Ladder/Stepladder_06',
          rating: '0',
          suggestedRating: '0',
          selectAnswer: null,
          multiselectAnswers: null,
          confidence: 0.94,
          confidenceScore: 0.94,
          evidenceObserved: 'Fixed aluminium stepladder design without tie rods.',
          evidence: 'Fixed aluminium stepladder design without tie rods.',
          reasoning: 'Tie rods are not applicable to this ladder type.',
          needsHumanVerification: false,
          requiresHumanVerification: false,
          carActionPlan: null,
        },
        {
          questionId: 'Invented_Question_999',
          rating: '1',
          suggestedRating: '1',
          selectAnswer: null,
          multiselectAnswers: null,
          confidence: 0.99,
          confidenceScore: 0.99,
          evidenceObserved: 'Should be rejected.',
          evidence: 'Should be rejected.',
          reasoning: 'Invalid question ID.',
          needsHumanVerification: false,
          requiresHumanVerification: false,
          carActionPlan: null,
        },
      ],
      evaluationsMap: {},
      recommendations: ['Clean third rung and physically inspect feet.'],
      analyzedAt: new Date().toISOString(),
      modelIdentifier: 'gemini-3.8-flash',
      isMock: false,
      notes: 'Aluminium stepladder inspected on paved area.',
    };

    apiSubject.next({
      success: true,
      data: mockGeminiResult,
      timestamp: new Date().toISOString(),
    });

    assert.equal(component.isScanning(), false);
    assert.equal(component.activeStep(), 'review-form');
    assert.equal(component.formAnswers()['Invented_Question_999'], undefined);

    // AI suggestion kept separate from confirmed rating until accepted; 0 auto-attached photos
    const q1Ans = component.getAnswer('Ladder/Stepladder_01');
    assert.equal(q1Ans.rating, '');
    assert.equal(q1Ans.aiSuggestedRating, '1');
    assert.equal(q1Ans.aiConfidence, 91);
    assert.equal(q1Ans.comment, '');
    assert.equal((q1Ans.photos || []).length, 0);

    // Null rating stays unanswered and requires human verification
    const q4Ans = component.getAnswer('Ladder/Stepladder_04');
    assert.equal(q4Ans.rating, '');
    assert.equal(q4Ans.aiSuggestedRating, null);
    assert.equal(q4Ans.requiresHumanVerification, true);

    // Existing manual human answer on Ladder/Stepladder_02 is preserved
    const q2Ans = component.getAnswer('Ladder/Stepladder_02');
    assert.equal(q2Ans.rating, '-1');
    assert.equal(q2Ans.comment, 'Manual inspector finding: worn foot pad.');
    assert.equal(q2Ans.aiSuggestedRating, '1');

    // Accept AI suggestion on unanswered question Ladder/Stepladder_01
    component.acceptAiSuggestion('Ladder/Stepladder_01');
    assert.equal(component.getAnswer('Ladder/Stepladder_01').rating, '1');
    assert.equal(component.getAnswer('Ladder/Stepladder_01').isHumanVerified, true);
    assert.equal(component.getAnswer('Ladder/Stepladder_01').aiSuggestionStatus, 'accepted');

    // Attempting to accept AI suggestion on manually answered Ladder/Stepladder_02 requires confirmation
    component.acceptAiSuggestion('Ladder/Stepladder_02');
    assert.equal(component.pendingOverwriteQuestionId(), 'Ladder/Stepladder_02');
    assert.equal(component.getAnswer('Ladder/Stepladder_02').rating, '-1');

    // Explicit overwrite confirmation applies the suggestion
    component.acceptAiSuggestion('Ladder/Stepladder_02', true);
    assert.equal(component.pendingOverwriteQuestionId(), null);
    assert.equal(component.getAnswer('Ladder/Stepladder_02').rating, '1');

    // Reject suggestion on Ladder/Stepladder_06
    component.rejectAiSuggestion('Ladder/Stepladder_06');
    assert.equal(component.getAnswer('Ladder/Stepladder_06').aiSuggestionStatus, 'rejected');
    assert.equal(component.getAnswer('Ladder/Stepladder_06').rating, '');

    // Edit suggestion on Ladder/Stepladder_03
    component.editAiSuggestion('Ladder/Stepladder_03');
    assert.equal(component.getAnswer('Ladder/Stepladder_03').aiSuggestionStatus, 'edited');
    assert.equal(
      component.getAnswer('Ladder/Stepladder_03').carActionPlan,
      'Clean mud/mortar from rungs before use.'
    );

    component.ngOnDestroy();
  });

  it('6. stops scanning animation immediately on backend error or cancellation', () => {
    const { component } = createComponentWithMockApi(() =>
      throwError(() => ({
        status: 503,
        error: { error: { message: 'Service temporarily unavailable' } },
      }))
    );

    component.selectBank('ladder-stepladder');
    component.uploadedPhotos.set([
      {
        id: 'photo_err',
        name: 'ladder.jpg',
        url: VALID_TEST_JPEG_DATA_URL,
        size: 160,
        timestamp: new Date().toISOString(),
      },
    ]);

    component.startAiPhotoScanning();
    assert.equal(component.isScanning(), false);
    assert.equal(component.activeStep(), 'ai-scanning');
    assert.equal(component.scanError(), 'Service temporarily unavailable');

    component.cancelScanning();
    assert.equal(component.isScanning(), false);
    assert.equal(component.scanError(), null);
    assert.equal(component.activeStep(), 'photo-upload');

    component.ngOnDestroy();
  });

  it('7. ChatGPT-style photo attachments, in-chat photo analysis, zero Gemini branding, and IndexedDB persistence (Tests 1–15)', async () => {
    let capturedPhotoRequests: PhotoInspectionRequest[] = [];
    const sharedPersistence = new ChatPersistenceService();

    const { app, injector } = createAppComponentWithMockApi(
      (prompt: string) => {
        const lower = prompt.toLowerCase();
        if (lower === 'hi') {
          return of({
            success: true,
            data: {
              text: 'Hi! How can I help you today?',
              model: 'gemini-3.8-flash',
              generatedAt: new Date().toISOString(),
              latencyMs: 120,
            },
            timestamp: new Date().toISOString(),
          });
        }
        if (lower === 'how are you?') {
          return of({
            success: true,
            data: {
              text: "I'm doing well, thank you! How can I help you today?",
              model: 'gemini-3.8-flash',
              generatedAt: new Date().toISOString(),
              latencyMs: 110,
            },
            timestamp: new Date().toISOString(),
          });
        }
        return of({
          success: true,
          data: {
            text: 'Sure! Which inspection form would you like to fill?',
            model: 'gemini-3.8-flash',
            generatedAt: new Date().toISOString(),
            latencyMs: 140,
          },
          timestamp: new Date().toISOString(),
        });
      },
      (req: PhotoInspectionRequest) => {
        capturedPhotoRequests.push(req);
        return of({
          success: true,
          data: {
            bankId: req.bankId,
            bankName: req.bankName,
            analyzedAt: new Date().toISOString(),
            modelIdentifier: 'QuestAI Vision',
            photoCount: req.photos.length,
            visualSummary: 'Site photographs reviewed for compliance.',
            overallRiskLevel: 'low',
            questionsEvaluated: req.questions.length,
            evaluations: req.questions.slice(0, 2).map((q) => ({
              questionId: q.id,
              suggestedRating: 1 as const,
              confidence: 0.92,
              requiresHumanVerification: false,
              visibleEvidence: 'Verified in site photograph.',
              explanation: 'Meets safety requirements.',
              suggestedComment: 'Compliant in uploaded photograph.',
              relevantPhotoIndices: [0],
            })),
          },
          timestamp: new Date().toISOString(),
        });
      },
      sharedPersistence
    );

    // Attach an embedded SiteInspectionComponent instance so in-chat workflow triggers synchronously in tests
    const embeddedInspection = runInInjectionContext(injector, () => new SiteInspectionComponent());
    embeddedInspection.embeddedInChat = true;
    embeddedInspection.conversationId = app.activeConversationId();
    embeddedInspection.workflowStatusChange.subscribe((ev) => app.onEmbeddedWorkflowStatusChange(ev));
    (app as any).inspectionComponent = embeddedInspection;

    // Verify exact 12 category chip labels
    const expectedCategoryNames = [
      'Civil / Other',
      'Street Lighting',
      'Road Marking',
      'Road Surfacing',
      'Traffic Management 12D',
      'Traffic Management 12AB',
      'Full Body Harness',
      'Ladder / Stepladder',
      'Depot Check Sheet',
      'Managers Site Inspection',
      'Managers Site Inspection – Risk Banks',
      'Road Marking (Test)',
    ];
    assert.deepEqual(
      app.siteInspectionBanks.map((b) => b.name),
      expectedCategoryNames
    );

    // TEST 1: User sends "Hi" -> short greeting, no category panel
    app.composerText.set('Hi');
    app.sendMessage();
    let msgs = app.activeMessages();
    assert.equal(msgs.length, 2);
    assert.equal(msgs[1].content, 'Hi! How can I help you today?');
    assert.equal(!!msgs[1].showInspectionCategories, false);

    // TEST 2: User sends "I want to fill a Site Inspection form." -> asks which form and shows 12 category chips
    app.composerText.set('I want to fill a Site Inspection form.');
    app.sendMessage();
    msgs = app.activeMessages();
    assert.equal(msgs.length, 4);
    assert.equal(msgs[3].content, 'Sure! Which inspection form would you like to fill?');
    assert.equal(msgs[3].showInspectionCategories, true);

    // TEST 3: User clicks "Civil / Other" chip -> assistant replies "Great! Please upload your site photographs here."
    // and NO separate upload modal opens
    const civilBank = app.siteInspectionBanks.find((b) => b.id === 'civil-other')!;
    app.onSelectCategoryChipFromChat(civilBank, msgs[3].id);
    msgs = app.activeMessages();
    assert.equal(app.selectedUploadBank()?.id, 'civil-other');
    assert.equal(app.showPhotoUploadModal(), false);
    assert.equal(msgs[msgs.length - 1].content, 'Great! Please upload your site photographs here.');

    // Also verify typed category selection ("Ladder / Stepladder") sends the same prompt without opening modal
    app.composerText.set('Ladder / Stepladder');
    app.sendMessage();
    msgs = app.activeMessages();
    assert.equal(app.selectedUploadBank()?.id, 'ladder-stepladder');
    assert.equal(app.showPhotoUploadModal(), false);
    assert.equal(msgs[msgs.length - 1].content, 'Great! Please upload your site photographs here.');

    // TEST 4: User clicks the (+) attachment button -> attachment menu opens
    assert.equal(app.showAttachmentMenu(), false);
    app.toggleAttachmentMenu();
    assert.equal(app.showAttachmentMenu(), true);
    app.closeAttachmentMenu();
    assert.equal(app.showAttachmentMenu(), false);

    // TEST 5, 6, 7: User attaches multiple photos (gallery + camera) -> thumbnails appear above composer without auto-sending
    app.addPendingPhotos([
      {
        id: 'p-1',
        name: 'ladder_front.jpg',
        url: VALID_TEST_JPEG_DATA_URL,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'p-2',
        name: 'ladder_feet.jpg',
        url: VALID_TEST_JPEG_DATA_URL,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'p-cam-3',
        name: 'camera_rung.jpg',
        url: VALID_TEST_JPEG_DATA_URL,
        timestamp: new Date().toISOString(),
      },
    ]);
    assert.equal(app.uploadedPhotos().length, 3);
    assert.equal(capturedPhotoRequests.length, 0, 'Must not auto-send or auto-analyse before Send is pressed');

    // Remove one thumbnail before sending
    app.removePendingComposerPhoto(1);
    assert.equal(app.uploadedPhotos().length, 2);
    assert.equal(app.uploadedPhotos()[0].id, 'p-1');
    assert.equal(app.uploadedPhotos()[1].id, 'p-cam-3');

    // Verify pending composer attachments are persisted in IndexedDB before sending
    const persistedPendingBeforeSend = await sharedPersistence.loadPendingAttachments(
      app.activeConversationId()
    );
    assert.equal(persistedPendingBeforeSend.length, 2);

    // TEST 8, 9, 10, 11: User sends the attached photos in chat ->
    // 1. User message includes the 2 photos
    // 2. Composer pending photos are cleared
    // 3. Real photo-analysis endpoint is called with 'ladder-stepladder' and 2 photos
    // 4. Inspection form is ready in-chat and assistant message updates to "Your photographs have been analysed. Your inspection form is ready for review."
    app.composerText.set('Here are the site ladder photos');
    app.sendMessage();

    assert.equal(app.uploadedPhotos().length, 0);
    assert.equal(capturedPhotoRequests.length, 1);
    assert.equal(capturedPhotoRequests[0].bankId, 'ladder-stepladder');
    assert.equal(capturedPhotoRequests[0].photos.length, 2);
    assert.equal(embeddedInspection.activeStep(), 'review-form');
    assert.equal(embeddedInspection.isScanning(), false);

    msgs = app.activeMessages();
    const userPhotoMsg = msgs[msgs.length - 2];
    const assistantWorkflowMsg = msgs[msgs.length - 1];
    assert.equal(userPhotoMsg.sender, 'user');
    assert.equal(userPhotoMsg.photos?.length, 2);
    assert.equal(assistantWorkflowMsg.sender, 'assistant');
    assert.equal(assistantWorkflowMsg.isInspectionWorkflowMessage, true);
    assert.equal(
      assistantWorkflowMsg.content,
      'Your photographs have been analysed. Your inspection form is ready for review.'
    );

    // TEST 12: Verify "Gemini" does not appear anywhere in conversation messages or status text
    const serializedConversation = JSON.stringify(app.conversations());
    assert.equal(/gemini/i.test(serializedConversation), false, 'Conversation must not contain Gemini branding');

    // TEST 13, 14, 15: Verify IndexedDB persistence restores conversations and sent image attachments after refresh/re-init
    const persistedState = await sharedPersistence.loadState();
    assert.equal(persistedState.conversations.length, 1);
    const restoredPhotoMsg = persistedState.conversations[0].messages.find(
      (m) => m.photos && m.photos.length > 0
    );
    assert.equal(restoredPhotoMsg?.photos?.length, 2);

    // =========================================================================
    // PHASE 3.2 VERIFICATION: Tests 1-8
    // =========================================================================

    // Test 1 & 2: Civil and Ladder bank restoration with initialBankId
    const ladderComp = runInInjectionContext(injector, () => new SiteInspectionComponent());
    ladderComp.conversationId = app.activeConversationId();
    ladderComp.initialBankId = 'ladder-stepladder';
    ladderComp.initialPhotos = restoredPhotoMsg?.photos;
    ladderComp.loadDraft();
    assert.equal(ladderComp.selectedBankId(), 'ladder-stepladder');
    ladderComp.ngOnInit();
    assert.equal(ladderComp.selectedBankId(), 'ladder-stepladder');
    assert.equal(ladderComp.activeStep(), 'review-form');
    assert.equal(ladderComp.uploadedPhotos().length, 2);
    assert.equal(ladderComp.uploadedPhotos()[0].url.length > 50, true);

    // Test 3: Two separate conversations using the same category (Civil/Other) do not overwrite each other
    const conv1Comp = runInInjectionContext(injector, () => new SiteInspectionComponent());
    conv1Comp.conversationId = 'conv-civil-1';
    conv1Comp.initialBankId = 'civil-other';
    conv1Comp.ngOnInit();
    const civilQ1 = conv1Comp.applicableQuestions()[0].id;
    conv1Comp.setRating(civilQ1, '1');
    conv1Comp.setComment(civilQ1, 'Conversation 1 specific civil comment');
    conv1Comp.saveDraft();

    const conv2Comp = runInInjectionContext(injector, () => new SiteInspectionComponent());
    conv2Comp.conversationId = 'conv-civil-2';
    conv2Comp.initialBankId = 'civil-other';
    conv2Comp.ngOnInit();
    conv2Comp.setRating(civilQ1, '-1');
    conv2Comp.setComment(civilQ1, 'Conversation 2 specific civil comment');
    conv2Comp.saveDraft();

    // Reload Conv 1 and verify its answers were not overwritten by Conv 2
    const conv1Reloaded = runInInjectionContext(injector, () => new SiteInspectionComponent());
    conv1Reloaded.conversationId = 'conv-civil-1';
    conv1Reloaded.initialBankId = 'civil-other';
    conv1Reloaded.ngOnInit();
    assert.equal(conv1Reloaded.formAnswers()[civilQ1]?.rating, '1');
    assert.equal(conv1Reloaded.formAnswers()[civilQ1]?.comment, 'Conversation 1 specific civil comment');

    // Reload Conv 2 and verify its distinct answers
    const conv2Reloaded = runInInjectionContext(injector, () => new SiteInspectionComponent());
    conv2Reloaded.conversationId = 'conv-civil-2';
    conv2Reloaded.initialBankId = 'civil-other';
    conv2Reloaded.ngOnInit();
    assert.equal(conv2Reloaded.formAnswers()[civilQ1]?.rating, '-1');
    assert.equal(conv2Reloaded.formAnswers()[civilQ1]?.comment, 'Conversation 2 specific civil comment');

    // Test 6 & 7: Finalized inspection restoration & activeStep = 'finalized'
    conv1Reloaded.confirmFinalizeInspection();
    const finalRef = conv1Reloaded.finalizedReport()?.referenceNumber;
    assert.equal(typeof finalRef === 'string' && finalRef.startsWith('SI-2026-'), true);
    assert.equal(conv1Reloaded.activeStep(), 'finalized');

    // Reload Conv 1 after finalization
    const conv1FinalizedReload = runInInjectionContext(injector, () => new SiteInspectionComponent());
    conv1FinalizedReload.conversationId = 'conv-civil-1';
    conv1FinalizedReload.initialBankId = 'civil-other';
    conv1FinalizedReload.ngOnInit();
    assert.equal(conv1FinalizedReload.activeStep(), 'finalized');
    assert.equal(conv1FinalizedReload.finalizedReport()?.referenceNumber, finalRef);

    // Test 8: Switching to Conv 2 still shows non-finalized review-form
    assert.equal(conv2Reloaded.activeStep(), 'review-form');
    assert.equal(conv2Reloaded.finalizedReport(), null);

    ladderComp.ngOnDestroy();
    conv1Comp.ngOnDestroy();
    conv2Comp.ngOnDestroy();
    conv1Reloaded.ngOnDestroy();
    conv2Reloaded.ngOnDestroy();
    conv1FinalizedReload.ngOnDestroy();
    embeddedInspection.ngOnDestroy();
  });
});
