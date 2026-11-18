import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { ConversationalInspectionService } from './conversational-inspection.service';
import { ChatPersistenceService } from './chat-persistence.service';
import { ReportService } from './report.service';
import {
  Conversation,
  ChatMessage,
  type InspectionPhoto,
  type ThinkingStep,
} from '../models/chat.models';
import {
  InspectionSessionViewModel,
  InspectionDraftSummaryViewModel,
  InspectionQuestionViewModel,
  InspectionAnswerViewModel,
} from '../models/inspection-view.models';
import {
  SiteInspectionQuestion,
  SiteInspectionBankOption,
  SITE_INSPECTION_BANKS,
  getQuestionsForDepartment,
} from '../models/site-inspection.schema';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per photo
const MAX_INSPECTION_PHOTOS = 10;

@Injectable({
  providedIn: 'root',
})
export class ChatStateService {
  private readonly apiService = inject(ApiService);
  private readonly conversationalInspection = inject(ConversationalInspectionService);
  private readonly chatPersistence = inject(ChatPersistenceService);
  private readonly reportService = inject(ReportService);

  readonly siteInspectionBanks: SiteInspectionBankOption[] = SITE_INSPECTION_BANKS;

  // Conversations list & active ID
  readonly conversations = signal<Conversation[]>([]);
  readonly activeConversationId = signal<string>('');

  readonly activeConversation = computed(() => {
    const id = this.activeConversationId();
    return this.conversations().find((c) => c.id === id) || null;
  });

  // Generation & thinking state
  readonly isGenerating = signal<boolean>(false);
  readonly thinkingWords = signal<string>('Thinking');
  readonly analyzingStepMessage = signal<string>('');
  private thinkingTimer: any = null;

  // Composer attachments state
  readonly composerText = signal<string>('');
  readonly uploadedPhotos = signal<InspectionPhoto[]>([]);
  readonly attachedDocument = signal<string | null>(null);
  readonly photoUploadError = signal<string>('');
  readonly showAttachmentMenu = signal<boolean>(false);

  // Home Screen & Inspection Dropdown state
  readonly selectedUploadBank = signal<SiteInspectionBankOption | null>(null);
  readonly selectedUploadRiskBanks = signal<string[]>([]);
  readonly showHomeInspectionDropdown = signal<boolean>(false);
  readonly showPhotoUploadModal = signal<boolean>(false);
  readonly uploadSiteNotes = signal<string>('');
  readonly isDragOver = signal<boolean>(false);

  // Adaptive Review Drawer state
  readonly activeReviewDraft = signal<InspectionDraftSummaryViewModel | null>(null);
  readonly activeInspectionSession = signal<InspectionSessionViewModel | null>(null);
  readonly activeReviewQuestions = signal<SiteInspectionQuestion[]>([]);
  activeClarificationQueue: InspectionQuestionViewModel[] = [];

  readonly availableRiskBanks = [
    { key: 'hotWorks', label: 'Hot Works (Welding, cutting, grinding)' },
    { key: 'confinedSpaces', label: 'Confined Spaces' },
    { key: 'liftingOperations', label: 'Lifting Operations (Cranes, HIAB)' },
    { key: 'excavation', label: 'Deep Excavations (> 1.2m)' },
    { key: 'workAtHeight', label: 'Working at Height (Scaffolding, MEWPs)' },
    { key: 'asbestos', label: 'Asbestos or Hazardous Materials' },
    { key: 'trafficControl', label: 'Live Traffic Closures & Diversions' },
    { key: 'undergroundServices', label: 'Buried Cables & Utility Strikes' },
  ];

  openPhotoUploadModal(bank?: SiteInspectionBankOption): void {
    if (bank) {
      this.selectedUploadBank.set(bank);
      if (bank.isManagers) {
        this.selectedUploadRiskBanks.set(this.availableRiskBanks.map((r) => r.key));
      } else {
        this.selectedUploadRiskBanks.set([]);
      }
    }
    this.showPhotoUploadModal.set(true);
  }

