import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReportService } from '../../core/services/report.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  readonly reportService = inject(ReportService);
  private readonly router = inject(Router);

  get reports() {
    return this.reportService.inspectionHistoryList();
  }

  get selectedRecord() {
    return this.reportService.selectedHistoryRecord();
  }

  openRecord(record: any): void {
    this.reportService.openHistoryRecord(record);
  }

  closeRecord(): void {
    this.reportService.closeHistoryRecord();
  }

  downloadPdf(record: any): void {
    this.reportService.downloadReportPdf(record);
  }

  deleteRecord(event: MouseEvent, refNumber: string): void {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this inspection report?')) {
      this.reportService.deleteHistoryRecord(refNumber);
    }
  }

  startNewInspection(): void {
    this.router.navigate(['/inspection']);
  }
}
