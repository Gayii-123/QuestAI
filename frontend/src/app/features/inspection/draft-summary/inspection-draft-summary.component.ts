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

  onReviewClick(): void {
    this.openReview.emit(this.summary);
  }

  onDownloadPdfClick(): void {
    this.downloadPdf.emit(this.summary);
  }
}
