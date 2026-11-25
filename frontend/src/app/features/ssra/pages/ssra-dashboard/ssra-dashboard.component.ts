import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SsraService } from '../../services/ssra.service';
import { SsraAssessment, SsraLifecycleStatus } from '../../models/ssra.models';
import { ACTIVE_SSRA_DOMAINS } from '../../config/ssra-types.config';

@Component({
  selector: 'app-ssra-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ssra-dashboard.component.html',
  styleUrls: ['./ssra-dashboard.component.css']
})
export class SsraDashboardComponent implements OnInit {
  private ssraService = inject(SsraService);
  private router = inject(Router);

  readonly activeDomains = ACTIVE_SSRA_DOMAINS;

  searchTerm = signal('');
  selectedDomain = signal<string>('all');
  selectedStatus = signal<string>('all');

  readonly assessments = this.ssraService.assessments;
  readonly isLoading = this.ssraService.isLoading;

  readonly stats = computed(() => {
    const list = this.assessments();
    return {
      total: list.length,
      level1: list.filter((a) => a.lifecycleStatus === 'Level1').length,
      complete: list.filter((a) => a.lifecycleStatus === 'Complete').length,
      incomplete: list.filter((a) => a.lifecycleStatus === 'Incomplete').length
    };
  });

  readonly filteredAssessments = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const domain = this.selectedDomain();
    const status = this.selectedStatus();

    return this.assessments().filter((a) => {
      // Search term
      if (term) {
        const matchRef = a.refno?.toLowerCase().includes(term);
        const matchJob = a.siteInformation?.jobno?.toLowerCase().includes(term);
        const matchLoc = a.siteInformation?.location?.toLowerCase().includes(term);
        const matchDomain = a.domainTitle?.toLowerCase().includes(term);
        if (!matchRef && !matchJob && !matchLoc && !matchDomain) {
          return false;
        }
      }

      // Domain filter
      if (domain !== 'all' && a.domainType !== domain) {
        return false;
      }

      // Status filter
      if (status !== 'all' && a.lifecycleStatus !== status) {
        return false;
      }

      return true;
    });
  });

  ngOnInit(): void {
    this.ssraService.loadAssessments();
  }

  navigateToNew(): void {
    this.router.navigate(['/ssra/new']);
  }

  navigateToDetail(id: string): void {
    this.router.navigate(['/ssra', id]);
  }

  navigateToClose(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/ssra', id, 'close']);
  }

  getStatusClass(status: SsraLifecycleStatus): string {
    switch (status) {
      case 'Complete':
        return 'status-complete';
      case 'Level1':
        return 'status-level1';
      case 'Incomplete':
      default:
        return 'status-incomplete';
    }
  }

  getStatusLabel(status: SsraLifecycleStatus): string {
    switch (status) {
      case 'Complete':
        return 'Complete (Shift Closed)';
      case 'Level1':
        return 'Level 1 (Pre-Start Signed)';
      case 'Incomplete':
      default:
        return 'Draft (Incomplete)';
    }
  }
}
