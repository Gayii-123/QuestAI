import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChatMessage } from '../../../core/models/chat.models';
import {
  InspectionAnswerViewModel,
  InspectionDraftSummaryViewModel,
} from '../../../core/models/inspection-view.models';
import {
  SiteInspectionBankOption,
  SITE_INSPECTION_BANKS,
} from '../../../core/models/site-inspection.schema';
import { ChatStateService } from '../../../core/services/chat-state.service';
import { ReportService } from '../../../core/services/report.service';

import { InspectionProgressComponent } from '../../inspection/progress/inspection-progress.component';
import { InspectionSingleQuestionCardComponent } from '../../inspection/single-question-card/inspection-single-question-card.component';
import { InspectionEvidenceMessageComponent } from '../../inspection/evidence-message/inspection-evidence-message.component';
import { InspectionQuestionBatchComponent } from '../../inspection/question-batch/inspection-question-batch.component';
import { InspectionDraftSummaryComponent } from '../../inspection/draft-summary/inspection-draft-summary.component';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [
    CommonModule,
    InspectionProgressComponent,
    InspectionSingleQuestionCardComponent,
    InspectionEvidenceMessageComponent,
    InspectionQuestionBatchComponent,
    InspectionDraftSummaryComponent,
  ],
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.css'],
})
export class ChatMessageComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly chatState = inject(ChatStateService);
  readonly reportService = inject(ReportService);

  @Input({ required: true }) msg!: ChatMessage;

  readonly siteInspectionBanks: SiteInspectionBankOption[] = SITE_INSPECTION_BANKS;

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
      if (!trimmed) continue;

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

  onSingleQuestionAnswer(answer: InspectionAnswerViewModel): void {
    this.chatState.onBatchAnswerQuestion(this.msg, answer);
  }

  onSingleQuestionSkip(questionId: string): void {
    this.chatState.onSingleQuestionSkip(this.msg, questionId);
  }

  onBatchAnswerQuestion(answer: InspectionAnswerViewModel): void {
    this.chatState.onBatchAnswerQuestion(this.msg, answer);
  }

  onBatchSubmitAll(event: any): void { }

  onBatchContinue(): void { }

  onQuestionRequestPhoto(questionId: string): void { }

  openReviewDrawer(summary: InspectionDraftSummaryViewModel): void {
    this.chatState.openReviewDrawer(summary, this.msg.inspectionId);
  }

  downloadReportPdf(summary: InspectionDraftSummaryViewModel): void {
    this.reportService.downloadReportPdf(summary);
  }

  onSelectCategoryChip(bank: SiteInspectionBankOption): void {
    this.chatState.onSelectCategoryChipFromChat(bank, this.msg.id);
  }

  cancelCategorySelection(): void {
    this.chatState.cancelCategorySelection();
  }

  async onDirectPhotosSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.chatState.processFiles(input.files);
      input.value = '';
    }
  }

  onDirectPhotoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  async onDirectPhotoDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      await this.chatState.processFiles(event.dataTransfer.files);
    }
  }

  retryMessage(prompt?: string): void {
    if (!prompt || this.chatState.isGenerating()) return;
    this.chatState.composerText.set(prompt);
    this.chatState.sendMessage();
  }
}

