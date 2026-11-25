import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SsraSiteInformation, SsraWeatherType } from '../../models/ssra.models';

@Component({
  selector: 'app-ssra-site-information',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ssra-site-information.component.html',
  styleUrls: ['./ssra-site-information.component.css'],
})
export class SsraSiteInformationComponent {
  @Input({ required: true }) siteInfo!: SsraSiteInformation;
  @Input() readOnly: boolean = false;
  @Input() disabled: boolean = false;
  @Input() validationErrors: { [key: string]: string } = {};
  @Output() siteInfoChange = new EventEmitter<SsraSiteInformation>();

  get isLocked(): boolean {
    return this.readOnly || this.disabled;
  }

  readonly weatherOptions: { value: SsraWeatherType; label: string; icon: string }[] = [
    { value: 'DRY', label: 'Dry / Clear', icon: '☀️' },
    { value: 'WET', label: 'Wet / Rain', icon: '🌧️' },
    { value: 'ICY', label: 'Icy / Frost', icon: '❄️' },
    { value: 'FOG', label: 'Fog / Mist', icon: '🌫️' },
  ];

  onWeatherSelect(val: SsraWeatherType): void {
    if (this.isLocked) return;
    this.siteInfo.weather = val;
    this.emitChange();
  }

  onFieldChange(): void {
    this.emitChange();
  }

  private emitChange(): void {
    this.siteInfoChange.emit({ ...this.siteInfo });
  }

  setCurrentTime(): void {
    if (this.isLocked) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    this.siteInfo.timeonsite = `${hours}:${minutes}`;
    this.emitChange();
  }
}
