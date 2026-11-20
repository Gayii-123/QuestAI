import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
import { AuthService } from '../../../core/services/auth.service';

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
  private readonly router = inject(Router);
  readonly chatState = inject(ChatStateService);
  readonly reportService = inject(ReportService);
  readonly authService = inject(AuthService);

  readonly userInitials = computed(() => {
    const name = (
      (this.authService.userProfile() as any)?.name ||
      this.authService.currentUser()?.displayName ||
      'Subhash Kumar'
    ).trim();
    if (!name) return 'SK';
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  });

  readonly userPhotoUrl = computed(() => {
    return this.authService.currentUser()?.photoURL || null;
  });

  isCopied = false;

  getResolvedPhotoUrl(photo: { id?: string; url?: string }): string {
    if (photo.url) return photo.url;
    if (photo.id) {
      const cached = this.chatState.getPhotoUrl(photo.id);
      if (cached) {
        photo.url = cached;
        return cached;
      }
    }
    return '';
  }

  onPhotoError(photo: { url?: string }): void {
    photo.url = '';
  }

  formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async copyResponse(content: string): Promise<void> {
    if (!content || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(content);
      this.isCopied = true;
      setTimeout(() => (this.isCopied = false), 2000);
    } catch {
      // ignore
    }
  }

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

  openInternalAuditWorkspace(): void {
    if (this.msg.internalAuditSession) {
      this.chatState.openSessionInInternalAudit(this.msg.internalAuditSession);
    }
    void this.router.navigate(['/internal-audit']);
  }

  viewInMyReports(): void {
    const ref =
      this.msg.internalAuditSession?.referenceNumber ||
      this.msg.internalAuditResult?.referenceNumber;
    if (ref) {
      const existing = this.reportService.inspectionHistoryList().find(
        (r) => r.referenceNumber === ref
      );
      if (existing) {
        this.reportService.openHistoryRecord(existing);
      }
    }
    void this.router.navigate(['/reports']);
  }

  downloadIaPdf(): void {
    const record = this.msg.internalAuditSession || {
      ...this.msg.internalAuditResult,
      isInternalAudit: true,
      referenceNumber:
        this.msg.internalAuditSession?.referenceNumber ||
        this.msg.internalAuditResult?.referenceNumber ||
        'IA104368',
    };
    this.reportService.downloadReportPdf(record);
  }

  async onInternalAuditPhotosSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.chatState.processFiles(input.files);
      input.value = '';
      this.chatState.runInternalAuditFromUploadedPhotos();
    }
  }

  async onIaPhotoDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      await this.chatState.processFiles(event.dataTransfer.files);
      this.chatState.runInternalAuditFromUploadedPhotos();
    }
  }

  retryMessage(prompt?: string): void {
    if (!prompt || this.chatState.isGenerating()) return;
    this.chatState.composerText.set(prompt);
    this.chatState.sendMessage();
  }
}

