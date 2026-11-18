import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  InspectionDraftSummaryViewModel,
  InspectionSessionViewModel,
  InspectionQuestionViewModel,
} from '../../../core/models/inspection-view.models';
import {
  SiteInspectionQuestion,
  groupQuestionsByHeader,
  QuestionGroup,
  getQuestionsForDepartment,
} from '../../../core/models/site-inspection.schema';
import { QuestionAnswer } from '../site-inspection.models';

@Component({
  selector: 'app-inspection-review-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inspection-review-drawer.component.html',
  styleUrls: ['./inspection-review-drawer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectionReviewDrawerComponent implements OnInit, OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) draftSummary!: InspectionDraftSummaryViewModel;
  @Input() session?: InspectionSessionViewModel | null;
  @Input() canonicalQuestions: SiteInspectionQuestion[] = [];

  @Output() closeDrawer = new EventEmitter<void>();
  @Output() confirmAssessment = new EventEmitter<InspectionDraftSummaryViewModel>();
  @Output() downloadPdf = new EventEmitter<InspectionDraftSummaryViewModel>();

  questionGroups = signal<QuestionGroup[]>([]);
  activeFilter = signal<'all' | 'pass' | 'car' | 'na' | 'unresolved'>('all');
  isConfirmed = signal<boolean>(false);
  inspectorSignOffName: string = 'Site Inspector';

  ngOnInit(): void {
    this.loadQuestions();
    if (this.draftSummary?.isConfirmedByInspector) {
      this.isConfirmed.set(true);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['canonicalQuestions'] || changes['session'] || changes['draftSummary']) {
      this.loadQuestions();
    }
  }

  private loadQuestions(): void {
    let allQuestions: any[] = [];
    if (this.canonicalQuestions && this.canonicalQuestions.length > 0) {
      allQuestions = [...this.canonicalQuestions];
    } else {
      const dept = this.session?.department || this.draftSummary?.department;
      if (dept) {
        const qs = getQuestionsForDepartment(
          dept,
          this.session?.trafficSubtype,
          this.session?.selectedRiskBanks
        );
        if (qs && qs.length > 0) {
          allQuestions = [...qs];
          this.canonicalQuestions = qs;
        }
      }
    }

    // Merge any dynamic abnormality questions from session
    if (this.session?.questionAssessments) {
      const dynamicQs = Object.values(this.session.questionAssessments).filter(
        (q: any) => q.isDynamicObservation || q.questionId.startsWith('abnormality_') || q.questionId.startsWith('extra_')
      );
      for (const dq of dynamicQs) {
        if (!allQuestions.some((item) => item.id === dq.questionId)) {
          allQuestions.push({
            id: dq.questionId,
            qnum: dq.qnum,
            headername: dq.headername,
            qtext: dq.qtext,
            typeofans: dq.typeofans,
            guidance: dq.guidance,
            isDynamicObservation: true,
          });
        }
      }
    }

    this.questionGroups.set(groupQuestionsByHeader(allQuestions));
    this.cdr.markForCheck();
  }

  getSupportingPhotos(questionId: string): any[] {
    const qAssessment = this.getQuestionAssessment(questionId);
    if (!qAssessment) return [];
    // Only display inline thumbnails if this check is a dynamic observation or defect (-1)
    if (!qAssessment.isDynamicObservation && qAssessment.userAnswerRating !== '-1' && qAssessment.suggestedRating !== '-1') {
      return [];
    }
    const photoIds = qAssessment.supportingPhotoIds;
    if (!photoIds || photoIds.length === 0 || !this.session?.uploadedPhotos) return [];
    return this.session.uploadedPhotos.filter((p) => photoIds.includes(p.id) && p.url && p.url.trim().length > 0);
  }

  getRequirementStatusText(questionId: string): string {
    const rating = this.getQuestionRating(questionId);
    if (rating === '1') return 'Yes / Good';
    if (rating === '-1') return 'Action Required';
    if (rating === '0') return 'N/A';
    return '';
  }

  getAnswer(questionId: string): QuestionAnswer | undefined {
    return this.draftSummary?.answers?.[questionId] || this.session?.answers?.[questionId];
  }

  getQuestionRating(questionId: string): string {
    const ans = this.getAnswer(questionId);
    return ans?.rating || '';
  }

  getQuestionAssessment(questionId: string): InspectionQuestionViewModel | undefined {
    return this.session?.questionAssessments?.[questionId];
  }

  getEvidenceText(questionId: string): string {
    const qAssessment = this.getQuestionAssessment(questionId);
    if (qAssessment?.evidenceObserved) return qAssessment.evidenceObserved;
    const ans = this.getAnswer(questionId);
    return ans?.aiEvidence || '';
  }

  getCarActionPlanText(questionId: string): string {
    const ans = this.getAnswer(questionId);
    if (ans?.carActionPlan) return ans.carActionPlan;
    const qAssessment = this.getQuestionAssessment(questionId);
    return qAssessment?.carActionPlan || '';
  }

  onCarPlanInput(questionId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const val = target ? target.value : '';
    this.updateCarActionPlan(questionId, val);
  }

  getSelectAnswerText(questionId: string): string {
    const ans = this.getAnswer(questionId);
    return ans?.selectans || '';
  }

  setFilter(filter: 'all' | 'pass' | 'car' | 'na' | 'unresolved'): void {
    this.activeFilter.set(filter);
    this.cdr.markForCheck();
  }

  isQuestionVisible(q: SiteInspectionQuestion): boolean {
    const filter = this.activeFilter();
    if (filter === 'all') return true;
    const rating = this.getQuestionRating(q.id);
    if (filter === 'pass') return rating === '1';
    if (filter === 'car') return rating === '-1';
    if (filter === 'na') return rating === '0';
    if (filter === 'unresolved') return !rating;
    return true;
  }

  updateQuestionRating(questionId: string, rating: '1' | '-1' | '0'): void {
    if (this.isConfirmed()) return;
    if (!this.draftSummary.answers) {
      this.draftSummary.answers = {};
    }
    const current = this.draftSummary.answers[questionId] || {};
    this.draftSummary.answers[questionId] = {
      ...current,
      rating,
      answeredBy: 'human',
    };
    if (this.session) {
      if (!this.session.answers) this.session.answers = {};
      this.session.answers[questionId] = {
        ...(this.session.answers[questionId] || {}),
        rating,
        answeredBy: 'human',
      };
      const qAssess = this.session.questionAssessments?.[questionId];
      if (qAssess) {
        qAssess.userAnswerRating = rating;
        qAssess.isAnswered = true;
        qAssess.status = 'user_answered';
      }
    }
    this.recalculateDraftCounts();
    this.cdr.markForCheck();
  }

  updateCarActionPlan(questionId: string, actionPlan: string): void {
    if (this.isConfirmed()) return;
    if (!this.draftSummary.answers) this.draftSummary.answers = {};
    const current = this.draftSummary.answers[questionId] || {};
    this.draftSummary.answers[questionId] = {
      ...current,
      carActionPlan: actionPlan,
    };
    if (this.session) {
      if (!this.session.answers) this.session.answers = {};
      this.session.answers[questionId] = {
        ...(this.session.answers[questionId] || {}),
        carActionPlan: actionPlan,
      };
      const qAssess = this.session.questionAssessments?.[questionId];
      if (qAssess) {
        qAssess.carActionPlan = actionPlan;
      }
    }
    this.cdr.markForCheck();
  }

  private recalculateDraftCounts(): void {
    const answers = Object.values(this.draftSummary.answers || {});
    this.draftSummary.passCount = answers.filter((a) => a.rating === '1').length;
    this.draftSummary.carCount = answers.filter((a) => a.rating === '-1').length;
    this.draftSummary.naCount = answers.filter((a) => a.rating === '0').length;
    const answeredCount =
      this.draftSummary.passCount + this.draftSummary.carCount + this.draftSummary.naCount;
    this.draftSummary.unresolvedCount = Math.max(
      0,
      this.draftSummary.totalApplicable - answeredCount
    );
  }

  onConfirmClick(): void {
    this.isConfirmed.set(true);
    this.cdr.markForCheck();
    const updatedSummary: InspectionDraftSummaryViewModel = {
      ...this.draftSummary,
      isConfirmedByInspector: true,
      confirmedAt: new Date().toISOString(),
    };
    this.confirmAssessment.emit(updatedSummary);
  }

  onDownloadPdf(): void {
    this.downloadPdf.emit(this.draftSummary);
  }

  onClose(): void {
    this.closeDrawer.emit();
  }
}
