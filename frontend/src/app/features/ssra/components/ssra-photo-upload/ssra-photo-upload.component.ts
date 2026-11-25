import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SsraEvidencePhoto } from '../../models/ssra.models';
import { SsraEvidenceService } from '../../services/ssra-evidence.service';

@Component({
  selector: 'app-ssra-photo-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ssra-photo-upload.component.html',
  styleUrls: ['./ssra-photo-upload.component.css']
})
export class SsraPhotoUploadComponent {
  private evidenceService = inject(SsraEvidenceService);

  @Input() photos: SsraEvidencePhoto[] = [];
  @Input() category: 'pre-work' | 'closing' | 'question' = 'pre-work';
  @Input() minPhotos: number = 0;
  @Input() maxPhotos: number = 20;
  @Input() disabled: boolean = false;
  @Input() title: string = 'Pre-Work Photographic Evidence';
  @Input() subtitle: string = 'Take or upload clear photos of the work area before starting.';

  @Output() photosChange = new EventEmitter<SsraEvidencePhoto[]>();

  isProcessing = false;
  selectedPhoto: SsraEvidencePhoto | null = null;
  errorMessage = '';

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || this.disabled) return;

    this.isProcessing = true;
    this.errorMessage = '';

    try {
      const files = Array.from(input.files);
      const remainingSlots = this.maxPhotos - this.photos.length;
      if (remainingSlots <= 0) {
        this.errorMessage = `Maximum of ${this.maxPhotos} photos reached.`;
        return;
      }

      const filesToProcess = files.slice(0, remainingSlots);
      const newPhotos: SsraEvidencePhoto[] = [];

      for (const file of filesToProcess) {
        const photo = await this.evidenceService.compressImage(file, this.category);
        newPhotos.push(photo);
      }

      const updated = [...this.photos, ...newPhotos];
      this.photos = updated;
      this.photosChange.emit(updated);
    } catch (err: any) {
      this.errorMessage = err.message || 'Failed to process images. Please try again.';
    } finally {
      this.isProcessing = false;
      input.value = '';
    }
  }

  removePhoto(index: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;
    const updated = this.photos.filter((_, i) => i !== index);
    this.photos = updated;
    this.photosChange.emit(updated);
  }

  openLightbox(photo: SsraEvidencePhoto): void {
    this.selectedPhoto = photo;
  }

  closeLightbox(): void {
    this.selectedPhoto = null;
  }
}
