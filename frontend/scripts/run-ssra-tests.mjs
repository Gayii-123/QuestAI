/**
 * QuestAI — SSRA Automated Test Suite Runner
 * Executes all 14 unit tests for the SSRA module.
 */

import {
  ACTIVE_SSRA_DOMAINS,
  LEGACY_DO_NOT_USE_DOMAINS,
  getActiveSsraTypes,
  getSsraTypeByKey,
  isLegacySsraType,
} from '../dist-test/config/ssra-types.config.js';

import {
  SSRA_HOT_WORKS_CHECKS_CONFIG,
  createDefaultHotWorksData,
} from '../dist-test/config/ssra-hotworks.config.js';

import {
  getQuestionsForDomain,
  SSRA_QUESTIONNAIRE_VERSION,
} from '../dist-test/config/ssra-question-catalogue.config.js';

import { SsraValidators } from '../dist-test/validators/ssra.validators.js';

const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    results.push({ name, passed: true });
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    results.push({ name, passed: false, error: err.message });
  }
}

console.log('\n======================================================');
console.log('  QUESTAI — SSRA AUTOMATED TEST SUITE (14 TESTS)       ');
console.log('======================================================\n');

// 1. Domain Catalogue: 14 active domains
test('1. Domain Catalogue: Exactly 14 active operational domains', () => {
  const active = getActiveSsraTypes();
  assert(active.length === 14, `Expected 14 active domains, got ${active.length}`);
  assert(ACTIVE_SSRA_DOMAINS.length === 14, 'ACTIVE_SSRA_DOMAINS length mismatch');
  const keys = active.map((d) => d.key);
  const expected = [
    'civil-callout', 'civil-planned', 'civil-reactive', 'crossover',
    'grab-lorry', 'gully-cleansing', 'mechanic-roadside', 'mechanic-workshop',
    'road-marking', 'road-surfacing', 'street-lighting', 'traffic-management',
    'utility-survey', 'winter-maintenance'
  ];
  for (const k of expected) {
    assert(keys.includes(k), `Missing expected active domain: ${k}`);
  }
});

// 2. Legacy Exclusion: 4 DoNotUse variants
test('2. Legacy Domain Exclusion: 4 legacy types strictly excluded', () => {
  assert(LEGACY_DO_NOT_USE_DOMAINS.length === 4, 'Expected 4 legacy types');
  assert(isLegacySsraType('legacy-general') === true, 'legacy-general should be legacy');
  assert(isLegacySsraType('legacy-civil') === true, 'legacy-civil should be legacy');
  assert(isLegacySsraType('legacy-surfacing') === true, 'legacy-surfacing should be legacy');
  assert(isLegacySsraType('legacy-tm') === true, 'legacy-tm should be legacy');
  const activeKeys = getActiveSsraTypes().map((d) => d.key);
  for (const l of LEGACY_DO_NOT_USE_DOMAINS) {
    assert(!activeKeys.includes(l.key), `Legacy type ${l.key} found in active list`);
  }
});

// 3. Domain Retrieval: key metadata mapping
test('3. Domain Retrieval: Retrieve active domain metadata & department', () => {
  const tm = getSsraTypeByKey('traffic-management');
  assert(tm !== undefined, 'traffic-management not found');
  assert(tm.department === 'Traffic Safety', `Expected Traffic Safety, got ${tm.department}`);
  assert(tm.title === 'Traffic Management', 'Title mismatch');

  const lighting = getSsraTypeByKey('street-lighting');
  assert(lighting !== undefined, 'street-lighting not found');
  assert(lighting.department === 'Electrical & Lighting', `Expected Electrical & Lighting, got ${lighting.department}`);
});

// 4. Question Catalogue: All 14 domains have safety questions
test('4. Question Catalogue: Configured safety questions for all 14 active domains', () => {
  for (const d of ACTIVE_SSRA_DOMAINS) {
    const qList = getQuestionsForDomain(d.key);
    assert(qList.length > 0, `No questions configured for domain ${d.key}`);
    assert(qList.every((q) => !!q.id && !!q.text), `Incomplete question definition in ${d.key}`);
  }
});

