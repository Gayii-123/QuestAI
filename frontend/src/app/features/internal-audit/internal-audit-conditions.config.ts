/**
 * QuestAI - Internal Audit Authoritative 27 Audit Conditions & Taxonomies
 *
 * Source: Extracted from original Quest IaGeminiAddDialogComponent
 * (src/app/feature/internal-audit/components/ia-gemini-add-dialog/ia-gemini-add-dialog.component.ts)
 *
 * PRESERVE EXACT WORDING, ORDER, AND MEANINGS.
 */

export type InternalAuditRating =
  | 'Good Practice'
  | 'Compliant'
  | 'Observations only'
  | 'Area for Improvement'
  | 'Minor Non-Conformance'
  | 'Major Non-Conformance';

export interface AuditConditionDefinition {
  id: string; // e.g., 'FA01'
  number: number; // 1 to 27
  focusArea: string; // Title e.g., 'Appropriate PPE'
  requirement: string; // Detailed standard requirement
  defaultRating: InternalAuditRating;
  triggersCar: boolean; // True if non-compliant
  category: 'Safety' | 'Environmental' | 'Health & Welfare' | 'Operations' | 'General';
}

/**
 * Authoritative 27 Hardcoded Internal Audit Conditions
 */
export const INTERNAL_AUDIT_CONDITIONS: readonly AuditConditionDefinition[] = [
  {
    id: 'FA01',
    number: 1,
    focusArea: 'Appropriate PPE',
    requirement: 'High vis trousers and vest worn (Shorts strictly NOT permitted). Full 6-point PPE required.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA02',
    number: 2,
    focusArea: 'Public is kept separate',
    requirement: 'Fence or cones placed to separate public and operatives on footpath / Pedestrian route safely signed & protected.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA03',
    number: 3,
    focusArea: 'Good Housekeeping',
    requirement: 'Site kept clear of waste, mud, debris, litter, and obstructions.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA04',
    number: 4,
    focusArea: 'Fire exit route clear',
    requirement: 'Clear exit route to escape without any obstructions.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA05',
    number: 5,
    focusArea: 'Clear access to distribution panel',
    requirement: 'Clear, unimpeded access to electrical distribution panel.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA06',
    number: 6,
    focusArea: 'Electric / Gas testing',
    requirement: 'In-date PAT test / inspection stickers visible on electrical & gas tools.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA07',
    number: 7,
    focusArea: 'Water / Gas leak',
    requirement: 'Leak free, no fluid or gas leaks observed.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Environmental',
  },
  {
    id: 'FA08',
    number: 8,
    focusArea: 'Fire Extinguishers',
    requirement: 'In date, serviced annually, and easily accessible.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA09',
    number: 9,
    focusArea: 'CO2 / Water / Foam / Electrical / Fire blanket',
    requirement: 'Correct extinguisher/suppression type for specific hazard.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA10',
    number: 10,
    focusArea: 'Lifting Tackle',
    requirement: 'Test certificate and colour-coded tag in date (BLUE Jan-Jun, YELLOW Jul-Dec).',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA11',
    number: 11,
    focusArea: 'RPE (Respirators)',
    requirement: 'Face fit tested & correct filters fitted for specific hazard.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Health & Welfare',
  },
  {
    id: 'FA12',
    number: 12,
    focusArea: 'Ear Defenders/Plugs',
    requirement: 'Suitable noise attenuation for site noise levels.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Health & Welfare',
  },
  {
    id: 'FA13',
    number: 13,
    focusArea: 'Eye Protection',
    requirement: 'Grade 1 B safety goggles for high risk cutting/breaking; Grade 1 F safety glasses for general works.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA14',
    number: 14,
    focusArea: 'Dust suppression/Extraction',
    requirement: 'Water suppression active on cut off saws / extraction for grinding.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Environmental',
  },
  {
    id: 'FA15',
    number: 15,
    focusArea: 'Dust extraction/collection',
    requirement: 'Dust extraction in use and functioning.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Environmental',
  },
  {
    id: 'FA16',
    number: 16,
    focusArea: 'Refuelling points',
    requirement: 'Drip trays / bunds used during refuelling of plant & machinery.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Environmental',
  },
  {
    id: 'FA17',
    number: 17,
    focusArea: 'Damaged/Faulty plant',
    requirement: 'Quarantined, red-tagged, and reported.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Operations',
  },
  {
    id: 'FA18',
    number: 18,
    focusArea: 'Slips/Trips',
    requirement: 'Housekeeping maintained, cables neatly routed/covered.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA19',
    number: 19,
    focusArea: 'Scaffolding / Access',
    requirement: 'Scafftag up to date, safe access ladder secured.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA20',
    number: 20,
    focusArea: 'First aid',
    requirement: 'First aid kit stocked and easily accessible, no expired items.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Health & Welfare',
  },
  {
    id: 'FA21',
    number: 21,
    focusArea: 'Welfare',
    requirement: 'Welfare facilities clean, stocked, running water.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Health & Welfare',
  },
  {
    id: 'FA22',
    number: 22,
    focusArea: 'PAT Testing',
    requirement: 'PAT test tag up to date on portable electrical tools.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA23',
    number: 23,
    focusArea: 'COSHH',
    requirement: 'COSHH risk assessments and safety data sheets available, containers properly labeled.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Health & Welfare',
  },
  {
    id: 'FA24',
    number: 24,
    focusArea: 'Excavations',
    requirement: 'Shored or battered back, edge protection & trench covers in place.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA25',
    number: 25,
    focusArea: 'Hot Works',
    requirement: 'Hot work permit, fire extinguisher on standby.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA26',
    number: 26,
    focusArea: 'Traffic Management',
    requirement: 'Signage and barriers compliant with Chapter 8 / Red Book.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'Safety',
  },
  {
    id: 'FA27',
    number: 27,
    focusArea: 'Other',
    requirement: 'Any site-specific hazards identified and controlled.',
    defaultRating: 'Compliant',
    triggersCar: false,
    category: 'General',
  },
];

