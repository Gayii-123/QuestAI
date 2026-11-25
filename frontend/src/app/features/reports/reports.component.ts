import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReportService } from '../../core/services/report.service';
import {
  INTERNAL_AUDIT_CONDITIONS,
  InternalAuditRating,
} from '../internal-audit/internal-audit-conditions.config';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent implements OnInit {
  readonly reportService = inject(ReportService);
  private readonly router = inject(Router);

  // Tab Filtering: All | Risk Assessments (SSRA) | Site Inspections | Internal Audits
  readonly activeTab = signal<'all' | 'ssra' | 'site_inspection' | 'internal_audit'>('all');

  // Internal Audit Edit Mode state
  readonly isEditingInternalAudit = signal<boolean>(false);
  readonly editableInternalAudit = signal<any | null>(null);
  readonly saveSuccessMessage = signal<string | null>(null);

  // Authoritative reference lists
  readonly conditionsList = INTERNAL_AUDIT_CONDITIONS;
  readonly availableRatings: readonly InternalAuditRating[] = [
    'Good Practice',
    'Compliant',
    'Observations only',
    'Area for Improvement',
    'Minor Non-Conformance',
    'Major Non-Conformance',
  ];

  ngOnInit(): void {
    this.reportService.loadInspectionHistory();
  }

  get reports(): any[] {
    return this.reportService.inspectionHistoryList();
  }

  get totalCount(): number {
    return this.reports.length;
  }

  get ssraCount(): number {
    return this.reports.filter((r) => r.isSsra).length;
  }

  get siteCount(): number {
    return this.reports.filter((r) => !r.isInternalAudit && !r.isSsra).length;
  }

  get iaCount(): number {
    return this.reports.filter((r) => r.isInternalAudit).length;
  }

  get filteredReports(): any[] {
    const tab = this.activeTab();
    if (tab === 'ssra') {
      return this.reports.filter((r) => r.isSsra);
    }
    if (tab === 'site_inspection') {
      return this.reports.filter((r) => !r.isInternalAudit && !r.isSsra);
    }
    if (tab === 'internal_audit') {
      return this.reports.filter((r) => r.isInternalAudit);
    }
    return this.reports;
  }

  get selectedRecord(): any | null {
    return this.reportService.selectedHistoryRecord();
  }

  setFilterTab(tab: 'all' | 'ssra' | 'site_inspection' | 'internal_audit'): void {
    this.activeTab.set(tab);
  }

  openRecord(record: any): void {
    if (record.isSsra) {
      const ssraId =
        record.rawAssessment?.id ||
        record.rawAssessment?.refno ||
        record.referenceNumber ||
        record.id;
      this.router.navigate(['/ssra', ssraId]);
      return;
    }
    this.cancelEditingInternalAudit();
    this.reportService.openHistoryRecord(record);
  }

  closeRecord(): void {
    this.cancelEditingInternalAudit();
    this.reportService.closeHistoryRecord();
  }

  // =========================================================================
  // Internal Audit Editing Workflow
  // =========================================================================

  startEditingInternalAudit(): void {
    const rec = this.selectedRecord;
    if (!rec) return;
    this.editableInternalAudit.set(JSON.parse(JSON.stringify(rec)));
    this.isEditingInternalAudit.set(true);
  }

  cancelEditingInternalAudit(): void {
    this.isEditingInternalAudit.set(false);
    this.editableInternalAudit.set(null);
  }

  saveEditingInternalAudit(): void {
    const edited = this.editableInternalAudit();
    if (!edited) return;

    // Normalize observations and CAR logic
    const obs = Array.isArray(edited.observations) ? edited.observations : [];
    for (const item of obs) {
      const isCar =
        item.rating === 'Area for Improvement' ||
        item.rating === 'Minor Non-Conformance' ||
        item.rating === 'Major Non-Conformance';

      if (isCar) {
        item.hasCar = 'Yes';
        item.carStatus = item.carStatus || 'Open';
        if (!item.carRef || item.carRef === '-' || item.carRef.trim() === '') {
          item.carRef = 'CA' + Math.floor(10000000 + Math.random() * 90000000);
        }
        if (!item.resolveByDateFormatted) {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          item.resolveByDateFormatted = d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
        item.who = item.who || item.assignedTo || edited.siteIncharge || 'Warrick Oliver';
      } else {
        item.hasCar = 'No';
        item.carStatus = 'Not Required';
      }
    }

    edited.auditorSummary = edited.auditorComment;
    edited.comment = edited.auditorComment;

    // Recalculate statistics
    const compliantCount = obs.filter(
      (o: any) => o.rating === 'Compliant' || o.rating === 'Good Practice'
    ).length;
    const carCount = obs.filter((o: any) => o.hasCar === 'Yes').length;
    const obsOnlyCount = obs.filter((o: any) => o.rating === 'Observations only').length;

    edited.stats = {
      total: obs.length,
      answered: obs.length,
      passCount: compliantCount,
      carCount: carCount,
      naCount: 0,
      obsCount: obsOnlyCount,
    };
    edited.totalScore = obs.length > 0 ? Math.round((compliantCount / obs.length) * 100) : 100;
    edited.updatedAt = new Date().toISOString();

    // Persist via service (local storage + Firebase backend sync)
    this.reportService.saveInternalAuditRecord(edited);

    this.isEditingInternalAudit.set(false);
    this.editableInternalAudit.set(null);

    // Show temporary success toast
    this.saveSuccessMessage.set('✓ Internal Audit Report saved successfully to My Reports');
    setTimeout(() => {
      this.saveSuccessMessage.set(null);
    }, 4000);
  }

  onAuditRatingChange(obs: any, newRating: InternalAuditRating | string): void {
    obs.rating = newRating;
    const isCar =
      newRating === 'Area for Improvement' ||
      newRating === 'Minor Non-Conformance' ||
      newRating === 'Major Non-Conformance';

    if (isCar) {
      obs.hasCar = 'Yes';
      obs.carStatus = 'Open';
      if (!obs.carRef || obs.carRef === '-' || obs.carRef.trim() === '') {
        obs.carRef = 'CA' + Math.floor(10000000 + Math.random() * 90000000);
      }
      if (!obs.resolveByDateFormatted) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        obs.resolveByDateFormatted = d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      if (!obs.who) {
        obs.who = this.editableInternalAudit()?.siteIncharge || 'Warrick Oliver';
      }
    } else {
      obs.hasCar = 'No';
      obs.carStatus = 'Not Required';
    }
  }

  onConditionChange(obs: any, conditionId: string): void {
    const def = this.conditionsList.find((c) => c.id === conditionId);
    if (def) {
      obs.focusAreaRef = def.id;
      obs.focusArea = def.focusArea;
    }
  }

  addObservation(): void {
    const edited = this.editableInternalAudit();
    if (!edited) return;
    if (!Array.isArray(edited.observations)) {
      edited.observations = [];
    }

    // Default to next available condition
    const currentRefs = new Set(edited.observations.map((o: any) => o.focusAreaRef));
    const nextCond = this.conditionsList.find((c) => !currentRefs.has(c.id)) || this.conditionsList[0];

    edited.observations.push({
      focusArea: nextCond.focusArea,
      focusAreaRef: nextCond.id,
      finding: 'Site conditions inspected and evaluated against standard safety requirements.',
      suggestedAction: nextCond.requirement,
      rating: 'Compliant',
      hasCar: 'No',
      carStatus: 'Not Required',
      supportingPhotoIds: [],
    });
  }

  removeObservation(index: number): void {
    const edited = this.editableInternalAudit();
    if (!edited || !Array.isArray(edited.observations)) return;
    if (index >= 0 && index < edited.observations.length) {
      edited.observations.splice(index, 1);
    }
  }

  // =========================================================================
  // Report Actions & Helpers
  // =========================================================================

  downloadPdf(record: any): void {
    if (record.isSsra) {
      const ssraId =
        record.rawAssessment?.id ||
        record.rawAssessment?.refno ||
        record.referenceNumber ||
        record.id;
      this.router.navigate(['/ssra', ssraId]);
      return;
    }
    this.reportService.downloadReportPdf(record);
  }

  deleteRecord(event: MouseEvent, refNumber: string): void {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this report from history?')) {
      this.reportService.deleteHistoryRecord(refNumber);
    }
  }

  startNewSsra(): void {
    this.router.navigate(['/ssra/new']);
  }

  startNewInspection(): void {
    this.router.navigate(['/inspection']);
  }

  startNewInternalAudit(): void {
    this.router.navigate(['/internal-audit']);
  }

  getPrintDate(): string {
    const now = new Date();
    return (
      now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) +
      ' ' +
      now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  }

  getRatingPillClass(rating: string | undefined): string {
    const r = (rating || '').toLowerCase();
    if (r.includes('improvement')) return 'pill-improvement';
    if (r.includes('minor')) return 'pill-minor-ncr';
    if (r.includes('major')) return 'pill-major-ncr';
    if (r.includes('practice')) return 'pill-practice';
    if (r.includes('observation')) return 'pill-observations';
    return 'pill-compliant';
  }

  getObservationPhotos(record: any, obs: any): any[] {
    const photos: any[] = record?.photos || [];
    if (!photos || photos.length === 0) return [];
    if (obs?.supportingPhotoIds && obs.supportingPhotoIds.length > 0) {
      const idSet = new Set(obs.supportingPhotoIds);
      const matched = photos.filter((p) => idSet.has(p.id) || idSet.has(p.name));
      if (matched.length > 0) return matched;
    }
    return photos.slice(0, 5);
  }
}