// 5. Bilingual Support: Romanian translations
test('5. Bilingual Support: Romanian translations for bilingual site operatives', () => {
  const tmQuestions = getQuestionsForDomain('traffic-management');
  const roQuestions = tmQuestions.filter((q) => !!q.roText);
  assert(roQuestions.length > 0, 'No Romanian translations found in traffic-management');
  assert(roQuestions[0].roText.length > 5, 'Romanian translation text too short');
});

// 6. Safe Working Control Measures
test('6. Control Measures: Questions contain operational control measures (CM)', () => {
  const surfacingQuestions = getQuestionsForDomain('road-surfacing');
  const withCm = surfacingQuestions.filter((q) => !!q.cm);
  assert(withCm.length > 0, 'No control measures found in road-surfacing');
  assert(withCm[0].cm.length > 5, 'Control measure text too short');
});

// 7. Hot Works Pre-Work Config: 4 authoritative checks
test('7. Hot Works Pre-Work Config: 4 verified Quest safety pre-checks (HW-1 to HW-4)', () => {
  assert(SSRA_HOT_WORKS_CHECKS_CONFIG.length === 4, 'Expected 4 Hot Works checks');
  const ids = SSRA_HOT_WORKS_CHECKS_CONFIG.map((c) => c.id);
  assert(JSON.stringify(ids) === JSON.stringify(['HW-1', 'HW-2', 'HW-3', 'HW-4']), 'HW IDs mismatch');
  const defaultHw = createDefaultHotWorksData();
  assert(defaultHw.applicable === false, 'Default applicable should be false');
  assert(defaultHw.checks.length === 4, 'Default checks should have 4 items');
  assert(defaultHw.checks.every((c) => c.status === 'N/A'), 'Default status should be N/A');
});

// 8. Phase 1 Validation (Passing)
test('8. Phase 1 Validation (Passing): Complete pre-start submission passes with 0 errors', () => {
  const tmQuestions = getQuestionsForDomain('traffic-management');
  const validData = {
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
      { id: 'p1', name: 'Site-Approach.jpg', url: 'data:...', category: 'pre-work' },
      { id: 'p2', name: 'Work-Zone.jpg', url: 'data:...', category: 'pre-work' },
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
  assert(result.isValid === true, `Validation failed unexpectedly: ${JSON.stringify(result.errors)}`);
  assert(result.errors.length === 0, 'Errors array should be empty');
});

// 9. Phase 1 Validation (Missing Photos < 2)
test('9. Phase 1 Validation (Missing Photos): Rejects when fewer than 2 photos attached', () => {
  const tmQuestions = getQuestionsForDomain('traffic-management');
  const invalidData = {
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
    ],
    othercomments: 'None',
    operatives: [
      { operativeId: 'op1', displayName: 'Jane Doe', signatureDataUrl: 'data:...' },
    ],
    hotWorks: createDefaultHotWorksData(),
  };

  const result = SsraValidators.validatePhase1(invalidData, tmQuestions);
  assert(result.isValid === false, 'Should be invalid with 1 photo');
  const photoErr = result.errors.find((e) => e.field === 'preWorkPhotos');
  assert(photoErr !== undefined, 'Expected preWorkPhotos error');
});

// 10. Phase 1 Validation (Unsigned Operatives)
test('10. Phase 1 Validation (Unsigned Operatives): Rejects when operative lacks signature', () => {
  const tmQuestions = getQuestionsForDomain('traffic-management');
  const invalidData = {
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
    othercomments: 'Hazards checked',
    operatives: [
      { operativeId: 'op1', displayName: 'Unsigned Worker', signatureDataUrl: '' },
    ],
    hotWorks: createDefaultHotWorksData(),
  };

  const result = SsraValidators.validatePhase1(invalidData, tmQuestions);
  assert(result.isValid === false, 'Should be invalid with unsigned operative');
  const sigErr = result.errors.find((e) => e.field.includes('signature'));
  assert(sigErr !== undefined, 'Expected signature error for unsigned worker');
});

