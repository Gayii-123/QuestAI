import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InspectionDraftSummaryViewModel } from '../../../core/models/inspection-view.models';

@Component({
  selector: 'app-inspection-draft-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inspection-draft-summary.component.html',
  styleUrls: ['./inspection-draft-summary.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectionDraftSummaryComponent {
  @Input({ required: true }) summary!: InspectionDraftSummaryViewModel;
  @Output() openReview = new EventEmitter<InspectionDraftSummaryViewModel>();
  @Output() downloadPdf = new EventEmitter<InspectionDraftSummaryViewModel>();

  get complianceScore(): number {
    if (!this.summary) return 100;
    const evaluated = (this.summary.passCount || 0) + (this.summary.carCount || 0);
    if (evaluated === 0) return 100;
    return Math.round(((this.summary.passCount || 0) / evaluated) * 100);
  }

  get isCompliant(): boolean {
    return (this.summary?.carCount || 0) === 0;
  }

  get displayReference(): string {
    if (!this.summary?.referenceNumber) return 'SI-2026';
    return this.summary.referenceNumber.replace(/--+/g, '-');
  }

  onReviewClick(): void {
    this.openReview.emit(this.summary);
  }

  onDownloadPdfClick(): void {
    this.downloadPdf.emit(this.summary);
  }
}