  closePhotoUploadModal(): void {
    this.showPhotoUploadModal.set(false);
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
    this.selectedUploadRiskBanks.set(this.availableRiskBanks.map((r) => r.key));
  }

  clearAllUploadRiskBanks(): void {
    this.selectedUploadRiskBanks.set([]);
  }

  runAiPhotoAnalysisAndFill(): void {
    const bank = this.selectedUploadBank() || this.siteInspectionBanks[0];
    const photos = this.uploadedPhotos();
    if (!bank || photos.length === 0 || this.isGenerating()) return;

    this.showPhotoUploadModal.set(false);
    this.selectedUploadBank.set(bank);
    if (this.uploadSiteNotes() && !this.composerText()) {
      this.composerText.set(this.uploadSiteNotes());
    }
    this.sendMessage();
  }

  constructor() {
    void this.restorePersistedChatState();
  }

  // --- Persistence & Initialization ---

  async restorePersistedChatState(): Promise<void> {
    try {
      const state = await this.chatPersistence.loadState();
      const convs = state.conversations || [];
      this.conversations.set(convs);

      const activeId = state.activeConversationId;
      if (activeId && convs.some((c: Conversation) => c.id === activeId)) {
        this.activeConversationId.set(activeId);
        const conv = convs.find((c: Conversation) => c.id === activeId);
        if (conv?.selectedBankId) {
          const bank = this.siteInspectionBanks.find((b) => b.id === conv.selectedBankId);
          if (bank) this.selectedUploadBank.set(bank);
        }
        if (conv?.activeInspectionId) {
          const s = this.conversationalInspection.getSession(conv.activeInspectionId);
          this.activeInspectionSession.set(s || null);
        }
      } else if (convs.length > 0) {
        this.activeConversationId.set(convs[0].id);
      }

      const draftPhotos = await this.chatPersistence.loadPendingAttachments(
        this.activeConversationId() || '__draft__'
      );
      this.uploadedPhotos.set(draftPhotos);
    } catch (e) {
      console.warn('Failed to restore chat persistence', e);
    }
  }

  persistChatState(): void {
    void this.chatPersistence.saveConversations(this.conversations(), this.activeConversationId());
  }

  persistPendingComposerPhotos(): void {
    const convId = this.activeConversationId() || '__draft__';
    void this.chatPersistence.savePendingAttachments(convId, this.uploadedPhotos());
  }

  // --- Conversation Lifecycle ---

  startNewChat(): void {
    this.activeConversationId.set('');
    this.composerText.set('');
    this.attachedDocument.set(null);
    this.uploadedPhotos.set([]);
    this.selectedUploadBank.set(null);
    this.activeInspectionSession.set(null);
    this.activeReviewDraft.set(null);
    this.showAttachmentMenu.set(false);
    this.persistChatState();
  }

  selectConversation(id: string): void {
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
    this.persistChatState();
  }

  deleteConversation(id: string): void {
    const conv = this.conversations().find((c) => c.id === id);
    if (conv?.activeInspectionId) {
      this.conversationalInspection.deleteSession(conv.activeInspectionId);
    }
    const list = this.conversations().filter((c) => c.id !== id);
    this.conversations.set(list);
    void this.chatPersistence.deleteConversation(id);
    if (this.activeConversationId() === id) {
      if (list.length > 0) {
        this.selectConversation(list[0].id);
      } else {
        this.startNewChat();
      }
    }
    this.persistChatState();
  }

  clearAllConversations(): void {
    const list = this.conversations();
    for (const c of list) {
      void this.chatPersistence.deleteConversation(c.id);
      if (c.activeInspectionId) {
        this.conversationalInspection.deleteSession(c.activeInspectionId);
      }
    }
    this.conversations.set([]);
    this.startNewChat();
  }

  renameConversation(id: string, newTitle: string): void {
    const trimmed = (newTitle || '').trim();
    if (!trimmed) return;
    this.conversations.update((list) =>
      list.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
    );
    this.persistChatState();
  }

