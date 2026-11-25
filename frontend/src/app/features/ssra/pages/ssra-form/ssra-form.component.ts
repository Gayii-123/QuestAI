import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { SsraService } from '../../services/ssra.service';
import { SsraDraftService } from '../../services/ssra-draft.service';
import { SsraValidators, SsraValidationError } from '../../validators/ssra.validators';

import {
  SsraAssessment,
  SsraPhase1Data,
  SsraSiteInformation,
  SsraEvidencePhoto,
  SsraAnswer,
  SsraHotWorksData,
  SsraOperative,
  SsraClosingReport
} from '../../models/ssra.models';

import {
  ACTIVE_SSRA_DOMAINS,
  getActiveSsraTypes,
  getSsraTypeByKey,
  isLegacySsraType
} from '../../config/ssra-types.config';

import {
  getQuestionsForDomain,
  SSRA_QUESTIONNAIRE_VERSION,
  SsraQuestion
} from '../../config/ssra-question-catalogue.config';

import { createDefaultHotWorksData } from '../../config/ssra-hotworks.config';

// Reusable components
import { SsraTypeSelectorComponent } from '../../components/ssra-type-selector/ssra-type-selector.component';
import { SsraSiteInformationComponent } from '../../components/ssra-site-information/ssra-site-information.component';
import { SsraPhotoUploadComponent } from '../../components/ssra-photo-upload/ssra-photo-upload.component';
import { SsraChecklistComponent } from '../../components/ssra-checklist/ssra-checklist.component';
import { SsraHotworksComponent } from '../../components/ssra-hotworks/ssra-hotworks.component';
import { SsraOperativesSignaturesComponent } from '../../components/ssra-operatives-signatures/ssra-operatives-signatures.component';
import { SsraClosingReportComponent } from '../../components/ssra-closing-report/ssra-closing-report.component';

