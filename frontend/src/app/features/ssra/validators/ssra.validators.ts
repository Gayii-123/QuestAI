/**
 * QuestAI — SSRA Validators
 *
 * Enforces Phase 1 pre-start requirements and Phase 2 shift closing conditional rules.
 * Qualitative point-of-work safety checks with zero numerical risk matrix calculations.
 */

import {
  SsraClosingReport,
  SsraPhase1Data,
  SsraQuestionDefinition,
} from '../models/ssra.models';

export interface SsraValidationError {
  field: string;
  message: string;
}

export interface SsraValidationResult {
  isValid: boolean;
  errors: SsraValidationError[];
}

export class SsraValidators {
  /**
   * Strictly validates Phase 1 pre-start submission payload.
   * Requirements:
   * 1. Site info: jobno, location, contractName, weather, description, timeonsite.
   * 2. Pre-work photos: minimum 2 photos attached.
   * 3. Checklist: all mandatory questions for the domain must have an answer.
   * 4. Additional hazards: othercomments must be non-empty.
   * 5. Affected persons: at least 1 person selected.
   * 6. Operatives & signatures: at least 1 operative; every operative must have a valid signature.
   * 7. Hot works: if applicable, all 4 checks must have status 'Pass' or 'Fail'.
   */
  static validatePhase1(
    data: Partial<SsraPhase1Data>,
    questions: SsraQuestionDefinition[]
  ): SsraValidationResult {
    const errors: SsraValidationError[] = [];

    // 1. Site Information
    const site = data.siteInformation;
    if (!site?.jobno?.trim()) {
      errors.push({ field: 'siteInformation.jobno', message: 'Job number is required.' });
    }
    if (!site?.location?.trim()) {
      errors.push({ field: 'siteInformation.location', message: 'Site location is required.' });
    }
    if (!site?.contractName?.trim()) {
      errors.push({ field: 'siteInformation.contractName', message: 'Contract name is required.' });
    }
    if (!site?.weather) {
      errors.push({ field: 'siteInformation.weather', message: 'Weather condition is required.' });
    }
    if (!site?.description?.trim()) {
      errors.push({ field: 'siteInformation.description', message: 'Work description is required.' });
    }
    if (!site?.timeonsite?.trim()) {
      errors.push({ field: 'siteInformation.timeonsite', message: 'Time on site is required.' });
    }

    // 2. Pre-work Photos (Minimum 2)
    const photos = data.preWorkPhotos || [];
    if (photos.length < 2) {
      errors.push({
        field: 'preWorkPhotos',
        message: `At least 2 pre-work site photographs are required (currently ${photos.length} attached).`,
      });
    }

    // 3. Checklist Answers
    const answers = data.answers || [];
    const answerMap = new Map(answers.map((a) => [a.questionId, a]));
    for (const q of questions) {
      if (q.isMandatory) {
        const ans = answerMap.get(q.id);
        if (!ans || !ans.value || ans.value.trim() === '') {
          const qText = q.text || q.questionText || '';
          const qNumber = q.qnum || q.questionNumber || '';
          errors.push({
            field: `answers.${q.id}`,
            message: `Question #${qNumber} ("${qText.substring(0, 45)}...") is mandatory.`,
          });
        }
      }
    }

    // 4. Additional Hazards / Control Measures (othercomments)
    if (!data.othercomments || data.othercomments.trim().length === 0) {
      errors.push({
        field: 'othercomments',
        message: 'Additional site-specific hazards & control measures declaration is required.',
      });
    }

    // 5. Affected Persons (At least 1)
    const affected = data.personsAffected || [];
    if (affected.length === 0) {
      errors.push({
        field: 'personsAffected',
        message: 'At least one affected person or co-worker must be listed.',
      });
    }

    // 6. Operatives & Signatures (At least 1; all signed)
    const operatives = data.operatives || [];
    if (operatives.length === 0) {
      errors.push({
        field: 'operatives',
        message: 'At least one operative must be listed on the assessment roster.',
      });
    } else {
      operatives.forEach((op, index) => {
        const hasSig = !!(op.signatureDataUrl || op.signatureEvidenceId);
        if (!hasSig) {
          errors.push({
            field: `operatives[${index}].signature`,
            message: `Operative "${op.displayName || 'Operative ' + (index + 1)}" must provide a digital signature.`,
          });
        }
      });
    }

    // 7. Hot Works Checks (If applicable)
    if (data.hotWorks?.applicable) {
      const checks = data.hotWorks.checks || [];
      if (checks.length < 4) {
        errors.push({
          field: 'hotWorks.checks',
          message: 'All 4 Hot Works pre-work safety checks must be evaluated.',
        });
      } else {
        checks.forEach((c) => {
          if (!c.status || c.status === 'N/A') {
            errors.push({
              field: `hotWorks.checks.${c.id}`,
              message: `Hot Works check "${c.title}" must be evaluated (Pass / Fail).`,
            });
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Strictly validates Phase 2 Shift Closing Report conditional requirements.
   */
  static validatePhase2Closing(report: Partial<SsraClosingReport>): SsraValidationResult {
    return this.validatePhase2(report);
  }

  static validatePhase2(report: Partial<SsraClosingReport>): SsraValidationResult {
    const errors: SsraValidationError[] = [];

    // 1. Time off site
    if (!report.timeoffsite || report.timeoffsite.trim().length === 0) {
      errors.push({ field: 'timeoffsite', message: 'Time off site is required.' });
    }

    // 2. Traffic Management Equipment Left on Site
    const tmleft = report.jobstatus?.tmleft;
    if (!tmleft) {
      errors.push({ field: 'jobstatus.tmleft', message: 'Traffic management left status is required.' });
    } else if (tmleft === 'YES' && (!report.jobstatus?.tmcomment || report.jobstatus.tmcomment.trim().length === 0)) {
      errors.push({
        field: 'jobstatus.tmcomment',
        message: 'Details of traffic management left on site are required when TM is left.',
      });
    }

    // 3. Another Visit Required
    const visitagain = report.jobstatus?.visitagain;
    if (!visitagain) {
      errors.push({ field: 'jobstatus.visitagain', message: 'Visit again status is required.' });
    } else if (visitagain === 'YES' && (!report.jobstatus?.visitagaincomment || report.jobstatus.visitagaincomment.trim().length === 0)) {
      errors.push({
        field: 'jobstatus.visitagaincomment',
        message: 'Explanation is required when another site visit is required.',
      });
    }

    // 4. Follow-up Required
    const followup = report.jobstatus?.followup;
    if (!followup) {
      errors.push({ field: 'jobstatus.followup', message: 'Follow-up status is required.' });
    } else if (followup === 'YES' && (!report.jobstatus?.followupcomment || report.jobstatus.followupcomment.trim().length === 0)) {
      errors.push({
        field: 'jobstatus.followupcomment',
        message: 'Explanation is required when further follow-up actions are needed.',
      });
    }

    // 5. Job Finish status
    if (!report.jobfinish) {
      errors.push({ field: 'jobfinish', message: 'Job finished status is required.' });
    }

    // 6. Closing handover comments
    const comments = report.closingreport?.comments;
    if (!comments || comments.trim().length === 0) {
      errors.push({ field: 'closingreport.comments', message: 'Shift handover / closing comments are required.' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