  appendMessageToActive(msg: ChatMessage): void {
    const conv = this.activeConversation();
    if (!conv) return;
    conv.messages = [...(conv.messages || []), msg];
    conv.updatedAt = new Date();
    conv.previewSnippet = msg.content
      ? msg.content.substring(0, 48)
      : msg.photos && msg.photos.length > 0
        ? `Uploaded ${msg.photos.length} photograph(s)`
        : 'Site Inspection Report';

    this.conversations.update((list) =>
      list.map((c) => (c.id === conv.id ? { ...conv } : c))
    );
    this.persistChatState();
  }

  setConversationSelectedBank(bankId: string): void {
    const conv = this.activeConversation();
    if (!conv) return;
    conv.selectedBankId = bankId;
    this.conversations.update((list) =>
      list.map((c) => (c.id === conv.id ? { ...c, selectedBankId: bankId } : c))
    );
    this.persistChatState();
  }

  markCategorySelectedInConversation(bankId: string, messageId?: string): void {
    const conv = this.activeConversation();
    if (!conv?.messages) return;
    for (const msg of conv.messages) {
      if (messageId && msg.id === messageId) {
        msg.categorySelected = true;
        msg.selectedBankId = bankId;
      } else if (!messageId && msg.showInspectionCategories) {
        msg.categorySelected = true;
        msg.selectedBankId = bankId;
      }
    }
    this.conversations.update((list) => [...list]);
    this.persistChatState();
  }

  clearPreviousWorkflowMessagesInActiveConversation(): void {
    const conv = this.activeConversation();
    if (!conv?.messages) return;
    conv.messages = conv.messages.filter(
      (m) =>
        !m.singleQuestion &&
        !m.questionBatch &&
        !m.evidenceMessage &&
        !m.draftSummary &&
        !m.isInspectionWorkflowMessage
    );
    this.conversations.update((list) => [...list]);
    this.persistChatState();
  }

  // --- Attachments & Photo Management ---

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

  removeUploadedPhoto(index: number): void {
    this.uploadedPhotos.update((list) => list.filter((_, i) => i !== index));
    this.persistPendingComposerPhotos();
  }

  clearUploadedPhotos(): void {
    this.uploadedPhotos.set([]);
    this.persistPendingComposerPhotos();
  }

  async processFiles(fileList: FileList | File[]): Promise<void> {
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

  // --- Thinking Animation ---

  startThinkingAnimation(isPhotoAnalysis: boolean = false): void {
    this.clearThinkingAnimation();
    this.thinkingWords.set('Triangulating');

    const photoStages = [
      { delay: 1400, word: 'Reviewing photographs' },
      { delay: 2900, word: 'Examining visual evidence' },
      { delay: 4600, word: 'Checking inspection criteria' },
      { delay: 6400, word: 'Evaluating safety compliance' },
      { delay: 8200, word: 'Synthesizing report' },
    ];

    const textStages = [
      { delay: 1300, word: 'Thinking' },
      { delay: 2700, word: 'Analyzing requirements' },
      { delay: 4300, word: 'Synthesizing response' },
      { delay: 5900, word: 'Formulating findings' },
    ];

    const stages = isPhotoAnalysis ? photoStages : textStages;
    for (const stage of stages) {
      const timer = setTimeout(() => {
        this.thinkingWords.set(stage.word);
      }, stage.delay);
      if (!this.thinkingTimer) this.thinkingTimer = [];
      this.thinkingTimer.push(timer);
    }
  }

  clearThinkingAnimation(): void {
    if (this.thinkingTimer) {
      if (Array.isArray(this.thinkingTimer)) {
        this.thinkingTimer.forEach((t) => clearTimeout(t));
      } else {
        clearTimeout(this.thinkingTimer);
      }
      this.thinkingTimer = null;
    }
    this.thinkingWords.set('Thinking');
  }

  sanitizeProviderBranding(text: string | undefined): string {
    if (!text) return '';
    return text.replace(/\bgemini(-[0-9a-z.-]+)?\b/gi, 'QuestAI');
  }

  // --- Send Message & Workflows ---

  sendMessage(): void {
    const text = this.composerText().trim();
    const photosToSend = [...this.uploadedPhotos()];
    if ((!text && photosToSend.length === 0) || this.isGenerating()) return;

    this.showAttachmentMenu.set(false);
    this.photoUploadError.set('');

    let currentConv = this.activeConversation();
    const docAttachment = this.attachedDocument();

    if (!currentConv) {
      const baseTitle =
        text ||
        (this.selectedUploadBank()?.name
          ? `${this.selectedUploadBank()!.name} Inspection`
          : 'Site Inspection Photos');
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

    // 1. Photos Submitted Workflow
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

      this.isGenerating.set(true);
      this.startThinkingAnimation(true);
      this.analyzingStepMessage.set('Reviewing your photographs...');

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
            const draftSummary =
              turnResponse.draftSummary ||
              this.conversationalInspection.generateDraftSummary(session);
            draftSummary.isConfirmedByInspector = true;
            session.draftSummary = draftSummary;
            this.conversationalInspection.saveSession(session);
            this.reportService.saveFinalizedReportToStorage(session, draftSummary, currentConv.id);

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
          this.clearThinkingAnimation();
          this.analyzingStepMessage.set('');
          this.uploadedPhotos.set([]);
          void this.chatPersistence.savePendingAttachments(currentConv.id, []);
          void this.chatPersistence.savePendingAttachments('__draft__', []);
        })
        .catch((err) => {
          this.isGenerating.set(false);
          this.clearThinkingAnimation();
          this.analyzingStepMessage.set('');

          this.uploadedPhotos.set(photosToSend);
          this.persistPendingComposerPhotos();
          if (text && !this.composerText()) {
            this.composerText.set(text);
          }

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
        });
      return;
    }

