/**
 * QuestAI — SSRA Automated Test Suite
 *
 * 14 comprehensive unit test cases verifying:
 * 1. 14 Active Domain catalogue completeness
 * 2. Strict rejection of 4 legacy DoNotUse domain types
 * 3. Domain key retrieval & metadata mapping
 * 4. Question catalogue integrity across all domains
 * 5. Romanian translation verification for bilingual operatives
 * 6. Safe working control measure mapping
 * 7. Hot Works 4 authoritative pre-work checks definition
 * 8. Phase 1 Pre-Start validation (happy path sign-off)
 * 9. Phase 1 validation rejection on insufficient photos (< 2)
 * 10. Phase 1 validation rejection on unsigned operatives
 * 11. Phase 1 validation rejection on incomplete Hot Works pre-checks
 * 12. Phase 2 conditional validation: TM left on site requires comment
 * 13. Phase 2 conditional validation: Return visit requires comment
 * 14. Local draft & submission storage isolation (zero collision with legacy keys)
 */

import {
  ACTIVE_SSRA_DOMAINS,
  LEGACY_DO_NOT_USE_DOMAINS,
  getActiveSsraTypes,
  getSsraTypeByKey,
  isLegacySsraType,
} from './config/ssra-types.config';

import {
  SSRA_HOT_WORKS_CHECKS_CONFIG,
  createDefaultHotWorksData,
} from './config/ssra-hotworks.config';

import {
  getQuestionsForDomain,
  SSRA_QUESTIONNAIRE_VERSION,
} from './config/ssra-question-catalogue.config';

import { SsraValidators } from './validators/ssra.validators';
import { SsraDraftService } from './services/ssra-draft.service';
import { SsraPhase1Data, SsraClosingReport } from './models/ssra.models';