@Component({
  selector: 'app-ssra-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SsraTypeSelectorComponent,
    SsraSiteInformationComponent,
    SsraPhotoUploadComponent,
    SsraChecklistComponent,
    SsraHotworksComponent,
    SsraOperativesSignaturesComponent,
    SsraClosingReportComponent
  ],
  templateUrl: './ssra-form.component.html',
  styleUrls: ['./ssra-form.component.css']
})
export class SsraFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ssraService = inject(SsraService);
  private draftService = inject(SsraDraftService);

  isClosingPhase = signal(false);
  assessmentId = signal<string | null>(null);
  existingAssessment = signal<SsraAssessment | null>(null);

  // Form State
  clientReferenceId = signal(this.draftService.generateClientReferenceId());
  domainType = signal('traffic-management');
  siteInformation = signal<SsraSiteInformation>({
    jobno: '',
    clientjobno: '',
    location: '',
    contractName: '',
    contractId: '',
    depot: '',
    weather: 'DRY',
    description: '',
    timeonsite: new Date().toTimeString().substring(0, 5)
  });

  preWorkPhotos = signal<SsraEvidencePhoto[]>([]);
  answers = signal<Record<string, SsraAnswer>>({});
  otherComments = signal('');
  hotWorks = signal<SsraHotWorksData>(createDefaultHotWorksData());
  operatives = signal<SsraOperative[]>([]);
  personsAffected = signal<string[]>(['Operatives', 'Passing Traffic / Drivers']);

  closingReport = signal<SsraClosingReport>({
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
  });

  currentQuestions = computed<SsraQuestion[]>(() => {
    return getQuestionsForDomain(this.domainType());
  });

  validationErrors = signal<SsraValidationError[]>([]);
  isSubmitting = signal(false);
  saveMessage = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const url = this.router.url;

    if (id) {
      this.assessmentId.set(id);
      this.loadExistingAssessment(id, url.includes('/close'));
    } else {
      // Check for saved local draft
      const draft = this.draftService.loadDraft();
      if (draft && !isLegacySsraType(draft.domainType)) {
        this.populateFromDraft(draft);
      }
    }
  }

  private loadExistingAssessment(id: string, isClosing: boolean): void {
    this.ssraService.getAssessmentById(id).subscribe({
      next: (assessment) => {
        if (!assessment) return;
        this.existingAssessment.set(assessment);
        this.clientReferenceId.set(assessment.clientReferenceId);
        this.domainType.set(assessment.domainType);
        this.siteInformation.set(assessment.siteInformation);
        this.preWorkPhotos.set(assessment.preWorkPhotos || []);
        
        const ansMap: Record<string, SsraAnswer> = {};
        for (const a of assessment.answers || []) {
          ansMap[a.questionId] = a;
        }
        this.answers.set(ansMap);
        this.otherComments.set(assessment.othercomments || '');
        this.hotWorks.set(assessment.hotWorks || createDefaultHotWorksData());
        this.operatives.set(assessment.operatives || []);
        this.personsAffected.set(assessment.personsAffected || []);

        if (assessment.closingReport) {
          this.closingReport.set(assessment.closingReport);
        }

        if (isClosing) {
          this.isClosingPhase.set(true);
        }
      },
      error: (err) => {
        console.error('Failed to load assessment:', err);
      }
    });
  }

  private populateFromDraft(draft: SsraPhase1Data): void {
    this.clientReferenceId.set(draft.clientReferenceId);
    this.domainType.set(draft.domainType);
    this.siteInformation.set(draft.siteInformation);
    this.preWorkPhotos.set(draft.preWorkPhotos);
    
    const ansMap: Record<string, SsraAnswer> = {};
    for (const a of draft.answers) {
      ansMap[a.questionId] = a;
    }
    this.answers.set(ansMap);
    this.otherComments.set(draft.othercomments);
    this.hotWorks.set(draft.hotWorks);
    this.operatives.set(draft.operatives);
    this.personsAffected.set(draft.personsAffected);
  }

  onDomainSelected(domainKey: string): void {
    if (this.isClosingPhase() || this.existingAssessment()?.lifecycleStatus === 'Level1') return;
    this.domainType.set(domainKey);
    this.answers.set({});
  }

  onHotWorksTriggered(triggered: boolean): void {
    if (triggered && !this.hotWorks().applicable) {
      this.hotWorks.set({
        ...this.hotWorks(),
        applicable: true
      });
    }
  }

  saveDraft(): void {
    const answersList: SsraAnswer[] = Object.values(this.answers());
    const draft: SsraPhase1Data = {
      clientReferenceId: this.clientReferenceId(),
      domainType: this.domainType(),
      questionnaireVersion: SSRA_QUESTIONNAIRE_VERSION,
      siteInformation: this.siteInformation(),
      personsAffected: this.personsAffected(),
      answers: answersList,
      preWorkPhotos: this.preWorkPhotos(),
      othercomments: this.otherComments(),
      operatives: this.operatives(),
      hotWorks: this.hotWorks()
    };

    this.draftService.saveDraft(draft);
    this.saveMessage.set('Draft saved locally.');
    setTimeout(() => this.saveMessage.set(null), 3000);
  }

  submitPhase1(): void {
    const answersList: SsraAnswer[] = Object.values(this.answers());
    const phase1Data: SsraPhase1Data = {
      clientReferenceId: this.clientReferenceId(),
      domainType: this.domainType(),
      questionnaireVersion: SSRA_QUESTIONNAIRE_VERSION,
      siteInformation: this.siteInformation(),
      personsAffected: this.personsAffected(),
      answers: answersList,
      preWorkPhotos: this.preWorkPhotos(),
      othercomments: this.otherComments(),
      operatives: this.operatives(),
      hotWorks: this.hotWorks()
    };

    const validation = SsraValidators.validatePhase1(phase1Data, this.currentQuestions());
    if (!validation.isValid) {
      this.validationErrors.set(validation.errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.validationErrors.set([]);
    this.isSubmitting.set(true);

    this.ssraService.submitPhase1(phase1Data).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.draftService.clearDraft();
        this.router.navigate(['/ssra']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.validationErrors.set([
          { field: 'api', message: err.message || 'Submission failed. Please try again.' }
        ]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  submitPhase2(): void {
    const id = this.assessmentId();
    if (!id) return;

    const report = this.closingReport();
    const validation = SsraValidators.validatePhase2Closing(report);

    if (!validation.isValid) {
      this.validationErrors.set(validation.errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.validationErrors.set([]);
    this.isSubmitting.set(true);

    this.ssraService.submitPhase2Closing(id, report).subscribe({
      next: (closed) => {
        this.isSubmitting.set(false);
        this.router.navigate(['/ssra']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.validationErrors.set([
          { field: 'api', message: err.message || 'Failed to submit shift closing report.' }
        ]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/ssra']);
  }
}
