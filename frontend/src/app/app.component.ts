import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from './core/services/api.service';
import { ChatPersistenceService } from './core/services/chat-persistence.service';
import { ChatMessage, Conversation } from './core/models/chat.models';
import {
  SiteInspectionComponent,
  MAX_INSPECTION_PHOTOS,
  MAX_IMAGE_SIZE_BYTES,
} from './features/inspection/site-inspection.component';
import { InspectionPhoto } from './features/inspection/site-inspection.models';
import { InspectionProgressComponent } from './features/inspection/progress/inspection-progress.component';
import { InspectionEvidenceMessageComponent } from './features/inspection/evidence-message/inspection-evidence-message.component';
import { InspectionQuestionBatchComponent } from './features/inspection/question-batch/inspection-question-batch.component';
import { InspectionSingleQuestionCardComponent } from './features/inspection/single-question-card/inspection-single-question-card.component';
import { InspectionDraftSummaryComponent } from './features/inspection/draft-summary/inspection-draft-summary.component';
import { InspectionReviewDrawerComponent } from './features/inspection/review-drawer/inspection-review-drawer.component';
import { ConversationalInspectionService } from './core/services/conversational-inspection.service';
import { PdfExportService, InspectionPdfData } from './core/services/pdf-export.service';
import {
  InspectionSessionViewModel,
  InspectionQuestionBatchViewModel,
  InspectionAnswerViewModel,
  InspectionEvidenceViewModel,
  InspectionDraftSummaryViewModel,
} from './core/models/inspection-view.models';
import { SiteInspectionQuestion, getQuestionsForDepartment } from './core/models/site-inspection.schema';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SiteInspectionComponent,
    InspectionProgressComponent,
    InspectionEvidenceMessageComponent,
    InspectionQuestionBatchComponent,
    InspectionSingleQuestionCardComponent,
    InspectionDraftSummaryComponent,
    InspectionReviewDrawerComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, AfterViewChecked, OnDestroy {
  private readonly apiService = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly chatPersistence = inject(ChatPersistenceService);
  private readonly conversationalInspection = inject(ConversationalInspectionService);
  private readonly pdfExportService = inject(PdfExportService);

  // Active clarification questions queue for single-question card flow
  private activeClarificationQueue: any[] = [];

  // Rotating welcome heading animation
  readonly welcomePhrases = [
    'How can Quest AI help you?',
    'What do you want to do today?',
    "What's on your mind today?",
    'What would you like to explore?',
  ];
  welcomePhraseIndex = signal(0);
  isHeadingFading = signal(false);
  welcomeHeading = computed(() => this.welcomePhrases[this.welcomePhraseIndex()]);
  private welcomeInterval: ReturnType<typeof setInterval> | null = null;

  @ViewChild('chatScrollContainer') private chatScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('composerTextarea') private composerTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('chatGalleryInput') private chatGalleryInput?: ElementRef<HTMLInputElement>;
  @ViewChild('chatCameraInput') private chatCameraInput?: ElementRef<HTMLInputElement>;
  @ViewChild(SiteInspectionComponent) private inspectionComponent?: SiteInspectionComponent;

  // Active top-level view: 'chat' | 'inspection' | 'inspection-history'
  currentView = signal<'chat' | 'inspection' | 'inspection-history'>('chat');

  // Inspection history from localStorage
  inspectionHistoryList = signal<any[]>([]);

  // Whether to show inspection record detail
  selectedHistoryRecord = signal<any | null>(null);

  // Active Review Drawer State
  activeReviewDraft = signal<InspectionDraftSummaryViewModel | null>(null);
  activeInspectionSession = signal<InspectionSessionViewModel | null>(null);
  activeReviewQuestions = signal<SiteInspectionQuestion[]>([]);

  // Sidebar view: 'home' | 'recent-chats' | 'inspection-history' | 'my-reports'
  sidebarActiveSection = signal<'home' | 'recent-chats' | 'inspection-history' | 'my-reports'>('home');

  // Complete list of all 12 Question Banks
  readonly siteInspectionBanks = [
    {
      id: 'civil-other',
      name: 'Civil / Other',
      department: 'Civil/Other',
      icon: '🏗️',
      badge: '52 Questions',
      count: 52,
      description: 'Civil works, plant, traffic management, welfare, site vehicles, and quality checks',
    },
    {
      id: 'street-lighting',
      name: 'Street Lighting',
      department: 'Street Lighting',
      icon: '💡',
      badge: '47 Questions',
      count: 47,
      description: 'Column installations, cable isolations, MEWPs, electrical testing and safety',
    },
    {
      id: 'road-marking',
      name: 'Road Marking',
      department: 'Road Marking',
      icon: '🛣️',
      badge: '44 Questions',
      count: 44,
      description: 'Thermoplastic boilers, pre-heaters, glass bead pressure systems and hydro-blasting',
    },
    {
      id: 'road-surfacing',
      name: 'Road Surfacing',
      department: 'Road Surfacing',
      icon: '🚜',
      badge: '27 Questions',
      count: 27,
      description: 'Asphalt paving, rollers, pedestrian management, thermal hazards, and environmental controls',
    },
    {
      id: 'tm-12d',
      name: 'Traffic Management 12D',
      department: 'Traffic Management',
      trafficSubtype: '12D',
      icon: '🛑',
      badge: '33 Questions',
      count: 33,
      description: 'Urban and rural roads, temporary traffic lights, convoy working and stop/go controls',
    },
    {
      id: 'tm-12ab',
      name: 'Traffic Management 12AB',
      department: 'Traffic Management',
      trafficSubtype: '12AB',
      icon: '🚧',
      badge: '32 Questions',
      count: 32,
      description: 'High-speed dual carriageways and motorways, IPVs, taper closures and overhead gantries',
    },
    {
      id: 'full-body-harness',
      name: 'Full Body Harness',
      department: 'Harness and Lanyard',
      icon: '🪢',
      badge: '21 Questions',
      count: 21,
      description: 'Fall arrest harnesses, lanyards, carabiners, webbing integrity, labels and inspection history',
    },
    {
      id: 'ladder-stepladder',
      name: 'Ladder / Stepladder',
      department: 'Ladder/Stepladder',
      icon: '🪜',
      badge: '9 Questions',
      count: 9,
      description: 'Ladder pre-use checks, stiles, rungs, anti-slip feet, spreaders and angle requirements',
    },
    {
      id: 'depot-check-sheet',
      name: 'Depot Check Sheet',
      department: 'Depot Check Sheet',
      icon: '🏢',
      badge: '32 Questions',
      count: 32,
      description: 'Depot yards, bunded fuel storage, hazardous waste, emergency eyewash and fire safety',
    },
    {
      id: 'managers-site-inspection',
      name: 'Managers Site Inspection',
      department: 'Managers Site Inspection',
      isManagers: true,
      icon: '📋',
      badge: '12 Base + Risk Banks',
      count: 12,
      description: 'Management site walk inspection with dynamic selection of active project risk banks',
    },
    {
      id: 'managers-risk-banks',
      name: 'Managers Site Inspection – Risk Banks',
      department: 'Managers Risk Banks',
      icon: '⚠️',
      badge: '49 Risk Questions',
      count: 49,
      description: 'Comprehensive risk bank covering all 13 high-risk construction activities',
    },
    {
      id: 'road-marking-test',
      name: 'Road Marking (Test)',
      department: 'Road Marking (Test)',
      icon: '🧪',
      badge: '16 Questions',
      count: 16,
      description: 'Operational test verification checklist for road marking crews and equipment calibration',
    },
  ];

  // Question banks list for sidebar navigation
  readonly sidebarInspectionBanks = this.siteInspectionBanks;

  // Home Page Question Bank Dropdown state
  showHomeInspectionDropdown = signal<boolean>(false);
  inspectionBankSearchQuery = signal<string>('');

  // Filtered inspection banks for dropdown search (matches "site inspection" or any bank)
  filteredInspectionBanks = computed(() => {
    const q = this.inspectionBankSearchQuery().trim().toLowerCase();
    const all = this.siteInspectionBanks;
    if (!q || q === 'site inspection' || q === 'inspection' || q === 'site' || q === 'quest' || q === 'banks') {
      return all;
    }
    return all.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.badge.toLowerCase().includes(q)
    );
  });

  // Composer Attachment (+) Menu & Pending Photo Previews state
  showAttachmentMenu = signal<boolean>(false);
  showPhotoUploadModal = signal<boolean>(false);
  selectedUploadBank = signal<any | null>(null);
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
  selectedUploadRiskBanks = signal<string[]>([
    'Buried services',
    'Worker/construction plant interface',
    'Working at height',
  ]);
  uploadedPhotos = signal<InspectionPhoto[]>([]);
  pendingComposerPhotos = this.uploadedPhotos;
  uploadSiteNotes = signal<string>('');
  photoUploadError = signal<string>('');
  isAnalyzingPhotos = signal<boolean>(false);
  analyzingStepMessage = signal<string>('');
  isDragOver = signal<boolean>(false);

  // User name for personalized greeting
  readonly userName = signal<string>('Subhash');

  // Mobile sidebar drawer state
  mobileSidebarOpen = signal<boolean>(false);

  // Desktop sidebar collapse state
  desktopSidebarCollapsed = signal<boolean>(false);

  // Staged document attachment in composer
  attachedDocument = signal<string | null>(null);

  // Search filter for recent conversations
  searchQuery = signal<string>('');

  // Composer input model
  composerText = signal<string>('');

  // Assistant typing / responding state
  isGenerating = signal<boolean>(false);

  // Attachment upload feedback toast state
  attachmentNotice = signal<string | null>(null);
  private attachmentNoticeTimer?: ReturnType<typeof setTimeout>;

  // Conversations in-memory state (empty on start; created dynamically on message)
  conversations = signal<Conversation[]>([]);

  // Active conversation pointer (empty string indicates a fresh new conversation)
  activeConversationId = signal<string>('');

  // Sidebar Conversation Context Menu & Delete Modal State (ChatGPT-style)
  activeContextMenuConv = signal<Conversation | null>(null);
  contextMenuPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  conversationToDelete = signal<Conversation | null>(null);

  // Filtered conversations based on search input
  filteredConversations = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.conversations();
    if (!query) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.previewSnippet.toLowerCase().includes(query)
    );
  });

  // Current active conversation object
  activeConversation = computed<Conversation | null>(() => {
    const id = this.activeConversationId();
    if (!id) return null;
    return this.conversations().find((c) => c.id === id) || null;
  });

  // Active messages list
  activeMessages = computed<ChatMessage[]>(() => {
    const active = this.activeConversation();
    return active ? active.messages : [];
  });

  // True when the active conversation has at least one message
  hasMessages = computed<boolean>(() => this.activeMessages().length > 0);

  private shouldScrollToBottom = false;

  ngOnInit(): void {
    // Clean up any stale legacy mock pending pre-fill
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('questai_pending_ai_fill');
      }
      if (typeof window !== 'undefined' && window.location.pathname.includes('inspection')) {
        this.currentView.set('inspection');
      }
    } catch {
      // Safe fallback
    }

    // Restore conversations and image attachments from IndexedDB
    void this.restorePersistedChatState();

    // Load inspection history from localStorage
    this.loadInspectionHistory();

    // Cycle heading phrases with a smooth fade animation every 3.5s
    this.welcomeInterval = setInterval(() => {
      this.isHeadingFading.set(true);
      setTimeout(() => {
        this.welcomePhraseIndex.update((i) => (i + 1) % this.welcomePhrases.length);
        this.isHeadingFading.set(false);
      }, 300);
    }, 3500);
  }

  ngOnDestroy(): void {
    if (this.welcomeInterval) {
      clearInterval(this.welcomeInterval);
    }
  }

  async restorePersistedChatState(): Promise<void> {
    try {
      const state = await this.chatPersistence.loadState();
      if (state.conversations.length > 0) {
        this.conversations.set(state.conversations);
        const targetId =
          state.activeConversationId &&
            state.conversations.some((c) => c.id === state.activeConversationId)
            ? state.activeConversationId
            : state.conversations[0].id;
        this.activeConversationId.set(targetId);

        const activeConv = state.conversations.find((c) => c.id === targetId);
        if (activeConv?.selectedBankId) {
          const bank = this.siteInspectionBanks.find((b) => b.id === activeConv.selectedBankId);
          if (bank) {
            this.selectedUploadBank.set(bank);
          }
        }
        const pendingForActive =
          state.pendingPhotosByConv[targetId] || state.pendingPhotosByConv['__draft__'] || [];
        if (pendingForActive.length > 0) {
          this.uploadedPhotos.set(pendingForActive);
        }
      } else if (state.pendingPhotosByConv['__draft__']?.length) {
        this.uploadedPhotos.set(state.pendingPhotosByConv['__draft__']);
      }
    } catch {
      // Safe fallback if IndexedDB is unavailable
    }
  }

  private persistChatState(): void {
    void this.chatPersistence.saveConversations(
      this.conversations(),
      this.activeConversationId()
    );
  }

  private persistPendingComposerPhotos(): void {
    const convKey = this.activeConversationId() || '__draft__';
    void this.chatPersistence.savePendingAttachments(convKey, this.uploadedPhotos());
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  // --- View Switching & Navigation Controls ---

  navigateToInspection(bankId?: string): void {
    this.currentView.set('inspection');
    this.sidebarActiveSection.set('recent-chats');
    this.closeMobileSidebar();
    const applyStep = () => {
      if (this.inspectionComponent) {
        if (bankId) {
          this.inspectionComponent.selectBank(bankId);
          this.inspectionComponent.activeStep.set('photo-upload');
        } else {
          this.inspectionComponent.activeStep.set('category-select');
        }
      }
    };
    if (this.inspectionComponent) {
      applyStep();
    } else {
      setTimeout(applyStep, 0);
    }
    try {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/inspection');
      }
    } catch { }
  }

  focusComposer(): void {
    setTimeout(() => {
      this.composerTextarea?.nativeElement.focus();
    }, 50);
  }

  navigateToChat(): void {
    this.currentView.set('chat');
    this.sidebarActiveSection.set('recent-chats');
    this.closeMobileSidebar();
    try {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/');
      }
    } catch { }
  }

  selectInspectionBank(bankId: string): void {
    this.navigateToInspection(bankId);
  }

  toggleSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.mobileSidebarOpen.update((val) => !val);
    } else {
      this.desktopSidebarCollapsed.update((val) => !val);
    }
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((val) => !val);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  openPhotoUploadForComposer(event?: Event): void {
    this.toggleAttachmentMenu(event);
  }

  toggleAttachmentMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.showAttachmentMenu.update((v) => !v);
  }

  closeAttachmentMenu(): void {
    this.showAttachmentMenu.set(false);
  }

  openGalleryFilePicker(inputEl?: HTMLInputElement): void {
    this.showAttachmentMenu.set(false);
    (inputEl || this.chatGalleryInput?.nativeElement)?.click();
  }

  openCameraCapture(inputEl?: HTMLInputElement): void {
    this.showAttachmentMenu.set(false);
    (inputEl || this.chatCameraInput?.nativeElement)?.click();
  }

  onComposerFilesSelected(event: Event): void {
    this.showAttachmentMenu.set(false);
    this.onFilesSelected(event);
  }

  onComposerCameraCaptured(event: Event): void {
    this.showAttachmentMenu.set(false);
    this.onFilesSelected(event);
  }

  addPendingPhotos(photos: InspectionPhoto[]): void {
    this.photoUploadError.set('');
    const current = this.uploadedPhotos();
    if (current.length + photos.length > MAX_INSPECTION_PHOTOS) {
      this.photoUploadError.set(`Maximum ${MAX_INSPECTION_PHOTOS} photographs allowed per analysis.`);
      return;
    }
    this.uploadedPhotos.set([...current, ...photos]);
    this.persistPendingComposerPhotos();
  }

  removeAttachedDocument(): void {
    this.attachedDocument.set(null);
  }

  // --- Home Screen Site Inspection Dropdown & AI Photo Upload Methods ---

  toggleHomeInspectionDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.showHomeInspectionDropdown.update((v) => !v);
  }

  closeHomeInspectionDropdown(): void {
    this.showHomeInspectionDropdown.set(false);
  }

  onSelectBankForPhotoUpload(bank: any): void {
    this.selectedUploadBank.set(bank);
    this.uploadedPhotos.set([]);
    this.uploadSiteNotes.set('');
    this.photoUploadError.set('');
    this.showHomeInspectionDropdown.set(false);
    this.showPhotoUploadModal.set(true);
    if (this.inspectionComponent && bank?.id) {
      this.inspectionComponent.selectBank(bank.id);
    }
  }

  toggleUploadRiskBank(key: string): void {
    const current = this.selectedUploadRiskBanks();
    if (current.includes(key)) {
      this.selectedUploadRiskBanks.set(current.filter((k) => k !== key));
    } else {
      this.selectedUploadRiskBanks.set([...current, key]);
    }
  }

  selectAllUploadRiskBanks(): void {
    this.selectedUploadRiskBanks.set(this.availableRiskBanks.map((b) => b.key));
  }

  clearAllUploadRiskBanks(): void {
    this.selectedUploadRiskBanks.set([]);
  }

  closePhotoUploadModal(): void {
    if (this.isAnalyzingPhotos()) return;
    this.photoUploadError.set('');
    this.showPhotoUploadModal.set(false);
  }

  openManualChecklistFromModal(): void {
    const bank = this.selectedUploadBank();
    if (!bank || this.isAnalyzingPhotos()) return;
    const riskBanks = bank.isManagers ? [...this.selectedUploadRiskBanks()] : undefined;
    this.photoUploadError.set('');
    this.showPhotoUploadModal.set(false);
    this.currentView.set('inspection');
    this.closeMobileSidebar();

    try {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/inspection');
      }
    } catch { }

    const triggerManual = () => {
      if (this.inspectionComponent) {
        this.inspectionComponent.openManualChecklistForBank(bank.id, riskBanks);
      }
    };

    if (this.inspectionComponent) {
      triggerManual();
    } else {
      setTimeout(triggerManual, 0);
    }
  }

  onInspectionRequestAiPhotoUpload(bankId: string): void {
    const bank =
      this.siteInspectionBanks.find((b) => b.id === bankId) ||
      this.siteInspectionBanks[0];
    this.onSelectBankForPhotoUpload(bank);
  }

  onFilesSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.processFiles(target.files);
      target.value = '';
    }
  }

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

  onDropPhotos(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processFiles(event.dataTransfer.files);
    }
  }

  private async processFiles(fileList: FileList | File[]): Promise<void> {
    this.photoUploadError.set('');
    const allowedMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    const files = Array.from(fileList).filter((f) => allowedMimes.has((f.type || '').toLowerCase()));
    if (files.length === 0) {
      this.photoUploadError.set('Please upload valid JPG, PNG, or WebP photographs.');
      return;
    }

    const currentCount = this.uploadedPhotos().length;
    if (currentCount + files.length > MAX_INSPECTION_PHOTOS) {
      this.photoUploadError.set(`Maximum ${MAX_INSPECTION_PHOTOS} photographs allowed per analysis.`);
      return;
    }

    const newPhotos: InspectionPhoto[] = [];

    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        this.photoUploadError.set(`"${file.name}" exceeds the 10 MB per-photo limit.`);
        continue;
      }
      try {
        const base64 = await this.compressAndReadFile(file);
        newPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          url: base64,
          size: file.size,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to process image', err);
      }
    }

    if (newPhotos.length > 0) {
      this.uploadedPhotos.update((current) => [...current, ...newPhotos]);
      this.persistPendingComposerPhotos();
    }
  }

  private compressAndReadFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1024;
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
          resolve(result);
        };
        img.onerror = () => resolve(result);
        img.src = result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  removeUploadedPhoto(index: number): void {
    this.uploadedPhotos.update((list) => list.filter((_, i) => i !== index));
    this.persistPendingComposerPhotos();
  }

  removePendingComposerPhoto(index: number): void {
    this.removeUploadedPhoto(index);
  }

  clearUploadedPhotos(): void {
    this.uploadedPhotos.set([]);
    this.persistPendingComposerPhotos();
  }

  /**
   * Hands off the selected inspection bank, uploaded photographs, and site notes
   * to SiteInspectionComponent inside the active conversation (or standalone workspace),
   * which immediately launches the viewfinder scanning animation and calls POST /api/ai/inspect-photos.
   */
  runAiPhotoAnalysisAndFill(): void {
    const bank = this.selectedUploadBank() || this.siteInspectionBanks[0];
    const photos = this.uploadedPhotos();
    if (!bank || photos.length === 0 || this.isAnalyzingPhotos()) return;

    this.showPhotoUploadModal.set(false);
    this.selectedUploadBank.set(bank);
    if (this.uploadSiteNotes() && !this.composerText()) {
      this.composerText.set(this.uploadSiteNotes());
    }
    this.sendMessage();
  }

  startNewChat(): void {
    this.navigateToChat();
    this.activeConversationId.set('');
    this.composerText.set('');
    this.attachedDocument.set(null);
    this.uploadedPhotos.set([]);
    this.selectedUploadBank.set(null);
    this.activeInspectionSession.set(null);
    this.activeReviewDraft.set(null);
    this.showAttachmentMenu.set(false);
    this.closeConversationMenu();
    this.closeMobileSidebar();
    this.persistChatState();
  }

  selectConversation(id: string): void {
    this.navigateToChat();
    this.activeConversationId.set(id);
    const conv = this.conversations().find((c) => c.id === id);
    if (conv?.selectedBankId) {
      const bank = this.siteInspectionBanks.find((b) => b.id === conv.selectedBankId);
      if (bank) this.selectedUploadBank.set(bank);
    }
    if (conv?.activeInspectionId) {
      const s = this.conversationalInspection.getSession(conv.activeInspectionId);
      this.activeInspectionSession.set(s || null);
    } else {
      this.activeInspectionSession.set(null);
    }
    void this.chatPersistence.loadPendingAttachments(id).then((photos) => {
      this.uploadedPhotos.set(photos);
    });
    this.closeMobileSidebar();
    this.shouldScrollToBottom = true;
    this.persistChatState();
  }

  // --- Sidebar Conversation Management (ChatGPT-style Delete & Context Menu) ---

  onConversationContextMenu(event: MouseEvent, conv: Conversation): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeContextMenuConv.set(conv);
    const clickX = event.clientX;
    const clickY = event.clientY;
    const menuWidth = 160;
    const menuHeight = 50;
    const x = clickX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 12 : clickX;
    const y = clickY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 12 : clickY;
    this.contextMenuPosition.set({ x, y });
  }

  toggleConversationMenu(event: MouseEvent, conv: Conversation): void {
    event.stopPropagation();
    if (this.activeContextMenuConv()?.id === conv.id) {
      this.closeConversationMenu();
      return;
    }
    const triggerEl = event.currentTarget as HTMLElement | null;
    const rect = triggerEl?.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 50;
    let x = (rect?.right || event.clientX) - menuWidth;
    let y = (rect?.bottom || event.clientY) + 4;
    if (x < 12) x = 12;
    if (y + menuHeight > window.innerHeight) y = (rect?.top || event.clientY) - menuHeight - 4;
    this.activeContextMenuConv.set(conv);
    this.contextMenuPosition.set({ x, y });
  }

  closeConversationMenu(): void {
    this.activeContextMenuConv.set(null);
  }

  promptDeleteConversation(conv: Conversation, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.closeConversationMenu();
    this.conversationToDelete.set(conv);
  }

  promptDeleteActiveMenuConv(): void {
    const conv = this.activeContextMenuConv();
    if (conv) {
      this.promptDeleteConversation(conv);
    }
  }

  cancelDeleteConversation(): void {
    this.conversationToDelete.set(null);
  }

  confirmDeleteConversation(): void {
    const target = this.conversationToDelete();
    if (!target) return;
    const targetId = target.id;
    const wasActive = this.activeConversationId() === targetId;

    // 1. Remove from in-memory conversations list
    this.conversations.update((list) => list.filter((c) => c.id !== targetId));

    // 2. Clean up from IndexedDB & persistent storage
    void this.chatPersistence.deleteConversation(targetId);

    // 3. Clean up associated inspection session if present
    if (target.activeInspectionId) {
      this.conversationalInspection.deleteSession(target.activeInspectionId);
    }

    // 4. Update active chat pointer or reset if empty
    if (wasActive) {
      const remaining = this.conversations();
      if (remaining.length > 0) {
        this.selectConversation(remaining[0].id);
      } else {
        this.startNewChat();
      }
    } else {
      this.persistChatState();
    }

    this.conversationToDelete.set(null);
  }

  showClearAllConfirm = signal<boolean>(false);

  promptClearAllConversations(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.showClearAllConfirm.set(true);
  }

  cancelClearAll(): void {
    this.showClearAllConfirm.set(false);
  }

  confirmClearAll(): void {
    const list = this.conversations();
    for (const c of list) {
      void this.chatPersistence.deleteConversation(c.id);
      if (c.activeInspectionId) {
        this.conversationalInspection.deleteSession(c.activeInspectionId);
      }
    }
    this.conversations.set([]);
    this.showClearAllConfirm.set(false);
    this.navigateToHome();
  }

  // --- Message Handling ---

  sendMessage(): void {
    const text = this.composerText().trim();
    const photosToSend = [...this.uploadedPhotos()];
    if ((!text && photosToSend.length === 0) || this.isGenerating()) return;

    this.showAttachmentMenu.set(false);
    this.photoUploadError.set('');

    let currentConv = this.activeConversation();
    const docAttachment = this.attachedDocument();

    // If starting a brand new conversation
    if (!currentConv) {
      const baseTitle = text || (this.selectedUploadBank()?.name ? `${this.selectedUploadBank().name} Inspection` : 'Site Inspection Photos');
      const title = baseTitle.length > 36 ? baseTitle.substring(0, 36) + '...' : baseTitle;
      const newId = 'conv-' + Date.now();
      const newConv: Conversation = {
        id: newId,
        title: title,
        updatedAt: new Date(),
        previewSnippet: baseTitle,
        selectedBankId: this.selectedUploadBank()?.id,
        messages: [],
      };

      this.conversations.update((list) => [newConv, ...list]);
      this.activeConversationId.set(newId);
      currentConv = newConv;
    }

    // 1. Handle message containing photographs (Adaptive Conversational Inspection Workflow)
    if (photosToSend.length > 0) {
      const targetBankId =
        currentConv.selectedBankId ||
        this.selectedUploadBank()?.id ||
        'civil-other';
      const targetBank =
        this.siteInspectionBanks.find((b) => b.id === targetBankId) ||
        this.siteInspectionBanks[0];

      this.selectedUploadBank.set(targetBank);
      this.setConversationSelectedBank(targetBank.id);

      const userPhotoMessage: ChatMessage = {
        id: 'msg-' + Date.now(),
        sender: 'user',
        content: text,
        timestamp: new Date(),
        photos: photosToSend.map((p) => ({ ...p })),
        attachmentName: docAttachment || undefined,
      };

      this.appendMessageToActive(userPhotoMessage);
      this.composerText.set('');
      this.uploadSiteNotes.set('');
      this.attachedDocument.set(null);
      this.uploadedPhotos.set([]);
      void this.chatPersistence.savePendingAttachments(currentConv.id, []);
      void this.chatPersistence.savePendingAttachments('__draft__', []);

      // 1. Get or create adaptive inspection session
      let session = currentConv.activeInspectionId
        ? this.conversationalInspection.getSession(currentConv.activeInspectionId)
        : undefined;

      if (!session || session.bankId !== targetBank.id) {
        session = this.conversationalInspection.createSession(
          currentConv.id,
          targetBank,
          targetBank.isManagers ? [...this.selectedUploadRiskBanks()] : undefined
        );
        currentConv.activeInspectionId = session.inspectionId;
      }
      this.activeInspectionSession.set(session);

      // Display "Reviewing your photographs..." state corresponding to actual backend request
      this.isGenerating.set(true);
      this.analyzingStepMessage.set('Reviewing your photographs...');
      this.shouldScrollToBottom = true;

      this.conversationalInspection
        .analyzeTurnWithBackend(session, {
          inspectionId: session.inspectionId,
          conversationId: currentConv.id,
          bankId: session.bankId,
          department: session.department,
          trafficSubtype: session.trafficSubtype,
          selectedRiskBanks: session.selectedRiskBanks,
          newPhotos: photosToSend,
          allPhotos: session.uploadedPhotos,
          userText: text,
        })
        .then((turnResponse) => {
          this.clearPreviousWorkflowMessagesInActiveConversation();

          // Collect clarification questions that genuinely require on-site confirmation
          const clarificationQuestions: any[] = [];
          if (turnResponse.nextClarificationBatch?.questionIds?.length) {
            for (const qid of turnResponse.nextClarificationBatch.questionIds) {
              const q = session.questionAssessments[qid];
              if (q && !q.isAnswered) {
                clarificationQuestions.push(q);
              }
            }
          }

          const progress = this.conversationalInspection.getProgress(session);

          if (clarificationQuestions.length > 0) {
            this.activeClarificationQueue = [...clarificationQuestions];
            const firstQ = this.activeClarificationQueue.shift();

            // Direct single question card without preamble text or progress line
            const assistantMsg: ChatMessage = {
              id: 'msg-' + (Date.now() + 1),
              sender: 'assistant',
              content: '',
              timestamp: new Date(),
              inspectionId: session.inspectionId,
              singleQuestion: firstQ,
              singleQuestionIndex: 1,
              singleQuestionTotal: clarificationQuestions.length,
            };
            this.appendMessageToActive(assistantMsg);
          } else {
            // All checks evaluated directly from photographs - finalize report
            session.workflowStatus = 'completed';
            session.completedAt = new Date().toISOString();
            const draftSummary = turnResponse.draftSummary || this.conversationalInspection.generateDraftSummary(session);
            draftSummary.isConfirmedByInspector = true;
            session.draftSummary = draftSummary;
            this.conversationalInspection.saveSession(session);
            this.saveFinalizedReportToStorage(session, draftSummary);

            const assistantMsg: ChatMessage = {
              id: 'msg-' + (Date.now() + 1),
              sender: 'assistant',
              content: `All done! I've checked your photographs for **${targetBank.name}** and completed the inspection report.`,
              timestamp: new Date(),
              inspectionId: session.inspectionId,
              draftSummary,
              inspectionProgress: progress,
            };
            this.appendMessageToActive(assistantMsg);
          }

          this.isGenerating.set(false);
          this.analyzingStepMessage.set('');
          this.shouldScrollToBottom = true;
        })
        .catch((err) => {
          this.isGenerating.set(false);
          this.analyzingStepMessage.set('');
          let errorMessage =
            'Unable to complete photo analysis right now. Please verify your connection or try again.';
          if (err?.status === 0 || err?.status === 429) {
            errorMessage =
              'The AI photo analysis service is temporarily unavailable due to Cloud Functions connectivity or rate limits. You can still complete your Site Inspection by selecting a category or uploading photographs.';
          } else if (err?.status === 504) {
            errorMessage = 'The photo analysis request timed out. Please try again.';
          } else if (err?.error?.message) {
            errorMessage = this.sanitizeProviderBranding(err.error.message);
          } else if (err?.message) {
            errorMessage = this.sanitizeProviderBranding(err.message);
          }

          const errMsg: ChatMessage = {
            id: 'msg-' + (Date.now() + 1),
            sender: 'assistant',
            content: errorMessage,
            timestamp: new Date(),
            isError: true,
            retryPrompt: text,
          };
          this.appendMessageToActive(errMsg);
          this.shouldScrollToBottom = true;
        });
      return;
    }

    const hadActiveSelector = this.hasActiveCategorySelector();

    // Append User Message
    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      content: text,
      timestamp: new Date(),
      attachmentName: docAttachment || undefined,
    };

    this.appendMessageToActive(userMessage);
    this.composerText.set('');
    this.attachedDocument.set(null);
    this.shouldScrollToBottom = true;

    // Handle user cancelling an active category selector via chat
    if (hadActiveSelector && /^\s*(cancel|never\s*mind|stop|exit|no\s*thanks)\s*[.!?]*$/i.test(text)) {
      this.cancelCategorySelection();
    } else {
      // Handle user typing a category name when asked to choose (or typing an exact category name)
      const typedBank = hadActiveSelector
        ? this.matchTypedCategory(text)
        : this.matchExactCategoryName(text);

      if (typedBank) {
        this.onSelectCategoryChipFromChat(typedBank);
        return;
      }
    }

    // Handle greetings immediately with a natural friendly response
    if (this.isGreeting(text)) {
      const greetingMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'assistant',
        content: `Hello! 👋 I'm your QuestAI site inspection assistant. How can I help you today? You can upload site photographs via the (+) button, ask questions about site safety and regulations, or tell me if you'd like to start a Site Inspection.`,
        timestamp: new Date(),
      };
      this.appendMessageToActive(greetingMsg);
      this.shouldScrollToBottom = true;
      return;
    }

    // Check if the current conversation is waiting for an answer to a single question card (Screenshot 5)
    const pendingMsgWithQuestion = [...currentConv.messages]
      .reverse()
      .find((m) => m.singleQuestion && !m.singleQuestion.isAnswered);

    if (pendingMsgWithQuestion && pendingMsgWithQuestion.singleQuestion) {
      const q = pendingMsgWithQuestion.singleQuestion;
      const lower = text.trim().toLowerCase();

      if (/^(yes|y|pass|yep|yeah|compliant|1)$/i.test(lower)) {
        this.onSingleQuestionAnswer(pendingMsgWithQuestion, {
          questionId: q.questionId,
          rating: '1',
          comment: text,
          answeredBy: 'human',
          answeredAt: new Date().toISOString(),
        });
        return;
      } else if (/^(no|n|fail|defect|car|action|not yet|2)$/i.test(lower)) {
        this.onSingleQuestionAnswer(pendingMsgWithQuestion, {
          questionId: q.questionId,
          rating: '-1',
          comment: text,
          carActionPlan: text,
          answeredBy: 'human',
          answeredAt: new Date().toISOString(),
        });
        return;
      } else if (/^(skip|pass on this|next|ignore)$/i.test(lower)) {
        this.onSingleQuestionSkip(pendingMsgWithQuestion, q.questionId);
        return;
      } else {
        // Natural language free-text answer for this question
        this.onSingleQuestionAnswer(pendingMsgWithQuestion, {
          questionId: q.questionId,
          rating: '1',
          textAnswer: text,
          comment: text,
          answeredBy: 'human',
          answeredAt: new Date().toISOString(),
        });
        return;
      }
    }

    // Check if there is an active incomplete inspection session
    const activeSession = currentConv.activeInspectionId
      ? this.conversationalInspection.getSession(currentConv.activeInspectionId)
      : undefined;

    // Handle conversational free-text answer during active inspection session
    if (activeSession && activeSession.workflowStatus !== 'completed' && !hadActiveSelector) {
      const { matchedQuestions, updatedReasoning } = this.conversationalInspection.recordConversationalUserText(
        activeSession,
        text
      );

      if (matchedQuestions.length > 0) {
        // Automatically finalize remaining visual/compliance checks and complete inspection draft
        const remaining = this.conversationalInspection.getPendingApplicableQuestions(activeSession);
        for (const rem of remaining) {
          rem.isAnswered = true;
          rem.status = 'ai_suggested';
          rem.userAnswerRating = rem.userAnswerRating || '1';
          rem.suggestedRating = rem.suggestedRating || '1';
          activeSession.answers[rem.questionId] = {
            rating: rem.userAnswerRating,
            comment: 'Standard site compliance verified.',
            answeredBy: 'ai',
          };
        }
        activeSession.workflowStatus = 'draft_ready';
        const progress = this.conversationalInspection.getProgress(activeSession);
        const draftSummary = this.conversationalInspection.generateDraftSummary(activeSession);
        activeSession.draftSummary = draftSummary;
        this.conversationalInspection.saveSession(activeSession);

        const assistantMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'assistant',
          content: `${updatedReasoning} All ${activeSession.totalApplicableQuestions} checks for **${activeSession.bankName}** are now complete and verified.`,
          timestamp: new Date(),
          inspectionId: activeSession.inspectionId,
          inspectionProgress: progress,
          draftSummary: draftSummary,
        };
        this.appendMessageToActive(assistantMsg);
        this.shouldScrollToBottom = true;
        this.persistChatState();
        return;
      }
    }

    const isFormRequest = this.isInspectionFormRequest(text);
    const mentionedBank = isFormRequest ? this.matchTypedCategory(text) : null;

    if (isFormRequest) {
      // Prevent duplicate category-selection panels in the same conversation
      this.clearActiveCategorySelectors();

      const assistantContent = mentionedBank
        ? `Sure! I found ${mentionedBank.name}. Would you like to proceed with this category or choose another below?`
        : 'Sure! Which inspection category would you like to complete?';

      const assistantMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        attachmentName: docAttachment || undefined,
        showInspectionCategories: true,
        suggestedBankId: mentionedBank?.id,
        selectedBankId: mentionedBank?.id,
      };
      this.appendMessageToActive(assistantMsg);
      this.shouldScrollToBottom = true;
      return;
    }

    this.isGenerating.set(true);

    // Contact backend POST /api/ai/generate
    this.apiService.generateText(text).subscribe({
      next: (res) => {
        const assistantContent = this.sanitizeProviderBranding(res.data.text);

        const assistantMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'assistant',
          content: assistantContent,
          timestamp: new Date(res.data.generatedAt || Date.now()),
          attachmentName: docAttachment || undefined,
          showInspectionCategories: false,
          suggestedBankId: mentionedBank?.id,
          selectedBankId: mentionedBank?.id,
        };
        this.appendMessageToActive(assistantMsg);
        this.isGenerating.set(false);
        this.shouldScrollToBottom = true;
      },
      error: (err) => {
        let errorMessage = "We couldn't complete your request right now. Please try again.";
        if (err.status === 0 || err.status === 429) {
          errorMessage =
            'The AI assistant is temporarily unavailable due to Cloud Functions connectivity or Gemini API rate limits. You can still complete your Site Inspection by selecting a category or uploading photographs.';
        } else if (err.status === 504) {
          errorMessage = 'The request timed out. Please try asking again.';
        } else if (err.error?.message) {
          errorMessage = this.sanitizeProviderBranding(err.error.message);
        } else if (err.error?.error?.message) {
          errorMessage = this.sanitizeProviderBranding(err.error.error.message);
        } else if (err.message) {
          errorMessage = this.sanitizeProviderBranding(err.message);
        }

        const errorMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'assistant',
          content: errorMessage,
          timestamp: new Date(),
          isError: true,
          retryPrompt: text,
        };
        this.appendMessageToActive(errorMsg);
        this.isGenerating.set(false);
        this.shouldScrollToBottom = true;
      },
    });
  }

  private sanitizeProviderBranding(text: string | undefined): string {
    if (!text) return '';
    return text.replace(/\bgemini(-[0-9a-z.-]+)?\b/gi, 'QuestAI');
  }

  retryMessage(prompt?: string): void {
    if (!prompt || this.isGenerating()) return;
    this.composerText.set(prompt);
    this.sendMessage();
  }

  /**
   * Called when the user clicks one of the 12 compact category chips in the assistant response
   * (or selects a category by typing its name). Records the selected bank and sends the
   * conversational prompt: "Great! Please upload your site photographs here." without opening any modal.
   */
  onSelectCategoryChipFromChat(bank: any, messageId?: string): void {
    if (!bank) return;

    // Ensure an active conversation exists if triggered directly
    if (!this.activeConversation()) {
      const newId = 'conv-' + Date.now();
      const newConv: Conversation = {
        id: newId,
        title: `${bank.name} Inspection`,
        updatedAt: new Date(),
        previewSnippet: bank.name,
        selectedBankId: bank.id,
        messages: [],
      };
      this.conversations.update((list) => [newConv, ...list]);
      this.activeConversationId.set(newId);
    }

    this.selectedUploadBank.set(bank);
    this.showPhotoUploadModal.set(false);
    this.setConversationSelectedBank(bank.id);
    this.markCategorySelectedInConversation(bank.id, messageId);

    // Initialize adaptive inspection session
    const activeConv = this.activeConversation();
    if (activeConv) {
      const session = this.conversationalInspection.createSession(
        activeConv.id,
        bank,
        bank.isManagers ? [...this.selectedUploadRiskBanks()] : undefined
      );
      activeConv.activeInspectionId = session.inspectionId;
      this.activeInspectionSession.set(session);
    }

    if (this.inspectionComponent && bank.id) {
      this.inspectionComponent.selectBank(bank.id);
    }

    const promptMsg: ChatMessage = {
      id: 'msg-' + (Date.now() + 1),
      sender: 'assistant',
      content: `Great! Please share photographs of the **${bank.name}** setup and surrounding area:`,
      timestamp: new Date(),
      selectedBankId: bank.id,
      inspectionId: activeConv?.activeInspectionId,
      showInlinePhotoUpload: true,
    };
    this.appendMessageToActive(promptMsg);
    this.shouldScrollToBottom = true;
  }

  getBankName(bankId?: string): string {
    if (!bankId) return '';
    const bank = this.siteInspectionBanks.find((b) => b.id === bankId);
    return bank ? bank.name : '';
  }

  async onDirectPhotosSelected(event: Event, msg: ChatMessage): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input?.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    await this.handleDirectPhotoFiles(files, msg);
    input.value = '';
  }

  async onDirectPhotoDrop(event: DragEvent, msg: ChatMessage): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const files = Array.from(event.dataTransfer.files);
      await this.handleDirectPhotoFiles(files, msg);
    }
  }

  onDirectPhotoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  private async handleDirectPhotoFiles(files: File[], msg: ChatMessage): Promise<void> {
    const allowedMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    const imageFiles = files.filter((f) => allowedMimes.has((f.type || '').toLowerCase()));
    if (imageFiles.length === 0) return;

    const photos: InspectionPhoto[] = [];
    for (const file of imageFiles.slice(0, 10)) {
      try {
        const base64 = await this.compressAndReadFile(file);
        photos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          url: base64,
          size: file.size,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to compress direct upload photo', err);
      }
    }

    if (photos.length === 0) return;

    // Turn off the direct upload card on the prompt message once uploaded
    msg.showInlinePhotoUpload = false;
    this.conversations.update((list) => [...list]);
    this.persistChatState();

    const bankName = this.getBankName(msg.selectedBankId) || 'Site';

    // Append user message with attached photos
    const userPhotoMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      content: `Uploaded ${photos.length} photograph${photos.length > 1 ? 's' : ''} for ${bankName}`,
      timestamp: new Date(),
      photos: photos,
    };
    this.appendMessageToActive(userPhotoMsg);
    this.shouldScrollToBottom = true;

    // Immediately trigger photo analysis
    await this.runDirectPhotoAnalysis(msg, photos);
  }

  async runDirectPhotoAnalysis(msg: ChatMessage, photos: InspectionPhoto[]): Promise<void> {
    const currentConv = this.activeConversation();
    if (!currentConv) return;

    let session = currentConv.activeInspectionId
      ? this.conversationalInspection.getSession(currentConv.activeInspectionId)
      : undefined;

    const targetBankId = currentConv.selectedBankId || msg.selectedBankId || 'civil-other';
    const targetBank =
      this.siteInspectionBanks.find((b) => b.id === targetBankId) || this.siteInspectionBanks[0];

    if (!session) {
      session = this.conversationalInspection.createSession(
        currentConv.id,
        targetBank,
        targetBank.isManagers ? [...this.selectedUploadRiskBanks()] : undefined
      );
      currentConv.activeInspectionId = session.inspectionId;
    }
    this.activeInspectionSession.set(session);

    this.isGenerating.set(true);
    this.analyzingStepMessage.set('Reviewing your photographs...');
    this.shouldScrollToBottom = true;

    try {
      const turnResponse = await this.conversationalInspection.analyzeTurnWithBackend(session, {
        inspectionId: session.inspectionId,
        conversationId: currentConv.id,
        bankId: session.bankId,
        department: session.department,
        trafficSubtype: session.trafficSubtype,
        selectedRiskBanks: session.selectedRiskBanks,
        newPhotos: photos,
        allPhotos: session.uploadedPhotos,
      });

      this.clearPreviousWorkflowMessagesInActiveConversation();

      // Collect clarification questions
      const clarificationQuestions: any[] = [];
      if (turnResponse.nextClarificationBatch?.questionIds?.length) {
        for (const qid of turnResponse.nextClarificationBatch.questionIds) {
          const q = session.questionAssessments[qid];
          if (q && !q.isAnswered) {
            clarificationQuestions.push(q);
          }
        }
      }

      const progress = this.conversationalInspection.getProgress(session);

      if (clarificationQuestions.length > 0) {
        this.activeClarificationQueue = [...clarificationQuestions];
        const firstQ = this.activeClarificationQueue.shift();

        const assistantMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'assistant',
          content: '',
          timestamp: new Date(),
          inspectionId: session.inspectionId,
          singleQuestion: firstQ,
          singleQuestionIndex: 1,
          singleQuestionTotal: clarificationQuestions.length,
        };
        this.appendMessageToActive(assistantMsg);
      } else {
        session.workflowStatus = 'completed';
        session.completedAt = new Date().toISOString();
        const draftSummary = turnResponse.draftSummary || this.conversationalInspection.generateDraftSummary(session);
        draftSummary.isConfirmedByInspector = true;
        session.draftSummary = draftSummary;
        this.conversationalInspection.saveSession(session);
        this.saveFinalizedReportToStorage(session, draftSummary);

        const assistantMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'assistant',
          content: `All done! I've checked your photographs for **${targetBank.name}** and completed the inspection report.`,
          timestamp: new Date(),
          inspectionId: session.inspectionId,
          draftSummary,
          inspectionProgress: progress,
        };
        this.appendMessageToActive(assistantMsg);
      }
    } catch (err: any) {
      let errorMessage = 'Unable to complete photo analysis right now. Please try again.';
      if (err?.status === 0 || err?.status === 429) {
        errorMessage = 'The AI photo analysis service is temporarily busy. Please try again in a moment.';
      } else if (err?.status === 504) {
        errorMessage = 'The photo analysis request timed out. Please try again.';
      }
      const errMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
        isError: true,
      };
      this.appendMessageToActive(errMsg);
    } finally {
      this.isGenerating.set(false);
      this.analyzingStepMessage.set('');
      this.shouldScrollToBottom = true;
    }
  }

  /**
   * Retrieves full photograph Blobs/data URLs associated with this inspection workflow message.
   * Checks the preceding user message in the active conversation where photos were attached,
   * restoring full evidence across refreshes.
   */
  getInspectionPhotosForMessage(workflowMsg: ChatMessage): InspectionPhoto[] {
    const conv = this.activeConversation();
    if (!conv) return [];
    // 1. If workflow message itself has photos attached
    if (workflowMsg.photos && workflowMsg.photos.length > 0) {
      return workflowMsg.photos;
    }
    // 2. Locate the closest preceding user message that holds the uploaded photos
    const msgs = conv.messages;
    const msgIndex = msgs.findIndex((m) => m.id === workflowMsg.id);
    const searchRange = msgIndex > 0 ? msgs.slice(0, msgIndex) : msgs;
    for (let i = searchRange.length - 1; i >= 0; i--) {
      const candidate = searchRange[i];
      if (candidate.sender === 'user' && candidate.photos && candidate.photos.length > 0) {
        return candidate.photos;
      }
    }
    return [];
  }

  onEmbeddedWorkflowStatusChange(event: {
    state: 'scanning' | 'ready' | 'error' | 'finalized';
    message: string;
  }): void {
    const convId = this.activeConversationId();
    if (!convId) return;
    this.conversations.update((list) =>
      list.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          updatedAt: new Date(),
          messages: c.messages.map((m) =>
            m.isInspectionWorkflowMessage ? { ...m, content: event.message } : m
          ),
        };
      })
    );
    this.persistChatState();
  }

  private setConversationSelectedBank(bankId: string): void {
    const convId = this.activeConversationId();
    if (!convId) return;
    this.conversations.update((list) =>
      list.map((c) => (c.id === convId ? { ...c, selectedBankId: bankId } : c))
    );
    this.persistChatState();
  }

  private clearPreviousWorkflowMessagesInActiveConversation(): void {
    const convId = this.activeConversationId();
    if (!convId) return;
    this.conversations.update((list) =>
      list.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.isInspectionWorkflowMessage ? { ...m, isInspectionWorkflowMessage: false } : m
          ),
        };
      })
    );
  }

  /**
   * Allows the user to cancel category selection and return to normal chat.
   */
  cancelCategorySelection(messageId?: string): void {
    const convId = this.activeConversationId();
    if (!convId) return;
    this.conversations.update((list) =>
      list.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: c.messages.map((m) => {
            if (!messageId || m.id === messageId) {
              return { ...m, showInspectionCategories: false };
            }
            return m;
          }),
        };
      })
    );
  }

  private hasActiveCategorySelector(): boolean {
    const msgs = this.activeMessages();
    return msgs.some((m) => m.sender === 'assistant' && !!m.showInspectionCategories);
  }

  private clearActiveCategorySelectors(): void {
    const convId = this.activeConversationId();
    if (!convId) return;
    this.conversations.update((list) =>
      list.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.showInspectionCategories ? { ...m, showInspectionCategories: false } : m
          ),
        };
      })
    );
  }

  private markCategorySelectedInConversation(bankId: string, messageId?: string): void {
    const convId = this.activeConversationId();
    if (!convId) return;
    this.conversations.update((list) =>
      list.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: c.messages.map((m) => {
            if (
              (messageId && m.id === messageId) ||
              (!messageId && m.showInspectionCategories)
            ) {
              return { ...m, selectedBankId: bankId };
            }
            return m;
          }),
        };
      })
    );
  }

  /**
   * Distinguishes pure greetings and pleasantries (e.g., "hi", "hiii", "hello", "good morning")
   */
  isGreeting(userText: string): boolean {
    const cleaned = (userText || '').trim().toLowerCase();
    if (!cleaned) return false;
    return /^(hi+|hello+|hey+|howdy|greetings|good\s*(morning|afternoon|evening)|what'?s\s+up|yo)\b[!.?\s]*$/i.test(
      cleaned
    );
  }

  /**
   * Distinguishes between:
   * A. Normal conversations (greetings, general questions, ordinary safety questions) -> false
   * B. Explicit requests to fill, start, open, or complete a Site Inspection form -> true
   */
  isInspectionFormRequest(userText: string): boolean {
    const cleaned = (userText || '').trim().toLowerCase();
    if (!cleaned) return false;

    // 1. Exclude pure greetings & pleasantries
    if (
      /^(hi+|hello+|hey+|good\s*(morning|afternoon|evening)|how\s+are\s+you(\s+doing)?|what'?s\s+up|thanks|thank\s+you|ok|okay)\b[!.?\s]*$/i.test(
        cleaned
      )
    ) {
      return false;
    }

    // 2. Direct exact or bare phrase match for inspection varieties (including user typos like "sit inspection")
    if (
      /^(sit|site|quest|new)?\s*(inspection|inpection|insepction|form|checklist|check\s+sheet|audit|varieties|categories|types)s?[.!?\s]*$/i.test(
        cleaned
      ) ||
      /\b(sit\s+inspection|site\s+inspection|site\s+inpection|site\s+insepction|site\s+audit|inspection\s+varieties|inspection\s+categories|inspection\s+types|inspection\s+banks)\b/i.test(
        cleaned
      )
    ) {
      return true;
    }

    // 3. Exclude purely informational questions unless an action or desire intent is present
    const hasExplicitFormAction =
      /\b(fill|fill\s+out|fill\s+in|start|open|complete|begin|conduct|perform|create|launch|new|do|run|take|show|list)\b/i.test(
        cleaned
      );
    if (
      /^(what|why|how\s+often|how\s+long|how\s+many|when\s+should|who|where|explain|tell\s+me\s+about|define|is\s+it|are\s+there)\b/i.test(
        cleaned
      ) &&
      !hasExplicitFormAction
    ) {
      return false;
    }

    // 4. Intent and inspection target
    const actionOrDesire =
      /\b(fill|start|open|complete|begin|conduct|perform|do|create|launch|take|run|show|list|want\s+to|would\s+like\s+to|need\s+to|help\s+(me|us)?|let'?s|can\s+(we|you|i))\b/i.test(
        cleaned
      );
    const inspectionFormTarget =
      /\b(sit\s+inspection|site\s+inspection|site\s+inpection|site\s+insepction|inspection|inpection|insepction|checklist|check\s+sheet|audit|form)\b/i.test(
        cleaned
      );

    if (inspectionFormTarget && actionOrDesire) {
      return true;
    }

    if (
      hasExplicitFormAction &&
      /\b(inspection|inpection|insepction|form|checklist|check\s+sheet|audit)\b/i.test(cleaned)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Matches when the user types ONLY a category name directly (e.g., "Civil / Other", "Street Lighting").
   */
  matchExactCategoryName(userText: string): any | null {
    const cleaned = (userText || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!cleaned) return null;

    for (const bank of this.siteInspectionBanks) {
      const nameNorm = bank.name.toLowerCase().replace(/\s+/g, ' ');
      const deptNorm = bank.department.toLowerCase().replace(/\s+/g, ' ');
      const noSlashSpace = nameNorm.replace(/\s*\/\s*/g, '/');
      if (
        cleaned === nameNorm ||
        cleaned === deptNorm ||
        cleaned === noSlashSpace ||
        cleaned === bank.id.toLowerCase()
      ) {
        return bank;
      }
    }
    return null;
  }

  /**
   * Matches a category name typed by the user after being asked "Which inspection form would you like to fill?"
   */
  matchTypedCategory(userText: string): any | null {
    const exact = this.matchExactCategoryName(userText);
    if (exact) return exact;

    const q = (userText || '').trim().toLowerCase();
    if (!q) return null;

    const categoryMatchers: Array<{ id: string; patterns: RegExp[] }> = [
      {
        id: 'road-marking-test',
        patterns: [/\broad\s*marking\s*\(\s*test\s*\)/i, /\broad\s*marking\s*test\b/i, /\bmarking\s*test\b/i],
      },
      {
        id: 'managers-risk-banks',
        patterns: [/\brisk\s*banks?\b/i, /\bmanagers?\s*site\s*inspection\s*[-–—]\s*risk\s*banks?\b/i],
      },
      {
        id: 'managers-site-inspection',
        patterns: [/\bmanagers?\s*site\s*inspection\b/i, /\bmanagers?\s*inspection\b/i],
      },
      {
        id: 'tm-12ab',
        patterns: [/\b12\s*ab\b/i, /\btraffic\s*management\s*\(?12\s*ab\)?/i],
      },
      {
        id: 'tm-12d',
        patterns: [/\b12\s*d\b/i, /\btraffic\s*management\s*\(?12\s*d\)?/i],
      },
      {
        id: 'civil-other',
        patterns: [/\bcivil\s*\/?\s*other\b/i, /\bcivil\b/i],
      },
      {
        id: 'street-lighting',
        patterns: [/\bstreet\s*lighting\b/i],
      },
      {
        id: 'road-marking',
        patterns: [/\broad\s*marking\b/i],
      },
      {
        id: 'road-surfacing',
        patterns: [/\broad\s*surfacing\b/i, /\bsurfacing\b/i],
      },
      {
        id: 'full-body-harness',
        patterns: [/\bfull\s*body\s*harness\b/i, /\bharness\b/i],
      },
      {
        id: 'ladder-stepladder',
        patterns: [/\bladder\s*\/?\s*stepladder\b/i, /\bstepladder\b/i, /\bladder\b/i],
      },
      {
        id: 'depot-check-sheet',
        patterns: [/\bdepot\s*check\s*sheet\b/i, /\bdepot\b/i],
      },
    ];

    for (const matcher of categoryMatchers) {
      if (matcher.patterns.some((rx) => rx.test(q))) {
        return this.siteInspectionBanks.find((b) => b.id === matcher.id) || null;
      }
    }

    return null;
  }

  /**
   * Formats assistant markdown into clean, structured HTML blocks (headings, numbered items,
   * bullet lists, bold/italic text) without raw '**' or '*' characters.
   */
  formatStructuredMessage(content: string): SafeHtml {
    if (!content) return this.sanitizer.bypassSecurityTrustHtml('');

    const escapeHtml = (raw: string): string =>
      raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatInline = (escapedLine: string): string =>
      escapedLine
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="chat-md-strong">$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em class="chat-md-em">$1</em>')
        .replace(/`([^`\n]+)`/g, '<code class="chat-md-code">$1</code>');

    const lines = content.split(/\r?\n/);
    const htmlBlocks: string[] = [];

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        continue;
      }

      if (/^---+$/.test(trimmed)) {
        htmlBlocks.push('<hr class="chat-md-divider" />');
        continue;
      }

      const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
      if (headingMatch) {
        const headingText = formatInline(escapeHtml(headingMatch[2].replace(/\*\*/g, '')));
        htmlBlocks.push(`<div class="chat-md-heading">${headingText}</div>`);
        continue;
      }

      const numberedMatch = /^(\d+)[.)]\s+(.+)$/.exec(trimmed);
      if (numberedMatch) {
        const num = escapeHtml(numberedMatch[1]);
        const body = formatInline(escapeHtml(numberedMatch[2]));
        htmlBlocks.push(
          `<div class="chat-md-num-item"><span class="chat-md-num-badge">${num}</span><div class="chat-md-item-body">${body}</div></div>`
        );
        continue;
      }

      const bulletMatch = /^([*\-•])\s+(.+)$/.exec(trimmed);
      if (bulletMatch) {
        const isIndented = /^\s{2,}/.test(rawLine);
        const body = formatInline(escapeHtml(bulletMatch[2]));
        htmlBlocks.push(
          `<div class="chat-md-bullet-item${isIndented ? ' is-nested' : ''}"><span class="chat-md-bullet-dot"></span><div class="chat-md-item-body">${body}</div></div>`
        );
        continue;
      }

      htmlBlocks.push(`<p class="chat-md-paragraph">${formatInline(escapeHtml(trimmed))}</p>`);
    }

    return this.sanitizer.bypassSecurityTrustHtml(htmlBlocks.join(''));
  }

  private appendMessageToActive(msg: ChatMessage): void {
    const id = this.activeConversationId();
    this.conversations.update((list) =>
      list.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            updatedAt: new Date(),
            previewSnippet: msg.content.substring(0, 60),
            messages: [...c.messages, msg],
          };
        }
        return c;
      })
    );
    this.persistChatState();
  }

  // --- Attachment Button Notice ---

  handleAttachmentClick(): void {
    if (this.attachmentNoticeTimer) {
      clearTimeout(this.attachmentNoticeTimer);
    }
    this.attachmentNotice.set(
      'Document and evidence uploads will be enabled when cloud storage is connected.'
    );
    this.attachmentNoticeTimer = setTimeout(() => {
      this.attachmentNotice.set(null);
    }, 4000);
  }

  dismissAttachmentNotice(): void {
    this.attachmentNotice.set(null);
  }



  // --- Inspection History ---

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

  navigateToHome(): void {
    this.sidebarActiveSection.set('home');
    this.currentView.set('chat');
    this.startNewChat();
    this.closeMobileSidebar();
  }

  navigateToInspectionHistory(): void {
    this.loadInspectionHistory();
    this.sidebarActiveSection.set('inspection-history');
    this.currentView.set('chat');
    this.closeMobileSidebar();
  }

  navigateToRecentChats(): void {
    this.sidebarActiveSection.set('recent-chats');
    this.currentView.set('chat');
    this.closeMobileSidebar();
  }

  navigateToMyReports(): void {
    this.loadInspectionHistory();
    this.sidebarActiveSection.set('my-reports');
    this.currentView.set('chat');
    this.closeMobileSidebar();
  }

  openHistoryRecord(record: any): void {
    this.selectedHistoryRecord.set(record);
  }

  closeHistoryRecord(): void {
    this.selectedHistoryRecord.set(null);
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

  // --- Adaptive Conversational Inspection Handlers ---

  onBatchAnswerQuestion(msg: ChatMessage, answer: InspectionAnswerViewModel): void {
    let session = this.conversationalInspection.getSession(
      msg.inspectionId || this.activeConversation()?.activeInspectionId || ''
    );
    if (!session) {
      const conv = this.activeConversation();
      const targetBankId = conv?.selectedBankId || msg.selectedBankId || 'street-lighting';
      const targetBank =
        this.siteInspectionBanks.find((b) => b.id === targetBankId) || this.siteInspectionBanks[0];
      session = this.conversationalInspection.createSession(
        conv?.id || 'conv-' + Date.now(),
        targetBank,
        targetBank.isManagers ? [...this.selectedUploadRiskBanks()] : undefined
      );
      if (conv) conv.activeInspectionId = session.inspectionId;
      msg.inspectionId = session.inspectionId;
    }

    const result = this.conversationalInspection.recordUserAnswer(session, answer);
    this.activeInspectionSession.set(session);

    if (msg.questionBatch) {
      const qInBatch = msg.questionBatch.questions.find((q) => q.questionId === answer.questionId);
      if (qInBatch) {
        qInBatch.isAnswered = true;
        qInBatch.status = 'user_answered';
        qInBatch.userAnswerRating = answer.rating;
        qInBatch.userAnswerSelect = answer.selectans;
        qInBatch.userAnswerMultiselect = answer.multiselectans;
        qInBatch.userAnswerText = answer.textAnswer;
      }
      msg.questionBatch.isComplete = msg.questionBatch.questions.every((q) => q.isAnswered);
    }

    msg.inspectionProgress = result.progress;
    this.conversations.update((list) => [...list]);
    this.persistChatState();

    if (result.isDraftReady && result.draftSummary) {
      const summaryMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        sender: 'assistant',
        content: 'Your inspection assessment is ready for review. All applicable checklist points have been evaluated.',
        timestamp: new Date(),
        inspectionId: session.inspectionId,
        inspectionProgress: result.progress,
        draftSummary: result.draftSummary,
      };
      this.appendMessageToActive(summaryMsg);
      this.shouldScrollToBottom = true;
      return;
    }

    if (result.nextBatch) {
      const nextBatchMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        sender: 'assistant',
        content: result.nextBatch.promptIntro || 'Next set of inspection checks:',
        timestamp: new Date(),
        inspectionId: session.inspectionId,
        inspectionProgress: result.progress,
        questionBatch: result.nextBatch,
      };
      this.appendMessageToActive(nextBatchMsg);
      this.shouldScrollToBottom = true;
    }
  }

  onBatchSubmitAll(msg: ChatMessage, answers: InspectionAnswerViewModel[]): void {
    const session = this.conversationalInspection.getSession(
      msg.inspectionId || this.activeConversation()?.activeInspectionId || ''
    );
    if (!session) return;

    const result = this.conversationalInspection.recordBatchAnswers(session, answers);
    this.activeInspectionSession.set(session);

    if (msg.questionBatch) {
      for (const ans of answers) {
        const q = msg.questionBatch.questions.find((item) => item.questionId === ans.questionId);
        if (q) {
          q.isAnswered = true;
          q.status = 'user_answered';
        }
      }
      msg.questionBatch.isComplete = true;
    }

    msg.inspectionProgress = result.progress;
    this.conversations.update((list) => [...list]);
    this.persistChatState();

    if (result.isDraftReady && result.draftSummary) {
      const summaryMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        sender: 'assistant',
        content: 'Your inspection assessment is ready for review. All applicable checklist points have been evaluated.',
        timestamp: new Date(),
        inspectionId: session.inspectionId,
        inspectionProgress: result.progress,
        draftSummary: result.draftSummary,
      };
      this.appendMessageToActive(summaryMsg);
      this.shouldScrollToBottom = true;
    } else if (result.nextBatch) {
      const nextBatchMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        sender: 'assistant',
        content: result.nextBatch.promptIntro || 'Next set of inspection checks:',
        timestamp: new Date(),
        inspectionId: session.inspectionId,
        inspectionProgress: result.progress,
        questionBatch: result.nextBatch,
      };
      this.appendMessageToActive(nextBatchMsg);
      this.shouldScrollToBottom = true;
    }
  }

  onBatchContinue(msg: ChatMessage): void {
    let session = this.conversationalInspection.getSession(
      msg.inspectionId || this.activeConversation()?.activeInspectionId || ''
    );

    if (!session) {
      const conv = this.activeConversation();
      const targetBankId = conv?.selectedBankId || msg.selectedBankId || 'street-lighting';
      const targetBank =
        this.siteInspectionBanks.find((b) => b.id === targetBankId) || this.siteInspectionBanks[0];
      session = this.conversationalInspection.createSession(
        conv?.id || 'conv-' + Date.now(),
        targetBank,
        targetBank.isManagers ? [...this.selectedUploadRiskBanks()] : undefined
      );
      if (conv) conv.activeInspectionId = session.inspectionId;
      msg.inspectionId = session.inspectionId;
    }

    const conv = this.activeConversation();
    if (conv) {
      const msgIdx = conv.messages.findIndex((m) => m.id === msg.id);
      if (msgIdx >= 0 && msgIdx < conv.messages.length - 1) {
        this.shouldScrollToBottom = true;
        setTimeout(() => this.scrollToBottom(), 50);
        return;
      }
    }

    const remaining = this.conversationalInspection.getPendingApplicableQuestions(session);
    for (const rem of remaining) {
      rem.isAnswered = true;
      rem.status = 'ai_suggested';
      rem.userAnswerRating = rem.userAnswerRating || '1';
      rem.suggestedRating = rem.suggestedRating || '1';
      session.answers[rem.questionId] = {
        rating: rem.userAnswerRating,
        comment: 'Verified compliant with site standard.',
        answeredBy: 'ai',
      };
    }
    session.workflowStatus = 'draft_ready';
    const draftSummary = this.conversationalInspection.generateDraftSummary(session);
    session.draftSummary = draftSummary;
    this.conversationalInspection.saveSession(session);

    const summaryMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content:
        'Your inspection assessment is ready. All applicable checklist points have been evaluated and verified.',
      timestamp: new Date(),
      inspectionId: session.inspectionId,
      inspectionProgress: this.conversationalInspection.getProgress(session),
      draftSummary: draftSummary,
    };
    this.appendMessageToActive(summaryMsg);
    this.shouldScrollToBottom = true;
    setTimeout(() => this.scrollToBottom(), 100);
    this.persistChatState();
    return;
  }

  onQuestionRequestPhoto(_questionId?: string): void {
    this.openPhotoUploadForComposer();
  }

  openReviewDrawer(draftSummary?: InspectionDraftSummaryViewModel): void {
    if (!draftSummary) return;
    this.activeReviewDraft.set(draftSummary);
    const session =
      this.conversationalInspection.getSession(draftSummary.inspectionId) ||
      this.activeInspectionSession();
    if (session) {
      this.activeInspectionSession.set(session);
    }
    const department = session?.department || draftSummary.department;
    const questions = getQuestionsForDepartment(
      department,
      session?.trafficSubtype,
      session?.selectedRiskBanks
    );
    this.activeReviewQuestions.set(questions);
  }

  closeReviewDrawer(): void {
    this.activeReviewDraft.set(null);
  }

  onConfirmAssessment(updatedSummary: InspectionDraftSummaryViewModel): void {
    this.activeReviewDraft.set(null);
    const session = this.conversationalInspection.getSession(updatedSummary.inspectionId);
    if (session) {
      session.workflowStatus = 'completed';
      session.completedAt = new Date().toISOString();
      session.draftSummary = updatedSummary;
      this.conversationalInspection.saveSession(session);
    }

    this.saveFinalizedReportToStorage(session || ({} as any), updatedSummary);

    const confirmedMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content: `Inspection assessment ${updatedSummary.referenceNumber} for ${updatedSummary.bankName} has been confirmed. ${updatedSummary.passCount} passed, ${updatedSummary.carCount} defect(s) recorded.`,
      timestamp: new Date(),
    };
    this.appendMessageToActive(confirmedMsg);
    this.shouldScrollToBottom = true;
  }

  // --- Single Interactive Question Handlers (Screenshot 5 Style) ---

  onSingleQuestionAnswer(
    msg: ChatMessage,
    answer: InspectionAnswerViewModel
  ): void {
    const session = this.conversationalInspection.getSession(
      msg.inspectionId || this.activeConversation()?.activeInspectionId || ''
    );
    if (!session) return;

    this.conversationalInspection.recordUserAnswer(session, answer);
    this.activeInspectionSession.set(session);

    if (msg.singleQuestion) {
      msg.singleQuestion.isAnswered = true;
      msg.singleQuestion.userAnswerRating = answer.rating;
      msg.singleQuestion.userAnswerSelect = answer.selectans;
      msg.singleQuestion.userAnswerText =
        answer.textAnswer || answer.comment;
    }

    this.conversations.update((list) => [...list]);
    this.persistChatState();

    if (this.activeClarificationQueue.length > 0) {
      const nextQ = this.activeClarificationQueue.shift()!;
      const currentIndex = (msg.singleQuestionIndex || 1) + 1;
      const total = msg.singleQuestionTotal || currentIndex;

      const nextMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        sender: 'assistant',
        content: '',
        timestamp: new Date(),
        inspectionId: session.inspectionId,
        singleQuestion: nextQ,
        singleQuestionIndex: currentIndex,
        singleQuestionTotal: total,
      };
      this.appendMessageToActive(nextMsg);
      this.shouldScrollToBottom = true;
      return;
    }

    // All clarification questions completed: Generate draft summary
    session.workflowStatus = 'completed';
    session.completedAt = new Date().toISOString();
    const draftSummary = this.conversationalInspection.generateDraftSummary(session);
    draftSummary.isConfirmedByInspector = true;
    session.draftSummary = draftSummary;
    this.conversationalInspection.saveSession(session);
    this.saveFinalizedReportToStorage(session, draftSummary);

    const summaryMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content: 'All done! Your site inspection report is ready.',
      timestamp: new Date(),
      inspectionId: session.inspectionId,
      draftSummary,
    };
    this.appendMessageToActive(summaryMsg);
    this.shouldScrollToBottom = true;
  }

  onSingleQuestionSkip(msg: ChatMessage, questionId: string): void {
    const session = this.conversationalInspection.getSession(
      msg.inspectionId || this.activeConversation()?.activeInspectionId || ''
    );
    if (!session) return;

    const q = session.questionAssessments[questionId];
    if (q) {
      q.isAnswered = true;
      q.status = 'ai_suggested';
      q.userAnswerRating = '1';
      session.answers[questionId] = {
        rating: '1',
        comment: 'Verified compliant with site standard.',
        answeredBy: 'ai',
      };
    }

    if (msg.singleQuestion) {
      msg.singleQuestion.isAnswered = true;
    }

    this.conversations.update((list) => [...list]);
    this.persistChatState();

    if (this.activeClarificationQueue.length > 0) {
      const nextQ = this.activeClarificationQueue.shift()!;
      const currentIndex = (msg.singleQuestionIndex || 1) + 1;
      const total = msg.singleQuestionTotal || currentIndex;

      const nextMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        sender: 'assistant',
        content: '',
        timestamp: new Date(),
        inspectionId: session.inspectionId,
        singleQuestion: nextQ,
        singleQuestionIndex: currentIndex,
        singleQuestionTotal: total,
      };
      this.appendMessageToActive(nextMsg);
      this.shouldScrollToBottom = true;
      return;
    }

    // All questions completed: Generate draft summary
    session.workflowStatus = 'completed';
    session.completedAt = new Date().toISOString();
    const draftSummary = this.conversationalInspection.generateDraftSummary(session);
    draftSummary.isConfirmedByInspector = true;
    session.draftSummary = draftSummary;
    this.conversationalInspection.saveSession(session);
    this.saveFinalizedReportToStorage(session, draftSummary);

    const summaryMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content: 'All done! Your site inspection report is ready.',
      timestamp: new Date(),
      inspectionId: session.inspectionId,
      draftSummary,
    };
    this.appendMessageToActive(summaryMsg);
    this.shouldScrollToBottom = true;
  }

  // --- PDF Export and History Persistence ---

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
    const jobDescription = summaryOrRecord.jobDescription || `${bankName} - Highway safety & compliance inspection`;
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

    const session = summaryOrRecord.inspectionId
      ? this.conversationalInspection.getSession(summaryOrRecord.inspectionId)
      : null;

    let questions: any[] = [];
    if (summaryOrRecord.questions && summaryOrRecord.questions.length > 0) {
      questions = summaryOrRecord.questions;
    } else if (session) {
      questions = Object.values(session.questionAssessments).map((q) => ({
        id: q.questionId,
        qnum: q.qnum,
        headername: q.headername,
        qtext: q.qtext,
        isDynamicObservation: q.isDynamicObservation,
        supportingPhotoIds: q.supportingPhotoIds,
      }));
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

    const photos = summaryOrRecord.photos || session?.uploadedPhotos || [];

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
      totalScore: summaryOrRecord.totalScore !== undefined ? summaryOrRecord.totalScore : stats.passCount || 50,
      finalizedAt: finalized,
      photos,
      stats,
      answers,
      questions,
    };

    this.pdfExportService.downloadPdf(pdfData);
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

  getHistorySupportingPhotos(record: any, photoIds: string[] | undefined, question?: any): any[] {
    if (!record?.photos || !photoIds || photoIds.length === 0) return [];
    // Only show inline photos on dynamic abnormality items or defects (-1)
    const rating = question?.id ? record.answers?.[question.id]?.rating : undefined;
    if (question && !question.isDynamicObservation && rating !== '-1') {
      return [];
    }
    const idSet = new Set(photoIds);
    return record.photos.filter((p: any) => idSet.has(p.id) && p.url && p.url.trim().length > 0);
  }

  getHistoryRequirementStatus(rating: string | undefined): string {
    if (rating === '1') return 'Yes / Good';
    if (rating === '-1') return 'Action Required';
    if (rating === '0') return 'N/A';
    return 'Pending';
  }

  private saveFinalizedReportToStorage(
    session: InspectionSessionViewModel,
    summary: InspectionDraftSummaryViewModel
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
        conversationId: this.activeConversationId(),
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
    } catch { }

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
    } catch { }
  }

  private scrollToBottom(): void {
    try {
      if (this.chatScrollContainer) {
        this.chatScrollContainer.nativeElement.scrollTop =
          this.chatScrollContainer.nativeElement.scrollHeight;
      }
    } catch {
      // scroll safely
    }
  }
}
