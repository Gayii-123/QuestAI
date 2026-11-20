import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  InternalAuditService,
} from './internal-audit.service';
import { ReportService } from '../../core/services/report.service';
import {
  InternalAuditPhoto,
  InternalAuditObservation,
  InternalAuditSession,
  InternalAuditAnalysisResult,
} from './internal-audit.models';
import {
  INTERNAL_AUDIT_CONDITIONS,
  INTERNAL_AUDIT_RATINGS,
  InternalAuditRating,
  ratingTriggersCar,
} from './internal-audit-conditions.config';

export type InternalAuditViewStep = 'upload' | 'analyzing' | 'review' | 'completed';

@Component({
  selector: 'app-internal-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './internal-audit.component.html',
  styleUrls: ['./internal-audit.component.css'],
})
export class InternalAuditComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auditService = inject(InternalAuditService);
  private readonly reportService = inject(ReportService, { optional: true });

  @Output() exitAudit = new EventEmitter<void>();

  // Element references for file inputs
  @ViewChild('galleryInput') private galleryInput?: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') private cameraInput?: ElementRef<HTMLInputElement>;

  // Workflow steps: 'upload' | 'analyzing' | 'review' | 'completed'
  readonly currentStep = signal<InternalAuditViewStep>('upload');

  // Active Session state
  readonly session = signal<InternalAuditSession | null>(null);

  // Form & Input signals
  readonly siteName = signal<string>('');
  readonly siteLocation = signal<string>('');
  readonly auditorName = signal<string>('Lead Auditor');
  readonly photos = signal<InternalAuditPhoto[]>([]);
  readonly observations = signal<InternalAuditObservation[]>([]);
  readonly auditorSummary = signal<string>('');
  readonly extractedLocation = signal<string>('');

  // UI state signals
  readonly isUploading = signal<boolean>(false);
  readonly uploadError = signal<string | null>(null);
  readonly isAnalyzing = signal<boolean>(false);
  readonly analysisError = signal<string | null>(null);
  readonly previewingPhoto = signal<InternalAuditPhoto | null>(null);
  readonly activeFilter = signal<'all' | 'car' | 'compliant'>('all');
  readonly isDragOver = signal<boolean>(false);
  readonly toastMessage = signal<string | null>(null);

  // Available rating definitions & 27 conditions
  readonly ratingsList = INTERNAL_AUDIT_RATINGS;
  readonly conditionsList = INTERNAL_AUDIT_CONDITIONS;

  // Filtered observations computed
  readonly filteredObservations = computed(() => {
    const list = this.observations();
    const filter = this.activeFilter();
    if (filter === 'car') {
      return list.filter((o) => o.hasCar === 'Yes');
    }
    if (filter === 'compliant') {
      return list.filter((o) => o.hasCar === 'No');
    }
    return list;
  });

  // Summary counts computed
  readonly stats = computed(() => {
    const obs = this.observations();
    const carCount = obs.filter((o) => o.hasCar === 'Yes').length;
    const compliantCount = obs.filter((o) => o.hasCar === 'No').length;
    const totalCount = obs.length;
    const score = totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 100;
    return {
      total: totalCount,
      car: carCount,
      compliant: compliantCount,
      score,
      photosCount: this.photos().length,
    };
  });

  ngOnInit(): void {
    // Check if there is an active session in service, otherwise create new
    const existing = this.auditService.currentSession();
    if (existing && existing.status !== 'completed') {
      this.loadSessionState(existing);
    } else {
      this.startNewAudit();
    }
  }

  // ==========================================================================
  // Session Init & Loading
  // ==========================================================================

  startNewAudit(): void {
    const newSession = this.auditService.createSession(
      this.siteName(),
      this.siteLocation(),
      this.auditorName()
    );
    this.session.set(newSession);
    this.photos.set([]);
    this.observations.set([]);
    this.auditorSummary.set('');
    this.extractedLocation.set('');
    this.analysisError.set(null);
    this.uploadError.set(null);
    this.currentStep.set('upload');
  }

  loadSessionState(sess: InternalAuditSession): void {
    this.session.set(sess);
    this.siteName.set(sess.siteName || '');
    this.siteLocation.set(sess.location || '');
    this.auditorName.set(sess.auditorName || 'Lead Auditor');
    this.photos.set(sess.photos || []);
    this.observations.set(sess.observations || []);
    this.auditorSummary.set(sess.auditorSummary || '');
    this.extractedLocation.set(sess.location || '');

    if (sess.status === 'completed') {
      this.currentStep.set('completed');
    } else if (sess.status === 'review' || sess.observations.length > 0) {
      this.currentStep.set('review');
    } else {
      this.currentStep.set('upload');
    }
  }

  // ==========================================================================
  // Photo Handling & Upload
  // ==========================================================================

  triggerGalleryPicker(): void {
    this.galleryInput?.nativeElement.click();
  }

  triggerCameraCapture(): void {
    this.cameraInput?.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDropPhotos(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      void this.processSelectedFiles(event.dataTransfer.files);
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.processSelectedFiles(input.files);
      input.value = '';
    }
  }

  private async processSelectedFiles(fileList: FileList): Promise<void> {
    this.isUploading.set(true);
    this.uploadError.set(null);

    const files = Array.from(fileList);
    const addedPhotos: InternalAuditPhoto[] = [];

    for (const file of files) {
      try {
        const compressed = await this.auditService.compressPhoto(file);
        addedPhotos.push(compressed);
      } catch (err: any) {
        this.uploadError.set(err.message || `Failed to process ${file.name}`);
      }
    }

    if (addedPhotos.length > 0) {
      const updated = [...this.photos(), ...addedPhotos];
      this.photos.set(updated);
      this.syncSessionPhotos(updated);
      this.showToast(`Added ${addedPhotos.length} site photograph${addedPhotos.length > 1 ? 's' : ''}`);
    }

    this.isUploading.set(false);
  }

  removePhoto(index: number): void {
    const current = [...this.photos()];
    if (index >= 0 && index < current.length) {
      const removed = current.splice(index, 1)[0];
      this.photos.set(current);
      this.syncSessionPhotos(current);

      // Clean up references in observations
      const currentObs = this.observations().map((o) => {
        const filteredIds = o.photoIds.filter((id) => id !== removed.id);
        const filteredUrls = o.photoUrls.filter((url) => url !== removed.url);
        return { ...o, photoIds: filteredIds, photoUrls: filteredUrls };
      });
      this.observations.set(currentObs);
    }
  }

  private syncSessionPhotos(photos: InternalAuditPhoto[]): void {
    const current = this.session();
    if (current) {
      current.photos = photos;
      current.siteName = this.siteName();
      current.location = this.siteLocation();
      current.auditorName = this.auditorName();
      this.auditService.saveDraft(current);
    }
  }

  openPhotoPreview(photo: InternalAuditPhoto): void {
    this.previewingPhoto.set(photo);
  }

  closePhotoPreview(): void {
    this.previewingPhoto.set(null);
  }

  // ==========================================================================
  // AI Analysis Execution
  // ==========================================================================

  startAiAnalysis(): void {
    if (this.photos().length === 0) {
      this.uploadError.set('Please add at least one site photograph before starting analysis.');
      return;
    }

    const sess = this.session();
    if (!sess) return;

    sess.siteName = this.siteName();
    sess.location = this.siteLocation();
    sess.auditorName = this.auditorName();
    sess.photos = this.photos();

    this.isAnalyzing.set(true);
    this.analysisError.set(null);
    this.currentStep.set('analyzing');

    this.auditService.analyzeAuditPhotos(sess).subscribe({
      next: (result: InternalAuditAnalysisResult) => {
        sess.analysisResult = result;
        sess.auditorSummary = result.auditorSummary;
        sess.location = result.location;
        sess.observations = result.observations;
        sess.status = 'review';

        this.auditorSummary.set(result.auditorSummary);
        this.extractedLocation.set(result.location);
        this.observations.set(result.observations);
        this.auditService.saveDraft(sess);

        this.isAnalyzing.set(false);
        this.currentStep.set('review');
        this.showToast('AI analysis completed! Review your audit observations below.');
      },
      error: (err: Error) => {
        this.isAnalyzing.set(false);
        this.analysisError.set(err.message || 'An unexpected error occurred during AI analysis.');
      },
    });
  }

  retryAnalysis(): void {
    this.startAiAnalysis();
  }

  backToUpload(): void {
    this.currentStep.set('upload');
  }

  // ==========================================================================
  // Observation Editing & Review
  // ==========================================================================

  updateObservationRating(obs: InternalAuditObservation, newRating: InternalAuditRating): void {
    obs.rating = newRating;
    obs.hasCar = ratingTriggersCar(newRating) ? 'Yes' : 'No';
    if (obs.hasCar === 'Yes' && !obs.carRefNo) {
      obs.carRefNo = `CA-IA-${Date.now().toString().slice(-6)}`;
      obs.resolveByDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
    }
    obs.isEdited = true;
    this.observations.set([...this.observations()]);
    this.autoSave();
  }

  updateObservationFinding(obs: InternalAuditObservation, newText: string): void {
    obs.finding = newText;
    obs.isEdited = true;
    this.autoSave();
  }

  updateObservationAction(obs: InternalAuditObservation, newAction: string): void {
    obs.suggestedAction = newAction;
    obs.isEdited = true;
    this.autoSave();
  }

  deleteObservation(index: number): void {
    const list = [...this.observations()];
    if (index >= 0 && index < list.length) {
      list.splice(index, 1);
      this.observations.set(list);
      this.autoSave();
      this.showToast('Observation removed.');
    }
  }

  addNewObservation(): void {
    const nextIdx = this.observations().length + 1;
    const newObs: InternalAuditObservation = {
      id: `obs_manual_${Date.now()}`,
      focusArea: 'Good Housekeeping',
      focusAreaRef: `FA${String(nextIdx).padStart(2, '0')}`,
      finding: 'Visual check confirmed on site.',
      suggestedAction: 'Maintain clean work areas and free walkways.',
      rating: 'Compliant',
      photoIds: this.photos().length > 0 ? [this.photos()[0].id] : [],
      photoUrls: this.photos().length > 0 ? [this.photos()[0].url] : [],
      hasCar: 'No',
      isEdited: true,
    };
    this.observations.set([...this.observations(), newObs]);
    this.autoSave();
    this.showToast('New observation added.');
  }

  autoSave(): void {
    const sess = this.session();
    if (sess) {
      sess.auditorSummary = this.auditorSummary();
      sess.location = this.extractedLocation();
      sess.observations = this.observations();
      sess.photos = this.photos();
      this.auditService.saveDraft(sess);
    }
  }

  // ==========================================================================
  // Finalization & Navigation
  // ==========================================================================

  saveDraftExplicitly(): void {
    this.autoSave();
    const sess = this.session();
    if (sess) {
      this.auditService.saveAuditToBackend(sess).subscribe({
        next: () => this.showToast('Audit draft saved locally and synced to backend.'),
        error: () => this.showToast('Audit draft saved locally.'),
      });
    } else {
      this.showToast('Audit draft saved locally.');
    }
  }

  completeAudit(): void {
    const sess = this.session();
    if (!sess) return;

    sess.auditorSummary = this.auditorSummary();
    sess.location = this.extractedLocation();
    sess.observations = this.observations();
    sess.photos = this.photos();

    const finalized = this.auditService.finalizeAudit(sess);
    this.session.set(finalized);
    this.currentStep.set('completed');
    this.showToast(`Internal Audit ${finalized.referenceNumber} successfully completed.`);

    // Persist to user's reports collection in Firestore (questai/data/users/{uid}/reports/{ref})
    if (this.reportService) {
      this.reportService.saveInternalAuditRecord(finalized);
    }
  }

  onExit(): void {
    this.exitAudit.emit();
    this.router.navigate(['/chat']);
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 4000);
  }
}
