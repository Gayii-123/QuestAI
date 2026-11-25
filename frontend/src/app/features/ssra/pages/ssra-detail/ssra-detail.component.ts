import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SsraService } from '../../services/ssra.service';
import { SsraDraftService } from '../../services/ssra-draft.service';
import { SsraAssessment, SsraEvidencePhoto, SsraLifecycleStatus } from '../../models/ssra.models';
import { getQuestionsForDomain, SsraQuestion } from '../../config/ssra-question-catalogue.config';

@Component({
  selector: 'app-ssra-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ssra-detail.component.html',
  styleUrls: ['./ssra-detail.component.css']
})
export class SsraDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ssraService = inject(SsraService);
  private draftService = inject(SsraDraftService);

  assessment = signal<SsraAssessment | null>(null);
  domainQuestions = signal<SsraQuestion[]>([]);
  isLoading = signal(true);
  selectedPhoto = signal<SsraEvidencePhoto | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/ssra']);
      return;
    }

    this.ssraService.getAssessmentById(id).subscribe({
      next: (data) => {
        let finalData = data;
        if (!finalData) {
          finalData = this.draftService.getLocalSubmissionById(id);
        }
        this.assessment.set(finalData);
        if (finalData) {
          this.domainQuestions.set(getQuestionsForDomain(finalData.domainType));
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load assessment:', err);
        const fallback = this.draftService.getLocalSubmissionById(id);
        this.assessment.set(fallback);
        if (fallback) {
          this.domainQuestions.set(getQuestionsForDomain(fallback.domainType));
        }
        this.isLoading.set(false);
      }
    });
  }

  getQuestionText(questionId: string): string {
    const q = this.domainQuestions().find((item) => item.id === questionId);
    return (q ? (q.text || q.questionText) : questionId) || questionId;
  }

  getQuestionControlMeasure(questionId: string): string | undefined {
    const q = this.domainQuestions().find((item) => item.id === questionId);
    return q ? (q.cm || q.controlMeasure) : undefined;
  }

  getQuestionNumber(questionId: string, index: number): number {
    const q = this.domainQuestions().find((item) => item.id === questionId);
    return (q ? (q.qnum || q.questionNumber) : (index + 1)) || (index + 1);
  }

  navigateToClose(): void {
    const a = this.assessment();
    if (!a) return;
    this.router.navigate(['/ssra', a.id, 'close']);
  }

  backToDashboard(): void {
    this.router.navigate(['/ssra']);
  }

  goToReports(): void {
    this.router.navigate(['/reports']);
  }

  printReport(): void {
    window.print();
  }

  openLightbox(photo: SsraEvidencePhoto): void {
    this.selectedPhoto.set(photo);
  }

  closeLightbox(): void {
    this.selectedPhoto.set(null);
  }

  getStatusClass(status: SsraLifecycleStatus): string {
    switch (status) {
      case 'Complete':
        return 'status-complete';
      case 'Level1':
        return 'status-level1';
      case 'Incomplete':
      default:
        return 'status-incomplete';
    }
  }

  getStatusLabel(status: SsraLifecycleStatus): string {
    switch (status) {
      case 'Complete':
        return 'Complete (Shift Closed)';
      case 'Level1':
        return 'Level 1 (Pre-Start Signed)';
      case 'Incomplete':
      default:
        return 'Draft (Incomplete)';
    }
  }
}