// 11. Phase 1 Validation (Incomplete Hot Works)
test('11. Phase 1 Validation (Incomplete Hot Works): Rejects when hot works check not Pass', () => {
  const tmQuestions = getQuestionsForDomain('traffic-management');
  const invalidData = {
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
    othercomments: 'Fire precautions',
    operatives: [
      { operativeId: 'op1', displayName: 'Worker', signatureDataUrl: 'data:...' },
    ],
    hotWorks: {
      applicable: true,
      checks: [
        { id: 'HW-1', title: 'Extinguishers', description: '', status: 'Pass' },
        { id: 'HW-2', title: '10m Clearance', description: '', status: 'Fail' },
        { id: 'HW-3', title: 'Fire Watch', description: '', status: 'N/A' },
        { id: 'HW-4', title: 'Leak Integrity', description: '', status: 'Pass' },
      ],
    },
  };

  const result = SsraValidators.validatePhase1(invalidData, tmQuestions);
  assert(result.isValid === false, 'Should be invalid with failing/incomplete Hot Works check');
  const hwErr = result.errors.find((e) => e.field.includes('hotWorks'));
  assert(hwErr !== undefined, 'Expected hotWorks validation error');
});

// 12. Phase 2 Conditional: TM left on site requires comment
test('12. Phase 2 Conditional: Requires tmcomment when tmleft is YES', () => {
  const reportWithoutComment = {
    timeoffsite: '16:30',
    jobfinish: 'YES',
    jobstatus: {
      tmleft: 'YES',
      tmcomment: '',
      visitagain: 'NO',
      followup: 'NO',
    },
    usedmaterials: [],
    closingreport: {
      moreimages: [],
      comments: 'Shift completed.',
    },
  };

  const result = SsraValidators.validatePhase2(reportWithoutComment);
  assert(result.isValid === false, 'Should be invalid without tmcomment');
  const tmErr = result.errors.find((e) => e.field === 'jobstatus.tmcomment');
  assert(tmErr !== undefined, 'Expected jobstatus.tmcomment error');
});

// 13. Phase 2 Conditional: Return visit requires comment
test('13. Phase 2 Conditional: Requires visitagaincomment when visitagain is YES', () => {
  const reportWithoutVisitComment = {
    timeoffsite: '17:00',
    jobfinish: 'NO',
    jobstatus: {
      tmleft: 'NO',
      visitagain: 'YES',
      visitagaincomment: '',
      followup: 'NO',
    },
    usedmaterials: [],
    closingreport: {
      moreimages: [],
      comments: 'Job unfinished.',
    },
  };

  const result = SsraValidators.validatePhase2(reportWithoutVisitComment);
  assert(result.isValid === false, 'Should be invalid without visitagaincomment');
  const visitErr = result.errors.find((e) => e.field === 'jobstatus.visitagaincomment');
  assert(visitErr !== undefined, 'Expected jobstatus.visitagaincomment error');
});

// 14. Qualitative Safety Baseline & No Risk Matrix
test('14. Qualitative Baseline: Excludes numerical 5x5 or 3x3 risk matrix calculations', () => {
  const tmQuestions = getQuestionsForDomain('traffic-management');
  for (const q of tmQuestions) {
    assert(q.likelihood === undefined, 'No numerical likelihood property allowed');
    assert(q.severity === undefined, 'No numerical severity property allowed');
    assert(q.riskScore === undefined, 'No numerical riskScore property allowed');
  }
});

console.log('\n------------------------------------------------------');
const total = results.length;
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(`  TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('------------------------------------------------------\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('  ALL 14 SSRA TEST CASES PASSED SUCCESSFULLY!\n');
}