describe('QuestAI — SSRA Test Suite (14 Tests)', () => {
  // Test 1: Exactly 14 active operational domains
  it('1. Domain Catalogue: should provide exactly 14 active operational domains', () => {
    const active = getActiveSsraTypes();
    expect(active.length).toBe(14);
    expect(ACTIVE_SSRA_DOMAINS.length).toBe(14);

    const keys = active.map((d) => d.key);
    expect(keys).toContain('civil-callout');
    expect(keys).toContain('civil-planned');
    expect(keys).toContain('civil-reactive');
    expect(keys).toContain('crossover');
    expect(keys).toContain('grab-lorry');
    expect(keys).toContain('gully-cleansing');
    expect(keys).toContain('mechanic-roadside');
    expect(keys).toContain('mechanic-workshop');
    expect(keys).toContain('road-marking');
    expect(keys).toContain('road-surfacing');
    expect(keys).toContain('street-lighting');
    expect(keys).toContain('traffic-management');
    expect(keys).toContain('utility-survey');
    expect(keys).toContain('winter-maintenance');
  });

  // Test 2: Strict rejection of the 4 legacy DoNotUse types
  it('2. Legacy Domain Exclusion: should detect and exclude all 4 legacy types from active selection', () => {
    expect(LEGACY_DO_NOT_USE_DOMAINS.length).toBe(4);

    expect(isLegacySsraType('legacy-general')).toBeTrue();
    expect(isLegacySsraType('legacy-civil')).toBeTrue();
    expect(isLegacySsraType('legacy-surfacing')).toBeTrue();
    expect(isLegacySsraType('legacy-tm')).toBeTrue();

    const activeKeys = getActiveSsraTypes().map((d) => d.key);
    for (const legacy of LEGACY_DO_NOT_USE_DOMAINS) {
      expect(activeKeys).not.toContain(legacy.key);
    }
  });

  // Test 3: Domain metadata retrieval by key
  it('3. Domain Retrieval: should correctly retrieve active domain metadata and department mapping', () => {
    const tm = getSsraTypeByKey('traffic-management');
    expect(tm).toBeDefined();
    expect(tm?.department).toBe('Traffic Safety');
    expect(tm?.title).toBe('Traffic Management');

    const lighting = getSsraTypeByKey('street-lighting');
    expect(lighting).toBeDefined();
    expect(lighting?.department).toBe('Electrical & Lighting');
  });

  // Test 4: Every active domain has a valid question catalogue
  it('4. Question Catalogue: should have configured safety question sets for all 14 active domains', () => {
    for (const domain of ACTIVE_SSRA_DOMAINS) {
      const questions = getQuestionsForDomain(domain.key);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.every((q) => !!q.id && !!q.questionText)).toBeTrue();
    }
  });

  // Test 5: Romanian translations configured for bilingual operatives
  it('5. Bilingual Support: should provide Romanian translations for site operative safety questions', () => {
    const tmQuestions = getQuestionsForDomain('traffic-management');
    const withRo = tmQuestions.filter((q) => !!q.romanianTranslation);
    expect(withRo.length).toBeGreaterThan(0);
    expect(withRo[0].romanianTranslation?.length).toBeGreaterThan(5);
  });

  // Test 6: Safe working control measures present
  it('6. Control Measures: questions should contain operational control measures / safe working methods', () => {
    const surfacingQuestions = getQuestionsForDomain('road-surfacing');
    const withCm = surfacingQuestions.filter((q) => !!q.controlMeasure);
    expect(withCm.length).toBeGreaterThan(0);
    expect(withCm[0].controlMeasure).toBeTruthy();
  });

  // Test 7: Authoritative 4 Hot Works pre-work checks definition
  it('7. Hot Works Pre-Work Config: should define the 4 verified Quest safety pre-checks', () => {
    expect(SSRA_HOT_WORKS_CHECKS_CONFIG.length).toBe(4);
    const ids = SSRA_HOT_WORKS_CHECKS_CONFIG.map((c) => c.id);
    expect(ids).toEqual(['HW-1', 'HW-2', 'HW-3', 'HW-4']);

    const defaultHw = createDefaultHotWorksData();
    expect(defaultHw.applicable).toBeFalse();
    expect(defaultHw.checks.length).toBe(4);
    expect(defaultHw.checks.every((c) => c.status === 'N/A')).toBeTrue();
  });

  // Test 8: Valid Phase 1 sign-off passes with 0 validation errors
  it('8. Phase 1 Validation (Passing): should validate a complete pre-start submission with 0 errors', () => {
    const tmQuestions = getQuestionsForDomain('traffic-management');
    const validData: SsraPhase1Data = {
      clientReferenceId: 'test-ref-001',
      domainType: 'traffic-management',
      questionnaireVersion: SSRA_QUESTIONNAIRE_VERSION,
      siteInformation: {
        jobno: 'JOB-9921',
        location: 'A40 Oxford Road',
        contractName: 'Highways Maintenance',
        weather: 'DRY',
        description: 'Lane 1 closure for pothole patching',
        timeonsite: '08:30',
      },
      personsAffected: ['Operatives', 'Passing Traffic / Drivers'],
      answers: tmQuestions.map((q) => ({
        questionId: q.id,
        value: 'Yes',
        notes: 'Verified OK',
      })),
      preWorkPhotos: [
        { id: 'p1', name: 'Site-Approach.jpg', url: 'data:image/jpeg;base64,...', category: 'pre-work' },
        { id: 'p2', name: 'Work-Zone.jpg', url: 'data:image/jpeg;base64,...', category: 'pre-work' },
      ],
      othercomments: 'Overhead cables verified at 8m clearance',
      operatives: [
        {
          operativeId: 'op1',
          displayName: 'John Smith',
          role: 'Lead Operative',
          signatureDataUrl: 'data:image/png;base64,sig1',
          signedAt: new Date().toISOString(),
        },
      ],
      hotWorks: createDefaultHotWorksData(),
    };

    const result = SsraValidators.validatePhase1(validData, tmQuestions);
    expect(result.isValid).toBeTrue();
    expect(result.errors.length).toBe(0);
  });

  // Test 9: Phase 1 validation rejects when pre-work photos < 2
  it('9. Phase 1 Validation (Missing Photos): should reject when fewer than 2 pre-work photos are provided', () => {
    const tmQuestions = getQuestionsForDomain('traffic-management');
    const invalidData: SsraPhase1Data = {
      clientReferenceId: 'test-ref-002',
      domainType: 'traffic-management',
      questionnaireVersion: SSRA_QUESTIONNAIRE_VERSION,
      siteInformation: {
        jobno: 'JOB-1234',
        location: 'Main St',
        contractName: 'Marlborough',
        weather: 'WET',
        description: 'Road works',
        timeonsite: '09:00',
      },
      personsAffected: ['Operatives'],
      answers: tmQuestions.map((q) => ({ questionId: q.id, value: 'Yes' })),
      preWorkPhotos: [
        { id: 'p1', name: 'OnlyOne.jpg', url: 'data:...', category: 'pre-work' },
      ], // Only 1 photo
      othercomments: '',
      operatives: [
        {
          operativeId: 'op1',
          displayName: 'Jane Doe',
          signatureDataUrl: 'data:image/png;base64,sig',
        },
      ],
      hotWorks: createDefaultHotWorksData(),
    };

    const result = SsraValidators.validatePhase1(invalidData, tmQuestions);
    expect(result.isValid).toBeFalse();
    const photoErr = result.errors.find((e) => e.field === 'preWorkPhotos');
    expect(photoErr).toBeDefined();
    expect(photoErr?.message).toContain('At least 2 pre-work photos');
  });

  // Test 10: Phase 1 validation rejects when operative has no signature
  it('10. Phase 1 Validation (Unsigned Operatives): should reject when any operative has not signed', () => {
    const tmQuestions = getQuestionsForDomain('traffic-management');
    const invalidData: SsraPhase1Data = {
      clientReferenceId: 'test-ref-003',
      domainType: 'traffic-management',
      questionnaireVersion: SSRA_QUESTIONNAIRE_VERSION,
      siteInformation: {
        jobno: 'JOB-5678',
        location: 'High St',
        contractName: 'Council',
        weather: 'DRY',
        description: 'Works',
        timeonsite: '08:00',
      },
      personsAffected: ['Operatives'],
      answers: tmQuestions.map((q) => ({ questionId: q.id, value: 'Yes' })),
      preWorkPhotos: [
        { id: 'p1', name: '1.jpg', url: 'data:...', category: 'pre-work' },
        { id: 'p2', name: '2.jpg', url: 'data:...', category: 'pre-work' },
      ],
      othercomments: '',
      operatives: [
        { operativeId: 'op1', displayName: 'Unsigned Worker', signatureDataUrl: '' },
      ],
      hotWorks: createDefaultHotWorksData(),
    };

    const result = SsraValidators.validatePhase1(invalidData, tmQuestions);
    expect(result.isValid).toBeFalse();
    const sigErr = result.errors.find((e) => e.field.includes('signature'));
    expect(sigErr).toBeDefined();
    expect(sigErr?.message).toContain('digital signature');
  });

  // Test 11: Phase 1 validation rejects if Hot Works applicable but checks incomplete
  it('11. Phase 1 Validation (Incomplete Hot Works): should reject when hot works checks are not Pass', () => {
    const tmQuestions = getQuestionsForDomain('traffic-management');
    const invalidData: SsraPhase1Data = {
      clientReferenceId: 'test-ref-004',
      domainType: 'traffic-management',
      questionnaireVersion: SSRA_QUESTIONNAIRE_VERSION,
      siteInformation: {
        jobno: 'JOB-7788',
        location: 'Depot Yard',
        contractName: 'Works',
        weather: 'DRY',
        description: 'Gas cutting',
        timeonsite: '10:00',
      },
      personsAffected: ['Operatives'],
      answers: tmQuestions.map((q) => ({ questionId: q.id, value: 'Yes' })),
      preWorkPhotos: [
        { id: 'p1', name: '1.jpg', url: 'data:...', category: 'pre-work' },
        { id: 'p2', name: '2.jpg', url: 'data:...', category: 'pre-work' },
      ],
      othercomments: '',
      operatives: [
        { operativeId: 'op1', displayName: 'Worker', signatureDataUrl: 'data:image/png;base64,sig' },
      ],
      hotWorks: {
        applicable: true,
        checks: [
          { id: 'HW-1', title: 'Extinguishers', description: '', status: 'Pass' },
          { id: 'HW-2', title: '10m Clearance', description: '', status: 'Fail' }, // Failed check!
          { id: 'HW-3', title: 'Fire Watch', description: '', status: 'N/A' },
          { id: 'HW-4', title: 'Leak Integrity', description: '', status: 'Pass' },
        ],
      },
    };

    const result = SsraValidators.validatePhase1(invalidData, tmQuestions);
    expect(result.isValid).toBeFalse();
    const hwErr = result.errors.find((e) => e.field.includes('hotWorks'));
    expect(hwErr).toBeDefined();
  });

  // Test 12: Phase 2 conditional validation: TM left requires comment
  it('12. Phase 2 Conditional: should require tmcomment when tmleft is YES', () => {
    const reportWithoutComment: SsraClosingReport = {
      timeoffsite: '16:30',
      jobfinish: 'YES',
      jobstatus: {
        tmleft: 'YES',
        tmcomment: '', // Missing mandatory comment
        visitagain: 'NO',
        followup: 'NO',
      },
      usedmaterials: [],
      closingreport: {
        moreimages: [],
        comments: 'Left site safely.',
      },
    };

    const result = SsraValidators.validatePhase2Closing(reportWithoutComment);
    expect(result.isValid).toBeFalse();
    const tmErr = result.errors.find((e) => e.field === 'jobstatus.tmcomment' || e.field === 'tmcomment');
    expect(tmErr).toBeDefined();
    expect(tmErr?.message).toContain('traffic management');
  });

  // Test 13: Phase 2 conditional validation: Return visit requires comment
  it('13. Phase 2 Conditional: should require visitagaincomment when visitagain is YES', () => {
    const reportWithoutVisitComment: SsraClosingReport = {
      timeoffsite: '17:00',
      jobfinish: 'NO',
      jobstatus: {
        tmleft: 'NO',
        visitagain: 'YES',
        visitagaincomment: '', // Missing comment
        followup: 'NO',
      },
      usedmaterials: [],
      closingreport: {
        moreimages: [],
        comments: 'Job incomplete, returning tomorrow.',
      },
    };

    const result = SsraValidators.validatePhase2Closing(reportWithoutVisitComment);
    expect(result.isValid).toBeFalse();
    const visitErr = result.errors.find((e) => e.field === 'jobstatus.visitagaincomment' || e.field === 'visitagaincomment');
    expect(visitErr).toBeDefined();
    expect(visitErr?.message).toContain('another site visit is required');
  });

  // Test 14: Storage isolation: strictly uses questai_ssra keys, zero impact on legacy collections
  it('14. Storage Isolation: should use isolated SSRA storage namespace with zero collision with inspection keys', () => {
    const draftService = new SsraDraftService();
    const testDraft: SsraPhase1Data = {
      clientReferenceId: 'iso-test-01',
      domainType: 'street-lighting',
      questionnaireVersion: '1.0',
      siteInformation: {
        jobno: 'J-1',
        location: 'L-1',
        contractName: 'C-1',
        weather: 'DRY',
        description: 'D-1',
        timeonsite: '07:00',
      },
      personsAffected: ['Operatives'],
      answers: [],
      preWorkPhotos: [],
      othercomments: '',
      operatives: [],
      hotWorks: createDefaultHotWorksData(),
    };

    // Save draft
    draftService.saveDraft(testDraft);
    const retrieved = draftService.loadDraft();
    expect(retrieved?.clientReferenceId).toBe('iso-test-01');

    // Verify localStorage key starts with questai_ssra_
    const rawStored = localStorage.getItem('questai_ssra_local_drafts');
    expect(rawStored).toBeTruthy();

    // Verify ZERO collision with legacy collections
    expect(localStorage.getItem('quest-ai-inspections')).toBeNull();
    expect(localStorage.getItem('quest-ai-internal-audits')).toBeNull();

    // Cleanup
    draftService.clearDraft();
    expect(draftService.loadDraft()).toBeNull();
  });
});
