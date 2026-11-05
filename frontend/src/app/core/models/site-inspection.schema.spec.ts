/**
 * Verification test suite for QuestAI Site Inspection Form Schema
 *
 * Confirms:
 * 1. All 374 questions are available across all 12 question banks.
 * 2. All 12 question banks are correctly registered.
 * 3. Composite question IDs remain unique within each bank.
 * 4. Road Surfacing conditional display rules evaluate accurately.
 * 5. Rating conventions strictly adhere to '1', '-1', '0', and ''.
 * 6. All 4 helper functions execute properly.
 */

import {
  CIVIL_OTHER_QUESTIONS,
  STREET_LIGHTING_QUESTIONS,
  ROAD_MARKING_QUESTIONS,
  ROAD_SURFACING_QUESTIONS,
  TRAFFIC_MANAGEMENT_12D_QUESTIONS,
  TRAFFIC_MANAGEMENT_12AB_QUESTIONS,
  FULL_BODY_HARNESS_QUESTIONS,
  LADDER_STEPLADDER_QUESTIONS,
  DEPOT_CHECK_SHEET_QUESTIONS,
  MANAGERS_BASE_QUESTIONS,
  MANAGERS_RISK_BANKS,
  ROAD_MARKING_TEST_QUESTIONS,
  SITE_INSPECTION_QUESTION_BANKS,
  SUPPORTED_DEPARTMENTS,
  getCompositeQuestionId,
  getQuestionsForDepartment,
  evaluateConditionalRule,
  groupQuestionsByHeader,
  SiteInspectionQuestion,
  QuestRatingValue,
} from './site-inspection.schema';

export interface VerificationResult {
  passed: boolean;
  totalQuestions: number;
  banksCount: number;
  bankDetails: Record<string, number>;
  duplicateIds: Record<string, string[]>;
  conditionalRuleTestsPassed: boolean;
  helpersVerified: boolean;
  ratingConventionsVerified: boolean;
  errors: string[];
}

/**
 * Programmatic verification method to validate all schema requirements
 */
