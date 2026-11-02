import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, HealthResponse, AIServiceStatusResponse } from './core/services/api.service';
import { ChatMessage, Conversation, SuggestionPrompt } from './core/models/chat.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, AfterViewChecked {
  private readonly apiService = inject(ApiService);

  @ViewChild('chatScrollContainer') private chatScrollContainer?: ElementRef<HTMLDivElement>;

  // Mobile sidebar drawer state
  mobileSidebarOpen = signal<boolean>(false);

  // Search filter for recent conversations
  searchQuery = signal<string>('');

  // Composer input model
  composerText = signal<string>('');

  // Assistant typing / responding state
  isGenerating = signal<boolean>(false);

  // Attachment upload feedback toast state
  attachmentNotice = signal<string | null>(null);
  private attachmentNoticeTimer?: ReturnType<typeof setTimeout>;

  // Diagnostics Modal state
  showDiagnosticsModal = signal<boolean>(false);
  diagnosticsLoading = signal<boolean>(false);
  healthData = signal<HealthResponse | null>(null);
  healthError = signal<string | null>(null);
  aiStatusData = signal<AIServiceStatusResponse['data'] | null>(null);
  aiStatusError = signal<string | null>(null);

  // Standard Suggestion Prompts requested by project specification
  readonly suggestionCards: SuggestionPrompt[] = [
    {
      id: 'doc-understanding',
      title: 'Understand an Inspection Document',
      description: 'Find important information, requirements, and relevant sections.',
      prompt: 'Help me analyze this site inspection document to identify mandatory safety standards, regulatory compliance sections, and inspection checklists.',
      category: 'document',
    },
    {
      id: 'evidence-review',
      title: 'Review Inspection Evidence',
      description: 'Organise available evidence and identify information that may be missing.',
      prompt: 'Review the collected site inspection evidence, organize observations by risk level, and highlight any missing photographic or testing records.',
      category: 'evidence',
    },
    {
      id: 'response-prep',
      title: 'Prepare Inspection Responses',
      description: 'Get assistance preparing answers based on the available inspection information.',
      prompt: 'Draft an inspection response detailing corrective actions, contractor remediation timelines, and preventive measures.',
      category: 'response',
    },
  ];

  // Conversations in-memory state
  conversations = signal<Conversation[]>([
    {
      id: 'conv-1',
      title: 'Building A Perimeter Joint Review',
      updatedAt: new Date(Date.now() - 1000 * 60 * 45), // 45 mins ago
      previewSnippet: 'Foundation inspection and structural joint verification...',
      messages: [
        {
          id: 'm1',
          sender: 'user',
          content: 'Can you review the perimeter wall and foundation joints at Grid A-1?',
          timestamp: new Date(Date.now() - 1000 * 60 * 45),
        },
        {
          id: 'm2',
          sender: 'assistant',
          content: 'Here is the preliminary evaluation for the perimeter wall at Grid A-1:',
          timestamp: new Date(Date.now() - 1000 * 60 * 44),
          structuredInspection: {
            summary: 'Preliminary structural & safety review indicates alignment is within acceptable tolerances. Regular scheduled visual checks are advised.',
            overallRiskLevel: 'low',
            modelIdentifier: 'gemini-1.5-pro (backend proxy)',
            isMock: true,
            findings: [
              {
                id: 'finding-1',
                category: 'safety',
                severity: 'low',
                title: 'Foundation & Framing Alignment Verification',
                description: 'Initial geometry review shows minimal expansion gap variance. Visual crack detection and load monitoring recommended.',
                location: 'Perimeter Wall / Grid A-1',
                recommendation: 'Perform regular scheduled visual inspection and verify compliance documentation.',
                confidenceScore: 0.95,
              },
            ],
          },
        },
      ],
    },
    {
      id: 'conv-2',
      title: 'HVAC Ductwork & Fire Damper Audit',
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26), // Yesterday
      previewSnippet: 'Checked mechanical room penetrations for firestopping compliance.',
      messages: [
        {
          id: 'm3',
          sender: 'user',
          content: 'What are the required inspection points for fire damper installations in mechanical shafts?',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26),
        },
        {
          id: 'm4',
          sender: 'assistant',
          content: 'Key inspection requirements for mechanical fire dampers include:\n\n1. **Clear Access**: Minimum 18" clearance around inspection hatches.\n2. **Actuator & Link Testing**: Verification of fusible link rating and thermal release.\n3. **Perimeter Firestopping**: Non-combustible sealant installation complying with ASTM E814 / UL 1479.\n4. **Documentation**: Affixed inspection tag with contractor license and date stamped.',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26 + 1000 * 15),
        },
      ],
    },
  ]);

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
    // Check initial health quietly in background for diagnostics drawer
    this.fetchDiagnosticsQuiet();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  // --- Sidebar & Navigation Controls ---

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((val) => !val);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  startNewChat(): void {
    this.activeConversationId.set('');
    this.composerText.set('');
    this.closeMobileSidebar();
  }

  selectConversation(id: string): void {
    this.activeConversationId.set(id);
    this.closeMobileSidebar();
    this.shouldScrollToBottom = true;
  }

  // --- Suggestion Cards & Message Handling ---

  onSelectSuggestion(card: SuggestionPrompt): void {
    this.composerText.set(card.prompt);
    this.sendMessage();
  }

  sendMessage(): void {
    const text = this.composerText().trim();
    if (!text || this.isGenerating()) return;

    let currentConv = this.activeConversation();

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
    };

    this.appendMessageToActive(userMessage);
    this.composerText.set('');
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

  // --- Diagnostics Modal (Preserves backend status & health check) ---

  openDiagnostics(): void {
    this.showDiagnosticsModal.set(true);
    this.refreshDiagnostics();
  }

  closeDiagnostics(): void {
    this.showDiagnosticsModal.set(false);
  }

  refreshDiagnostics(): void {
    this.diagnosticsLoading.set(true);
    this.healthError.set(null);
    this.aiStatusError.set(null);

    this.apiService.getHealth().subscribe({
      next: (data) => {
        this.healthData.set(data);
        this.diagnosticsLoading.set(false);
      },
      error: (err) => {
        this.healthError.set(
          err.status === 0
            ? 'Backend server not responding on http://localhost:5001'
            : err.message
        );
        this.diagnosticsLoading.set(false);
      },
    });

    this.apiService.getAiStatus().subscribe({
      next: (res) => {
        this.aiStatusData.set(res.data);
      },
      error: (err) => {
        this.aiStatusError.set(
          err.status === 0 ? 'Backend not responding' : err.message
        );
      },
    });
  }

  private fetchDiagnosticsQuiet(): void {
    this.apiService.getHealth().subscribe({
      next: (data) => this.healthData.set(data),
      error: () => this.healthData.set(null),
    });
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
