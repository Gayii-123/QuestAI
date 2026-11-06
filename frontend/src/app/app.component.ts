import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './core/services/api.service';
import { ChatMessage, Conversation } from './core/models/chat.models';
import { SiteInspectionComponent } from './features/inspection/site-inspection.component';
import { InspectionPhoto } from './features/inspection/site-inspection.models';
import { AiInspectionFillService } from './core/services/ai-inspection-fill.service';
import { getQuestionsForDepartment } from './core/models/site-inspection.schema';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, SiteInspectionComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, AfterViewChecked {
  private readonly apiService = inject(ApiService);
  private readonly aiInspectionFillService = inject(AiInspectionFillService);

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
      name: 'Civil/Other',
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
      name: 'Traffic Management (12D)',
      department: 'Traffic Management',
      trafficSubtype: '12D',
      icon: '🛑',
      badge: '33 Questions',
      count: 33,
      description: 'Urban and rural roads, temporary traffic lights, convoy working and stop/go controls',
    },
    {
      id: 'tm-12ab',
      name: 'Traffic Management (12AB)',
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
      name: 'Ladder/Stepladder',
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
      name: 'Managers Risk Banks',
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
  uploadedPhotos = signal<InspectionPhoto[]>([]);
  uploadSiteNotes = signal<string>('');
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
    // Check if initial URL points to site inspection
    try {
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
    if (this.inspectionComponent) {
      if (bankId) {
        this.inspectionComponent.selectBank(bankId);
        this.inspectionComponent.activeStep.set('photo-upload');
      } else {
        this.inspectionComponent.activeStep.set('category-select');
      }
    }
    try {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/inspection');
      }
    } catch {}
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
    } catch {}
  }

  selectInspectionBank(bankId: string): void {
    this.navigateToInspection(bankId);
    if (this.inspectionComponent) {
      this.inspectionComponent.selectBank(bankId);
    }
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
    this.navigateToInspection();
    if (this.inspectionComponent) {
      this.inspectionComponent.activeStep.set('photo-upload');
    }
  }

  removeAttachedDocument(): void {
    this.attachedDocument.set(null);
  }

  // --- Home Screen Site Inspection Dropdown & AI Photo Upload Methods ---

  @HostListener('document:click', ['$event'])
  @HostListener('document:touchstart', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (this.showHomeInspectionDropdown() && !target.closest('.inspection-badge-container')) {
      this.closeHomeInspectionDropdown();
    }
    if (this.showNotifications() && !target.closest('.notification-wrap')) {
      this.closeNotifications();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showHomeInspectionDropdown()) {
      this.closeHomeInspectionDropdown();
    }
    if (this.showNotifications()) {
      this.closeNotifications();
    }
    if (this.showSettingsModal()) {
      this.closeSettingsModal();
    }
  }

  toggleNotifications(event?: Event): void {
    if (event) event.stopPropagation();
    this.showNotifications.update((v) => !v);
  }

  closeNotifications(): void {
    this.showNotifications.set(false);
  }

  openSettings(): void {
    this.closeMobileSidebar();
    this.showSettingsModal.set(true);
  }

  closeSettingsModal(): void {
    this.showSettingsModal.set(false);
  }

  deleteConversation(id: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.conversations.update((list) => list.filter((c) => c.id !== id));
    if (this.activeConversationId() === id) {
      this.activeConversationId.set('');
    }
  }

  openInspectionHistory(): void {
    this.closeMobileSidebar();
    this.sidebarActiveNav.set('inspection-history');
    this.navigateToInspection();
    if (this.inspectionComponent) {
      this.inspectionComponent.activeStep.set('review-form');
    }
  }

  openMyReports(): void {
    this.closeMobileSidebar();
    this.sidebarActiveNav.set('my-reports');
    this.navigateToInspection();
    if (this.inspectionComponent) {
      this.inspectionComponent.activeStep.set('finalized');
    }
  }

  onStartInspectionAction(): void {
    this.closeMobileSidebar();
    this.navigateToInspection();
    if (this.inspectionComponent) {
      this.inspectionComponent.activeStep.set('category-select');
    }
  }

  onAiPhotoInspectionAction(): void {
    this.openPhotoUploadForComposer();
  }

  onHelpMeFillFormAction(): void {
    this.composerText.set('Help me review site safety requirements and complete the inspection checklist.');
    this.sendMessage();
  }

  toggleHomeInspectionDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
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
    this.closeHomeInspectionDropdown();
    this.showPhotoUploadModal.set(true);
  }

  closePhotoUploadModal(): void {
    if (this.isAnalyzingPhotos()) return;
    this.showPhotoUploadModal.set(false);
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
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    const newPhotos: InspectionPhoto[] = [];

    for (const file of files) {
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

  removeUploadedPhoto(index: number): void {
    this.uploadedPhotos.update((list) => list.filter((_, i) => i !== index));
  }

  clearUploadedPhotos(): void {
    this.uploadedPhotos.set([]);
  }

  runAiPhotoAnalysisAndFill(): void {
    const bank = this.selectedUploadBank();
    const photos = this.uploadedPhotos();
    if (!bank || photos.length === 0) return;

    this.isAnalyzingPhotos.set(true);
    this.analyzingStepMessage.set(
      'QuestAI Vision: Scanning visual features & detecting site equipment...'
    );

    setTimeout(() => {
      this.analyzingStepMessage.set(
        `Matching visual evidence against ${bank.name} verified checklist...`
      );
      setTimeout(() => {
        this.analyzingStepMessage.set(
          'Evaluating safety standards, isolations, barriers & Red Book rules...'
        );
        setTimeout(() => {
          this.analyzingStepMessage.set(
            'Auto-filling answers, observations, and linking photo evidence...'
          );
          setTimeout(() => {
            // Get questions for this department
            let questions: any[] = [];
            if (bank.isManagers) {
              questions = getQuestionsForDepartment('Managers Site Inspection');
            } else if (bank.department === 'Traffic Management') {
              questions = getQuestionsForDepartment(
                'Traffic Management',
                bank.trafficSubtype || '12D'
              );
            } else {
              questions = getQuestionsForDepartment(bank.department);
            }

            const fillResult =
              this.aiInspectionFillService.generateAiInspectionAnswers(
                bank.id,
                bank.name,
                questions,
                photos,
                this.uploadSiteNotes()
              );

            // Store in localStorage for inspection component
            try {
              localStorage.setItem(
                'questai_pending_ai_fill',
                JSON.stringify(fillResult)
              );
            } catch {}

            // If inspection component is already mounted, apply immediately
            if (this.inspectionComponent) {
              this.inspectionComponent.applyAiPreFill(fillResult);
            }

            // Also call backend inspection action for telemetry
            this.apiService
              .runInspection(
                `AI Photo Inspection: ${bank.name}`,
                `Analyzed ${photos.length} photos. ${fillResult.totalEvaluated} questions auto-filled.`
              )
              .subscribe({
                next: () => {},
                error: () => {},
              });

            this.isAnalyzingPhotos.set(false);
            this.showPhotoUploadModal.set(false);

            // Navigate to inspection page
            this.navigateToInspection(bank.id);
          }, 600);
        }, 500);
      }, 500);
    }, 500);
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
    this.isGenerating.set(true);
    this.shouldScrollToBottom = true;

    // Contact backend inspection service
    this.apiService.runInspection(currentConv.title, text).subscribe({
      next: (res) => {
        const assistantMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'assistant',
          content: res.data.summary,
          timestamp: new Date(),
          attachmentName: docAttachment || 'First Aid Policy',
          structuredInspection: {
            summary: res.data.summary,
            overallRiskLevel: res.data.overallRiskLevel,
            findings: res.data.findings,
            modelIdentifier: res.data.modelIdentifier,
            isMock: res.data.isMock,
          },
        };
        this.appendMessageToActive(assistantMsg);
        this.isGenerating.set(false);
        this.shouldScrollToBottom = true;
      },
      error: (err) => {
        // Helpful fallback if backend is offline or during testing
        const fallbackMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'assistant',
          content:
            err.status === 0
              ? 'I received your query: "' +
                text +
                '".\n\n*(Note: The QuestAI backend is currently unreachable at http://localhost:5001. Please run `npm run dev` in the `backend/` directory to connect live API responses.)*'
              : 'Site inspection review for: "' +
                text +
                '"\n\nEnsure that all structural joints, photographic evidence, and safety logs are submitted for compliance review.',
          timestamp: new Date(),
          attachmentName: docAttachment || 'RA_21_Night Time Working.pdf',
        };
        this.appendMessageToActive(fallbackMsg);
        this.isGenerating.set(false);
        this.shouldScrollToBottom = true;
      },
    });
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
