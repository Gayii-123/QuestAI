import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SsraClosingReport, SsraEvidencePhoto, SsraYesNo } from '../../models/ssra.models';
import { SsraPhotoUploadComponent } from '../ssra-photo-upload/ssra-photo-upload.component';

@Component({
  selector: 'app-ssra-closing-report',
  standalone: true,
  imports: [CommonModule, FormsModule, SsraPhotoUploadComponent],
  templateUrl: './ssra-closing-report.component.html',
  styleUrls: ['./ssra-closing-report.component.css']
})
export class SsraClosingReportComponent {
  @Input() closingReport: SsraClosingReport = this.getDefaultClosingReport();
  @Input() disabled: boolean = false;

  @Output() closingReportChange = new EventEmitter<SsraClosingReport>();

  materialInput = '';

  private getDefaultClosingReport(): SsraClosingReport {
    return {
      timeoffsite: new Date().toTimeString().substring(0, 5),
      jobstatus: {
        tmleft: 'NO',
        visitagain: 'NO',
        followup: 'NO'
      },
      jobfinish: 'YES',
      usedmaterials: [],
      materialsuseddescription: '',
      closingreport: {
        moreimages: [],
        comments: ''
      }
    };
  }

  updateField<K extends keyof SsraClosingReport>(field: K, value: SsraClosingReport[K]): void {
    if (this.disabled) return;
    const updated: SsraClosingReport = {
      ...this.closingReport,
      [field]: value
    };
    this.closingReport = updated;
    this.closingReportChange.emit(updated);
  }

  updateJobStatus(key: 'tmleft' | 'visitagain' | 'followup', value: SsraYesNo): void {
    if (this.disabled) return;
    const updated: SsraClosingReport = {
      ...this.closingReport,
      jobstatus: {
        ...this.closingReport.jobstatus,
        [key]: value
      }
    };
    this.closingReport = updated;
    this.closingReportChange.emit(updated);
  }

  updateJobStatusComment(key: 'tmcomment' | 'visitagaincomment' | 'followupcomment', value: string): void {
    if (this.disabled) return;
    const updated: SsraClosingReport = {
      ...this.closingReport,
      jobstatus: {
        ...this.closingReport.jobstatus,
        [key]: value
      }
    };
    this.closingReport = updated;
    this.closingReportChange.emit(updated);
  }

  addMaterial(): void {
    if (this.disabled) return;
    const item = this.materialInput.trim();
    if (!item) return;

    const materials = this.closingReport.usedmaterials || [];
    if (!materials.includes(item)) {
      const updatedMaterials = [...materials, item];
      this.updateField('usedmaterials', updatedMaterials);
    }
    this.materialInput = '';
  }

  removeMaterial(index: number): void {
    if (this.disabled) return;
    const materials = (this.closingReport.usedmaterials || []).filter((_, i) => i !== index);
    this.updateField('usedmaterials', materials);
  }

  onClosingPhotosChange(photos: SsraEvidencePhoto[]): void {
    if (this.disabled) return;
    const updated: SsraClosingReport = {
      ...this.closingReport,
      closingreport: {
        ...this.closingReport.closingreport,
        moreimages: photos
      }
    };
    this.closingReport = updated;
    this.closingReportChange.emit(updated);
  }

  updateClosingComments(comments: string): void {
    if (this.disabled) return;
    const updated: SsraClosingReport = {
      ...this.closingReport,
      closingreport: {
        ...this.closingReport.closingreport,
        comments
      }
    };
    this.closingReport = updated;
    this.closingReportChange.emit(updated);
  }
}
