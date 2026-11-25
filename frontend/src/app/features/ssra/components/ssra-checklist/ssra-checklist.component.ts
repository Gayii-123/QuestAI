import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SsraQuestion } from '../../config/ssra-question-catalogue.config';
import { SsraAnswer } from '../../models/ssra.models';

@Component({
  selector: 'app-ssra-checklist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ssra-checklist.component.html',
  styleUrls: ['./ssra-checklist.component.css']
})
export class SsraChecklistComponent implements OnChanges {
  @Input() questions: SsraQuestion[] = [];
  @Input() answers: Record<string, SsraAnswer> = {};
  @Input() disabled: boolean = false;

  @Output() answersChange = new EventEmitter<Record<string, SsraAnswer>>();
  @Output() hotWorksTriggered = new EventEmitter<boolean>();

  expandedNotes: Record<string, boolean> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['answers'] || changes['questions']) {
      this.evaluateHotWorksTriggers();
    }
  }

  setAnswerValue(question: SsraQuestion, value: string): void {
    if (this.disabled) return;

    const existing = this.answers[question.id] || {
      questionId: question.id,
      value: '',
      notes: ''
    };

    const updated = {
      ...this.answers,
      [question.id]: {
        ...existing,
        value: existing.value === value ? '' : value
      }
    };

    this.answers = updated;
    this.answersChange.emit(updated);
    this.evaluateHotWorksTriggers();
  }

  toggleOption(question: SsraQuestion, optionId: string): void {
    if (this.disabled) return;

    const existing = this.answers[question.id] || {
      questionId: question.id,
      value: '',
      notes: '',
      selectedOptionIds: []
    };

    const currentOptions = existing.selectedOptionIds || [];
    const hasOption = currentOptions.includes(optionId);
    const updatedOptions = hasOption
      ? currentOptions.filter((id) => id !== optionId)
      : [...currentOptions, optionId];

    const updated = {
      ...this.answers,
      [question.id]: {
        ...existing,
        selectedOptionIds: updatedOptions,
        value: updatedOptions.length > 0 ? updatedOptions.join(', ') : ''
      }
    };

    this.answers = updated;
    this.answersChange.emit(updated);
    this.evaluateHotWorksTriggers();
  }

  updateNote(questionId: string, noteText: string): void {
    if (this.disabled) return;

    const existing = this.answers[questionId] || {
      questionId,
      value: '',
      notes: ''
    };

    const updated = {
      ...this.answers,
      [questionId]: {
        ...existing,
        notes: noteText
      }
    };

    this.answers = updated;
    this.answersChange.emit(updated);
  }

  toggleNoteField(questionId: string): void {
    this.expandedNotes[questionId] = !this.expandedNotes[questionId];
  }

  isOptionSelected(questionId: string, optionId: string): boolean {
    const ans = this.answers[questionId];
    return !!ans?.selectedOptionIds?.includes(optionId);
  }

  hasAnswer(qId: string): boolean {
    return !!this.answers[qId]?.value;
  }

  isAnswerValue(qId: string, val: string): boolean {
    return this.answers[qId]?.value === val;
  }

  hasNotes(qId: string): boolean {
    return !!this.answers[qId]?.notes;
  }

  getNotes(qId: string): string {
    return this.answers[qId]?.notes || '';
  }

  private evaluateHotWorksTriggers(): void {
    let triggered = false;
    for (const q of this.questions) {
      const ans = this.answers[q.id];
      if (!ans) continue;

      if (q.triggersHotWorks && ans.value?.toLowerCase() === 'yes') {
        triggered = true;
        break;
      }

      if (q.options && ans.selectedOptionIds) {
        for (const optId of ans.selectedOptionIds) {
          const opt: any = q.options.find((o: any) => (typeof o === 'string' ? o === optId : o?.id === optId));
          if (typeof opt === 'object' && opt?.triggersHotWorks) {
            triggered = true;
            break;
          }
        }
      }
      if (triggered) break;
    }
    this.hotWorksTriggered.emit(triggered);
  }
}
