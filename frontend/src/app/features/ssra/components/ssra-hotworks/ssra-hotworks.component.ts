import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SsraHotWorksData, SsraHotWorksCheck } from '../../models/ssra.models';
import { SSRA_HOT_WORKS_CHECKS_CONFIG, createDefaultHotWorksData } from '../../config/ssra-hotworks.config';

@Component({
  selector: 'app-ssra-hotworks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ssra-hotworks.component.html',
  styleUrls: ['./ssra-hotworks.component.css']
})
export class SsraHotworksComponent {
  @Input() hotWorks: SsraHotWorksData = createDefaultHotWorksData();
  @Input() disabled: boolean = false;

  @Output() hotWorksChange = new EventEmitter<SsraHotWorksData>();

  toggleApplicable(value: boolean): void {
    if (this.disabled) return;

    let checks = this.hotWorks.checks;
    if (!checks || checks.length === 0) {
      checks = SSRA_HOT_WORKS_CHECKS_CONFIG.map((c) => ({
        ...c,
        status: 'N/A',
        notes: ''
      }));
    }

    const updated: SsraHotWorksData = {
      ...this.hotWorks,
      applicable: value,
      checks
    };
    this.hotWorks = updated;
    this.hotWorksChange.emit(updated);
  }

  setCheckStatus(checkId: string, status: 'Pass' | 'Fail' | 'N/A'): void {
    if (this.disabled) return;

    const updatedChecks = this.hotWorks.checks.map((c) => {
      if (c.id === checkId) {
        return { ...c, status };
      }
      return c;
    });

    const updated: SsraHotWorksData = {
      ...this.hotWorks,
      checks: updatedChecks
    };
    this.hotWorks = updated;
    this.hotWorksChange.emit(updated);
  }

  updateCheckNotes(checkId: string, notes: string): void {
    if (this.disabled) return;

    const updatedChecks = this.hotWorks.checks.map((c) => {
      if (c.id === checkId) {
        return { ...c, notes };
      }
      return c;
    });

    const updated: SsraHotWorksData = {
      ...this.hotWorks,
      checks: updatedChecks
    };
    this.hotWorks = updated;
    this.hotWorksChange.emit(updated);
  }
}
