import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InspectionEvidenceViewModel } from '../../../core/models/inspection-view.models';
import { InspectionPhoto } from '../site-inspection.models';

@Component({
  selector: 'app-inspection-evidence-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inspection-evidence-message.component.html',
  styleUrls: ['./inspection-evidence-message.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectionEvidenceMessageComponent {
  @Input({ required: true }) evidence!: InspectionEvidenceViewModel;
  @Output() previewPhoto = new EventEmitter<InspectionPhoto>();
  @Output() requestMorePhotos = new EventEmitter<void>();

  showAllSuggestions = false;

  toggleSuggestions(): void {
    this.showAllSuggestions = !this.showAllSuggestions;
  }

  onPhotoClick(photo: InspectionPhoto): void {
    this.previewPhoto.emit(photo);
  }

  onAddMorePhotosClick(): void {
    this.requestMorePhotos.emit();
  }
}

