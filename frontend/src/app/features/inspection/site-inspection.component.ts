import {
  Component,
  OnInit,
  signal,
  computed,
  Output,
  EventEmitter,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SiteInspectionQuestion,
  QuestRatingValue,
  getQuestionsForDepartment,
  groupQuestionsByHeader,
  evaluateConditionalRule,
  MANAGERS_RISK_BANKS,
  MANAGERS_BASE_QUESTIONS,
} from '../../core/models/site-inspection.schema';
import {
  InspectionStep,
  InspectionBankOption,
  QuestionAnswer,
  InspectionMetadata,
  SectionGroup,
  InspectionPhoto,
  FinalizedInspectionReport,
} from './site-inspection.models';
import { ApiService, PhotoInspectionRequest } from '../../core/services/api.service';
import { AiInspectionFillService } from '../../core/services/ai-inspection-fill.service';

@Component({
  selector: 'app-site-inspection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './site-inspection.component.html',
  styleUrls: ['./site-inspection.component.css'],
})
export class SiteInspectionComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly aiInspectionFillService = inject(AiInspectionFillService);

  @Output() switchToChat = new EventEmitter<void>();
  @Output() requestAiPhotoUpload = new EventEmitter<string>();

  // Active Workflow Step: 'category-select' | 'photo-upload' | 'ai-scanning' | 'review-form' | 'finalized'
  activeStep = signal<InspectionStep>('category-select');

  // Available 12 Question Banks from Quest schema
  readonly questionBanks: InspectionBankOption[] = [
    {
      id: 'civil-other',
      name: 'Civil/Other',
      department: 'Civil/Other',
      icon: '🏗️',
      badge: '52 Questions',
      description: 'Civil works, plant, traffic management, welfare, site vehicles, and quality checks',
      baseQuestionCount: 52,
    },
    {
      id: 'street-lighting',
      name: 'Street Lighting',
      department: 'Street Lighting',
      icon: '💡',
      badge: '47 Questions',
      description: 'Column installations, cable isolations, MEWPs, electrical testing and safety',
      baseQuestionCount: 47,
    },
    {
      id: 'road-marking',
      name: 'Road Marking',
      department: 'Road Marking',
      icon: '🛣️',
      badge: '44 Questions',
      description: 'Thermoplastic boilers, pre-heaters, glass bead pressure systems and hydro-blasting',
      baseQuestionCount: 44,
    },
    {
      id: 'road-surfacing',
      name: 'Road Surfacing',
      department: 'Road Surfacing',
      icon: '🚜',
      badge: '27 Questions',
      description: 'Asphalt paving, rollers, pedestrian management, thermal hazards, and environmental controls',
      baseQuestionCount: 27,
    },
    {
      id: 'tm-12d',
      name: 'Traffic Management (12D)',
      department: 'Traffic Management',
      trafficSubtype: '12D',
      icon: '🛑',
      badge: '33 Questions',
      description: 'Urban and rural roads, temporary traffic lights, convoy working and stop/go controls',
      baseQuestionCount: 33,
    },
    {
      id: 'tm-12ab',
      name: 'Traffic Management (12AB)',
      department: 'Traffic Management',
      trafficSubtype: '12AB',
      icon: '🚧',
      badge: '32 Questions',
      description: 'High-speed dual carriageways and motorways, IPVs, taper closures and overhead gantries',
      baseQuestionCount: 32,
    },
    {
      id: 'full-body-harness',
      name: 'Full Body Harness',
      department: 'Harness and Lanyard',
      icon: '🪢',
      badge: '21 Questions',
      description: 'Fall arrest harnesses, lanyards, carabiners, webbing integrity, labels and inspection history',
      baseQuestionCount: 21,
    },
    {
      id: 'ladder-stepladder',
      name: 'Ladder/Stepladder',
      department: 'Ladder/Stepladder',
      icon: '🪜',
      badge: '9 Questions',
      description: 'Ladder pre-use checks, stiles, rungs, anti-slip feet, spreaders and angle requirements',
      baseQuestionCount: 9,
    },
    {
      id: 'depot-check-sheet',
      name: 'Depot Check Sheet',
      department: 'Depot Check Sheet',
      icon: '🏢',
      badge: '32 Questions',
      description: 'Depot yards, bunded fuel storage, hazardous waste, emergency eyewash and fire safety',
      baseQuestionCount: 32,
    },
    {
      id: 'managers-site-inspection',
      name: 'Managers Site Inspection',
      department: 'Managers Site Inspection',
      isManagers: true,
      icon: '📋',
      badge: '12 Base + Risk Banks',
      description: 'Management site walk inspection with dynamic selection of active project risk banks',
      baseQuestionCount: 12,
    },
    {
      id: 'managers-risk-banks',
      name: 'Managers Risk Banks',
      department: 'Managers Risk Banks',
      isManagersRiskDirect: true,
      icon: '⚠️',
      badge: '49 Risk Questions',
      description: 'Comprehensive risk bank covering all 13 high-risk construction activities',
      baseQuestionCount: 49,
    },
    {
      id: 'road-marking-test',
      name: 'Road Marking (Test)',
      department: 'Road Marking (Test)',
      icon: '🧪',
      badge: '16 Questions',
      description: 'Operational test verification checklist for road marking crews and equipment calibration',
      baseQuestionCount: 16,
    },
  ];

  // Dynamic Risk Banks for Managers Site Inspection
  readonly availableRiskBanks = [
    { key: 'Buried services', label: 'Buried Services', count: 5, icon: '⚡' },
    { key: 'Interface with the public', label: 'Public Interface', count: 4, icon: '🚶' },
    { key: 'Manual handling', label: 'Manual Handling', count: 4, icon: '📦' },
    { key: 'Noise dust & vibration', label: 'Noise, Dust & Vibration', count: 3, icon: '🔊' },
    { key: 'Operating plant & machinery', label: 'Plant & Machinery', count: 4, icon: '🚜' },
    { key: 'Overhead services', label: 'Overhead Services', count: 3, icon: '⚡' },
    { key: 'Temporary works', label: 'Temporary Works', count: 4, icon: '🏗️' },
    { key: 'Worker/construction plant interface', label: 'Worker / Plant Interface', count: 5, icon: '⚠️' },
    { key: 'Working at height', label: 'Working at Height', count: 5, icon: '🪜' },
    { key: 'Work in/beside live traffic', label: 'Work Beside Live Traffic', count: 4, icon: '🚗' },
    { key: 'Working with/on live electrical circuits', label: 'Live Electrical Circuits', count: 3, icon: '🔌' },
    { key: 'Working on/near water', label: 'Working Near Water', count: 3, icon: '🌊' },
    { key: 'Hot Works', label: 'Hot Works', count: 2, icon: '🔥' },
  ];

  // Active bank selection
  selectedBankId = signal<string>('civil-other');

  // Traffic Management Subtype (12D or 12AB)
  trafficSubtype = signal<'12D' | '12AB'>('12D');

  // Dynamic Selected Risk Banks for Managers Site Inspection
  selectedRiskBanks = signal<string[]>([
    'Buried services',
    'Worker/construction plant interface',
    'Working at height',
  ]);

  // Direct filter for Managers Risk Banks view ('ALL' or specific category)
  directRiskFilter = signal<string>('ALL');

  // Inspection metadata
  inspectionMetadata = signal<InspectionMetadata>({
    inspectorName: 'Subhash Kumar',
    siteLocation: 'A1(M) Junction 4-6 Widening Scheme',
    jobReference: 'WO-2026-8842',
    inspectionDate: new Date().toISOString().substring(0, 10),
    weatherCondition: 'Dry / Clear',
    supervisorName: 'M. Davies',
    notes: 'Routine weekly site health, safety and operational audit.',
  });

  // Collapsible metadata toggle
  metadataExpanded = signal(false);

  // Form answers state
  formAnswers = signal<Record<string, QuestionAnswer>>({});

  // Review Form Filter tab: 'all' | 'needs-review' | 'car' | 'unanswered'
  reviewFilter = signal<'all' | 'needs-review' | 'car' | 'unanswered'>('all');

  // Search filter query in review form
  searchQuery = signal<string>('');

  // Active section name for accordion
  activeSectionName = signal<string>('');

  // Expanded state for each section
  expandedSections = signal<Record<string, boolean>>({});

  // Toast feedback message
  toastMessage = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  // Reset confirmation modal
  showResetModal = signal(false);

  // Finalize confirmation modal
  showFinalizeModal = signal(false);

  // Finalized report state
  finalizedReport = signal<FinalizedInspectionReport | null>(null);

  // Active photo being previewed in full modal
  previewModalPhoto = signal<InspectionPhoto | null>(null);

  // Auto-save debounce timer
  private autoSaveTimer?: ReturnType<typeof setTimeout>;

  // === STEP 2: PHOTO UPLOAD STATE ===
  uploadedPhotos = signal<InspectionPhoto[]>([]);
  uploadSiteNotes = signal<string>('');
  isDragOver = signal(false);

  // === STEP 3: AI SCANNING STATE ===
  isScanning = signal(false);
  scanningStatusMessage = signal<string>('Uploading site photographs...');
  scanningProgress = signal<number>(10);
  scanError = signal<string | null>(null);
  private scanningTimer?: ReturnType<typeof setTimeout>;

  // AI model identifier and mock flag
  aiModelIdentifier = signal<string>('QuestAI Vision Engine (Pre-Gemini Evaluation)');
  isMockEngine = signal(true);
  lastAnalyzedTimestamp = signal<string>('');

  // AI Pre-fill summary banner state
  aiPreFillSummary = signal<{
    photoCount: number;
    totalEvaluated: number;
    passedCount: number;
    carCount: number;
    naCount: number;
    needsReviewCount: number;
    bankName: string;
    timestamp: string;
    evidenceNotes?: string;
  } | null>(null);

  aiPreFillApplied = computed(() => this.aiPreFillSummary() !== null);

  // TrackBy functions to prevent DOM recreation
  trackBySection(index: number, sec: SectionGroup): string {
    return sec.headername;
  }

  trackByQuestion(index: number, q: SiteInspectionQuestion): string {
    return q.id;
  }

  trackByPhotoId(index: number, photo: InspectionPhoto): string {
    return photo.id;
  }

  // Currently selected bank definition
  currentBank = computed<InspectionBankOption>(() => {
    const id = this.selectedBankId();
    return this.questionBanks.find((b) => b.id === id) || this.questionBanks[0];
  });

  // Questions loaded based on selected bank and dynamic configurations
  currentQuestions = computed<SiteInspectionQuestion[]>(() => {
    const bank = this.currentBank();

    if (bank.isManagersRiskDirect) {
      const filter = this.directRiskFilter();
      if (filter === 'ALL') {
        return Object.values(MANAGERS_RISK_BANKS).flat();
      }
      return MANAGERS_RISK_BANKS[filter] || [];
    }

    if (bank.isManagers) {
      return getQuestionsForDepartment(
        'Managers Site Inspection',
        undefined,
        this.selectedRiskBanks()
      );
    }

    if (bank.department === 'Traffic Management') {
      return getQuestionsForDepartment(
        'Traffic Management',
        bank.trafficSubtype || this.trafficSubtype()
      );
    }

    return getQuestionsForDepartment(bank.department);
  });

  // Visible questions after evaluating conditional rules, search, and review filter
  visibleQuestions = computed<SiteInspectionQuestion[]>(() => {
    const questions = this.currentQuestions();
    const answers = this.formAnswers();

    return questions.filter((q) => {
      // Check conditional rule
      if (q.conditionalRule && !evaluateConditionalRule(q, answers)) {
        return false;
      }

      // Check search query
      const query = this.searchQuery().trim().toLowerCase();
      if (query) {
        const matchText = (q.qtext || '').toLowerCase().includes(query);
        const matchId = (q.id || '').toLowerCase().includes(query);
        const matchHeader = (q.headername || '').toLowerCase().includes(query);
        if (!matchText && !matchId && !matchHeader) {
          return false;
        }
      }

      // Check review filter: 'all' | 'needs-review' | 'car' | 'unanswered'
      const filter = this.reviewFilter();
      const ans = answers[q.id];

      if (filter === 'needs-review') {
        return ans?.requiresHumanVerification === true && !ans?.isHumanVerified;
      }

      if (filter === 'car') {
        return ans?.rating === '-1' || (ans?.multiselectans || []).some((m) => m.ncr === 'Yes');
      }

      if (filter === 'unanswered') {
        return !this.isQuestionAnswered(q.id);
      }

      return true;
    });
  });

  // Sections grouped by header
  sections = computed<SectionGroup[]>(() => {
    const questions = this.visibleQuestions();
    const rawGroups = groupQuestionsByHeader(questions);
    const answers = this.formAnswers();

    return rawGroups.map((g) => {
      const qList = g.questions;
      let answeredCount = 0;
      let hasCar = false;

      for (const q of qList) {
        if (this.isQuestionAnswered(q.id)) {
          answeredCount++;
        }
        const ans = answers[q.id];
        if (ans?.rating === '-1' || (ans?.multiselectans || []).some((m) => m.ncr === 'Yes')) {
          hasCar = true;
        }
      }

      return {
        headername: g.headername,
        questions: qList,
        answeredCount,
        totalCount: qList.length,
        hasCar,
      };
    });
  });

  // Comprehensive Statistics
  stats = computed(() => {
    const questions = this.currentQuestions();
    const answers = this.formAnswers();

    let answered = 0;
    let passCount = 0;
    let carCount = 0;
    let naCount = 0;
    let needsReviewCount = 0;
    let verifiedCount = 0;

    for (const q of questions) {
      const isVisible = !q.conditionalRule || evaluateConditionalRule(q, answers);
      if (!isVisible) continue;

      const ans = answers[q.id];
      if (this.isQuestionAnswered(q.id)) {
        answered++;
      }
      if (ans) {
        if (ans.rating === '1') passCount++;
        else if (ans.rating === '-1') carCount++;
        else if (ans.rating === '0') naCount++;

        if (ans.requiresHumanVerification && !ans.isHumanVerified) {
          needsReviewCount++;
        }
        if (ans.isHumanVerified) {
          verifiedCount++;
        }
      }
    }

    const total = this.visibleQuestions().length;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

    return {
      total,
      answered,
      unanswered: Math.max(0, total - answered),
      passCount,
      carCount,
      naCount,
      needsReviewCount,
      verifiedCount,
      percent,
    };
  });

  ngOnInit(): void {
    // Check if there is a pending AI pre-fill
    this.checkForPendingAiPreFill();
    // Initialize draft from localStorage if present
    this.loadDraft();
  }

  // === STEP 1: CATEGORY SELECTION METHODS ===

  selectBank(bankId: string): void {
    this.selectedBankId.set(bankId);
    const bank = this.currentBank();
    if (bank.trafficSubtype) {
      this.trafficSubtype.set(bank.trafficSubtype);
    }
    this.loadDraft();
  }

  continueToPhotoUpload(): void {
    this.activeStep.set('photo-upload');
  }

  skipToManualChecklist(): void {
    this.loadDraft();
    const groups = groupQuestionsByHeader(this.currentQuestions());
    if (groups.length > 0) {
      this.activeSectionName.set(groups[0].headername);
      this.expandedSections.set({ [groups[0].headername]: true });
    }
    this.activeStep.set('review-form');
    this.showToast('Manual checklist loaded. You can fill questions directly.');
  }

  backToCategorySelect(): void {
    this.activeStep.set('category-select');
  }

  // === STEP 2: PHOTO UPLOAD METHODS ===

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  async onDropPhotos(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      await this.processFileList(Array.from(event.dataTransfer.files));
    }
  }

  async onUploadFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.processFileList(Array.from(input.files));
      input.value = '';
    }
  }

  private async processFileList(files: File[]): Promise<void> {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      this.showToast('Please select valid image files (JPG, PNG, WebP).');
      return;
    }

    const currentPhotos = [...this.uploadedPhotos()];
    for (const file of imageFiles) {
      try {
        const dataUrl = await this.readFileAsOptimizedDataUrl(file);
        currentPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          url: dataUrl,
          size: file.size,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed reading photo', err);
      }
    }

    this.uploadedPhotos.set(currentPhotos);
    this.showToast(`${imageFiles.length} photo(s) uploaded successfully.`);
  }

  removeUploadedPhoto(index: number): void {
    const current = [...this.uploadedPhotos()];
    current.splice(index, 1);
    this.uploadedPhotos.set(current);
    this.showToast('Photo removed.');
  }

  clearUploadedPhotos(): void {
    this.uploadedPhotos.set([]);
    this.showToast('All uploaded photos cleared.');
  }

  // === STEP 3: AI SCANNING METHODS ===

  startAiPhotoScanning(): void {
    if (this.uploadedPhotos().length === 0) {
      this.showToast('Please upload at least one photograph to analyze.');
      return;
    }

    this.activeStep.set('ai-scanning');
    this.isScanning.set(true);
    this.scanError.set(null);
    this.scanningProgress.set(10);
    this.scanningStatusMessage.set('Uploading site photographs...');

    const stages = [
      { progress: 20, message: 'Uploading site photographs...' },
      { progress: 40, message: 'Preparing image frames for vision analysis...' },
      { progress: 65, message: 'Scanning visual features against Chapter 8 & safety guidelines...' },
      { progress: 85, message: `Evaluating compliance for ${this.currentBank().name} checklist...` },
      { progress: 95, message: 'Formulating evidence and recommendations...' },
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (!this.isScanning()) {
        clearInterval(interval);
        return;
      }
      if (currentStage < stages.length) {
        this.scanningProgress.set(stages[currentStage].progress);
        this.scanningStatusMessage.set(stages[currentStage].message);
        currentStage++;
      }
    }, 600);

    const photosPayload = this.uploadedPhotos().map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      base64Data: p.url,
      timestamp: p.timestamp,
    }));

    const request: PhotoInspectionRequest = {
      bankId: this.selectedBankId(),
      bankName: this.currentBank().name,
      department: this.currentBank().department,
      trafficSubtype: this.trafficSubtype(),
      selectedRiskBanks: this.selectedRiskBanks(),
      photos: photosPayload,
      siteNotes: this.uploadSiteNotes() || this.inspectionMetadata().notes,
      inspectorName: this.inspectionMetadata().inspectorName,
      jobReference: this.inspectionMetadata().jobReference,
    };

    // Call backend API
    this.apiService.analyzeInspectionPhotos(request).subscribe({
      next: (res) => {
        clearInterval(interval);
        this.scanningProgress.set(100);
        this.scanningStatusMessage.set('Populating inspection form...');

        setTimeout(() => {
          this.applyBackendAiResults(res.data);
        }, 500);
      },
      error: (err) => {
        console.warn('Backend inspect-photos error, applying local fallback engine:', err);
        clearInterval(interval);
        this.scanningProgress.set(100);
        this.scanningStatusMessage.set('Applying QuestAI Vision Engine fallback...');

        // Fallback to local evaluation service
        setTimeout(() => {
          this.applyLocalAiResults();
        }, 600);
      },
    });
  }

  cancelScanning(): void {
    this.isScanning.set(false);
    this.activeStep.set('photo-upload');
    this.showToast('Photo analysis cancelled.');
  }

  retryScanning(): void {
    this.startAiPhotoScanning();
  }

  private applyBackendAiResults(data: any): void {
    const questions = this.currentQuestions();
    const bank = this.currentBank();

    // Baseline domain fill
    const localResult = this.aiInspectionFillService.generateAiInspectionAnswers(
      bank.id,
      bank.department,
      questions,
      this.uploadedPhotos(),
      this.uploadSiteNotes()
    );

    const mergedAnswers = { ...localResult.answers };

    // Overlay backend evaluations if provided
    if (data && data.evaluations) {
      for (const [qid, evaluation] of Object.entries<any>(data.evaluations)) {
        if (mergedAnswers[qid]) {
          mergedAnswers[qid] = {
            ...mergedAnswers[qid],
            rating: evaluation.suggestedRating || mergedAnswers[qid].rating,
            aiSuggestedRating: evaluation.suggestedRating,
            aiEvidence: evaluation.evidence || mergedAnswers[qid].aiEvidence,
            aiReasoning: evaluation.reasoning || mergedAnswers[qid].aiReasoning,
            aiConfidence: Math.round((evaluation.confidenceScore || 0.9) * 100),
            requiresHumanVerification: evaluation.requiresHumanVerification ?? mergedAnswers[qid].requiresHumanVerification,
            carActionPlan: evaluation.carActionPlan || mergedAnswers[qid].carActionPlan,
            comment: evaluation.evidence || mergedAnswers[qid].comment,
          };
        }
      }
    }

    this.aiModelIdentifier.set(data?.modelIdentifier || 'QuestAI Vision Engine (Pre-Gemini Evaluation)');
    this.isMockEngine.set(data?.isMock ?? true);
    this.lastAnalyzedTimestamp.set(data?.analyzedAt || new Date().toISOString());

    this.finalizeAiApplication(mergedAnswers, localResult);
  }

  private applyLocalAiResults(): void {
    const questions = this.currentQuestions();
    const bank = this.currentBank();

    const localResult = this.aiInspectionFillService.generateAiInspectionAnswers(
      bank.id,
      bank.department,
      questions,
      this.uploadedPhotos(),
      this.uploadSiteNotes()
    );

    this.aiModelIdentifier.set('QuestAI Vision Engine (Pre-Gemini Evaluation)');
    this.isMockEngine.set(true);
    this.lastAnalyzedTimestamp.set(new Date().toISOString());

    this.finalizeAiApplication(localResult.answers, localResult);
  }

  private finalizeAiApplication(answers: Record<string, QuestionAnswer>, metrics: any): void {
    this.formAnswers.set(answers);
    this.isScanning.set(false);

    let passCount = 0;
    let carCount = 0;
    let naCount = 0;
    let needsReviewCount = 0;

    for (const ans of Object.values(answers)) {
      if (ans.rating === '1') passCount++;
      else if (ans.rating === '-1') carCount++;
      else if (ans.rating === '0') naCount++;
      if (ans.requiresHumanVerification) needsReviewCount++;
    }

    this.aiPreFillSummary.set({
      photoCount: this.uploadedPhotos().length,
      totalEvaluated: Object.keys(answers).length,
      passedCount: passCount,
      carCount: carCount,
      naCount: naCount,
      needsReviewCount: needsReviewCount,
      bankName: this.currentBank().name,
      timestamp: new Date().toISOString(),
      evidenceNotes: this.uploadSiteNotes(),
    });

    // Open first section
    const groups = groupQuestionsByHeader(this.currentQuestions());
    if (groups.length > 0) {
      this.activeSectionName.set(groups[0].headername);
      this.expandedSections.set({ [groups[0].headername]: true });
    }

    this.persistDraftToStorage();
    this.activeStep.set('review-form');

    this.showToast(
      `✨ AI Analysis Completed: ${passCount} Pass, ${carCount} CAR, ${needsReviewCount} Needs Review`
    );
  }

  // === STEP 4: REVIEW FORM METHODS ===

  setReviewFilter(filter: 'all' | 'needs-review' | 'car' | 'unanswered'): void {
    this.reviewFilter.set(filter);
  }

  // Set rating ('1' = Pass, '-1' = CAR, '0' = N/A, '' = Unanswered)
  setRating(questionId: string, rating: QuestRatingValue): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};

    const updated: QuestionAnswer = {
      ...existing,
      rating: existing.rating === rating ? '' : rating,
      isHumanVerified: true, // Inspector took active action
    };

    this.formAnswers.set({
      ...current,
      [questionId]: updated,
    });

    this.autoSaveDraft();
  }

  // Confirm AI suggestion directly
  confirmAiSuggestion(questionId: string): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};
    const suggested = existing.aiSuggestedRating || '1';

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        rating: suggested,
        isHumanVerified: true,
      },
    });

    this.showToast('Rating verified by inspector.');
    this.autoSaveDraft();
  }

  // Set select dropdown answer
  setSelect(questionId: string, value: string): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        selectans: value,
        isHumanVerified: true,
      },
    });

    this.autoSaveDraft();
  }

  // Toggle multiselect option
  toggleMultiSelect(
    questionId: string,
    optionTxt: string,
    optionId?: any,
    ncr?: string
  ): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};
    const selectedList = [...(existing.multiselectans || [])];

    const idx = selectedList.findIndex((item) => item.txt === optionTxt);
    if (idx >= 0) {
      selectedList.splice(idx, 1);
    } else {
      selectedList.push({ txt: optionTxt, id: optionId, ncr });
    }

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        multiselectans: selectedList,
        isHumanVerified: true,
      },
    });

    this.autoSaveDraft();
  }

  isMultiOptionSelected(questionId: string, optionTxt: string) {
    const ans = this.formAnswers()[questionId];
    if (!ans || !ans.multiselectans) return false;
    return ans.multiselectans.some((item) => item.txt === optionTxt);
  }

  // Set comment/notes
  setComment(questionId: string, comment: string): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        comment,
      },
    });

    this.autoSaveDraft();
  }

  // Set CAR action plan
  setCarActionPlan(questionId: string, carActionPlan: string): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        carActionPlan,
      },
    });

    this.autoSaveDraft();
  }

  // Set component support result (e.g. certificated persons)
  setComponentRes(questionId: string, value: string): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        componentres: value,
        isHumanVerified: true,
      },
    });

    this.autoSaveDraft();
  }

  // Set modal / competence result
  setModalRes(questionId: string, value: string): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        modalres: value,
        isHumanVerified: true,
      },
    });

    this.autoSaveDraft();
  }

  // Question photo handling
  getPhotos(questionId: string): InspectionPhoto[] {
    return this.formAnswers()[questionId]?.photos || [];
  }

  async onAddPhotoToQuestion(questionId: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    const current = this.formAnswers();
    const existing = current[questionId] || {};
    const existingPhotos = existing.photos ? [...existing.photos] : [];

    for (const file of files) {
      try {
        const dataUrl = await this.readFileAsOptimizedDataUrl(file);
        existingPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          url: dataUrl,
          size: file.size,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to load image', err);
      }
    }

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        photoAttached: existingPhotos.length > 0,
        photos: existingPhotos,
      },
    });

    input.value = '';
    this.showToast(`${files.length} photo(s) attached to question.`);
    this.autoSaveDraft();
  }

  removePhotoFromQuestion(questionId: string, photoId: string): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};
    const updatedPhotos = (existing.photos || []).filter((p) => p.id !== photoId);

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        photoAttached: updatedPhotos.length > 0,
        photos: updatedPhotos,
      },
    });

    this.showToast('Photo evidence removed.');
    this.autoSaveDraft();
  }

  // Check if a question is answered
  isQuestionAnswered(questionId: string) {
    const ans = this.formAnswers()[questionId];
    if (!ans) return false;
    return !!(
      ans.rating ||
      (ans.selectans && ans.selectans.trim() !== '') ||
      (ans.multiselectans && ans.multiselectans.length > 0) ||
      (ans.comment && ans.comment.trim() !== '') ||
      (ans.componentres && ans.componentres.trim() !== '') ||
      (ans.modalres && ans.modalres.trim() !== '')
    );
  }

  getAnswer(questionId: string): QuestionAnswer {
    return this.formAnswers()[questionId] || {};
  }

  getOptionText(opt: any): string {
    return typeof opt === 'string' ? opt : (opt?.txt || '');
  }

  getOptionNcr(opt: any): string | undefined {
    return typeof opt === 'object' ? opt?.ncr : undefined;
  }

  getQuestionOptions(q: SiteInspectionQuestion): any[] {
    return (q as any)['options'] || [];
  }

  public applyAiPreFill(result: {
    bankId: string;
    bankName: string;
    answers: Record<string, QuestionAnswer>;
    photoCount: number;
    totalEvaluated: number;
    passedCount: number;
    carCount: number;
    naCount: number;
    needsReviewCount?: number;
    timestamp?: string;
  }): void {
    this.selectedBankId.set(result.bankId);
    this.formAnswers.set(result.answers);
    this.aiPreFillSummary.set({
      photoCount: result.photoCount,
      totalEvaluated: result.totalEvaluated,
      passedCount: result.passedCount,
      carCount: result.carCount,
      naCount: result.naCount,
      needsReviewCount: result.needsReviewCount || 0,
      bankName: result.bankName,
      timestamp: result.timestamp || new Date().toISOString(),
    });
    this.persistDraftToStorage();
    this.activeStep.set('review-form');
  }

  // Expand/collapse sections
  toggleSection(headername: string): void {
    const current = this.expandedSections();
    this.expandedSections.set({
      ...current,
      [headername]: !current[headername],
    });
  }

  isSectionExpanded(headername: string) {
    const state = this.expandedSections();
    return state[headername] !== false;
  }

  expandAllSections(): void {
    const newState: Record<string, boolean> = {};
    for (const sec of this.sections()) {
      newState[sec.headername] = true;
    }
    this.expandedSections.set(newState);
  }

  collapseAllSections(): void {
    const newState: Record<string, boolean> = {};
    for (const sec of this.sections()) {
      newState[sec.headername] = false;
    }
    this.expandedSections.set(newState);
  }

  // Full-screen photo preview modal
  openPhotoPreview(photo: InspectionPhoto): void {
    this.previewModalPhoto.set(photo);
  }

  closePhotoPreview(): void {
    this.previewModalPhoto.set(null);
  }

  // === STEP 5: FINAL REVIEW & SUBMISSION METHODS ===

  openFinalizeModal(): void {
    this.showFinalizeModal.set(true);
  }

  closeFinalizeModal(): void {
    this.showFinalizeModal.set(false);
  }

  confirmFinalizeInspection(): void {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const ref = `SI-2026-${randomSuffix}`;
    const bank = this.currentBank();
    const st = this.stats();

    const report: FinalizedInspectionReport = {
      referenceNumber: ref,
      bankId: bank.id,
      bankName: bank.name,
      department: bank.department,
      finalizedAt: new Date().toISOString(),
      inspectorName: this.inspectionMetadata().inspectorName,
      siteLocation: this.inspectionMetadata().siteLocation,
      jobReference: this.inspectionMetadata().jobReference,
      stats: {
        total: st.total,
        answered: st.answered,
        passCount: st.passCount,
        carCount: st.carCount,
        naCount: st.naCount,
        needsReviewCount: st.needsReviewCount,
        verifiedCount: st.verifiedCount,
      },
      answers: this.formAnswers(),
      photoCount: this.uploadedPhotos().length,
      modelIdentifier: this.aiModelIdentifier(),
      isMock: this.isMockEngine(),
    };

    // Store in standalone local storage (Key: questai_finalized_inspections)
    try {
      const existingRaw = localStorage.getItem('questai_finalized_inspections');
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      existingList.unshift(report);
      localStorage.setItem('questai_finalized_inspections', JSON.stringify(existingList));
    } catch (e) {
      console.warn('Storage save error:', e);
    }

    this.finalizedReport.set(report);
    this.showFinalizeModal.set(false);
    this.activeStep.set('finalized');

    this.showToast(`Inspection finalized! Reference: ${ref}`);
  }

  startNewInspection(): void {
    this.formAnswers.set({});
    this.uploadedPhotos.set([]);
    this.uploadSiteNotes.set('');
    this.aiPreFillSummary.set(null);
    this.finalizedReport.set(null);
    this.reviewFilter.set('all');
    this.searchQuery.set('');
    this.activeStep.set('category-select');
  }

  // === DRAFT MANAGEMENT ===

  saveDraft(): void {
    this.persistDraftToStorage();
    this.showToast('Inspection draft saved locally.');
  }

  autoSaveDraft(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      this.persistDraftToStorage();
    }, 400);
  }

  private persistDraftToStorage(): void {
    try {
      const data = {
        bankId: this.selectedBankId(),
        trafficSubtype: this.trafficSubtype(),
        selectedRiskBanks: this.selectedRiskBanks(),
        metadata: this.inspectionMetadata(),
        answers: this.formAnswers(),
        uploadedPhotos: this.uploadedPhotos(),
        aiSummary: this.aiPreFillSummary(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`questai_inspection_${this.selectedBankId()}`, JSON.stringify(data));
    } catch {}
  }

  private loadDraft(): void {
    try {
      const raw = localStorage.getItem(`questai_inspection_${this.selectedBankId()}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.answers) this.formAnswers.set(parsed.answers);
        if (parsed.metadata) this.inspectionMetadata.set(parsed.metadata);
        if (parsed.uploadedPhotos) this.uploadedPhotos.set(parsed.uploadedPhotos);
        if (parsed.selectedRiskBanks && this.currentBank().isManagers) {
          this.selectedRiskBanks.set(parsed.selectedRiskBanks);
        }
        if (parsed.aiSummary) this.aiPreFillSummary.set(parsed.aiSummary);
        else this.aiPreFillSummary.set(null);
      } else {
        this.formAnswers.set({});
        this.aiPreFillSummary.set(null);
      }
    } catch {
      this.formAnswers.set({});
      this.aiPreFillSummary.set(null);
    }
  }

  checkForPendingAiPreFill(): void {
    try {
      const raw = localStorage.getItem('questai_pending_ai_fill');
      if (raw) {
        localStorage.removeItem('questai_pending_ai_fill');
        const data = JSON.parse(raw);
        if (data && data.bankId && data.answers) {
          this.selectedBankId.set(data.bankId);
          this.formAnswers.set(data.answers);
          this.activeStep.set('review-form');
        }
      }
    } catch {}
  }

  // Reset form
  confirmReset(): void {
    this.showResetModal.set(true);
  }

  doReset(): void {
    this.formAnswers.set({});
    try {
      localStorage.removeItem(`questai_inspection_${this.selectedBankId()}`);
    } catch {}
    this.showResetModal.set(false);
    this.showToast('Inspection form reset for this question bank.');
  }

  cancelReset(): void {
    this.showResetModal.set(false);
  }

  // Dynamic Risk Banks for Managers inspection
  toggleRiskBank(riskKey: string): void {
    const current = this.selectedRiskBanks();
    if (current.includes(riskKey)) {
      this.selectedRiskBanks.set(current.filter((k) => k !== riskKey));
    } else {
      this.selectedRiskBanks.set([...current, riskKey]);
    }
  }

  selectAllRiskBanks(): void {
    this.selectedRiskBanks.set(this.availableRiskBanks.map((r) => r.key));
  }

  clearAllRiskBanks(): void {
    this.selectedRiskBanks.set([]);
  }

  setTrafficSubtype(subtype: '12D' | '12AB'): void {
    this.trafficSubtype.set(subtype);
    if (subtype === '12D') {
      this.selectedBankId.set('tm-12d');
    } else {
      this.selectedBankId.set('tm-12ab');
    }
  }

  // Image optimization helper
  private async readFileAsOptimizedDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result || !file.type.startsWith('image/')) {
          resolve(result);
          return;
        }

        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
              return;
            }
          }
          resolve(result);
        };
        img.onerror = () => resolve(result);
        img.src = result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set(null);
    }, 3200);
  }

  dismissToast(): void {
    this.toastMessage.set(null);
  }
}
