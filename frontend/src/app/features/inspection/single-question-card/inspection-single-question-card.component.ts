import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  InspectionQuestionViewModel,
  InspectionAnswerViewModel,
} from '../../../core/models/inspection-view.models';

@Component({
  selector: 'app-inspection-single-question-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inspection-single-question-card.component.html',
  styleUrls: ['./inspection-single-question-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectionSingleQuestionCardComponent {
  @Input({ required: true }) question!: InspectionQuestionViewModel;
  @Input() questionNumber?: number;
  @Input() totalQuestions?: number;
  @Input() readOnly = false;

  @Output() answer = new EventEmitter<InspectionAnswerViewModel>();
  @Output() skip = new EventEmitter<string>();
  @Output() dismiss = new EventEmitter<string>();

  isInputOpen = signal(false);
  customText = signal('');

  get isAnswered(): boolean {
    return !!this.question?.isAnswered || this.readOnly;
  }

  get selectedRating(): string | null | undefined {
    return this.question?.userAnswerRating;
  }

  get selectedOption(): string | null | undefined {
    return this.question?.userAnswerSelect;
  }

  /**
   * Determine display options.
   * If question defines specific select options from Quest schema, use them.
   * Otherwise default to simple binary "Yes" / "No".
   */
  get options(): { label: string; rating?: '1' | '-1' | '0'; selectValue?: string }[] {
    if (this.question?.selectOptions && this.question.selectOptions.length > 0) {
      return this.question.selectOptions.map((opt) => {
        const label = typeof opt === 'string' ? opt : opt.txt || String(opt);
        return {
          label,
          selectValue: label,
        };
      });
    }

    return [
      { label: 'Yes', rating: '1' },
      { label: 'No', rating: '-1' },
    ];
  }

  onSelectOption(opt: { label: string; rating?: '1' | '-1' | '0'; selectValue?: string }): void {
    if (this.isAnswered) return;

    const answerPayload: InspectionAnswerViewModel = {
      questionId: this.question.questionId,
      rating: opt.rating,
      selectans: opt.selectValue,
      answeredBy: 'human',
      answeredAt: new Date().toISOString(),
    };

    this.answer.emit(answerPayload);
  }

  toggleCustomInput(): void {
    if (this.isAnswered) return;
    this.isInputOpen.update((v) => !v);
  }

  submitCustomText(): void {
    const text = this.customText().trim();
    if (!text || this.isAnswered) return;

    const answerPayload: InspectionAnswerViewModel = {
      questionId: this.question.questionId,
      textAnswer: text,
      comment: text,
      // If user typed something positive, default to compliant rating
      rating: '1',
      answeredBy: 'human',
      answeredAt: new Date().toISOString(),
    };

    this.answer.emit(answerPayload);
    this.isInputOpen.set(false);
  }

  onSkip(): void {
    if (this.isAnswered) return;
    this.skip.emit(this.question.questionId);
  }

  onDismiss(): void {
    if (this.isAnswered) return;
    this.dismiss.emit(this.question.questionId);
  }
}
