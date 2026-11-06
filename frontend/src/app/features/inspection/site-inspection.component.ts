import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  Output,
  EventEmitter,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  SiteInspectionQuestion,
  QuestRatingValue,
  getQuestionsForDepartment,
  groupQuestionsByHeader,
  evaluateConditionalRule,
  MANAGERS_RISK_BANKS,
  SelectOption,
  MultiSelectOption,
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
import {
  ApiService,
  PhotoInspectionRequest,
  PhotoInspectionResult,
  QuestionAiEvaluation,
} from '../../core/services/api.service';
import {
  isLegacyMockAnswerEntry,
  isLegacyMockString,
} from '../../core/services/ai-inspection-fill.service';

export const MAX_INSPECTION_PHOTOS = 10;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per image
export const MAX_TOTAL_IMAGES_BYTES = 25 * 1024 * 1024; // 25 MB total
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const DRAFT_SCHEMA_VERSION = 3;

export interface DraftMigrationReport {
  bankId: string;
  removedMockAnswersCount: number;
  removedMockCommentsCount: number;
  removedMockPhotosCount: number;
  preservedHumanAnswersCount: number;
  migratedAt: string;
}

@Component({
  selector: 'app-site-inspection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './site-inspection.component.html',
  styleUrls: ['./site-inspection.component.css'],
})
export class SiteInspectionComponent implements OnInit, OnDestroy {
  private readonly apiService = inject(ApiService);

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

  // Question ID awaiting explicit confirmation before overwriting an existing manual answer
  pendingOverwriteQuestionId = signal<string | null>(null);

  // Question ID currently in manual edit focus mode
  editingQuestionId = signal<string | null>(null);

  // Latest localStorage migration report (for transparency and testing)
  lastDraftMigrationReport = signal<DraftMigrationReport | null>(null);

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
  scanningStatusMessage = signal<string>('Preparing uploaded photographs');
  scanError = signal<string | null>(null);
  private scanSubscription?: Subscription;
  private scanStageTimers: ReturnType<typeof setTimeout>[] = [];