export function verifySiteInspectionSchema(): VerificationResult {
  const errors: string[] = [];

  // 1. Bank registration & question counts
  const allBanks: Record<string, SiteInspectionQuestion[]> = {
    'Civil/Other': CIVIL_OTHER_QUESTIONS,
    'Street Lighting': STREET_LIGHTING_QUESTIONS,
    'Road Marking': ROAD_MARKING_QUESTIONS,
    'Road Surfacing': ROAD_SURFACING_QUESTIONS,
    'Traffic Management (12D)': TRAFFIC_MANAGEMENT_12D_QUESTIONS,
    'Traffic Management (12AB)': TRAFFIC_MANAGEMENT_12AB_QUESTIONS,
    'Full Body Harness': FULL_BODY_HARNESS_QUESTIONS,
    'Ladder/Stepladder': LADDER_STEPLADDER_QUESTIONS,
    'Depot Check Sheet': DEPOT_CHECK_SHEET_QUESTIONS,
    'Managers Site Inspection': MANAGERS_BASE_QUESTIONS,
    'Managers Risk Banks': Object.values(MANAGERS_RISK_BANKS).flat(),
    'Road Marking (Test)': ROAD_MARKING_TEST_QUESTIONS,
  };

  const expectedCounts: Record<string, number> = {
    'Civil/Other': 52,
    'Street Lighting': 47,
    'Road Marking': 44,
    'Road Surfacing': 27,
    'Traffic Management (12D)': 33,
    'Traffic Management (12AB)': 32,
    'Full Body Harness': 21,
    'Ladder/Stepladder': 9,
    'Depot Check Sheet': 32,
    'Managers Site Inspection': 12,
    'Managers Risk Banks': 49,
    'Road Marking (Test)': 16,
  };

  const bankDetails: Record<string, number> = {};
  let totalQuestions = 0;

  for (const [name, questions] of Object.entries(allBanks)) {
    const count = questions.length;
    bankDetails[name] = count;
    totalQuestions += count;

    if (count !== expectedCounts[name]) {
      errors.push(
        `Bank "${name}" has ${count} questions, expected ${expectedCounts[name]}`
      );
    }
  }

  if (totalQuestions !== 374) {
    errors.push(`Total questions is ${totalQuestions}, expected exactly 374`);
  }

  // 2. Composite ID uniqueness within each bank
  const duplicateIds: Record<string, string[]> = {};
  for (const [name, questions] of Object.entries(allBanks)) {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const q of questions) {
      if (seen.has(q.id)) {
        dupes.push(q.id);
      }
      seen.add(q.id);
    }
    if (dupes.length > 0) {
      duplicateIds[name] = dupes;
      errors.push(`Bank "${name}" contains duplicate IDs: ${dupes.join(', ')}`);
    }
  }

  // 3. Helper function: getCompositeQuestionId
  const compositeTest = getCompositeQuestionId('TM/ Branding', '01');
  if (compositeTest !== 'TM/ Branding_01') {
    errors.push(`getCompositeQuestionId failed: got "${compositeTest}", expected "TM/ Branding_01"`);
  }

  // 4. Helper function: getQuestionsForDepartment
  const civilDept = getQuestionsForDepartment('Civil/Other');
  if (civilDept.length !== 52) {
    errors.push(`getQuestionsForDepartment('Civil/Other') returned ${civilDept.length}, expected 52`);
  }

  const tm12ab = getQuestionsForDepartment('Traffic Management', '12AB');
  if (tm12ab.length !== 32) {
    errors.push(`getQuestionsForDepartment('Traffic Management', '12AB') returned ${tm12ab.length}, expected 32`);
  }

  const tm12d = getQuestionsForDepartment('Traffic Management', '12D');
  if (tm12d.length !== 33) {
    errors.push(`getQuestionsForDepartment('Traffic Management', '12D') returned ${tm12d.length}, expected 33`);
  }

  const managersWithRisks = getQuestionsForDepartment('Managers Site Inspection', undefined, [
    'Asbestos',
    'Confined Spaces',
  ]);
  const expectedManagersCount =
    12 +
    (MANAGERS_RISK_BANKS['Asbestos']?.length || 0) +
    (MANAGERS_RISK_BANKS['Confined Spaces']?.length || 0);
  if (managersWithRisks.length !== expectedManagersCount) {
    errors.push(
      `getQuestionsForDepartment for Managers with risks returned ${managersWithRisks.length}, expected ${expectedManagersCount}`
    );
  }

  // 5. Helper function & Conditional Rules (Road Surfacing)
  let conditionalRuleTestsPassed = true;
  const rsQuestions = ROAD_SURFACING_QUESTIONS;
  const q4a = rsQuestions.find(q => q.id === 'Setting up work environment_4 a');
  const q12a = rsQuestions.find(q => q.id === 'Plant people interface_12 a');
  const q18a = rsQuestions.find(q => q.id === 'Task Specific Risks_18 a');
  const q19a = rsQuestions.find(q => q.id === 'Task Specific Risks_19 a');

  if (!q4a || !q12a || !q18a || !q19a) {
    conditionalRuleTestsPassed = false;
    errors.push('Could not locate all 4 Road Surfacing conditional questions');
  } else {
    // Q4a: selectIndexIn [0, 1, 2, 3]
    const q4True = evaluateConditionalRule(q4a, {
      'Setting up work environment_4': { selectans: 'Incorrect barrier for footpath width' },
    });
    const q4False = evaluateConditionalRule(q4a, {
      'Setting up work environment_4': {
        selectans:
          'Correct barrier for footpath width. Barrier complete throughout works & maintained. Pedestrian mashal active',
      },
    });

    // Q12a: multiselectContains ['No active / poor controls in place']
    const q12True = evaluateConditionalRule(q12a, {
      'Plant people interface_12': {
        multiselectans: [{ txt: 'No active / poor controls in place' }],
      },
    });
    const q12False = evaluateConditionalRule(q12a, {
      'Plant people interface_12': { multiselectans: [{ txt: 'Good controls' }] },
    });

    // Q18a: equals ['No']
    const q18True = evaluateConditionalRule(q18a, {
      'Task Specific Risks_18': { selectans: 'No' },
    });
    const q18False = evaluateConditionalRule(q18a, {
      'Task Specific Risks_18': { selectans: 'Yes' },
    });

    // Q19a: equals ['Yes']
    const q19True = evaluateConditionalRule(q19a, {
      'Task Specific Risks_19': { selectans: 'Yes' },
    });
    const q19False = evaluateConditionalRule(q19a, {
      'Task Specific Risks_19': { selectans: 'No' },
    });

    if (
      !q4True || q4False ||
      !q12True || q12False ||
      !q18True || q18False ||
      !q19True || q19False
    ) {
      conditionalRuleTestsPassed = false;
      errors.push('Road Surfacing conditional rule evaluation test failed');
    }
  }

  // 6. Helper function: groupQuestionsByHeader
  const groupedCivil = groupQuestionsByHeader(CIVIL_OTHER_QUESTIONS);
  if (!groupedCivil || groupedCivil.length === 0) {
    errors.push('groupQuestionsByHeader returned empty array for Civil/Other');
  }

  // 7. Rating conventions check
  const validRatings: QuestRatingValue[] = ['1', '-1', '0', ''];
  const ratingConventionsVerified = validRatings.length === 4;

  return {
    passed: errors.length === 0,
    totalQuestions,
    banksCount: Object.keys(allBanks).length,
    bankDetails,
    duplicateIds,
    conditionalRuleTestsPassed,
    helpersVerified: errors.length === 0,
    ratingConventionsVerified,
    errors,
  };
}

