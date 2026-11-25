import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SsraOperative } from '../../models/ssra.models';
import { SsraSignaturePadComponent } from '../ssra-signature-pad/ssra-signature-pad.component';

@Component({
  selector: 'app-ssra-operatives-signatures',
  standalone: true,
  imports: [CommonModule, FormsModule, SsraSignaturePadComponent],
  templateUrl: './ssra-operatives-signatures.component.html',
  styleUrls: ['./ssra-operatives-signatures.component.css']
})
export class SsraOperativesSignaturesComponent {
  @Input() operatives: SsraOperative[] = [];
  @Input() personsAffected: string[] = [];
  @Input() disabled: boolean = false;

  @Output() operativesChange = new EventEmitter<SsraOperative[]>();
  @Output() personsAffectedChange = new EventEmitter<string[]>();

  presetPersons = [
    'Operatives',
    'Subcontractors',
    'General Public',
    'Pedestrians',
    'Passing Traffic / Drivers',
    'Client Personnel',
    'Emergency Services'
  ];

  customPersonInput = '';
  newOperativeName = '';
  newOperativeRole = '';

  activeSigningOperative: SsraOperative | null = null;

  togglePresetPerson(person: string): void {
    if (this.disabled) return;
    const exists = this.personsAffected.includes(person);
    const updated = exists
      ? this.personsAffected.filter((p) => p !== person)
      : [...this.personsAffected, person];
    this.personsAffected = updated;
    this.personsAffectedChange.emit(updated);
  }

  addCustomPerson(): void {
    if (this.disabled) return;
    const trimmed = this.customPersonInput.trim();
    if (!trimmed || this.personsAffected.includes(trimmed)) return;
    const updated = [...this.personsAffected, trimmed];
    this.personsAffected = updated;
    this.personsAffectedChange.emit(updated);
    this.customPersonInput = '';
  }

  removePerson(person: string): void {
    if (this.disabled) return;
    const updated = this.personsAffected.filter((p) => p !== person);
    this.personsAffected = updated;
    this.personsAffectedChange.emit(updated);
  }

  addOperative(): void {
    if (this.disabled) return;
    const name = this.newOperativeName.trim();
    if (!name) return;

    const newOp: SsraOperative = {
      operativeId: 'op_' + Math.random().toString(36).substring(2, 9),
      displayName: name,
      role: this.newOperativeRole.trim() || 'Site Operative'
    };

    const updated = [...this.operatives, newOp];
    this.operatives = updated;
    this.operativesChange.emit(updated);

    this.newOperativeName = '';
    this.newOperativeRole = '';
  }

  removeOperative(index: number): void {
    if (this.disabled) return;
    const updated = this.operatives.filter((_, i) => i !== index);
    this.operatives = updated;
    this.operativesChange.emit(updated);
  }

  openSignaturePad(operative: SsraOperative): void {
    if (this.disabled) return;
    this.activeSigningOperative = operative;
  }

  onSignatureSaved(dataUrl: string): void {
    if (!this.activeSigningOperative) return;

    const opId = this.activeSigningOperative.operativeId;
    const timestamp = new Date().toISOString();

    const updated = this.operatives.map((op) => {
      if (op.operativeId === opId) {
        return {
          ...op,
          signatureDataUrl: dataUrl,
          signedAt: timestamp
        };
      }
      return op;
    });

    this.operatives = updated;
    this.operativesChange.emit(updated);
    this.activeSigningOperative = null;
  }

  onSignatureCancelled(): void {
    this.activeSigningOperative = null;
  }
}
