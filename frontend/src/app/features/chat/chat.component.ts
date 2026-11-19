import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed,
  effect,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatStateService } from '../../core/services/chat-state.service';
import { ReportService } from '../../core/services/report.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatMessageComponent } from './chat-message/chat-message.component';
import { ChatComposerComponent } from './chat-composer/chat-composer.component';
import { InspectionDraftSummaryViewModel } from '../../core/models/inspection-view.models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    ChatMessageComponent,
    ChatComposerComponent,
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  readonly chatState = inject(ChatStateService);
  readonly reportService = inject(ReportService);
  readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('chatScrollContainer') private chatScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('chatComposer') private chatComposer?: ChatComposerComponent;

  private shouldScrollToBottom = false;

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
  private welcomeInterval: any = null;

  readonly activeMessages = computed(() => {
    return this.chatState.activeConversation()?.messages || [];
  });

  readonly hasMessages = computed(() => {
    return this.activeMessages().length > 0;
  });

  constructor() {
    effect(() => {
      const msgCount = this.activeMessages().length;
      const generating = this.chatState.isGenerating();
      if (msgCount > 0 || generating) {
        this.shouldScrollToBottom = true;
      }
    });
  }

  ngOnInit(): void {
    // If route contains :id, select that conversation
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id && id !== this.chatState.activeConversationId()) {
        this.chatState.selectConversation(id);
      }
    });

    this.startWelcomeRotation();
  }

  ngOnDestroy(): void {
    if (this.welcomeInterval) {
      clearInterval(this.welcomeInterval);
      this.welcomeInterval = null;
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private startWelcomeRotation(): void {
    this.welcomeInterval = setInterval(() => {
      this.isHeadingFading.set(true);
      setTimeout(() => {
        this.welcomePhraseIndex.update((i) => (i + 1) % this.welcomePhrases.length);
        this.isHeadingFading.set(false);
      }, 400);
    }, 4500);
  }

  private scrollToBottom(): void {
    try {
      if (this.chatScrollContainer) {
        this.chatScrollContainer.nativeElement.scrollTop =
          this.chatScrollContainer.nativeElement.scrollHeight;
      }
    } catch { }
  }

  closeReviewDrawer(): void {
    this.chatState.closeReviewDrawer();
  }

  onConfirmAssessment(summary: InspectionDraftSummaryViewModel): void {
    this.chatState.onConfirmAssessment(summary);
  }

  downloadReportPdf(summary: InspectionDraftSummaryViewModel): void {
    this.reportService.downloadReportPdf(summary);
  }

  onAssessmentReopened(summary: InspectionDraftSummaryViewModel): void {
    this.chatState.onAssessmentReopened(summary);
  }
}
