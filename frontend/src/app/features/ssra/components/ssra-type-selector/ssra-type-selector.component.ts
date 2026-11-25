import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SsraDomainTypeInfo } from '../../models/ssra.models';
import { getActiveSsraTypes } from '../../config/ssra-types.config';

@Component({
  selector: 'app-ssra-type-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ssra-type-selector.component.html',
  styleUrls: ['./ssra-type-selector.component.css'],
})
export class SsraTypeSelectorComponent {
  @Input() selectedTypeKey: string | null = null;
  @Input() disabled: boolean = false;
  @Output() selectType = new EventEmitter<SsraDomainTypeInfo>();
  @Output() typeSelected = new EventEmitter<string>();

  readonly activeTypes: SsraDomainTypeInfo[] = getActiveSsraTypes();

  onCardClick(type: SsraDomainTypeInfo): void {
    if (this.disabled) return;
    this.selectType.emit(type);
    this.typeSelected.emit(type.key);
  }
}
