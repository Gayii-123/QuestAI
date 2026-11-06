import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from './core/services/api.service';
import { ChatMessage, Conversation } from './core/models/chat.models';
import {
  SiteInspectionComponent,
  MAX_INSPECTION_PHOTOS,
  MAX_IMAGE_SIZE_BYTES,
} from './features/inspection/site-inspection.component';
import { InspectionPhoto } from './features/inspection/site-inspection.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, SiteInspectionComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, AfterViewChecked {
  private readonly apiService = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('chatScrollContainer') private chatScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('composerTextarea') private composerTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild(SiteInspectionComponent) private inspectionComponent?: SiteInspectionComponent;

  // Active top-level view: 'chat' | 'inspection'
  currentView = signal<'chat' | 'inspection'>('chat');

  // Which sidebar nav item is currently active
  sidebarActiveNav = signal<'new-chat' | 'inspection-history' | 'my-reports' | 'settings' | ''>('new-chat');

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

  // Photo Upload & AI Auto-Fill Modal state
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
  uploadSiteNotes = signal<string>('');
  photoUploadError = signal<string>('');
  isAnalyzingPhotos = signal<boolean>(false);
  analyzingStepMessage = signal<string>('');
  isDragOver = signal<boolean>(false);

  // User name for personalized greeting
  readonly userName = signal<string>('Subhash');

  // Notifications Popover state
  showNotifications = signal<boolean>(false);

  // Settings / Diagnostics Modal state
  showSettingsModal = signal<boolean>(false);

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
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  // --- View Switching & Navigation Controls ---

  navigateToInspection(bankId?: string): void {
    this.closeHomeInspectionDropdown();
    this.currentView.set('inspection');
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
    this.closeHomeInspectionDropdown();
    this.currentView.set('chat');
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

  openPhotoUploadForComposer(): void {
    this.currentView.set('inspection');
    this.closeMobileSidebar();
    const openUploadStep = () => {
      if (this.inspectionComponent) {
        this.inspectionComponent.activeStep.set('photo-upload');
      }
    };
    if (this.inspectionComponent) {
      openUploadStep();
    } else {
      setTimeout(openUploadStep, 0);
    }
    try {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/inspection');
      }
    } catch { }
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

  onBankClick(bank: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.closeHomeInspectionDropdown();
    this.selectInspectionBank(bank.id);
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
    }
  }

  private compressAndReadFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
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
              const isPng = (file.type || '').toLowerCase() === 'image/png';
              resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85));
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

  removeUploadedPhoto(index: number): void {
    this.uploadedPhotos.update((list) => list.filter((_, i) => i !== index));
  }

  clearUploadedPhotos(): void {
    this.uploadedPhotos.set([]);
  }

  /**
   * Hands off the selected inspection bank, uploaded photographs, and site notes
   * to SiteInspectionComponent, which immediately launches the Step 3 viewfinder
   * scanning animation and calls POST /api/ai/inspect-photos (Gemini 3.8 Flash).
   */
  runAiPhotoAnalysisAndFill(): void {
    const bank = this.selectedUploadBank();
    const photos = this.uploadedPhotos();
    if (!bank || photos.length === 0 || this.isAnalyzingPhotos()) return;

    const handoffPayload = {
      bankId: bank.id as string,
      trafficSubtype: bank.trafficSubtype as '12D' | '12AB' | undefined,
      selectedRiskBanks: bank.isManagers ? [...this.selectedUploadRiskBanks()] : undefined,
      photos: [...photos],
      siteNotes: this.uploadSiteNotes(),
    };

    this.isAnalyzingPhotos.set(false);
    this.showPhotoUploadModal.set(false);
    this.currentView.set('inspection');
    this.closeMobileSidebar();

    try {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/inspection');
      }
    } catch { }

    const triggerAnalysis = () => {
      if (this.inspectionComponent) {
        this.inspectionComponent.startExternalPhotoAnalysis(handoffPayload);
      }
    };

    if (this.inspectionComponent) {
      triggerAnalysis();
    } else {
      setTimeout(triggerAnalysis, 0);
    }
  }

  startNewChat(): void {
    this.sidebarActiveNav.set('new-chat');
    this.navigateToChat();
    this.activeConversationId.set('');
    this.composerText.set('');
    this.attachedDocument.set(null);
    this.closeMobileSidebar();
  }

  selectConversation(id: string): void {
    this.sidebarActiveNav.set('');
    this.navigateToChat();
    this.activeConversationId.set(id);
    this.closeMobileSidebar();
    this.shouldScrollToBottom = true;
  }

  // --- Message Handling ---

  sendMessage(): void {
    const text = this.composerText().trim();
    if (!text || this.isGenerating()) return;

    let currentConv = this.activeConversation();
    const docAttachment = this.attachedDocument();

    // If starting a brand new conversation
    if (!currentConv) {
      const title = text.length > 36 ? text.substring(0, 36) + '...' : text;
      const newId = 'conv-' + Date.now();
      const newConv: Conversation = {
        id: newId,
        title: title,
        updatedAt: new Date(),
        previewSnippet: text,
        messages: [],
      };

      this.conversations.update((list) => [newConv, ...list]);
      this.activeConversationId.set(newId);
      currentConv = newConv;
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
        this.markCategorySelectedInConversation(typedBank.id);
        const confirmMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'assistant',
          content: `Selected ${typedBank.name}. Please upload your site photographs in the dialog to continue, or skip photos to open the manual checklist.`,
          timestamp: new Date(),
          selectedBankId: typedBank.id,
        };
        this.appendMessageToActive(confirmMsg);
        this.onSelectCategoryChipFromChat(typedBank);
        this.shouldScrollToBottom = true;
        return;
      }
    }

    const isFormRequest = this.isInspectionFormRequest(text);
    const mentionedBank = isFormRequest ? this.matchTypedCategory(text) : null;

    if (isFormRequest) {
      // Prevent duplicate category-selection panels in the same conversation
      this.clearActiveCategorySelectors();
    }

    this.isGenerating.set(true);

    // Contact real Gemini AI model via backend POST /api/ai/generate
    this.apiService.generateText(text).subscribe({
      next: (res) => {
        const assistantContent = isFormRequest
          ? 'Sure! Which inspection form would you like to fill?'
          : res.data.text;

        const assistantMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'assistant',
          content: assistantContent,
          timestamp: new Date(res.data.generatedAt || Date.now()),
          modelIdentifier: res.data.model,
          attachmentName: docAttachment || undefined,
          showInspectionCategories: isFormRequest,
          suggestedBankId: mentionedBank?.id,
          selectedBankId: mentionedBank?.id,
        };
        this.appendMessageToActive(assistantMsg);
        this.isGenerating.set(false);
        this.shouldScrollToBottom = true;
      },
      error: (err) => {
        let errorMessage = 'An unexpected error occurred while communicating with Gemini.';
        if (err.status === 0) {
          errorMessage =
            'Unable to reach the QuestAI backend at http://localhost:5001. Please verify that the backend server is running (npm run dev in backend/).';
        } else if (err.status === 429) {
          errorMessage =
            'Gemini API quota or rate limit reached. Please wait a few moments and try again.';
        } else if (err.status === 504) {
          errorMessage = 'The request to Gemini timed out. Please try asking again.';
        } else if (err.error?.error?.message) {
          errorMessage = err.error.error.message;
        } else if (err.message) {
          errorMessage = err.message;
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

  retryMessage(prompt?: string): void {
    if (!prompt || this.isGenerating()) return;
    this.composerText.set(prompt);
    this.sendMessage();
  }

  /**
   * Called when the user clicks one of the 12 compact category chips in the assistant response
   * (or selects a category by typing its name). Records the selected bank and opens the existing
   * photo-upload dialog.
   */
  onSelectCategoryChipFromChat(bank: any, messageId?: string): void {
    if (!bank) return;
    this.markCategorySelectedInConversation(bank.id, messageId);
    this.onSelectBankForPhotoUpload(bank);
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
    return msgs.some((m) => m.sender === 'assistant' && Boolean(m.showInspectionCategories));
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

    // 2. Exclude informational / educational questions unless they explicitly ask to fill/start/open a form
    const hasExplicitFormAction =
      /\b(fill|fill\s+out|fill\s+in|start|open|complete|begin|conduct|perform|create|launch|new)\b/i.test(
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

    // 3. Require both an action/desire intent AND a form/inspection target
    const actionOrDesire =
      /\b(fill|start|open|complete|begin|conduct|perform|do|create|launch|take|want\s+to|would\s+like\s+to|need\s+to|let'?s)\b/i.test(
        cleaned
      );
    const inspectionFormTarget =
      /\b(site\s+inspection|site\s+inpection|site\s+insepction|inspection\s+form|inpection\s+form|insepction\s+form|inspection\s+checklist|site\s+checklist|new\s+inspection|new\s+inpection|fill\s+(a|the)\s+form|fill\s+form|check\s+sheet)\b/i.test(
        cleaned
      );

    if (inspectionFormTarget && actionOrDesire) {
      return true;
    }

    // Also match "Fill a <Category> inspection form" or "Start a <Category> inspection"
    if (
      hasExplicitFormAction &&
      /\b(inspection|inpection|insepction|form|checklist|check\s+sheet)\b/i.test(cleaned)
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