  // AI model identifier and mock flag
  aiModelIdentifier = signal<string>('gemini-3.8-flash');
  isMockEngine = signal(false);
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
    summary?: string;
    overallSiteRisk?: 'low' | 'medium' | 'high' | 'critical';
    recommendations?: string[];
    evidenceNotes?: string;
  } | null>(null);

  aiPreFillApplied = computed(() => this.aiPreFillSummary() !== null);

  // TrackBy functions to prevent DOM recreation
  trackBySection(_index: number, sec: SectionGroup): string {
    return sec.headername;
  }

  trackByQuestion(_index: number, q: SiteInspectionQuestion): string {
    return q.id;
  }

  trackByPhotoId(_index: number, photo: InspectionPhoto): string {
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

  // Questions belonging to the selected bank that currently satisfy conditional rules
  applicableQuestions = computed<SiteInspectionQuestion[]>(() => {
    const questions = this.currentQuestions();
    const answers = this.formAnswers();
    const effectiveContext = this.buildConditionalEvaluationContext(answers);

    return questions.filter((q) => {
      if (q.conditionalRule && !evaluateConditionalRule(q, effectiveContext)) {
        return false;
      }
      return true;
    });
  });

  // Visible questions after evaluating conditional rules, search, and review filter
  visibleQuestions = computed<SiteInspectionQuestion[]>(() => {
    const questions = this.applicableQuestions();
    const answers = this.formAnswers();

    return questions.filter((q) => {
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
        return (
          (ans?.requiresHumanVerification === true ||
            (ans?.hasAiEvaluation === true && ans?.aiSuggestionStatus === 'pending')) &&
          !ans?.isHumanVerified
        );
      }

      if (filter === 'car') {
        const isConfirmedCar =
          ans?.rating === '-1' || (ans?.multiselectans || []).some((m) => m.ncr === 'Yes');
        const isPendingAiCar =
          !ans?.rating &&
          ans?.aiSuggestionStatus !== 'rejected' &&
          ans?.aiSuggestedRating === '-1';
        return isConfirmedCar || isPendingAiCar;
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
        const isCar =
          ans?.rating === '-1' ||
          (!ans?.rating &&
            ans?.aiSuggestionStatus !== 'rejected' &&
            ans?.aiSuggestedRating === '-1') ||
          (ans?.multiselectans || []).some((m) => m.ncr === 'Yes');
        if (isCar) {
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
    const questions = this.applicableQuestions();
    const answers = this.formAnswers();

    let answered = 0;
    let passCount = 0;
    let carCount = 0;
    let naCount = 0;
    let needsReviewCount = 0;
    let verifiedCount = 0;
    let confirmedPassCount = 0;
    let confirmedCarCount = 0;
    let confirmedNaCount = 0;

    for (const q of questions) {
      const ans = answers[q.id];
      if (this.isQuestionAnswered(q.id)) {
        answered++;
      }
      if (ans) {
        if (ans.rating === '1') {
          passCount++;
          confirmedPassCount++;
        } else if (ans.rating === '-1') {
          carCount++;
          confirmedCarCount++;
        } else if (ans.rating === '0') {
          naCount++;
          confirmedNaCount++;
        } else if (ans.aiSuggestionStatus !== 'rejected') {
          // Include unconfirmed AI suggestion in overview tally while keeping ans.rating separate
          if (ans.aiSuggestedRating === '1') passCount++;
          else if (ans.aiSuggestedRating === '-1') carCount++;
          else if (ans.aiSuggestedRating === '0') naCount++;
        }

        if (
          (ans.requiresHumanVerification ||
            (ans.hasAiEvaluation && ans.aiSuggestionStatus === 'pending')) &&
          !ans.isHumanVerified
        ) {
          needsReviewCount++;
        }
        if (ans.isHumanVerified) {
          verifiedCount++;
        }
      }
    }

    const total = questions.length;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

    return {
      total,
      answered,
      unanswered: Math.max(0, total - answered),
      passCount,
      carCount,
      naCount,
      confirmedPassCount,
      confirmedCarCount,
      confirmedNaCount,
      needsReviewCount,
      verifiedCount,
      percent,
    };
  });

  ngOnInit(): void {
    // Clean up any legacy mock pending pre-fill in localStorage
    this.cleanupLegacyPendingAiFill();
    // Initialize draft from localStorage if present (with safe legacy mock cleanup)
    this.loadDraft();
  }

  ngOnDestroy(): void {
    this.clearScanTimers();
    if (this.scanSubscription) {
      this.scanSubscription.unsubscribe();
      this.scanSubscription = undefined;
    }
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
  }

  private buildConditionalEvaluationContext(
    answers: Record<string, QuestionAnswer>
  ): Record<string, any> {
    const context: Record<string, any> = {};
    for (const [qId, ans] of Object.entries(answers)) {
      if (!ans) continue;
      // Only confirmed inspector answers or explicitly accepted suggestions drive conditional visibility
      context[qId] = {
        ...ans,
        selectans: ans.selectans,
        multiselectans: ans.multiselectans,
      };
    }
    return context;
  }

  // === STEP 1: CATEGORY SELECTION METHODS ===

  selectBank(bankId: string): void {
    this.selectedBankId.set(bankId);
    const bank = this.currentBank();
    if (bank.trafficSubtype) {
      this.trafficSubtype.set(bank.trafficSubtype);
    }
    this.pendingOverwriteQuestionId.set(null);
    this.editingQuestionId.set(null);
    this.loadDraft();
  }

  onCategoryCardClick(bankId: string): void {
    this.selectBank(bankId);
    this.requestAiPhotoUpload.emit(bankId);
  }

  openManualChecklistForBank(bankId: string, selectedRiskBanks?: string[]): void {
    this.selectBank(bankId);
    if (selectedRiskBanks && this.currentBank().isManagers) {
      this.selectedRiskBanks.set([...selectedRiskBanks]);
    }
    this.skipToManualChecklist();
  }

  continueToPhotoUpload(): void {
    this.requestAiPhotoUpload.emit(this.selectedBankId());
  }

  skipToManualChecklist(): void {
    this.loadDraft();
    const groups = groupQuestionsByHeader(this.applicableQuestions());
    if (groups.length > 0) {
      this.activeSectionName.set(groups[0].headername);
      this.expandedSections.set({ [groups[0].headername]: true });
    }
    this.activeStep.set('review-form');
    this.showToast('Manual checklist loaded. You can fill questions directly.');
  }

  backToCategorySelect(): void {
    if (this.isScanning()) {
      this.cancelScanning();
    }
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
    const validFiles = files.filter((f) =>
      ALLOWED_IMAGE_MIMES.has((f.type || '').toLowerCase())
    );
    if (validFiles.length === 0) {
      this.showToast('Please select valid JPG, PNG, or WebP photographs.');
      return;
    }

    const currentPhotos = [...this.uploadedPhotos()];
    if (currentPhotos.length + validFiles.length > MAX_INSPECTION_PHOTOS) {
      this.showToast(`Maximum ${MAX_INSPECTION_PHOTOS} photographs allowed per analysis.`);
      return;
    }

    let runningTotalBytes = currentPhotos.reduce(
      (sum, p) => sum + (p.size || this.estimateDataUrlBytes(p.url)),
      0
    );
    let addedCount = 0;

    for (const file of validFiles) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        this.showToast(`"${file.name}" exceeds the 10 MB per-photo limit.`);
        continue;
      }
      try {
        const { dataUrl, mimeType, byteLength, normalizedName } =
          await this.readFileAsOptimizedDataUrl(file);
        if (byteLength > MAX_IMAGE_SIZE_BYTES) {
          this.showToast(`"${file.name}" exceeds the 10 MB per-photo limit.`);
          continue;
        }
        if (runningTotalBytes + byteLength > MAX_TOTAL_IMAGES_BYTES) {
          this.showToast('Total photo size exceeds the 25 MB limit.');
          break;
        }
        runningTotalBytes += byteLength;
        currentPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: normalizedName,
          url: dataUrl,
          mimeType,
          size: byteLength,
          timestamp: new Date().toISOString(),
        });
        addedCount++;
      } catch (err) {
        console.error('Failed reading photo', err);
      }
    }

    if (addedCount > 0) {
      this.uploadedPhotos.set(currentPhotos);
      this.showToast(`${addedCount} photo(s) uploaded successfully.`);
    }
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

  public estimateDataUrlBytes(dataUrl: string): number {
    if (!dataUrl || typeof dataUrl !== 'string') return 0;
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const cleaned = base64.replace(/\s+/g, '');
    if (!cleaned) return 0;
    const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
  }

  public validatePhotosForAnalysis(photos: InspectionPhoto[]): {
    valid: boolean;
    error?: string;
  } {
    if (!Array.isArray(photos) || photos.length === 0) {
      return { valid: false, error: 'Please upload at least one photograph to analyse.' };
    }
    if (photos.length > MAX_INSPECTION_PHOTOS) {
      return {
        valid: false,
        error: `Too many photographs selected (${photos.length}). Maximum allowed is ${MAX_INSPECTION_PHOTOS}.`,
      };
    }

    let totalBytes = 0;
    for (const p of photos) {
      if (!p || !p.url || !p.url.startsWith('data:image/')) {
        return {
          valid: false,
          error: `Photograph "${p?.name || 'unnamed'}" is missing a valid image data URI.`,
        };
      }
      const mimeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/i.exec(p.url);
      const mime = mimeMatch ? mimeMatch[1].toLowerCase() : '';
      if (!ALLOWED_IMAGE_MIMES.has(mime)) {
        return {
          valid: false,
          error: `Photograph "${p.name}" has unsupported format "${mime || 'unknown'}". Use JPG, PNG, or WebP.`,
        };
      }
      const bytes = this.estimateDataUrlBytes(p.url);
      if (bytes <= 0) {
        return {
          valid: false,
          error: `Photograph "${p.name}" contains empty image data.`,
        };
      }
      if (bytes > MAX_IMAGE_SIZE_BYTES) {
        return {
          valid: false,
          error: `Photograph "${p.name}" exceeds the maximum 10 MB per-image limit.`,
        };
      }
      totalBytes += bytes;
    }

    if (totalBytes > MAX_TOTAL_IMAGES_BYTES) {
      return {
        valid: false,
        error: 'Total uploaded photographs exceed the 25 MB limit.',
      };
    }

    return { valid: true };
  }

  // === STEP 3: AI SCANNING METHODS (REAL GEMINI MULTIMODAL WORKFLOW) ===

  /**
   * Entry point used when the Home modal hands off selected bank + photos for real Gemini analysis.
   */
  public startExternalPhotoAnalysis(params: {
    bankId: string;
    trafficSubtype?: '12D' | '12AB';
    selectedRiskBanks?: string[];
    photos: InspectionPhoto[];
    siteNotes?: string;
  }): void {
    this.selectBank(params.bankId);
    if (params.trafficSubtype) {
      this.trafficSubtype.set(params.trafficSubtype);
    }
    if (params.selectedRiskBanks && this.currentBank().isManagers) {
      this.selectedRiskBanks.set([...params.selectedRiskBanks]);
    }
    this.uploadedPhotos.set([...params.photos]);
    if (params.siteNotes !== undefined) {
      this.uploadSiteNotes.set(params.siteNotes);
    }
    this.startAiPhotoScanning();
  }

  public buildPhotoInspectionRequest(): PhotoInspectionRequest {
    const bank = this.currentBank();
    const applicable = this.applicableQuestions();
    const photosPayload = this.uploadedPhotos().map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      size: p.size || this.estimateDataUrlBytes(p.url),
      timestamp: p.timestamp,
    }));

    return {
      bankId: this.selectedBankId(),
      bankName: bank.name,
      department: bank.department,
      trafficSubtype:
        bank.department === 'Traffic Management'
          ? bank.trafficSubtype || this.trafficSubtype()
          : undefined,
      selectedRiskBanks: bank.isManagers ? this.selectedRiskBanks() : undefined,
      siteName: this.inspectionMetadata().siteLocation,
      inspectionDate: this.inspectionMetadata().inspectionDate,
      siteNotes: this.uploadSiteNotes() || this.inspectionMetadata().notes,
      inspectorName: this.inspectionMetadata().inspectorName,
      jobReference: this.inspectionMetadata().jobReference,
      questions: applicable.map((q) => ({
        id: q.id,
        qnum: q.qnum,
        headername: q.headername,
        qtext: q.qtext,
        typeofans: q.typeofans as string[] | undefined,
        select: q.select,
        multiselect: q.multiselect,
        conditionalRule: q.conditionalRule,
      })),
      photos: photosPayload,
    };
  }

  private clearScanTimers(): void {
    for (const timer of this.scanStageTimers) {
      clearTimeout(timer);
    }
    this.scanStageTimers = [];
  }

  startAiPhotoScanning(): void {
    // Prevent duplicate submissions while a request is already in flight
    if (this.isScanning()) {
      return;
    }

    const validation = this.validatePhotosForAnalysis(this.uploadedPhotos());
    if (!validation.valid) {
      const msg = validation.error || 'Please upload valid site photographs.';
      this.scanError.set(msg);
      this.showToast(msg);
      return;
    }

    this.clearScanTimers();
    if (this.scanSubscription) {
      this.scanSubscription.unsubscribe();
      this.scanSubscription = undefined;
    }

    this.activeStep.set('ai-scanning');
    this.isScanning.set(true);
    this.scanError.set(null);
    this.scanningStatusMessage.set('Preparing uploaded photographs');

    const request = this.buildPhotoInspectionRequest();

    // Update status message as the HTTP request is dispatched
    this.scanningStatusMessage.set('Sending photographs for Gemini analysis');

    // Truthful lifecycle status updates while awaiting Gemini's response (no fabricated percentages)
    this.scanStageTimers.push(
      setTimeout(() => {
        if (this.isScanning()) {
          this.scanningStatusMessage.set('Analysing site evidence');
        }
      }, 900),
      setTimeout(() => {
        if (this.isScanning()) {
          this.scanningStatusMessage.set('Processing inspection question evaluations');
        }
      }, 2600)
    );

    this.scanSubscription = this.apiService.analyzeInspectionPhotos(request).subscribe({
      next: (res) => {
        this.clearScanTimers();
        this.scanSubscription = undefined;
        this.scanningStatusMessage.set('Processing inspection question evaluations');
        this.applyBackendAiResults(res.data);
      },
      error: (err) => {
        this.clearScanTimers();
        this.scanSubscription = undefined;
        this.isScanning.set(false);
        this.scanningStatusMessage.set('Photo analysis failed');
        this.scanError.set(this.formatPhotoAnalysisError(err));
      },
    });
  }

  private formatPhotoAnalysisError(err: any): string {
    const backendMessage =
      err?.error?.error?.message ||
      (Array.isArray(err?.error?.error?.details) && err.error.error.details.join('; ')) ||
      err?.error?.message;

    if (err?.status === 0) {
      return 'Cannot reach the QuestAI backend server on port 5001. Please ensure the backend is running.';
    }
    if (err?.status === 400) {
      return backendMessage || 'Invalid photo analysis request payload. Check photo format and size limits.';
    }
    if (err?.status === 401 || err?.status === 403) {
      return backendMessage || 'Gemini authentication failed on the backend. Verify backend API key configuration.';
    }
    if (err?.status === 429) {
      return backendMessage || 'Gemini API quota or rate limit exceeded. Please wait a moment and try again.';
    }
    if (err?.status === 504) {
      return backendMessage || 'Gemini photo analysis timed out. Try again or upload fewer/smaller photos.';
    }
    return backendMessage || 'Gemini photo analysis failed. Please try again.';
  }

  cancelScanning(): void {
    this.clearScanTimers();
    if (this.scanSubscription) {
      this.scanSubscription.unsubscribe();
      this.scanSubscription = undefined;
    }
    this.isScanning.set(false);
    this.scanError.set(null);
    this.activeStep.set('photo-upload');
    this.showToast('Photo analysis cancelled.');
  }

  retryScanning(): void {
    if (this.isScanning()) return;
    this.scanError.set(null);
    this.startAiPhotoScanning();
  }

  /**
   * Maps the real Gemini response from POST /api/ai/inspect-photos to the selected bank's questions.
   * - Validates all questionIds against the selected bank.
   * - Never converts a null rating to Pass ('1'), CAR ('-1'), or N/A ('0').
   * - Keeps AI suggestions separate from confirmed inspector answers until accepted.
   * - Never overwrites an existing human answer without explicit confirmation.
   * - Never automatically attaches photos to questions based on question index.
   */
  public applyBackendAiResults(data: PhotoInspectionResult): void {
    const questions = this.currentQuestions();
    const validQuestionMap = new Map<string, SiteInspectionQuestion>(
      questions.map((q) => [q.id, q])
    );

    // Build validated lookup map from either evaluations[] array or evaluationsMap record
    const evalById = new Map<string, QuestionAiEvaluation>();
    if (Array.isArray(data?.evaluations)) {
      for (const ev of data.evaluations) {
        if (ev && typeof ev.questionId === 'string' && validQuestionMap.has(ev.questionId)) {
          evalById.set(ev.questionId, ev);
        }
      }
    } else if (data?.evaluationsMap && typeof data.evaluationsMap === 'object') {
      for (const [qId, ev] of Object.entries(data.evaluationsMap)) {
        if (ev && validQuestionMap.has(qId)) {
          evalById.set(qId, ev);
        }
      }
    }

    const existingAnswers = this.formAnswers();
    const mergedAnswers: Record<string, QuestionAnswer> = {};
    const analyzedAt = data?.analyzedAt || new Date().toISOString();
    const modelId = data?.modelIdentifier || 'gemini-3.8-flash';

    let suggestedPassCount = 0;
    let suggestedCarCount = 0;
    let suggestedNaCount = 0;
    let needsReviewCount = 0;

    for (const q of questions) {
      const existing = existingAnswers[q.id];
      const hasHumanAnswer = this.hasManualInspectorAnswer(existing);
      const ev = evalById.get(q.id);

      if (!ev) {
        if (hasHumanAnswer) {
          mergedAnswers[q.id] = { ...existing };
        } else {
          mergedAnswers[q.id] = {
            rating: '',
            hasAiEvaluation: false,
            aiSuggestedRating: null,
            requiresHumanVerification: true,
            isHumanVerified: false,
          };
          needsReviewCount++;
        }
        continue;
      }

      // Strictly map rating: "1" = suggested Pass, "-1" = suggested CAR, "0" = suggested N/A, null = unresolved
      const rawRating = ev.rating;
      const aiSuggestedRating: '1' | '-1' | '0' | null =
        rawRating === '1' || rawRating === '-1' || rawRating === '0' ? rawRating : null;

      if (aiSuggestedRating === '1') suggestedPassCount++;
      else if (aiSuggestedRating === '-1') suggestedCarCount++;
      else if (aiSuggestedRating === '0') suggestedNaCount++;

      // Validate selectAnswer against allowed question select options
      const allowedSelects = this.getAllowedSelectOptionTexts(q);
      let aiSuggestedSelect: string | null = null;
      if (typeof ev.selectAnswer === 'string' && ev.selectAnswer.trim()) {
        const candidate = ev.selectAnswer.trim();
        if (allowedSelects.length === 0 || allowedSelects.includes(candidate)) {
          aiSuggestedSelect = candidate;
        }
      }

      // Validate multiselectAnswers against allowed question multiselect options
      const allowedMultiSelects = this.getAllowedMultiSelectOptionTexts(q);
      let aiSuggestedMultiSelect: string[] | null = null;
      if (Array.isArray(ev.multiselectAnswers) && ev.multiselectAnswers.length > 0) {
        const filtered = ev.multiselectAnswers
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim())
          .filter((item) => allowedMultiSelects.length === 0 || allowedMultiSelects.includes(item));
        if (filtered.length > 0) {
          aiSuggestedMultiSelect = filtered;
        }
      }

      // Normalize confidence to 0-100 percentage
      const rawConf =
        typeof ev.confidence === 'number'
          ? ev.confidence
          : typeof ev.confidenceScore === 'number'
            ? ev.confidenceScore
            : 0;
      const clampedConf = rawConf <= 1 ? Math.max(0, Math.min(1, rawConf)) * 100 : Math.max(0, Math.min(100, rawConf));
      const aiConfidence = Math.round(clampedConf);

      const evidenceObserved = (ev.evidenceObserved ?? ev.evidence ?? '').trim();
      const reasoning = (ev.reasoning ?? '').trim();
      const needsHumanVerification =
        aiSuggestedRating === null
          ? true
          : !!(ev.needsHumanVerification ?? ev.requiresHumanVerification);

      if (needsHumanVerification) {
        needsReviewCount++;
      }

      const aiSuggestedCarActionPlan =
        typeof ev.carActionPlan === 'string' && ev.carActionPlan.trim()
          ? ev.carActionPlan.trim()
          : null;

      // Preserve confirmed human answers; keep AI suggestions strictly separate until accepted
      mergedAnswers[q.id] = {
        rating: hasHumanAnswer ? (existing.rating ?? '') : '',
        selectans: hasHumanAnswer ? existing.selectans : undefined,
        multiselectans: hasHumanAnswer ? existing.multiselectans : undefined,
        comment: hasHumanAnswer ? existing.comment : '',
        carActionPlan: hasHumanAnswer ? existing.carActionPlan : undefined,
        componentres: hasHumanAnswer ? existing.componentres : undefined,
        modalres: hasHumanAnswer ? existing.modalres : undefined,
        photos: hasHumanAnswer ? existing.photos : undefined,
        photoAttached: hasHumanAnswer ? !!existing.photoAttached : false,
        isHumanVerified: hasHumanAnswer,
        answeredBy: hasHumanAnswer ? 'human' : 'ai',

        // AI Suggestion Metadata
        hasAiEvaluation: true,
        aiSuggestedRating,
        aiSuggestedSelect,
        aiSuggestedMultiSelect,
        aiSuggestedCarActionPlan,
        aiEvidence: evidenceObserved || undefined,
        aiReasoning: reasoning || undefined,
        aiConfidence,
        requiresHumanVerification: needsHumanVerification,
        aiSuggestionStatus: 'pending',
        aiModel: modelId,
        aiEvaluatedAt: analyzedAt,
      };
    }

    this.aiModelIdentifier.set(modelId);
    this.isMockEngine.set(!!data?.isMock);
    this.lastAnalyzedTimestamp.set(analyzedAt);

    this.formAnswers.set(mergedAnswers);
    this.isScanning.set(false);
    this.pendingOverwriteQuestionId.set(null);
    this.editingQuestionId.set(null);

    this.aiPreFillSummary.set({
      photoCount: this.uploadedPhotos().length,
      totalEvaluated: evalById.size,
      passedCount: suggestedPassCount,
      carCount: suggestedCarCount,
      naCount: suggestedNaCount,
      needsReviewCount,
      bankName: this.currentBank().name,
      timestamp: analyzedAt,
      summary: data?.summary || '',
      overallSiteRisk: data?.overallSiteRisk,
      recommendations: data?.recommendations || [],
      evidenceNotes: this.uploadSiteNotes(),
    });

    // Open first section
    const groups = groupQuestionsByHeader(this.applicableQuestions());
    if (groups.length > 0) {
      this.activeSectionName.set(groups[0].headername);
      this.expandedSections.set({ [groups[0].headername]: true });
    }

    this.persistDraftToStorage();
    this.activeStep.set('review-form');

    this.showToast(
      `✨ Gemini Analysis Complete: ${suggestedPassCount} Suggested Pass, ${suggestedCarCount} Suggested CAR, ${needsReviewCount} Needs Human Check`
    );
  }

  public hasManualInspectorAnswer(ans: QuestionAnswer | undefined): boolean {
    if (!ans) return false;
    if (!ans.isHumanVerified && ans.answeredBy !== 'human') return false;
    return !!(
      ans.rating ||
      (ans.selectans && ans.selectans.trim() !== '') ||
      (ans.multiselectans && ans.multiselectans.length > 0) ||
      (ans.comment && ans.comment.trim() !== '' && !isLegacyMockString(ans.comment)) ||
      (ans.carActionPlan && ans.carActionPlan.trim() !== '' && !isLegacyMockString(ans.carActionPlan)) ||
      (ans.componentres && ans.componentres.trim() !== '') ||
      (ans.modalres && ans.modalres.trim() !== '') ||
      (ans.photos && ans.photos.some((p) => p.attachedBy === 'inspector'))
    );
  }

  private getAllowedSelectOptionTexts(q: SiteInspectionQuestion): string[] {
    const rawList = q.select || (q as any)['options'] || [];
    if (!Array.isArray(rawList)) return [];
    return rawList
      .map((item: string | SelectOption) => (typeof item === 'string' ? item : item?.txt || ''))
      .filter((t: string) => t.trim().length > 0);
  }

  private getAllowedMultiSelectOptionTexts(q: SiteInspectionQuestion): string[] {
    const rawList = q.multiselect || [];
    if (!Array.isArray(rawList)) return [];
    return rawList
      .map((item: MultiSelectOption) => item?.txt || '')
      .filter((t: string) => t.trim().length > 0);
  }

  // === STEP 4: REVIEW FORM & MANDATORY HUMAN VERIFICATION METHODS ===

  setReviewFilter(filter: 'all' | 'needs-review' | 'car' | 'unanswered'): void {
    this.reviewFilter.set(filter);
  }

  // Set rating ('1' = Pass, '-1' = CAR, '0' = N/A, '' = Unanswered)
  setRating(questionId: string, rating: QuestRatingValue): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};
    const nextRating: QuestRatingValue = existing.rating === rating ? '' : rating;

    const updated: QuestionAnswer = {
      ...existing,
      rating: nextRating,
      isHumanVerified: nextRating !== '',
      answeredBy: 'human',
      aiSuggestionStatus: existing.hasAiEvaluation
        ? nextRating === existing.aiSuggestedRating
          ? 'accepted'
          : 'edited'
        : existing.aiSuggestionStatus,
    };

    this.formAnswers.set({
      ...current,
      [questionId]: updated,
    });

    if (this.pendingOverwriteQuestionId() === questionId) {
      this.pendingOverwriteQuestionId.set(null);
    }

    this.autoSaveDraft();
  }

  /**
   * Accept AI Suggestion for a question.
   * Never converts a null rating to Pass/CAR/N/A.
   * Never overwrites an existing human answer without explicit confirmation.
   */
  acceptAiSuggestion(questionId: string, forceOverwrite = false): void {
    const current = this.formAnswers();
    const existing = current[questionId];
    if (!existing || !existing.hasAiEvaluation) return;

    const suggestedRating = existing.aiSuggestedRating;
    const hasExecutableSuggestion =
      suggestedRating === '1' ||
      suggestedRating === '-1' ||
      suggestedRating === '0' ||
      !!existing.aiSuggestedSelect ||
      (Array.isArray(existing.aiSuggestedMultiSelect) &&
        existing.aiSuggestedMultiSelect.length > 0);

    if (!hasExecutableSuggestion) {
      this.showToast(
        'AI rating is unresolved for this question. Please inspect and select an answer manually.'
      );
      return;
    }

    // Do not overwrite an existing human answer without explicit confirmation
    if (this.hasManualInspectorAnswer(existing) && !forceOverwrite) {
      this.pendingOverwriteQuestionId.set(questionId);
      return;
    }

    const question = this.currentQuestions().find((q) => q.id === questionId);
    let nextMultiSelect = existing.multiselectans;
    if (
      question &&
      Array.isArray(existing.aiSuggestedMultiSelect) &&
      existing.aiSuggestedMultiSelect.length > 0
    ) {
      const schemaMulti = question.multiselect || [];
      nextMultiSelect = existing.aiSuggestedMultiSelect.map((txt) => {
        const match = schemaMulti.find((m) => m.txt === txt);
        return { txt, id: match?.id, ncr: match?.ncr };
      });
    }

    const acceptedRating: QuestRatingValue =
      suggestedRating === '1' || suggestedRating === '-1' || suggestedRating === '0'
        ? suggestedRating
        : (existing.rating ?? '');

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        rating: acceptedRating,
        selectans: existing.aiSuggestedSelect ?? existing.selectans,
        multiselectans: nextMultiSelect,
        comment:
          !existing.comment || forceOverwrite
            ? existing.aiEvidence || existing.comment || ''
            : existing.comment,
        carActionPlan:
          acceptedRating === '-1'
            ? existing.aiSuggestedCarActionPlan || existing.carActionPlan || ''
            : existing.carActionPlan,
        isHumanVerified: true,
        requiresHumanVerification: false,
        answeredBy: 'human',
        aiSuggestionStatus: 'accepted',
      },
    });

    this.pendingOverwriteQuestionId.set(null);
    this.editingQuestionId.set(null);
    this.showToast('AI suggestion accepted and verified by inspector.');
    this.autoSaveDraft();
  }

  /**
   * Backward-compatible alias for acceptAiSuggestion.
   */
  confirmAiSuggestion(questionId: string, forceOverwrite = false): void {
    this.acceptAiSuggestion(questionId, forceOverwrite);
  }

  cancelOverwriteConfirmation(): void {
    this.pendingOverwriteQuestionId.set(null);
  }

  /**
   * Edit answer: opens manual editing mode for the question and pre-stages AI observation notes
   * only if the inspector has not already entered a comment or CAR plan.
   */
  editAiSuggestion(questionId: string): void {
    const current = this.formAnswers();
    const existing = current[questionId] || {};

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        comment: existing.comment || existing.aiEvidence || '',
        carActionPlan:
          existing.carActionPlan ||
          (existing.aiSuggestedRating === '-1' ? existing.aiSuggestedCarActionPlan || '' : undefined),
        aiSuggestionStatus: 'edited',
      },
    });

    this.editingQuestionId.set(questionId);
    this.pendingOverwriteQuestionId.set(null);
    this.showToast('Editing answer manually. Select a rating or update inspector notes below.');
    this.autoSaveDraft();
  }

  /**
   * Reject AI Suggestion: dismisses the AI suggestion while preserving any existing human answer
   * or leaving the question unanswered for manual input.
   */
  rejectAiSuggestion(questionId: string): void {
    const current = this.formAnswers();
    const existing = current[questionId];
    if (!existing) return;

    const hasHuman = this.hasManualInspectorAnswer(existing);

    this.formAnswers.set({
      ...current,
      [questionId]: {
        ...existing,
        rating: hasHuman ? existing.rating : '',
        comment: hasHuman ? existing.comment : '',
        carActionPlan: hasHuman ? existing.carActionPlan : undefined,
        selectans: hasHuman ? existing.selectans : undefined,
        multiselectans: hasHuman ? existing.multiselectans : undefined,
        aiSuggestionStatus: 'rejected',
        requiresHumanVerification: !hasHuman,
      },
    });

    if (this.pendingOverwriteQuestionId() === questionId) {
      this.pendingOverwriteQuestionId.set(null);
    }
    if (this.editingQuestionId() === questionId) {
      this.editingQuestionId.set(null);
    }
    this.showToast('AI suggestion rejected. Please enter your manual assessment.');
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
        answeredBy: 'human',
        aiSuggestionStatus: existing.hasAiEvaluation ? 'edited' : existing.aiSuggestionStatus,
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
        answeredBy: 'human',
        aiSuggestionStatus: existing.hasAiEvaluation ? 'edited' : existing.aiSuggestionStatus,
      },
    });

    this.autoSaveDraft();
  }

  isMultiOptionSelected(questionId: string, optionTxt: string): boolean {
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
        isHumanVerified: existing.isHumanVerified || comment.trim().length > 0,
        answeredBy: 'human',
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
        answeredBy: 'human',
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
        answeredBy: 'human',
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
        answeredBy: 'human',
      },
    });

    this.autoSaveDraft();
  }

  // Question photo handling (manual inspector evidence only)
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
        const { dataUrl, mimeType, byteLength, normalizedName } =
          await this.readFileAsOptimizedDataUrl(file);
        existingPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: normalizedName,
          url: dataUrl,
          mimeType,
          size: byteLength,
          timestamp: new Date().toISOString(),
          attachedBy: 'inspector',
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
        answeredBy: 'human',
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

  // Check if a question has a confirmed inspector answer
  isQuestionAnswered(questionId: string): boolean {
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
    return q.select || (q as any)['options'] || [];
  }

  getQuestionMultiOptions(q: SiteInspectionQuestion): MultiSelectOption[] {
    return q.multiselect || [];
  }

  // Expand/collapse sections
  toggleSection(headername: string): void {
    const current = this.expandedSections();
    this.expandedSections.set({
      ...current,
      [headername]: !current[headername],
    });
  }

  isSectionExpanded(headername: string): boolean {
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
        passCount: st.confirmedPassCount,
        carCount: st.confirmedCarCount,
        naCount: st.confirmedNaCount,
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
    this.pendingOverwriteQuestionId.set(null);
    this.editingQuestionId.set(null);
    this.reviewFilter.set('all');
    this.searchQuery.set('');
    this.activeStep.set('category-select');
  }

  // === DRAFT MANAGEMENT & LEGACY MOCK CLEANUP (PART 6) ===

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
        schemaVersion: DRAFT_SCHEMA_VERSION,
        bankId: this.selectedBankId(),
        trafficSubtype: this.trafficSubtype(),
        selectedRiskBanks: this.selectedRiskBanks(),
        metadata: this.inspectionMetadata(),
        answers: this.formAnswers(),
        uploadedPhotos: this.uploadedPhotos(),
        aiSummary: this.aiPreFillSummary(),
        aiModelIdentifier: this.aiModelIdentifier(),
        isMockEngine: this.isMockEngine(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`questai_inspection_${this.selectedBankId()}`, JSON.stringify(data));
    } catch {}
  }

  /**
   * Safely cleans up stale `questai_pending_ai_fill` entries generated by the legacy mock service.
   */
  public cleanupLegacyPendingAiFill(): boolean {
    try {
      const raw = localStorage.getItem('questai_pending_ai_fill');
      if (!raw) return false;
      localStorage.removeItem('questai_pending_ai_fill');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inspects a parsed draft from `questai_inspection_<bankId>` and removes legacy mock AI
   * comments, mock ratings, and index-based auto-attached photos while preserving all
   * genuine inspector-entered answers, comments, and manually attached evidence.
   */
  public sanitizeAndMigrateDraft(
    bankId: string,
    parsed: any
  ): {
    answers: Record<string, QuestionAnswer>;
    aiSummary: any | null;
    aiModelIdentifier: string;
    isMockEngine: boolean;
    migrated: boolean;
    report: DraftMigrationReport;
  } {
    const isPreV3Draft = !parsed?.schemaVersion || parsed.schemaVersion < DRAFT_SCHEMA_VERSION;
    const isLegacyMockRun =
      parsed?.isMockEngine === true ||
      (typeof parsed?.aiModelIdentifier === 'string' &&
        parsed.aiModelIdentifier.includes('Pre-Gemini')) ||
      (isPreV3Draft && parsed?.aiSummary && !parsed?.aiModelIdentifier);

    const batchPhotoIds = new Set<string>(
      Array.isArray(parsed?.uploadedPhotos)
        ? parsed.uploadedPhotos.map((p: any) => p?.id).filter(Boolean)
        : []
    );
    const batchPhotoUrls = new Set<string>(
      Array.isArray(parsed?.uploadedPhotos)
        ? parsed.uploadedPhotos.map((p: any) => p?.url).filter(Boolean)
        : []
    );

    const cleanedAnswers: Record<string, QuestionAnswer> = {};
    const rawAnswers =
      parsed?.answers && typeof parsed.answers === 'object' ? parsed.answers : {};

    let removedMockAnswersCount = 0;
    let removedMockCommentsCount = 0;
    let removedMockPhotosCount = 0;
    let preservedHumanAnswersCount = 0;

    for (const [qId, rawAns] of Object.entries(rawAnswers)) {
      if (!rawAns || typeof rawAns !== 'object') continue;
      const ans: QuestionAnswer = { ...(rawAns as QuestionAnswer) };

      const hasMockFields =
        isLegacyMockAnswerEntry(ans) ||
        (isLegacyMockRun && !ans.isHumanVerified && ans.answeredBy !== 'human');

      if (hasMockFields) {
        if (ans.comment && isLegacyMockString(ans.comment)) {
          delete ans.comment;
          removedMockCommentsCount++;
        }
        if (ans.carActionPlan && isLegacyMockString(ans.carActionPlan)) {
          delete ans.carActionPlan;
        }

        // Remove photos that were automatically attached by legacy selectPhotosForQuestion()
        if (Array.isArray(ans.photos) && ans.photos.length > 0) {
          const genuineManualPhotos = ans.photos.filter(
            (p) =>
              p?.attachedBy === 'inspector' &&
              !batchPhotoIds.has(p.id) &&
              !batchPhotoUrls.has(p.url)
          );
          removedMockPhotosCount += ans.photos.length - genuineManualPhotos.length;
          ans.photos = genuineManualPhotos.length > 0 ? genuineManualPhotos : undefined;
          ans.photoAttached = genuineManualPhotos.length > 0;
        }

        // Strip legacy mock AI evaluation fields
        delete ans.hasAiEvaluation;
        delete ans.aiSuggestedRating;
        delete ans.aiSuggestedSelect;
        delete ans.aiSuggestedMultiSelect;
        delete ans.aiSuggestedCarActionPlan;
        delete ans.aiEvidence;
        delete ans.aiReasoning;
        delete ans.aiConfidence;
        delete ans.requiresHumanVerification;
        delete ans.aiSuggestionStatus;

        // If the inspector never manually verified or entered this answer, clear the mock rating too
        if (!ans.isHumanVerified && ans.answeredBy !== 'human') {
          removedMockAnswersCount++;
          continue;
        }
      }

      // Check if any genuine inspector-entered content or real Gemini evaluation remains
      const hasGenuineHumanContent =
        ans.isHumanVerified ||
        ans.answeredBy === 'human' ||
        !!(ans.comment && ans.comment.trim() && !isLegacyMockString(ans.comment)) ||
        !!(ans.selectans && ans.selectans.trim()) ||
        !!(ans.multiselectans && ans.multiselectans.length > 0) ||
        !!(ans.photos && ans.photos.length > 0);

      const hasRealGeminiEval =
        ans.hasAiEvaluation === true &&
        !!ans.aiModel &&
        !ans.aiModel.includes('Pre-Gemini');

      if (hasGenuineHumanContent) {
        preservedHumanAnswersCount++;
        cleanedAnswers[qId] = ans;
      } else if (hasRealGeminiEval) {
        cleanedAnswers[qId] = ans;
      }
    }

    const migrated =
      isPreV3Draft ||
      isLegacyMockRun ||
      removedMockAnswersCount > 0 ||
      removedMockCommentsCount > 0 ||
      removedMockPhotosCount > 0;

    const cleanSummary = isLegacyMockRun ? null : parsed?.aiSummary || null;
    const cleanModelId =
      !isLegacyMockRun && typeof parsed?.aiModelIdentifier === 'string'
        ? parsed.aiModelIdentifier
        : 'gemini-3.8-flash';

    const report: DraftMigrationReport = {
      bankId,
      removedMockAnswersCount,
      removedMockCommentsCount,
      removedMockPhotosCount,
      preservedHumanAnswersCount,
      migratedAt: new Date().toISOString(),
    };

    return {
      answers: cleanedAnswers,
      aiSummary: cleanSummary,
      aiModelIdentifier: cleanModelId,
      isMockEngine: false,
      migrated,
      report,
    };
  }

  public loadDraft(): void {
    const bankId = this.selectedBankId();
    try {
      const raw = localStorage.getItem(`questai_inspection_${bankId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const sanitized = this.sanitizeAndMigrateDraft(bankId, parsed);

        this.formAnswers.set(sanitized.answers);
        if (parsed.metadata) this.inspectionMetadata.set(parsed.metadata);
        if (Array.isArray(parsed.uploadedPhotos)) {
          this.uploadedPhotos.set(parsed.uploadedPhotos);
        } else {
          this.uploadedPhotos.set([]);
        }
        if (parsed.selectedRiskBanks && this.currentBank().isManagers) {
          this.selectedRiskBanks.set(parsed.selectedRiskBanks);
        }
        this.aiPreFillSummary.set(sanitized.aiSummary);
        this.aiModelIdentifier.set(sanitized.aiModelIdentifier);
        this.isMockEngine.set(false);

        if (sanitized.migrated) {
          this.lastDraftMigrationReport.set(sanitized.report);
          this.persistDraftToStorage();
        }
      } else {
        this.formAnswers.set({});
        this.uploadedPhotos.set([]);
        this.aiPreFillSummary.set(null);
      }
    } catch {
      this.formAnswers.set({});
      this.uploadedPhotos.set([]);
      this.aiPreFillSummary.set(null);
    }
  }

  // Reset form
  confirmReset(): void {
    this.showResetModal.set(true);
  }

  doReset(): void {
    this.formAnswers.set({});
    this.aiPreFillSummary.set(null);
    this.pendingOverwriteQuestionId.set(null);
    this.editingQuestionId.set(null);
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

  // Image optimization helper that preserves valid MIME & magic byte alignment
  private async readFileAsOptimizedDataUrl(file: File): Promise<{
    dataUrl: string;
    mimeType: string;
    byteLength: number;
    normalizedName: string;
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const originalMime = (file.type || 'image/jpeg').toLowerCase();
        const safeName = this.ensureSupportedExtension(file.name, originalMime);

        if (!result || !file.type.startsWith('image/')) {
          resolve({
            dataUrl: result,
            mimeType: originalMime,
            byteLength: this.estimateDataUrlBytes(result),
            normalizedName: safeName,
          });
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
              const targetMime = originalMime === 'image/png' ? 'image/png' : 'image/jpeg';
              const optimizedUrl =
                targetMime === 'image/png'
                  ? canvas.toDataURL('image/png')
                  : canvas.toDataURL('image/jpeg', 0.85);
              resolve({
                dataUrl: optimizedUrl,
                mimeType: targetMime,
                byteLength: this.estimateDataUrlBytes(optimizedUrl),
                normalizedName: this.ensureSupportedExtension(file.name, targetMime),
              });
              return;
            }
          }
          resolve({
            dataUrl: result,
            mimeType: originalMime === 'image/jpg' ? 'image/jpeg' : originalMime,
            byteLength: this.estimateDataUrlBytes(result),
            normalizedName: safeName,
          });
        };
        img.onerror = () =>
          resolve({
            dataUrl: result,
            mimeType: originalMime === 'image/jpg' ? 'image/jpeg' : originalMime,
            byteLength: this.estimateDataUrlBytes(result),
            normalizedName: safeName,
          });
        img.src = result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private ensureSupportedExtension(fileName: string, mimeType: string): string {
    const trimmed = (fileName || 'photo.jpg').trim();
    const dotIdx = trimmed.lastIndexOf('.');
    const ext = dotIdx !== -1 ? trimmed.slice(dotIdx).toLowerCase() : '';
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') {
      return trimmed;
    }
    const base = dotIdx !== -1 ? trimmed.slice(0, dotIdx) : trimmed;
    if (mimeType === 'image/png') return `${base}.png`;
    if (mimeType === 'image/webp') return `${base}.webp`;
    return `${base}.jpg`;
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
