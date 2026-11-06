import {
  SiteInspectionQuestion,
  SelectOption,
  MultiSelectOption,
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
  evaluateConditionalRule,
} from './site-inspection.schema';

export interface ResolvedInspectionBank {
  bankId: string;
  bankName: string;
  department: string;
  trafficSubtype?: '12D' | '12AB';
  questions: SiteInspectionQuestion[];
  questionById: Map<string, SiteInspectionQuestion>;
}

interface BankDefinition {
  bankId: string;
  aliases: string[];
  bankName: string;
  department: string;
  trafficSubtype?: '12D' | '12AB';
  getQuestions: (selectedRiskBanks?: string[]) => SiteInspectionQuestion[];
}

const BANK_DEFINITIONS: BankDefinition[] = [
  {
    bankId: 'civil-other',
    aliases: ['civil-other', 'civil/other', 'civil'],
    bankName: 'Civil/Other',
    department: 'Civil/Other',
    getQuestions: () => CIVIL_OTHER_QUESTIONS,
  },
  {
    bankId: 'street-lighting',
    aliases: ['street-lighting', 'street lighting'],
    bankName: 'Street Lighting',
    department: 'Street Lighting',
    getQuestions: () => STREET_LIGHTING_QUESTIONS,
  },
  {
    bankId: 'road-marking',
    aliases: ['road-marking', 'road marking'],
    bankName: 'Road Marking',
    department: 'Road Marking',
    getQuestions: () => ROAD_MARKING_QUESTIONS,
  },
  {
    bankId: 'road-surfacing',
    aliases: ['road-surfacing', 'road surfacing'],
    bankName: 'Road Surfacing',
    department: 'Road Surfacing',
    getQuestions: () => ROAD_SURFACING_QUESTIONS,
  },
  {
    bankId: 'tm-12d',
    aliases: ['tm-12d', 'traffic management (12d)', 'traffic-management-12d', '12d'],
    bankName: 'Traffic Management (12D)',
    department: 'Traffic Management',
    trafficSubtype: '12D',
    getQuestions: () => TRAFFIC_MANAGEMENT_12D_QUESTIONS,
  },
  {
    bankId: 'tm-12ab',
    aliases: ['tm-12ab', 'traffic management (12ab)', 'traffic-management-12ab', '12ab'],
    bankName: 'Traffic Management (12AB)',
    department: 'Traffic Management',
    trafficSubtype: '12AB',
    getQuestions: () => TRAFFIC_MANAGEMENT_12AB_QUESTIONS,
  },
  {
    bankId: 'full-body-harness',
    aliases: ['full-body-harness', 'full body harness', 'harness and lanyard', 'harness-and-lanyard'],
    bankName: 'Full Body Harness',
    department: 'Harness and Lanyard',
    getQuestions: () => FULL_BODY_HARNESS_QUESTIONS,
  },
  {
    bankId: 'ladder-stepladder',
    aliases: ['ladder-stepladder', 'ladder/stepladder', 'ladder'],
    bankName: 'Ladder/Stepladder',
    department: 'Ladder/Stepladder',
    getQuestions: () => LADDER_STEPLADDER_QUESTIONS,
  },
  {
    bankId: 'depot-check-sheet',
    aliases: ['depot-check-sheet', 'depot check sheet', 'depot'],
    bankName: 'Depot Check Sheet',
    department: 'Depot Check Sheet',
    getQuestions: () => DEPOT_CHECK_SHEET_QUESTIONS,
  },
  {
    bankId: 'managers-site-inspection',
    aliases: ['managers-site-inspection', 'managers site inspection'],
    bankName: 'Managers Site Inspection',
    department: 'Managers Site Inspection',
    getQuestions: (selectedRiskBanks?: string[]) => {
      const list = [...MANAGERS_BASE_QUESTIONS];
      if (Array.isArray(selectedRiskBanks) && selectedRiskBanks.length > 0) {
        for (const cat of selectedRiskBanks) {
          if (MANAGERS_RISK_BANKS[cat]) {
            list.push(...MANAGERS_RISK_BANKS[cat]);
          }
        }
      }
      return list;
    },
  },
  {
    bankId: 'managers-risk-banks',
    aliases: ['managers-risk-banks', 'managers risk banks'],
    bankName: 'Managers Risk Banks',
    department: 'Managers Risk Banks',
    getQuestions: (selectedRiskBanks?: string[]) => {
      if (Array.isArray(selectedRiskBanks) && selectedRiskBanks.length > 0) {
        const list: SiteInspectionQuestion[] = [];
        for (const cat of selectedRiskBanks) {
          if (MANAGERS_RISK_BANKS[cat]) {
            list.push(...MANAGERS_RISK_BANKS[cat]);
          }
        }
        return list;
      }
      return Object.values(MANAGERS_RISK_BANKS).flat();
    },
  },
  {
    bankId: 'road-marking-test',
    aliases: ['road-marking-test', 'road marking (test)'],
    bankName: 'Road Marking (Test)',
    department: 'Road Marking (Test)',
    getQuestions: () => ROAD_MARKING_TEST_QUESTIONS,
  },
];

/**
 * Resolves an inspection bank by bankId / name / department, returning its canonical
 * Quest questions (including only applicable conditional risk sections for Managers).
 */
export function resolveInspectionBank(
  bankIdentifier: string,
  options?: {
    trafficSubtype?: '12D' | '12AB';
    selectedRiskBanks?: string[];
  }
): ResolvedInspectionBank | null {
  if (!bankIdentifier || typeof bankIdentifier !== 'string') {
    return null;
  }
  const normalized = bankIdentifier.trim().toLowerCase();
  if (!normalized) return null;

  let def: BankDefinition | undefined;

  if (normalized === 'traffic-management' || normalized === 'traffic management') {
    def = BANK_DEFINITIONS.find(
      (b) => b.bankId === (options?.trafficSubtype === '12AB' ? 'tm-12ab' : 'tm-12d')
    );
  } else {
    def = BANK_DEFINITIONS.find((b) => b.aliases.includes(normalized));
  }

  if (!def) {
    return null;
  }

  const questions = def.getQuestions(options?.selectedRiskBanks);
  const questionById = new Map<string, SiteInspectionQuestion>();
  for (const q of questions) {
    questionById.set(q.id, q);
  }

  return {
    bankId: def.bankId,
    bankName: def.bankName,
    department: def.department,
    trafficSubtype: def.trafficSubtype,
    questions,
    questionById,
  };
}

/**
 * Extracts the valid option strings from a question's `select` definition.
 */
export function getAllowedSelectOptions(question: SiteInspectionQuestion): string[] {
  if (!Array.isArray(question.select) || question.select.length === 0) {
    return [];
  }
  return question.select
    .map((opt: string | SelectOption) => (typeof opt === 'string' ? opt : opt?.txt))
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/**
 * Extracts the valid option strings from a question's `multiselect` definition.
 */
export function getAllowedMultiSelectOptions(question: SiteInspectionQuestion): string[] {
  if (!Array.isArray(question.multiselect) || question.multiselect.length === 0) {
    return [];
  }
  return question.multiselect
    .map((opt: MultiSelectOption) => opt?.txt)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

export type { SiteInspectionQuestion };
export { evaluateConditionalRule, MANAGERS_RISK_BANKS };