/**
 * Valid Rating Values with UI presentation styles & metadata
 */
export const INTERNAL_AUDIT_RATINGS: readonly {
  value: InternalAuditRating;
  label: string;
  badgeClass: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  triggersCar: boolean;
  description: string;
}[] = [
  {
    value: 'Good Practice',
    label: 'Good Practice',
    badgeClass: 'rating-good-practice',
    color: '#15803d',
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    triggersCar: false,
    description: 'Exceeds compliance standards; exemplary site practice',
  },
  {
    value: 'Compliant',
    label: 'Compliant',
    badgeClass: 'rating-compliant',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    triggersCar: false,
    description: 'Meets required statutory and company safety standards',
  },
  {
    value: 'Observations only',
    label: 'Observations Only',
    badgeClass: 'rating-observations-only',
    color: '#0284c7',
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
    triggersCar: false,
    description: 'Factual observation noted; no formal action required',
  },
  {
    value: 'Area for Improvement',
    label: 'Area for Improvement',
    badgeClass: 'rating-area-for-improvement',
    color: '#d97706',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    triggersCar: true,
    description: 'Sub-optimal condition requiring corrective action',
  },
  {
    value: 'Minor Non-Conformance',
    label: 'Minor Non-Conformance',
    badgeClass: 'rating-minor-non-conformance',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    triggersCar: true,
    description: 'Deviation from procedure that does not pose immediate severe hazard',
  },
  {
    value: 'Major Non-Conformance',
    label: 'Major Non-Conformance',
    badgeClass: 'rating-major-non-conformance',
    color: '#991b1b',
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    triggersCar: true,
    description: 'Critical safety breach or imminent hazard requiring immediate halt/CAR',
  },
];

/**
 * Helper to determine if a rating necessitates a Corrective Action Record (CAR).
 * Matches the original Quest rule:
 * Area for Improvement, Minor Non-Conformance, and Major Non-Conformance trigger CARs.
 */
export function ratingTriggersCar(rating: InternalAuditRating | string): boolean {
  return ['Area for Improvement', 'Minor Non-Conformance', 'Major Non-Conformance'].includes(rating);
}

/**
 * Normalize and validate arbitrary AI rating strings into valid InternalAuditRating.
 */
export function normalizeAuditRating(rawRating: string | undefined | null): InternalAuditRating {
  if (!rawRating) return 'Compliant';
  const trimmed = rawRating.trim();
  const valid = INTERNAL_AUDIT_RATINGS.find((r) => r.value.toLowerCase() === trimmed.toLowerCase());
  if (valid) return valid.value;

  const rLower = trimmed.toLowerCase();
  if (rLower.includes('major')) return 'Major Non-Conformance';
  if (rLower.includes('minor')) return 'Minor Non-Conformance';
  if (rLower.includes('improvement')) return 'Area for Improvement';
  if (rLower.includes('good')) return 'Good Practice';
  if (rLower.includes('observation')) return 'Observations only';
  return 'Compliant';
}
