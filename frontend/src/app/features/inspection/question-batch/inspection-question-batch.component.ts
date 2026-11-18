import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  InspectionQuestionBatchViewModel,
  InspectionQuestionViewModel,
  InspectionAnswerViewModel,
} from '../../../core/models/inspection-view.models';
import { QuestRatingValue, SelectOption, MultiSelectOption } from '../../../core/models/site-inspection.schema';

@Component({
  selector: 'app-inspection-question-batch',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inspection-question-batch.component.html',
  styleUrls: ['./inspection-question-batch.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectionQuestionBatchComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) batch!: InspectionQuestionBatchViewModel;
  @Input() readOnly = false;

  @Output() answerQuestion = new EventEmitter<InspectionAnswerViewModel>();
  @Output() submitBatch = new EventEmitter<InspectionAnswerViewModel[]>();
  @Output() requestPhoto = new EventEmitter<string>();
  @Output() continueNext = new EventEmitter<void>();

  onContinueNext(): void {
    this.continueNext.emit();
  }

  // Local draft text & multiselect state
  textDrafts: Record<string, string> = {};
  multiselectDrafts: Record<string, string[]> = {};
  noteOpenState: Record<string, boolean> = {};

  toggleNoteInput(questionId: string): void {
    this.noteOpenState[questionId] = !this.noteOpenState[questionId];
    this.cdr.markForCheck();
  }

  isNoteOpen(questionId: string): boolean {
    return Boolean(this.noteOpenState[questionId]);
  }

  isBatchAllAnswered(): boolean {
    return (
      Array.isArray(this.batch?.questions) &&
      this.batch.questions.length > 0 &&
      this.batch.questions.every((q) => q.isAnswered)
    );
  }

  ngOnInit(): void {
    this.initDrafts();
  }

  private initDrafts(): void {
    if (!this.batch?.questions) return;
    for (const q of this.batch.questions) {
      if (q.userAnswerText) {
        this.textDrafts[q.questionId] = q.userAnswerText;
      }
      if (q.userAnswerMultiselect) {
        this.multiselectDrafts[q.questionId] = [...q.userAnswerMultiselect];
      } else {
        this.multiselectDrafts[q.questionId] = [];
      }
    }
  }

  // --- Rating Chips Handlers ---
  selectRating(question: InspectionQuestionViewModel, rating: QuestRatingValue): void {
    if (this.readOnly) return;

    // Immediately update local question state for instantaneous UI feedback
    question.userAnswerRating = rating;
    question.isAnswered = true;
    question.status = 'user_answered';
    this.cdr.markForCheck();

    const answer: InspectionAnswerViewModel = {
      questionId: question.questionId,
      rating: rating,
      answeredAt: new Date().toISOString(),
    };
    this.answerQuestion.emit(answer);
  }

  // --- Single-Select Handler ---
  selectOption(question: InspectionQuestionViewModel, opt: string | SelectOption): void {
    if (this.readOnly) return;
    const val = typeof opt === 'string' ? opt : opt.txt;

    // Immediately update local question state
    question.userAnswerSelect = val;
    question.isAnswered = true;
    question.status = 'user_answered';
    this.cdr.markForCheck();

    const answer: InspectionAnswerViewModel = {
      questionId: question.questionId,
      selectans: val,
      answeredAt: new Date().toISOString(),
    };
    this.answerQuestion.emit(answer);
  }

  // --- Multi-Select Handlers ---
  toggleMultiOption(question: InspectionQuestionViewModel, opt: MultiSelectOption | string): void {
    if (this.readOnly) return;
    const val = typeof opt === 'string' ? opt : opt.txt;
    const current = this.multiselectDrafts[question.questionId] || [];
    const index = current.indexOf(val);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(val);
    }
    this.multiselectDrafts[question.questionId] = [...current];
    this.cdr.markForCheck();
  }

  isMultiSelected(questionId: string, opt: MultiSelectOption | string): boolean {
    const val = typeof opt === 'string' ? opt : opt.txt;
    return (this.multiselectDrafts[questionId] || []).includes(val);
  }

  saveMultiselectAnswer(question: InspectionQuestionViewModel): void {
    if (this.readOnly) return;
    const selections = this.multiselectDrafts[question.questionId] || [];

    question.userAnswerMultiselect = [...selections];
    question.isAnswered = true;
    question.status = 'user_answered';
    this.cdr.markForCheck();

    const answer: InspectionAnswerViewModel = {
      questionId: question.questionId,
      multiselectans: selections,
      answeredAt: new Date().toISOString(),
    };
    this.answerQuestion.emit(answer);
  }

  // --- Free-Text Handler ---
  submitTextAnswer(question: InspectionQuestionViewModel): void {
    if (this.readOnly) return;
    const text = (this.textDrafts[question.questionId] || '').trim();
    if (!text) return;

    question.userAnswerText = text;
    question.isAnswered = true;
    this.noteOpenState[question.questionId] = false;
    this.cdr.markForCheck();

    const answer: InspectionAnswerViewModel = {
      questionId: question.questionId,
      textAnswer: text,
      answeredAt: new Date().toISOString(),
    };
    this.answerQuestion.emit(answer);
  }

  // --- Request Photo Handler ---
  onRequestPhoto(questionId: string): void {
    this.requestPhoto.emit(questionId);
  }

  // --- Submit Entire Batch ---
  onSubmitAllPending(): void {
    if (this.readOnly) return;
    const answers: InspectionAnswerViewModel[] = [];
    for (const q of this.batch.questions) {
      const text = (this.textDrafts[q.questionId] || '').trim();
      const multi = this.multiselectDrafts[q.questionId] || [];
      if (text || multi.length > 0 || q.userAnswerRating || q.userAnswerSelect) {
        answers.push({
          questionId: q.questionId,
          rating: q.userAnswerRating || undefined,
          selectans: q.userAnswerSelect || undefined,
          multiselectans: multi.length > 0 ? multi : q.userAnswerMultiselect || undefined,
          textAnswer: text || q.userAnswerText || undefined,
          answeredAt: new Date().toISOString(),
        });
      }
    }
    if (answers.length > 0) {
      this.submitBatch.emit(answers);
    }
  }

  // --- Utility Helpers for Template ---
  isRatingQuestion(q: InspectionQuestionViewModel): boolean {
    if (!q.typeofans || q.typeofans.length === 0) return true;
    return q.typeofans.includes('rating');
  }

  isSelectQuestion(q: InspectionQuestionViewModel): boolean {
    return Boolean(q.typeofans?.includes('select') && Array.isArray(q.selectOptions) && q.selectOptions.length > 0);
  }

  isMultiSelectQuestion(q: InspectionQuestionViewModel): boolean {
    return Boolean(q.typeofans?.includes('multiselect') && Array.isArray(q.multiselectOptions) && q.multiselectOptions.length > 0);
  }

  isTextQuestion(q: InspectionQuestionViewModel): boolean {
    return Boolean(
      q.typeofans?.includes('text') ||
      q.typeofans?.includes('textarea') ||
      (!this.isRatingQuestion(q) && !this.isSelectQuestion(q) && !this.isMultiSelectQuestion(q))
    );
  }

  hasSelectOptions(q: InspectionQuestionViewModel): boolean {
    return Array.isArray(q.selectOptions) && q.selectOptions.length > 0;
  }

  hasMultiSelectOptions(q: InspectionQuestionViewModel): boolean {
    return Array.isArray(q.multiselectOptions) && q.multiselectOptions.length > 0;
  }

  getOptionText(opt: string | SelectOption | MultiSelectOption): string {
    if (typeof opt === 'string') return opt;
    return opt.txt || String(opt);
  }

  getPendingCount(): number {
    return (this.batch?.questions || []).filter((q) => !q.isAnswered).length;
  }

  getAnsweredCount(): number {
    return (this.batch?.questions || []).filter((q) => q.isAnswered).length;
  }

  getMultiDraftCount(questionId: string): number {
    return (this.multiselectDrafts[questionId] || []).length;
  }

  hasTextDraft(questionId: string): boolean {
    return Boolean(this.textDrafts[questionId] && this.textDrafts[questionId].trim().length > 0);
  }
}