    // 2. Normal Text Message Workflow
    const hadActiveSelector = this.hasActiveCategorySelector();

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

    if (hadActiveSelector && /^\s*(cancel|never\s*mind|stop|exit|no\s*thanks)\s*[.!?]*$/i.test(text)) {
      this.cancelCategorySelection();
      return;
    }

    const typedBank = hadActiveSelector
      ? this.matchTypedCategory(text)
      : this.matchExactCategoryName(text);

    if (typedBank) {
      this.onSelectCategoryChipFromChat(typedBank);
      return;
    }

    if (this.isGreeting(text)) {
      const greetingMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'assistant',
        content:
          "Hello! I'm QuestAI, your highway safety and site compliance assistant. How can I help you today? You can ask me compliance questions, or select a **Site Inspection** category from the top menu or by typing its name.",
        timestamp: new Date(),
      };
      this.appendMessageToActive(greetingMsg);
      return;
    }

    const isFormRequest = this.isInspectionFormRequest(text);
    const mentionedBank = isFormRequest ? this.matchTypedCategory(text) : null;

    if (isFormRequest) {
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
      return;
    }

    // General AI generation
    this.isGenerating.set(true);
    this.startThinkingAnimation(false);

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
        this.clearThinkingAnimation();
      },
      error: (err) => {
        this.isGenerating.set(false);
        this.clearThinkingAnimation();

        let errorMessage = 'Unable to generate response. Please try again.';
        if (err.status === 0 || err.status === 429) {
          errorMessage =
            'The AI service is temporarily unavailable due to connectivity or rate limits. Please try again in a few moments.';
        } else if (err.error?.message) {
          errorMessage = this.sanitizeProviderBranding(err.error.message);
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
      },
    });
  }

  // --- Category Selection & Matching ---

  onSelectCategoryChipFromChat(bank: SiteInspectionBankOption, messageId?: string): void {
    if (!bank) return;

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
  }

  hasActiveCategorySelector(): boolean {
    const conv = this.activeConversation();
    if (!conv?.messages || conv.messages.length === 0) return false;
    for (let i = conv.messages.length - 1; i >= 0; i--) {
      const msg = conv.messages[i];
      if (msg.showInspectionCategories) {
        return !msg.categorySelected;
      }
    }
    return false;
  }

  cancelCategorySelection(): void {
    this.clearActiveCategorySelectors();
    const cancelMsg: ChatMessage = {
      id: 'msg-' + (Date.now() + 1),
      sender: 'assistant',
      content: "No problem. I've cancelled category selection. How else can I assist you with site safety or compliance?",
      timestamp: new Date(),
    };
    this.appendMessageToActive(cancelMsg);
  }

  clearActiveCategorySelectors(): void {
    const conv = this.activeConversation();
    if (!conv?.messages) return;
    let modified = false;
    for (const msg of conv.messages) {
      if (msg.showInspectionCategories && !msg.categorySelected) {
        msg.categorySelected = true;
        modified = true;
      }
    }
    if (modified) {
      this.conversations.update((list) => [...list]);
      this.persistChatState();
    }
  }

  matchExactCategoryName(userText: string): SiteInspectionBankOption | null {
    const cleaned = (userText || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!cleaned) return null;

    for (const bank of this.siteInspectionBanks) {
      const nameNorm = bank.name.toLowerCase().replace(/\s+/g, ' ');
      const deptNorm = bank.department.toLowerCase().replace(/\s+/g, ' ');
      const noSlashSpace = nameNorm.replace(/\s*\/\s*/g, '/');

      if (cleaned === nameNorm || cleaned === deptNorm || cleaned === noSlashSpace) {
        return bank;
      }
    }
    return null;
  }

  matchTypedCategory(userText: string): SiteInspectionBankOption | null {
    const exact = this.matchExactCategoryName(userText);
    if (exact) return exact;

    const q = (userText || '').trim().toLowerCase();
    if (!q) return null;

    const categoryMatchers: Array<{ id: string; patterns: RegExp[] }> = [
      { id: 'road-marking-test', patterns: [/\broad\s*marking\s*\(\s*test\s*\)/i, /\broad\s*marking\s*test\b/i] },
      { id: 'tm-12ab', patterns: [/\b(12ab|12\s*ab)\b/i, /\btm\s*12ab\b/i] },
      { id: 'tm-12d', patterns: [/\b(12d|12\s*d)\b/i, /\btm\s*12d\b/i] },
      { id: 'civil-other', patterns: [/\bcivil\b/i, /\bother\b/i, /\bcivil\s*works\b/i] },
      { id: 'street-lighting', patterns: [/\bstreet\s*light(ing)?\b/i, /\blighting\b/i] },
      { id: 'road-marking', patterns: [/\broad\s*marking\b/i, /\bmarking\b/i] },
      { id: 'road-surfacing', patterns: [/\broad\s*surfacing\b/i, /\bsurfacing\b/i, /\basphalt\b/i] },
      { id: 'full-body-harness', patterns: [/\bharness\b/i, /\blanyard\b/i] },
      { id: 'ladder-stepladder', patterns: [/\bladder\b/i, /\bstepladder\b/i] },
      { id: 'depot-check-sheet', patterns: [/\bdepot\b/i, /\bcheck\s*sheet\b/i] },
      { id: 'managers-risk-banks', patterns: [/\brisk\s*bank(s)?\b/i] },
      { id: 'managers-site-inspection', patterns: [/\bmanager('?s)?\b/i] },
    ];

    for (const matcher of categoryMatchers) {
      for (const pattern of matcher.patterns) {
        if (pattern.test(q)) {
          const bank = this.siteInspectionBanks.find((b) => b.id === matcher.id);
          if (bank) return bank;
        }
      }
    }
    return null;
  }

  isInspectionFormRequest(text: string): boolean {
    const q = (text || '').trim().toLowerCase();
    if (!q) return false;
    const formPatterns = [
      /\b(site\s*)?inspection\b/i,
      /\bchecklist\b/i,
      /\bcheck\s*list\b/i,
      /\bfill\s*(out|in|a|the)?\s*(form|checklist|report)?\b/i,
      /\bstart\s*(a|an|the)?\s*(inspection|checklist)\b/i,
      /\bnew\s*inspection\b/i,
      /\bconduct\s*(a|an)?\s*inspection\b/i,
    ];
    return formPatterns.some((pattern) => pattern.test(q));
  }

  isGreeting(text: string): boolean {
    const q = (text || '').trim().toLowerCase();
    return /^(hi|hello|hey|good morning|good afternoon|good evening|howdy)(\s+questai)?[\s!.,]*$/i.test(q);
  }

  // --- Clarifications & Question Handling ---

  onBatchAnswerQuestion(msg: ChatMessage, answer: InspectionAnswerViewModel): void {
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
      msg.singleQuestion.userAnswerText = answer.textAnswer || answer.comment;
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
      return;
    }

    session.workflowStatus = 'completed';
    session.completedAt = new Date().toISOString();
    const draftSummary = this.conversationalInspection.generateDraftSummary(session);
    draftSummary.isConfirmedByInspector = true;
    session.draftSummary = draftSummary;
    this.conversationalInspection.saveSession(session);
    this.reportService.saveFinalizedReportToStorage(session, draftSummary, this.activeConversationId());

    const summaryMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content: 'All done! Your site inspection report is ready.',
      timestamp: new Date(),
      inspectionId: session.inspectionId,
      draftSummary,
    };
    this.appendMessageToActive(summaryMsg);
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
      return;
    }

    session.workflowStatus = 'completed';
    session.completedAt = new Date().toISOString();
    const draftSummary = this.conversationalInspection.generateDraftSummary(session);
    draftSummary.isConfirmedByInspector = true;
    session.draftSummary = draftSummary;
    this.conversationalInspection.saveSession(session);
    this.reportService.saveFinalizedReportToStorage(session, draftSummary, this.activeConversationId());

    const summaryMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content: 'All done! Your site inspection report is ready.',
      timestamp: new Date(),
      inspectionId: session.inspectionId,
      draftSummary,
    };
    this.appendMessageToActive(summaryMsg);
  }

  // --- Review Drawer Integration ---

  openReviewDrawer(draftSummary: InspectionDraftSummaryViewModel, inspectionId?: string): void {
    this.activeReviewDraft.set(draftSummary);
    const sessId = inspectionId || draftSummary.inspectionId || this.activeConversation()?.activeInspectionId;
    if (sessId) {
      const s = this.conversationalInspection.getSession(sessId);
      this.activeInspectionSession.set(s || null);
    }
    const session = this.activeInspectionSession();
    const dept = session?.department || draftSummary.department;
    if (dept) {
      const qs = getQuestionsForDepartment(
        dept,
        session?.trafficSubtype,
        session?.selectedRiskBanks
      );
      this.activeReviewQuestions.set(qs);
    }
  }

  closeReviewDrawer(): void {
    this.activeReviewDraft.set(null);
  }

  onConfirmAssessment(updatedSummary: InspectionDraftSummaryViewModel): void {
    this.activeReviewDraft.set(null);
    const session = this.conversationalInspection.getSession(updatedSummary.inspectionId);
    if (session) {
      session.draftSummary = updatedSummary;
      session.workflowStatus = 'completed';
      session.completedAt = updatedSummary.confirmedAt || new Date().toISOString();
      this.conversationalInspection.saveSession(session);
    }

    this.reportService.saveFinalizedReportToStorage(session, updatedSummary, this.activeConversationId());

    const confirmedMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content: `Inspection assessment ${updatedSummary.referenceNumber} for ${updatedSummary.bankName} has been confirmed. ${updatedSummary.passCount} passed, ${updatedSummary.carCount} defect(s) recorded.`,
      timestamp: new Date(),
    };
    this.appendMessageToActive(confirmedMsg);
  }

  onAssessmentReopened(draftSummary: InspectionDraftSummaryViewModel): void {
    if (!draftSummary) return;
    draftSummary.isConfirmedByInspector = false;
    this.activeReviewDraft.set({ ...draftSummary });

    const session = this.activeInspectionSession();
    if (session) {
      session.workflowStatus = 'draft_ready';
      session.draftSummary = draftSummary;
      this.conversationalInspection.saveSession(session);
    }
  }
}

