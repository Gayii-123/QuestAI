/**
 * QuestAI Site Inspection Form Reusable Schema
 *
 * Extracted from Quest Web Application:
 * - src/app/feature/site-inspection/components/si-add/si-add.component.ts
 * - src/app/feature/site-inspection/components/si-add/managers-questions.ts
 *
 * NOTE: This is an isolated, portable TypeScript definition for QuestAI.
 * It contains zero dependencies on Angular, Firebase, or Quest runtime modules.
 */

// ============================================================================
// 1. DATA MODEL & TYPES
// ============================================================================

/**
 * Standard Quest Site Inspection Rating values:
 * '1'  : Compliant / Pass
 * '-1' : Non-Compliant / Action Required (triggers CAR creation)
 * '0'  : Not Applicable (N/A) / Not Observable
 */
export type QuestRatingValue = '1' | '-1' | '0' | '';

/**
 * Supported question answer input types
 */
export type QuestionAnswerType =
  | 'rating'
  | 'select'
  | 'multiselect'
  | 'componentsupport'
  | 'textarea'
  | 'imageURL'
  | 'Training';

/**
 * Single select option definition
 */
export interface SelectOption {
  txt: string;
  ncr?: 'No' | 'Minor' | 'Major' | string;
  id?: number | string;
  subselection?: any[];
  [key: string]: any;
}

/**
 * Multi-select option definition with optional identifier and NCR trigger
 */
export interface MultiSelectOption {
  txt: string;
  id?: number | string;
  ncr?: string;
  [key: string]: any;
}

/**
 * CAR (Corrective Action Request / NCR) trigger rule
 */
export interface NeedCarRule {
  ind: number;
  txt: string;
  typeofcar: 'Major NCR' | 'Minor NCR' | string;
}

/**
 * Conditional display rule describing when a child question is visible
 */
export interface ConditionalDisplayRule {
  parentQuestionId: string; // Composite ID: `${headername}_${qnum}`
  parentQnum: string | number;
  condition: 'selectIndexIn' | 'multiselectContains' | 'equals';
  targetValues: any[];
  description: string;
}

/**
 * QuestAI-specific evaluation metadata.
 * Kept strictly isolated from the Quest form submission payload.
 */
export interface QuestAiMetadata {
  /** Suggested rating ('1', '-1', '0', or numeric score) */
  ai_suggested_rating?: QuestRatingValue | string;
  /** Suggested select choice text */
  ai_suggested_select?: string;
  /** Suggested multiselect choices */
  ai_suggested_multiselect?: string[];
  /** Model confidence score between 0.00 and 1.00 */
  ai_confidence?: number;
  /** Factual visual evidence observed from site photographs */
  ai_evidence?: string;
  /** Detailed chain-of-thought safety justification */
  ai_reasoning?: string;
  /** Flag set to true if visual confidence is low (< 0.70) or hazard is ambiguous */
  needs_human?: boolean;
  /** Indices of photos in the uploaded batch that substantiate this answer */
  supportingMediaIndices?: number[];
  /** Origin marker */
  answered_by?: 'human' | 'ai';
  /** True if modified by human reviewer before submission */
  edited_by_user?: boolean;
}

/**
 * Standard Site Inspection Question Schema
 */
export interface SiteInspectionQuestion {
  /** Composite Unique Identifier: `${headername}_${qnum}` */
  id: string;
  /** Original Question Number in Quest */
  qnum: string | number;
  /** Section / Category Header */
  headername: string;
  /** Exact Question Text */
  qtext: string;
  /** Whether photograph is recommended ('yes' | 'no') */
  photo?: 'yes' | 'no' | string;
  /** Section type / category identifier */
  type?: string;
  /** Inspector Guidance / Guidance Notes */
  cm?: string;
  /** Input field types required */
  typeofans?: QuestionAnswerType[] | string[];
  /** Single-select choice array (string or SelectOption) */
  select?: (string | SelectOption)[];
  /** Multi-select choice array */
  multiselect?: MultiSelectOption[];
  /** Title for multi-select section */
  multiselectheader?: string;
  /** Title for component/person picker section */
  componentheader?: string;
  /** Corrective action triggering rule */
  needcar?: NeedCarRule[];
  /** Whether CAR is flagged by default ('Yes' | 'No') */
  hascar?: 'Yes' | 'No' | string;
  /** Mandatory answer requirements (e.g. ['selectans', 'imageURL']) */
  mandatecond?: string[];
  /** Conditional visibility rule, if applicable */
  conditionalRule?: ConditionalDisplayRule;
  /** QuestAI Evaluation Metadata (Separate from Quest DB schema) */
  questai_metadata?: QuestAiMetadata;
  [key: string]: any;
}

/**
 * Question Group / Section grouping for UI rendering
 */
export interface QuestionGroup {
  headername: string;
  questions: SiteInspectionQuestion[];
}

// ============================================================================
// 2. EXTRACTED QUESTION BANKS
// ============================================================================

export const CIVIL_OTHER_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "TM/ Branding_01",
    "qnum": "01",
    "headername": "TM/ Branding",
    "qtext": "Appropriate Traffic Management in place? (As per Chapter 8 Requirements - Red Book / Refer to company Handbook)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_02",
    "qnum": "02",
    "headername": "TM/ Branding",
    "qtext": "TM Signs secured using sand bags and in good condition (No trip hazards)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_03",
    "qnum": "03",
    "headername": "TM/ Branding",
    "qtext": "TM barriers in good condition?(enough barriers provided, barrier clips available, barriers secured using sand bags?)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_04",
    "qnum": "04",
    "headername": "TM/ Branding",
    "qtext": "Heras fencing on site checked for hazards including protruding bits, trip and fall hazards etc.? (Damaged Heras to be removed from site)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_05",
    "qnum": "05",
    "headername": "TM/ Branding",
    "qtext": "TM Cones in good shape?(No damages (bases), no dirty or damaged/missing sleeves.)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_06",
    "qnum": "06",
    "headername": "TM/ Branding",
    "qtext": "All site vehicles engaged with work on the road fully meet chapter 8 signage and markings requirements? Yellow and red alternating retro reflective chevrons covering the rear as possible, A highways maintenance sign on the rear, Yellow/reflective tape on the sides, A double amber flashing beacon with two independent light sources.",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_07",
    "qnum": "07",
    "headername": "TM/ Branding",
    "qtext": "If the normal pedestrian/wheelchair/cyclist routes are affected by our works, is alternate safe routes provided?(temporary pedestrian routes well marked and does not cause confusion for pedestrians/cyclists/wheel chair users, no trip and fall hazards etc)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_08",
    "qnum": "08",
    "headername": "TM/ Branding",
    "qtext": "Marlborough Branding boards displayed?",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "People / PPE_01",
    "qnum": "01",
    "headername": "People / PPE",
    "qtext": "All vehicle/plant reversing on site carried out in the presence of banksman?",
    "photo": "no",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "Work Site_01",
    "qnum": "01",
    "headername": "Work Site",
    "qtext": "Does the site appear well organised, clean and tidy?(entrance, obstructions, mud, debris, litter, graffiti, site waste etc)",
    "photo": "yes",
    "type": "worksite",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_01",
    "qnum": "01",
    "headername": "Site Vehicles",
    "qtext": "Vehicle parked safely and not blocking traffic signs? (Not obstructing oncoming traffic or pedestrian routes etc)",
    "photo": "no",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_02",
    "qnum": "02",
    "headername": "Site Vehicles",
    "qtext": "Vehicle cabins kept clean and tidy? (No clutter on the dashboard, litter etc)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_03",
    "qnum": "03",
    "headername": "Site Vehicles",
    "qtext": "Vehicles bodywork kept clean and tidy?(Regularly washed)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_01",
    "qnum": "01",
    "headername": "Emergency Equipment",
    "qtext": "Fire extinguisher available in the site vehicles and service date showing up to date?(Easily accessible, serviced annually etc)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_02",
    "qnum": "02",
    "headername": "Emergency Equipment",
    "qtext": "Spill kit available on all site vehicles? (Good condition, easily accessible etc)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_03",
    "qnum": "03",
    "headername": "Emergency Equipment",
    "qtext": "Fully equipped first aid Kit available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_04",
    "qnum": "04",
    "headername": "Emergency Equipment",
    "qtext": "Fully equipped burns kit available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_05",
    "qnum": "05",
    "headername": "Emergency Equipment",
    "qtext": "Eye wash available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Work Site_02",
    "qnum": "02",
    "headername": "Work Site",
    "qtext": "Welfare units / toilets kept clean and tidy?(no litter, waste bins provided etc)",
    "photo": "yes",
    "type": "worksite",
    "hascar": "No"
  },
  {
    "id": "Work Site_03",
    "qnum": "03",
    "headername": "Work Site",
    "qtext": "Designated smoking area, first aider name, nearest A & E information and HSE",
    "photo": "yes",
    "type": "worksite",
    "hascar": "No"
  },
  {
    "id": "Work Site_04",
    "qnum": "04",
    "headername": "Work Site",
    "qtext": "No smoking within site boundaries unless on designated smoking area?",
    "photo": "no",
    "type": "worksite",
    "hascar": "No"
  },
  {
    "id": "Welfare units_01",
    "qnum": "01",
    "headername": "Welfare units",
    "qtext": "Welfare electrical testing (PAT) in yearly service date?",
    "photo": "yes",
    "type": "welfare",
    "hascar": "No"
  },
  {
    "id": "Welfare units_02",
    "qnum": "02",
    "headername": "Welfare units",
    "qtext": "TMA Permit Number Displayed? F10 displayed on site if applicable?",
    "photo": "yes",
    "type": "welfare",
    "hascar": "No"
  },
  {
    "id": "Welfare units_03",
    "qnum": "03",
    "headername": "Welfare units",
    "qtext": "Is a fully equipped first aid Kit available in the welfare unit?",
    "photo": "yes",
    "type": "welfare",
    "hascar": "No"
  },
  {
    "id": "Welfare units_04",
    "qnum": "04",
    "headername": "Welfare units",
    "qtext": "Fire extinguisher available in the welfare unit? service date showing up to date?(Easily accessible, serviced annually etc)",
    "photo": "yes",
    "type": "welfare",
    "hascar": "No"
  },
  {
    "id": "Site Documents_01",
    "qnum": "01",
    "headername": "Site Documents",
    "qtext": "Site specific Risk Assessment conducted and recorded? (Forms given inside Gang Pack file or done online)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_02",
    "qnum": "02",
    "headername": "Site Documents",
    "qtext": "Job Method Statement/SMS available, briefed to and signed by all staff onsite?",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_03",
    "qnum": "03",
    "headername": "Site Documents",
    "qtext": "Gang pack available on site?(Site drawings, SMS, Risk Assessments, COSHH, Company Handbook, incident forms etc)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_09",
    "qnum": "09",
    "headername": "TM/ Branding",
    "qtext": "All vehicle drivers conduct pre-use check prior to operation and records filled in daily?((Vehicle Inspection Form (vehicles below 7.5 tonne) / Drivers Defect Report (vehicles above 7.5 tonne) filled in daily?)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_10",
    "qnum": "10",
    "headername": "TM/ Branding",
    "qtext": "Plant operators conduct pre-use checks and records filled in daily?(Digger, Dumper, Paver, Roller, Tele-handler etc)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_11",
    "qnum": "11",
    "headername": "TM/ Branding",
    "qtext": "All plant operators wear seat belts (if available) during plant operation?(Dumber, Roller, Tele-handler, Forklift etc)",
    "photo": "no",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_12",
    "qnum": "12",
    "headername": "TM/ Branding",
    "qtext": "Rotating beacons and reversing alarms operating on all moving works vehicles/plant where fitted?(Digger, Dumber, Roller, Tele-handler, Forklift etc)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_13",
    "qnum": "13",
    "headername": "TM/ Branding",
    "qtext": "Site plant and tools in good condition and defects recorded?(Cut off Saw, Breaker, Whacker, Vib Roller, trailer etc)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "Site Documents_04",
    "qnum": "04",
    "headername": "Site Documents",
    "qtext": "Permit to work up to date? (Permits required for excavation works/ Hot works / Lifting / working under power lines etc)(Permit to Dig – simple line drawings provided to indicate location of excavation, type, position and distance of service relative to the excavation)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_05",
    "qnum": "05",
    "headername": "Site Documents",
    "qtext": "Latest stats available on site?",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Work Site_05",
    "qnum": "05",
    "headername": "Work Site",
    "qtext": "Services clearly marked on the ground?",
    "photo": "yes",
    "type": "worksite",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_01",
    "qnum": "01",
    "headername": "Plant / Tools",
    "qtext": "CAT calibrated and kept up to date?(Take picture of calibration sticker)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_02",
    "qnum": "02",
    "headername": "Plant / Tools",
    "qtext": "GENIE calibrated and kept up to date and clamps provided?(Take picture of calibration sticker and clamps)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_03",
    "qnum": "03",
    "headername": "Plant / Tools",
    "qtext": "Are mechanical lifting aids available on site and used?(Forklifts, Kerb lifters etc)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "People / PPE_02",
    "qnum": "02",
    "headername": "People / PPE",
    "qtext": "Full 6 Point PPE worn? (High viz long sleeve t-shirts & trousers, steel toe & mid sole protected boots, eye protection, safety helmets, gloves worn always unless risk assessed)",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_03",
    "qnum": "03",
    "headername": "People / PPE",
    "qtext": "Is PPE in good condition?(Do not tear off Hi-Viz clothing / t-shirts sleeves, no hoodies under hard hat , no torn boots etc)",
    "photo": "no",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_04",
    "qnum": "04",
    "headername": "People / PPE",
    "qtext": "Task specific eye protection worn (eg: Class 1 B goggles for breaking out/cutting operations)? (Light eye protection (Class 1 F) worn at all other times unless risk assessed)",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_05",
    "qnum": "05",
    "headername": "People / PPE",
    "qtext": "Water suppression techniques used for all cutting activities? Ear protection and dust mask used by cutter operator?",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_06",
    "qnum": "06",
    "headername": "People / PPE",
    "qtext": "Operatives practising good Manual Lifting Techniques?",
    "photo": "no",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "Site Documents_06",
    "qnum": "06",
    "headername": "Site Documents",
    "qtext": "Vibration – HAVS Forms filled in when operating Vibration generating equipment?(HAVS form provided within the site method statement)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_04",
    "qnum": "04",
    "headername": "Plant / Tools",
    "qtext": "All chemical containers adequately labelled?(Use rubber tags provided (Diesel, petrol, water-do not drink) or use permanent marker to label the containers of its contents)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_05",
    "qnum": "05",
    "headername": "Plant / Tools",
    "qtext": "Lifting equipment display valid thorough examination certificate? Lifting accessories (Slings, chains) correctly colour coded (BLUE – Jan to June, YELLOW – July to Dec)? (6 months-lifting accessories, 12 months-lifting equipment)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Training_01",
    "qnum": "01",
    "headername": "Training",
    "qtext": "Training: Person holding full street works ticket? (Ideally foreman)?",
    "type": "Training",
    "hascar": "No"
  },
  {
    "id": "Training_02",
    "qnum": "02",
    "headername": "Training",
    "qtext": "Training: Person using CAT and Gennie?(Attended Cat4 training with last 3 years?)",
    "type": "Training",
    "hascar": "No"
  },
  {
    "id": "Training_03",
    "qnum": "03",
    "headername": "Training",
    "qtext": "Training: First Aider on site? (Attended first aid course within last 3 years?)",
    "type": "Training",
    "hascar": "No"
  },
  {
    "id": "Training_04",
    "qnum": "04",
    "headername": "Training",
    "qtext": "Training: Who carries out cutting on site? (Attended abrasive wheel course within last 3 years)",
    "type": "Training",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_01",
    "qnum": "01",
    "headername": "Quality Checks",
    "qtext": "Product validation / QC - Has the works been delivered to satisfactory standards meeting client requirements and specifications",
    "photo": "no",
    "type": "quality",
    "hascar": "No"
  }
];

export const STREET_LIGHTING_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "TM/ Branding_01",
    "qnum": "01",
    "headername": "TM/ Branding",
    "qtext": "Appropriate Traffic Management in place? (As per Chapter 8 Requirements - Red Book / Refer to company Handbook)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_02",
    "qnum": "02",
    "headername": "TM/ Branding",
    "qtext": "TM Signs secured using sand bags and in good condition (No trip hazards)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_03",
    "qnum": "03",
    "headername": "TM/ Branding",
    "qtext": "TM barriers in good condition?(enough barriers provided, barrier clips available, barriers secured using sand bags?)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_04",
    "qnum": "04",
    "headername": "TM/ Branding",
    "qtext": "Heras fencing if used on site checked for hazards including protruding bits, trip and fall hazards? Damaged Heras to be removed from site.",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_05",
    "qnum": "05",
    "headername": "TM/ Branding",
    "qtext": "TM Cones in good shape?(No damages (bases), no dirty or damaged/missing sleeves.)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_06",
    "qnum": "06",
    "headername": "TM/ Branding",
    "qtext": "All site vehicles engaged with work on the road fully meet chapter 8 signage and markings requirements? Yellow and red alternating retro reflective chevrons covering the rear as possible, A highways maintenance sign on the rear, Yellow/reflective tape on the sides, A double amber flashing beacon with two independent light sources.",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_07",
    "qnum": "07",
    "headername": "TM/ Branding",
    "qtext": "If the normal pedestrian/wheelchair/cyclist routes are affected by our works, is alternate safe routes provided?(temporary pedestrian routes well marked and does not cause confusion for pedestrians/cyclists/wheel chair users, no trip and fall hazards etc)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_08",
    "qnum": "08",
    "headername": "TM/ Branding",
    "qtext": "Marlborough Branding boards displayed?",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "People / PPE_01",
    "qnum": "01",
    "headername": "People / PPE",
    "qtext": "All vehicle/plant reversing on site carried out in the presence of banksman?",
    "photo": "no",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "Work Site_01",
    "qnum": "01",
    "headername": "Work Site",
    "qtext": "Does the site appear well organised, clean and tidy?(entrance, obstructions, mud, debris, litter, graffiti, site waste etc)",
    "photo": "yes",
    "type": "worksite",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_01",
    "qnum": "01",
    "headername": "Site Vehicles",
    "qtext": "Vehicle parked safely and not blocking traffic signs? (Not obstructing oncoming traffic or pedestrian routes etc)",
    "photo": "no",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_02",
    "qnum": "02",
    "headername": "Site Vehicles",
    "qtext": "Vehicle cabins kept clean and tidy? (No clutter on the dashboard, litter etc)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_03",
    "qnum": "03",
    "headername": "Site Vehicles",
    "qtext": "Vehicles bodywork kept clean and tidy?(Regularly washed)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_01",
    "qnum": "01",
    "headername": "Emergency Equipment",
    "qtext": "Fire extinguisher available in the site vehicles and service date showing up to date?(Easily accessible, serviced annually etc)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_02",
    "qnum": "02",
    "headername": "Emergency Equipment",
    "qtext": "Spill kit available on all site vehicles? (Good condition, easily accessible etc)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_03",
    "qnum": "03",
    "headername": "Emergency Equipment",
    "qtext": "Fully equipped first aid Kit available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_04",
    "qnum": "04",
    "headername": "Emergency Equipment",
    "qtext": "Fully equipped burns kit available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_05",
    "qnum": "05",
    "headername": "Emergency Equipment",
    "qtext": "Eye wash available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Work Site_02",
    "qnum": "02",
    "headername": "Work Site",
    "qtext": "No smoking within site boundaries unless on designated smoking area?",
    "photo": "no",
    "type": "worksite",
    "hascar": "No"
  },
  {
    "id": "Welfare units_01",
    "qnum": "01",
    "headername": "Welfare units",
    "qtext": "TMA Permit Number Displayed? F10 displayed on site if applicable?",
    "photo": "yes",
    "type": "welfare",
    "hascar": "No"
  },
  {
    "id": "Welfare units_02",
    "qnum": "02",
    "headername": "Welfare units",
    "qtext": "Welfare electrical testing (PAT) in yearly service date?",
    "photo": "yes",
    "type": "welfare",
    "hascar": "No"
  },
  {
    "id": "Site Documents_01",
    "qnum": "01",
    "headername": "Site Documents",
    "qtext": "Site specific Risk Assessment conducted and recorded? (Forms given inside Gang Pack file or done online)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_02",
    "qnum": "02",
    "headername": "Site Documents",
    "qtext": "Job Method Statement/SMS available, briefed to and signed by all staff onsite?",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_03",
    "qnum": "03",
    "headername": "Site Documents",
    "qtext": "Gang pack available on site?(Site drawings, SMS, Risk Assessments, COSHH, Company Handbook, incident forms etc)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_04",
    "qnum": "04",
    "headername": "Site Vehicles",
    "qtext": "All vehicle drivers conduct pre-use check prior to operation and records filled in daily?(Vehicle Inspection Form (vehicles below 7.5 tonne) / Drivers Defect Report (vehicles above 7.5 tonne) filled in daily?)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_01",
    "qnum": "01",
    "headername": "Plant / Tools",
    "qtext": "Site plant and tools in good condition and defects recorded?(Cut off Saw, Breaker, Whacker, Vib Roller, trailer etc)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Site Documents_04",
    "qnum": "04",
    "headername": "Site Documents",
    "qtext": "Permit to work up to date? (Permits required for excavation works/ Hot works / Lifting / working under power lines etc)(Permit to Dig – simple line drawings provided to indicate location of excavation, type, position and distance of service relative to the excavation)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_05",
    "qnum": "05",
    "headername": "Site Documents",
    "qtext": "Latest stats available on site?",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Work Site_03",
    "qnum": "03",
    "headername": "Work Site",
    "qtext": "Services clearly marked on the ground?",
    "photo": "yes",
    "type": "worksite",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_02",
    "qnum": "02",
    "headername": "Plant / Tools",
    "qtext": "CAT calibrated and kept up to date?(Take picture of calibration sticker)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_03",
    "qnum": "03",
    "headername": "Plant / Tools",
    "qtext": "GENIE calibrated and kept up to date and clamps provided?(Take picture of calibration sticker and clamps)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_04",
    "qnum": "04",
    "headername": "Plant / Tools",
    "qtext": "Are mechanical lifting aids available on site and used?(Forklifts, Kerb lifters etc)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "People / PPE_02",
    "qnum": "02",
    "headername": "People / PPE",
    "qtext": "Full 6 Point PPE worn? (High viz long sleeve t-shirts & trousers, steel toe & mid sole protected boots, eye protection, safety helmets, gloves worn always unless risk assessed)",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_03",
    "qnum": "03",
    "headername": "People / PPE",
    "qtext": "Is PPE in good condition?(Do not tear off Hi-Viz clothing / t-shirts sleeves, no hoodies under hard hat , no torn boots etc)",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_04",
    "qnum": "04",
    "headername": "People / PPE",
    "qtext": "Task specific eye protection worn (eg: Class 1 B goggles for breaking out/cutting operations)? (Light eye protection (Class 1 F) worn at all other times unless risk assessed)",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_05",
    "qnum": "05",
    "headername": "People / PPE",
    "qtext": "Water suppression techniques used for all cutting activities? Ear protection and dust mask used by cutter operator?",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_06",
    "qnum": "06",
    "headername": "People / PPE",
    "qtext": "Operatives practising good Manual Lifting Techniques?",
    "photo": "no",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "Site Documents_06",
    "qnum": "06",
    "headername": "Site Documents",
    "qtext": "Vibration – HAVS Forms filled in when operating Vibration generating equipment?(HAVS form provided within the site method statement)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_05",
    "qnum": "05",
    "headername": "Plant / Tools",
    "qtext": "All chemical containers adequately labelled?(Use rubber tags provided (Diesel, petrol, water-do not drink) or use permanent marker to label the containers of its contents)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_06",
    "qnum": "06",
    "headername": "Plant / Tools",
    "qtext": "Lifting equipment display valid thorough examination certificate? Lifting accessories (Slings, chains) correctly colour coded (BLUE – Jan to June, YELLOW – July to Dec)? (6 months-lifting accessories, 12 months-lifting equipment)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "People / PPE_07",
    "qnum": "07",
    "headername": "People / PPE",
    "qtext": "Face visors provided for operatives?",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "Training_01",
    "qnum": "01",
    "headername": "Training",
    "qtext": "Training: Person using CAT and Gennie?(Attended Cat4 training with last 3 years?)",
    "type": "Training",
    "hascar": "No"
  },
  {
    "id": "Training_02",
    "qnum": "02",
    "headername": "Training",
    "qtext": "Training: First Aider on site? (Attended first aid course within last 3 years?)",
    "type": "Training",
    "hascar": "No"
  },
  {
    "id": "Training_03",
    "qnum": "03",
    "headername": "Training",
    "qtext": "Training: Who carries out cutting on site? (Attended abrasive wheel course within last 3 years)",
    "type": "Training",
    "hascar": "No"
  },
  {
    "id": "Training_04",
    "qnum": "04",
    "headername": "Training",
    "qtext": "Training: Checking/inspection of the MEWP harness and lanyard",
    "type": "Training",
    "hascar": "No"
  },
  {
    "id": "Training_05",
    "qnum": "05",
    "headername": "Training",
    "qtext": "Training: HERS card(Please enter the operative's registration number and expiry date of card)",
    "type": "Training",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_01",
    "qnum": "01",
    "headername": "Quality Checks",
    "qtext": "Product validation / QC - Has the works been delivered to satisfactory standards meeting client requirements and specifications",
    "photo": "no",
    "type": "quality",
    "hascar": "No"
  }
];

export const ROAD_MARKING_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "TM/ Branding_01",
    "qnum": "01",
    "headername": "TM/ Branding",
    "qtext": "Appropriate Traffic Management in place? (As per Chapter 8 Requirements - Red Book / Refer to company Handbook)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_02",
    "qnum": "02",
    "headername": "TM/ Branding",
    "qtext": "TM Signs secured using sand bags and in good condition (No trip hazards)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_03",
    "qnum": "03",
    "headername": "TM/ Branding",
    "qtext": "TM barriers in good condition?(enough barriers provided, barrier clips available, barriers secured using sand bags?)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_04",
    "qnum": "04",
    "headername": "TM/ Branding",
    "qtext": "Heras fencing if used on site checked for hazards including protruding bits, trip and fall hazards? Damaged Heras to be removed from site.",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_05",
    "qnum": "05",
    "headername": "TM/ Branding",
    "qtext": "TM Cones in good shape?(No damages (bases), no dirty or damaged/missing sleeves.)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_06",
    "qnum": "06",
    "headername": "TM/ Branding",
    "qtext": "All site vehicles engaged with work on the road fully meet chapter 8 signage and markings requirements? Yellow and red alternating retro reflective chevrons covering the rear as possible, A highways maintenance sign on the rear, Yellow/reflective tape on the sides, A double amber flashing beacon with two independent light sources.",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_07",
    "qnum": "07",
    "headername": "TM/ Branding",
    "qtext": "If the normal pedestrian/wheelchair/cyclist routes are affected by our works, is alternate safe routes provided?(temporary pedestrian routes well marked and does not cause confusion for pedestrians/cyclists/wheel chair users, no trip and fall hazards etc)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_08",
    "qnum": "08",
    "headername": "TM/ Branding",
    "qtext": "Marlborough Branding boards displayed?",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_01",
    "qnum": "01",
    "headername": "Site Vehicles",
    "qtext": "Vehicle parked safely and not blocking traffic signs? (Not obstructing oncoming traffic or pedestrian routes etc)",
    "photo": "no",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_02",
    "qnum": "02",
    "headername": "Site Vehicles",
    "qtext": "Vehicle cabins kept clean and tidy? (No clutter on the dashboard, litter etc)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_03",
    "qnum": "03",
    "headername": "Site Vehicles",
    "qtext": "Vehicles bodywork kept clean and tidy?(Regularly washed)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_04",
    "qnum": "04",
    "headername": "Site Vehicles",
    "qtext": "All vehicle drivers conduct pre-use check prior to operation and records filled in daily?(Vehicle Inspection Form (vehicles below 7.5 tonne) / Drivers Defect Report (vehicles above 7.5 tonne) filled in daily?)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_01",
    "qnum": "01",
    "headername": "Emergency Equipment",
    "qtext": "Fire extinguisher available in the site vehicles and service date showing up to date?(Easily accessible, serviced annually etc)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_02",
    "qnum": "02",
    "headername": "Emergency Equipment",
    "qtext": "Spill kit available on all site vehicles? (Good condition, easily accessible etc)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_03",
    "qnum": "03",
    "headername": "Emergency Equipment",
    "qtext": "Fully equipped first aid Kit available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_04",
    "qnum": "04",
    "headername": "Emergency Equipment",
    "qtext": "Fully equipped burns kit available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_05",
    "qnum": "05",
    "headername": "Emergency Equipment",
    "qtext": "Eye wash available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Work Site_01",
    "qnum": "01",
    "headername": "Work Site",
    "qtext": "Does the site appear well organised, clean and tidy?(entrance, obstructions, mud, debris, litter, graffiti, site waste etc)",
    "photo": "yes",
    "type": "worksite",
    "hascar": "No"
  },
  {
    "id": "Work Site_02",
    "qnum": "02",
    "headername": "Work Site",
    "qtext": "No smoking within site boundaries unless on designated smoking area?",
    "photo": "no",
    "type": "worksite",
    "hascar": "No"
  },
  {
    "id": "Welfare units_01",
    "qnum": "01",
    "headername": "Welfare units",
    "qtext": "Welfare electrical testing (PAT) in yearly service date?",
    "photo": "yes",
    "type": "welfare",
    "hascar": "No"
  },
  {
    "id": "Welfare units_02",
    "qnum": "02",
    "headername": "Welfare units",
    "qtext": "TMA Permit Number Displayed? F10 displayed on site if applicable?",
    "photo": "yes",
    "type": "welfare",
    "hascar": "No"
  },
  {
    "id": "Site Documents_01",
    "qnum": "01",
    "headername": "Site Documents",
    "qtext": "Site specific Risk Assessment conducted and recorded? (Forms given inside Gang Pack file or done online)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_02",
    "qnum": "02",
    "headername": "Site Documents",
    "qtext": "Job Method Statement/SMS available, briefed to and signed by all staff onsite?",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_03",
    "qnum": "03",
    "headername": "Site Documents",
    "qtext": "Gang pack available on site?(Site drawings, SMS, Risk Assessments, COSHH, Company Handbook, incident forms etc)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_04",
    "qnum": "04",
    "headername": "Site Documents",
    "qtext": "Vibration – HAVS Forms filled in when operating Vibration generating equipment?(HAVS form provided within the site method statement)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "People / PPE_01",
    "qnum": "01",
    "headername": "People / PPE",
    "qtext": "All vehicle/plant reversing on site carried out in the presence of banksman?",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_02",
    "qnum": "02",
    "headername": "People / PPE",
    "qtext": "Full 6 Point PPE worn? (High viz long sleeve t-shirts & trousers, steel toe & mid sole protected boots, eye protection, safety helmets, gloves worn always unless risk assessed)",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_03",
    "qnum": "03",
    "headername": "People / PPE",
    "qtext": "Is PPE in good condition?(Do not tear off Hi-Viz clothing / t-shirts sleeves, no hoodies under hard hat etc)",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_04",
    "qnum": "04",
    "headername": "People / PPE",
    "qtext": "Task specific eye protection worn (eg: Class 1 B goggles for breaking out/cutting operations)? (Light eye protection (Class 1 F) worn at all other times unless risk assessed)",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_05",
    "qnum": "05",
    "headername": "People / PPE",
    "qtext": "Operatives practising good Manual Lifting Techniques?",
    "photo": "no",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_06",
    "qnum": "06",
    "headername": "People / PPE",
    "qtext": "Gauntlets provided for operatives?",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_07",
    "qnum": "07",
    "headername": "People / PPE",
    "qtext": "Face visors provided for operatives?",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_01",
    "qnum": "01",
    "headername": "Plant / Tools",
    "qtext": "Site plant and tools in good condition and defects recorded?(Cut off Saw, Breaker, Whacker, Vib Roller, trailer etc)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_02",
    "qnum": "02",
    "headername": "Plant / Tools",
    "qtext": "All chemical containers adequately labelled?(Use rubber tags provided (Diesel, petrol, water-do not drink) or use permanent marker to label the containers of its contents)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Plant / Tools_03",
    "qnum": "03",
    "headername": "Plant / Tools",
    "qtext": "Lifting equipment display valid thorough examination certificate? Lifting accessories (Slings, chains) correctly colour coded (BLUE – Jan to June, YELLOW – July to Dec)? (6 months-lifting accessories, 12 months-lifting equipment)",
    "photo": "yes",
    "type": "plant",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_01",
    "qnum": "01",
    "headername": "Quality Checks",
    "qtext": "Uniformity of lining (check line length & width)",
    "photo": "yes",
    "type": "quality",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_02",
    "qnum": "02",
    "headername": "Quality Checks",
    "qtext": "Uniformity of symbols (check size)",
    "photo": "yes",
    "type": "quality",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_03",
    "qnum": "03",
    "headername": "Quality Checks",
    "qtext": "Line thickness (measure thickness)",
    "photo": "yes",
    "type": "quality",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_04",
    "qnum": "04",
    "headername": "Quality Checks",
    "qtext": "Application of glass beads (visual inspection)",
    "photo": "yes",
    "type": "quality",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_05",
    "qnum": "05",
    "headername": "Quality Checks",
    "qtext": "Overall appearance",
    "photo": "yes",
    "type": "quality",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_06",
    "qnum": "06",
    "headername": "Quality Checks",
    "qtext": "Temperature shown on White Boiler Thermometer is within ±10⁰C of the Ref Thermometer?",
    "photo": "no",
    "type": "quality",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_07",
    "qnum": "07",
    "headername": "Quality Checks",
    "qtext": "Temperature shown on Yellow Boiler Thermometer is within ±10⁰C of the Ref Thermometer?",
    "photo": "no",
    "type": "quality",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_08",
    "qnum": "08",
    "headername": "Quality Checks",
    "qtext": "Calibration - Measuring Wheels calibrated? Take picture of service sticker on the measuring wheel.",
    "photo": "yes",
    "type": "quality",
    "hascar": "No"
  },
  {
    "id": "Training_01",
    "qnum": "01",
    "headername": "Training",
    "qtext": "Training: First Aider on site? (Attended first aid course within last 3 years?)",
    "type": "Training",
    "hascar": "No"
  }
];

export const ROAD_SURFACING_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "H&S Documentation and Planning_1",
    "qnum": 1,
    "headername": "H&S Documentation and Planning",
    "qtext": "The Foreman can describe the significant risks, and they have been identified in his SSRA",
    "cm": "Inspection is confirming that the significant risks are understood and being managed correctly ",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No"
    ],
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "H&S Documentation and Planning_2",
    "qnum": 2,
    "headername": "H&S Documentation and Planning",
    "qtext": "Identified Street works person on site at time of visit",
    "cm": "Street work competent person on site throughout works ",
    "typeofans": [
      "componentsupport"
    ],
    "componentheader": "Select street works certificated persons",
    "mandatecond": [
      "componentres"
    ]
  },
  {
    "id": "H&S Documentation and Planning_3",
    "qnum": 3,
    "headername": "H&S Documentation and Planning",
    "qtext": "Identified first aider & equipment available at site.",
    "cm": "Competent first aider & equipment accessible at site ",
    "typeofans": [
      "componentsupport"
    ],
    "componentheader": "Select trained first aider person",
    "mandatecond": [
      "componentres"
    ]
  },
  {
    "id": "Setting up work environment_4",
    "qnum": 4,
    "headername": "Setting up work environment",
    "qtext": "Pedestrian barrier installed &  complete/maintained through work area appropriate to footpath width ",
    "cm": "Correct pedestrian barrier in use & fully implemented",
    "typeofans": [
      "select"
    ],
    "select": [
      "Incorrect barrier for footpath width",
      "Correct barrier for footpath width, pedestrian marshall not visible/ evident",
      "Correct barrier for footpath width, pedestrian marshall active, large gaps in barrier: single gap >2m",
      "Correct barrier for footpath width, pedestrian marshall active, small gaps in barrier (no more than 4 gap, max gap <2m)",
      "Correct barrier for footpath width. Barrier complete throughout works & maintained. Pedestrian mashal active"
    ],
    "componentheader": "pedestrian barrier controls",
    "needcar": [
      {
        "ind": 1,
        "txt": "Incorrect barrier for footpath width",
        "typeofcar": "Major NCR"
      },
      {
        "ind": 2,
        "txt": "Correct barrier for footpath width, pedestrian marshall not visible/ evident",
        "typeofcar": "Major NCR"
      },
      {
        "ind": 3,
        "txt": "Correct barrier for footpath width, pedestrian marshall active, large gaps in barrier: single gap >2m",
        "typeofcar": "Major NCR"
      },
      {
        "ind": 4,
        "txt": "Correct barrier for footpath width, pedestrian marshall active, small gaps in barrier (no more than 4 gap, max gap <2m)",
        "typeofcar": "Minor NCR"
      }
    ],
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Setting up work environment_4 a",
    "qnum": "4 a",
    "headername": "Setting up work environment",
    "qtext": "Corrective actions (required for score 1-4)",
    "cm": "Where corrective action needed, what action have you taken ",
    "typeofans": [
      "multiselect"
    ],
    "multiselect": [
      {
        "txt": "Works stopped. Briefing given to gang",
        "id": 1
      },
      {
        "txt": "Workers seen doing corrective action ",
        "id": 2
      },
      {
        "txt": "Workers instructed to correct- not observed ",
        "id": 3
      },
      {
        "txt": "No action taken ",
        "id": 4
      }
    ],
    "multiselectheader": "Pedestrian barrier corrective action",
    "mandatecond": [
      "multiselectans"
    ],
    "conditionalRule": {
      "parentQuestionId": "Setting up work environment_4",
      "parentQnum": 4,
      "condition": "selectIndexIn",
      "targetValues": [
        0,
        1,
        2,
        3
      ],
      "description": "Applicable only if Q4 score is 1-4 (select option index 0, 1, 2, or 3)."
    }
  },
  {
    "id": "Setting up work environment_5",
    "qnum": 5,
    "headername": "Setting up work environment",
    "qtext": "Road closure at site entrance correctly in place & maintained  ",
    "cm": "",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No"
    ],
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Setting up work environment_6",
    "qnum": 6,
    "headername": "Setting up work environment",
    "qtext": "Overhead Obstructions marked (Kerbline blue cones 10m either side of obstruction)",
    "cm": "",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Setting up work environment_7",
    "qnum": 7,
    "headername": "Setting up work environment",
    "qtext": "Other high risk/ sensitive areas (schools, crossings etc identified ) being controlled",
    "cm": "Have all high risk/ sensitive locations been identified/ being managed ?",
    "typeofans": [
      "multiselect"
    ],
    "multiselect": [
      {
        "txt": "School/pre school",
        "id": 1
      },
      {
        "txt": "Hospital/Doctors/Medical centre",
        "id": 2
      },
      {
        "txt": "Playing fields/ public spaces ",
        "id": 3
      },
      {
        "txt": "Pedestrian crossing closed by work site ",
        "id": 4
      },
      {
        "txt": "Nursing Homes/Care Homes ",
        "id": 5
      },
      {
        "txt": "Access to shops/ business premises",
        "id": 6
      },
      {
        "txt": "Emergency services access ",
        "id": 7
      }
    ],
    "multiselectheader": "Local environment considerations ",
    "mandatecond": [
      "multiselectans"
    ]
  },
  {
    "id": "Setting up work environment_8",
    "qnum": 8,
    "headername": "Setting up work environment",
    "qtext": "Weather - weather risks understood by Foreman & being managed",
    "cm": "Forecast weather and its possible impacts of safe delivery accounted for  ",
    "typeofans": [
      "select"
    ],
    "select": [
      "Dry",
      "Light rain",
      "Heavy rain",
      "Snow / ice",
      "Fog/mist",
      "Adverse weather warning in place"
    ],
    "componentheader": "Weather",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Plant people interface_9",
    "qnum": 9,
    "headername": "Plant people interface",
    "qtext": "Zonal working correctly in use (observe single activity/ zone in practice)",
    "cm": "Arrangements for zonal working established & communicated  ",
    "typeofans": [
      "select",
      "imageURL"
    ],
    "select": [
      "Single zone working (small site)- only 1 activity  at any time on site",
      "Two zone working - different activity in each zone, zones well defined"
    ],
    "componentheader": "Zonal working",
    "mandatecond": [
      "selectans",
      "imageURL"
    ]
  },
  {
    "id": "Plant people interface_10",
    "qnum": 10,
    "headername": "Plant people interface",
    "qtext": "Named spotters/ banksman/men observed  fully performing role ",
    "cm": "Specific individuals assigned responsibility for key safe vehicle movement controls  ",
    "typeofans": [
      "componentsupport"
    ],
    "componentheader": "Select spotters & banksman",
    "mandatecond": [
      "componentres"
    ]
  },
  {
    "id": "Plant people interface_11",
    "qnum": 11,
    "headername": "Plant people interface",
    "qtext": "All persons working on site wearing  HV trousers & long sleeve tops , helmets, gloves and safety footwear  ",
    "cm": "All workers, & visitors on site to wear 6 point PPE (see also 18 below) ",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No"
    ],
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Plant people interface_12",
    "qnum": 12,
    "headername": "Plant people interface",
    "qtext": "Worker maintaining safe  clearance to moving plant",
    "cm": "Operatives are communicating with operators & looking out for each other",
    "typeofans": [
      "multiselect"
    ],
    "multiselect": [
      {
        "txt": "Observed banksman interacting with workers if close to moving plant",
        "id": 1
      },
      {
        "txt": "Observed workers getting machine driver attention before moving close (<1m) \"thumbs up\"",
        "id": 2
      },
      {
        "txt": "Observed non essential works remaining >2m from moving plant",
        "id": 3
      },
      {
        "txt": "Observed banksman with reversing plant / lorries",
        "id": 4
      },
      {
        "txt": "No active / poor controls in place",
        "id": 5
      }
    ],
    "multiselectheader": "Workers/ moving plant interface ",
    "needcar": [
      {
        "ind": 6,
        "txt": "No active / poor controls in place",
        "typeofcar": "Major NCR"
      }
    ],
    "mandatecond": [
      "multiselectans"
    ]
  },
  {
    "id": "Plant people interface_12 a",
    "qnum": "12 a",
    "headername": "Plant people interface",
    "qtext": "Corrective actions (No/poor control)",
    "cm": " ",
    "typeofans": [
      "multiselect"
    ],
    "multiselect": [
      {
        "txt": "Works stopped. Briefing given to gang",
        "id": 1
      },
      {
        "txt": "Workers seen doing corrective action ",
        "id": 2
      },
      {
        "txt": "Workers instructed to correct- not observed ",
        "id": 3
      },
      {
        "txt": "No action taken ",
        "id": 4
      }
    ],
    "multiselectheader": "Pedestrian barrier corrective action",
    "mandatecond": [
      "multiselectans"
    ],
    "conditionalRule": {
      "parentQuestionId": "Plant people interface_12",
      "parentQnum": 12,
      "condition": "multiselectContains",
      "targetValues": [
        "No active / poor controls in place"
      ],
      "description": "Applicable only if Q12 multiselect includes \"No active / poor controls in place\"."
    }
  },
  {
    "id": "Plant people interface_13",
    "qnum": 13,
    "headername": "Plant people interface",
    "qtext": "Parking/ holding areas defined and coned out / managed ",
    "cm": "Parking & vehicle holding areas need to be managed to good standard",
    "typeofans": [
      "select"
    ],
    "select": [
      "Parking/ holding area within road closure / TM scheme",
      "Parking holding area in same road (outside closure /TM scheme)",
      "Parking/holding area in another road (nearby)"
    ],
    "componentheader": "Parking / holding areas",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Health Risks_14",
    "qnum": 14,
    "headername": "Health Risks",
    "qtext": "Hearing protection in use in accordance with SSRA  listing  ",
    "cm": "Hearing protection needs to be worn by those involved in noise activities ",
    "typeofans": [
      "select"
    ],
    "select": [
      "Cutting/ breaking asphalt",
      "Cutting/ breaking concrete",
      "Working on/near planer",
      "No noisy work at time of visit"
    ],
    "componentheader": "Noise",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Health Risks_15",
    "qnum": 15,
    "headername": "Health Risks",
    "qtext": "HAVS logged by identified persons ?",
    "cm": "Operatives using tools with vibration risk (breakers, disc cutters etc) need to log exposure times daily ",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No"
    ],
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Health Risks_16",
    "qnum": 16,
    "headername": "Health Risks",
    "qtext": "Welfare  arrangements suitable, sufficient & readily available",
    "cm": "Suitable welfare- eating rest area, toilets, hand washing, and drinking water  available & maintained",
    "typeofans": [
      "select"
    ],
    "select": [
      "Welfare van inside road closure/TM scheme",
      "Welfare van in another road (nearby)",
      "Cabin welfare unit close to works",
      "Other (describe)"
    ],
    "componentheader": "Welfare",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Task Specific Risks_17",
    "qnum": 17,
    "headername": "Task Specific Risks",
    "qtext": "Hot works - What tasks are covered by current hot work permits ",
    "cm": "Required for any naked flame (bitumen boiler) and cutting which may produce sparks)",
    "typeofans": [
      "select"
    ],
    "select": [
      "Use of bitumen boiler",
      "Grinding ",
      "Cutting of metalwork ",
      "No hot works planned for day "
    ],
    "componentheader": "Hot Works permits",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Task Specific Risks_18",
    "qnum": 18,
    "headername": "Task Specific Risks",
    "qtext": " Eye protection - Is eye protection being worn  ",
    "cm": "Eye protection is part of 6 point PPE- needs to be worn unless no risk of eye injury, or other controls put in place",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No"
    ],
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Task Specific Risks_18 a",
    "qnum": "18 a",
    "headername": "Task Specific Risks",
    "qtext": "Eye protection - If eye protection not worn what actions taken to minimise risk of eye injury ",
    "cm": "",
    "typeofans": [
      "multiselect"
    ],
    "multiselect": [
      {
        "txt": "Eye protection to be worn when cutting/ breaking",
        "id": 1
      },
      {
        "txt": "Eye protection not worn no risk of eye injury whilst raking/ laying blacktop",
        "id": 2
      },
      {
        "txt": "Eye protection not worn raining and glasses affect vision (misting up)",
        "id": 3
      },
      {
        "txt": "Eye protection not worn night works and glasses affect vision ",
        "id": 4
      },
      {
        "txt": "Other controls to prevent eye injury",
        "id": 5
      }
    ],
    "multiselectheader": "Eye protection ",
    "mandatecond": [
      "multiselectans"
    ],
    "conditionalRule": {
      "parentQuestionId": "Task Specific Risks_18",
      "parentQnum": 18,
      "condition": "equals",
      "targetValues": [
        "No"
      ],
      "description": "Applicable only if Q18 select answer is \"No\"."
    }
  },
  {
    "id": "Task Specific Risks_19",
    "qnum": 19,
    "headername": "Task Specific Risks",
    "qtext": " Anti social behaviour (from 3rd parties) . Is ASB at risk for the workforce   ",
    "cm": "From site perspective",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No"
    ],
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Task Specific Risks_19 a",
    "qnum": "19 a",
    "headername": "Task Specific Risks",
    "qtext": "ASB; What controls are being taken to protect workforce  ",
    "cm": "",
    "typeofans": [
      "multiselect"
    ],
    "multiselect": [
      {
        "txt": "Client notified",
        "id": 1
      },
      {
        "txt": "Body cams worn (selected persons)",
        "id": 2
      },
      {
        "txt": "ASB not tolerated signage ",
        "id": 3
      },
      {
        "txt": "CCTV on site ",
        "id": 4
      },
      {
        "txt": "No additional measures",
        "id": 5
      }
    ],
    "multiselectheader": "Anti social behaviour",
    "mandatecond": [
      "multiselectans"
    ],
    "conditionalRule": {
      "parentQuestionId": "Task Specific Risks_19",
      "parentQnum": 19,
      "condition": "equals",
      "targetValues": [
        "Yes"
      ],
      "description": "Applicable only if Q19 select answer is \"Yes\"."
    }
  },
  {
    "id": "Task Specific Risks_20",
    "qnum": 20,
    "headername": "Task Specific Risks",
    "qtext": " Changes from planned scope of works: Has work scope changed since start of works, or unforseen items identified ",
    "cm": "Where work continues over multiple days, ensure changes are addressed ",
    "typeofans": [
      "select"
    ],
    "select": [
      "No changes- works continue as planned ",
      "Unforeseen services; reviewed with Supervisor",
      "Method changed- rebriefed gang",
      "Minor scope change - reviewed with Supervisor, rebriefed gang",
      "Significant scope change- New RAMS,  rebriefed gang"
    ],
    "componentheader": "Changes in work scope/method",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Worker briefing _21",
    "qnum": 21,
    "headername": "Worker briefing ",
    "qtext": " All persons currently working on site (at time of visit) are included in SSRA briefing records  ",
    "cm": "",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No"
    ],
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Manager Only _22",
    "qnum": 22,
    "headername": "Manager Only ",
    "qtext": "Overview of site",
    "cm": "",
    "typeofans": [
      "select"
    ],
    "select": [
      "1",
      "2",
      "3",
      "4",
      "5"
    ],
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Manager Only _23",
    "qnum": 23,
    "headername": "Manager Only ",
    "qtext": "What opportunities for improving safety on site would you share?",
    "cm": "",
    "typeofans": [
      "textarea"
    ],
    "mandatecond": [
      "comment"
    ]
  }
];

export const TRAFFIC_MANAGEMENT_12D_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "12D_01",
    "qnum": "01",
    "headername": "12D",
    "qtext": "Correct safety zone in place and clearly marked with a barrier.",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_02",
    "qnum": "02",
    "headername": "12D",
    "qtext": "Correct size cones",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_03",
    "qnum": "03",
    "headername": "12D",
    "qtext": "Correct cone spacing",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_04",
    "qnum": "04",
    "headername": "12D",
    "qtext": "Correct distance for placement of sign for speed of the road.",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_05",
    "qnum": "05",
    "headername": "12D",
    "qtext": "Correct sighting distance for visibility for signage.",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_06",
    "qnum": "06",
    "headername": "12D",
    "qtext": "Traffic light batteries and control panel secured.",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_07",
    "qnum": "07",
    "headername": "12D",
    "qtext": "Tm signs secured using adequate sandbags (no trip Hazards)",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_08",
    "qnum": "08",
    "headername": "12D",
    "qtext": "Is TM installed according to the relevant Drawing/permit?",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_09",
    "qnum": "09",
    "headername": "12D",
    "qtext": "Tm barriers in good condition? (Enough barriers provided,barrier clips available,barriers secured using sandbags?)",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_10",
    "qnum": "10",
    "headername": "12D",
    "qtext": "Heras fencing is used on-site and checked for hazards including protruding bits, and trip and fall hazards. Damaged Haras are to be removed from the Site.",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_11",
    "qnum": "11",
    "headername": "12D",
    "qtext": "Site TM regularly checked & maintained? TM checks are recorded daily.",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_12",
    "qnum": "12",
    "headername": "12D",
    "qtext": "All site vehicles engaged with work on the road fully meet Chapter 8 signage and marking requirements.",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_13",
    "qnum": "13",
    "headername": "12D",
    "qtext": "If the normal pedestrian/ wheelchair/cyclist routes are affected by our work. Is an alternate safe route provided? (Temporary pedestrian routes are well marked and do not confuse Pedestrian/cyclist/wheelchair users,no trip and fall hazards,etc.",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_14",
    "qnum": "14",
    "headername": "12D",
    "qtext": "Are CCTV body cameras being worn and advisory signs displayed?",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_15",
    "qnum": "15",
    "headername": "12D",
    "qtext": "Are blue cones being used to advise overhead cables are present?",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_16",
    "qnum": "16",
    "headername": "12D",
    "qtext": "Traffic lights- are Sufficient Stop/go boards available on-site.",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_17",
    "qnum": "17",
    "headername": "12D",
    "qtext": "Road closures- are red/white barriers being used to reinforce the closure points.",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_18",
    "qnum": "18",
    "headername": "12D",
    "qtext": "Does the site appear well-organized,clean, and tidy? (Entrance,Obstructions,Mud,debris, litter, graffiti, site waste etc.)",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "12D_19",
    "qnum": "19",
    "headername": "12D",
    "qtext": "No smoking within site boundaries smoking area?",
    "photo": "yes",
    "type": "12D",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_01",
    "qnum": "01",
    "headername": "Emergency Equipment",
    "qtext": "Fire extinguisher available in the site vehicles? Up to date? (Easily accessible etc)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_02",
    "qnum": "02",
    "headername": "Emergency Equipment",
    "qtext": "Spill kit available on all site vehicles? (Good condition, easily accessible etc)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_03",
    "qnum": "03",
    "headername": "Emergency Equipment",
    "qtext": "Fully equipped first aid Kit available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "People / PPE_02",
    "qnum": "02",
    "headername": "People / PPE",
    "qtext": "Full 6 Point PPE worn? (High viz long sleeve t-shirts & trousers, steel toe & mid sole protected boots, eye protection, safety helmets, gloves worn always unless risk assessed)",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_03",
    "qnum": "03",
    "headername": "People / PPE",
    "qtext": "Is PPE in good condition?(Do not tear off Hi-Viz clothing / t-shirts sleeves, no hoodies under hard hat , no torn boots etc)",
    "photo": "no",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_04",
    "qnum": "04",
    "headername": "People / PPE",
    "qtext": "Operatives practising good Manual Lifting Techniques? Site operatives  attended manual handling training within last three years?",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_13",
    "qnum": "13",
    "headername": "Quality Checks",
    "qtext": "Product validation / QC - Has the works been delivered to satisfactory standards meeting client requirements and specifications",
    "photo": "no",
    "type": "quality",
    "hascar": "No"
  },
  {
    "id": "Site Documents_01",
    "qnum": "01",
    "headername": "Site Documents",
    "qtext": "Site specific Risk Assessment conducted and recorded? (Forms given inside Gang Pack file or done online)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_02",
    "qnum": "02",
    "headername": "Site Documents",
    "qtext": "Job Method Statement/SMS available, briefed to and signed by all staff onsite?",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_01",
    "qnum": "01",
    "headername": "Site Vehicles",
    "qtext": "Vehicle parked safely and not blocking traffic signs? (Not obstructing oncoming traffic or pedestrian routes etc)",
    "photo": "no",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_02",
    "qnum": "02",
    "headername": "Site Vehicles",
    "qtext": "Vehicle cabins kept clean and tidy? (No clutter on the dashboard, litter etc)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_03",
    "qnum": "03",
    "headername": "Site Vehicles",
    "qtext": "Vehicles bodywork kept clean and tidy? (Regularly washed)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_04",
    "qnum": "04",
    "headername": "Site Vehicles",
    "qtext": "All vehicle drivers conduct pre-use check prior to operation and records filled in daily?((Vehicle Inspection Form (vehicles below 7.5 tonne) / Drivers Defect Report (vehicles above 7.5 tonne) filled in daily?)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_01",
    "qnum": "01",
    "headername": "TM/ Branding",
    "qtext": "Appropriate Traffic Management in place? (As per Chapter 8 requirements Red Book)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  }
];

export const TRAFFIC_MANAGEMENT_12AB_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "12AB_01",
    "qnum": "01",
    "headername": "12AB",
    "qtext": "Has the site briefing been carried out by the site lead.",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_02",
    "qnum": "02",
    "headername": "12AB",
    "qtext": "Is HRS equipment required and in good working order?",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_03",
    "qnum": "03",
    "headername": "12AB",
    "qtext": "Correct distance for placement of sign for speed of the road.",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_04",
    "qnum": "04",
    "headername": "12AB",
    "qtext": "Correct sighting distance for visibility for signage.",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_05",
    "qnum": "05",
    "headername": "12AB",
    "qtext": "Correct safety zone in place.",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_06",
    "qnum": "06",
    "headername": "12AB",
    "qtext": "Correct cone spacing",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_07",
    "qnum": "07",
    "headername": "12AB",
    "qtext": "Works access and exit installed.",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_08",
    "qnum": "08",
    "headername": "12AB",
    "qtext": "Lamps in good working order.",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_09",
    "qnum": "09",
    "headername": "12AB",
    "qtext": "Safety line in place if required.",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_10",
    "qnum": "10",
    "headername": "12AB",
    "qtext": "Tm signs secured using adequate sandbags and correctly fitted sandbars.",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_11",
    "qnum": "11",
    "headername": "12AB",
    "qtext": "Is TM installed according to the relevant Drawing/permit?",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_12",
    "qnum": "12",
    "headername": "12AB",
    "qtext": "Is the Airlock system in place and set up and used correctly?",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_13",
    "qnum": "13",
    "headername": "12AB",
    "qtext": "Site TM regularly checked & maintained? TM checks are recorded daily.",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_14",
    "qnum": "14",
    "headername": "12AB",
    "qtext": "All site vehicles engaged with work on the road fully meet Chapter 8 signage and marking requirements.",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_15",
    "qnum": "15",
    "headername": "12AB",
    "qtext": "Are blue cones being used to advise overhead cables are present?",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_16",
    "qnum": "16",
    "headername": "12AB",
    "qtext": "Qualifications, Ratio, and in date?",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_17",
    "qnum": "17",
    "headername": "12AB",
    "qtext": "Does the site appear well-organized, clean, and tidy? (Entrance, Obstructions, Mud, debris, litter, graffiti, site waste etc.)",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "12AB_18",
    "qnum": "18",
    "headername": "12AB",
    "qtext": "No smoking within site boundaries smoking area?",
    "photo": "yes",
    "type": "12AB",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_01",
    "qnum": "01",
    "headername": "Emergency Equipment",
    "qtext": "Fire extinguisher available in the site vehicles? Up to date? (Easily accessible etc)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_02",
    "qnum": "02",
    "headername": "Emergency Equipment",
    "qtext": "Spill kit available on all site vehicles? (Good condition, easily accessible etc)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "Emergency Equipment_03",
    "qnum": "03",
    "headername": "Emergency Equipment",
    "qtext": "Fully equipped first aid Kit available in the vehicle?(no expired items)",
    "photo": "yes",
    "type": "emergency",
    "hascar": "No"
  },
  {
    "id": "People / PPE_02",
    "qnum": "02",
    "headername": "People / PPE",
    "qtext": "Full 6 Point PPE worn? (High viz long sleeve t-shirts & trousers, steel toe & mid sole protected boots, eye protection, safety helmets, gloves worn always unless risk assessed)",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_03",
    "qnum": "03",
    "headername": "People / PPE",
    "qtext": "Is PPE in good condition?(Do not tear off Hi-Viz clothing / t-shirts sleeves, no hoodies under hard hat , no torn boots etc)",
    "photo": "no",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "People / PPE_04",
    "qnum": "04",
    "headername": "People / PPE",
    "qtext": "Operatives practising good Manual Lifting Techniques? Site operatives  attended manual handling training within last three years?",
    "photo": "yes",
    "type": "people",
    "hascar": "No"
  },
  {
    "id": "Quality Checks_13",
    "qnum": "13",
    "headername": "Quality Checks",
    "qtext": "Product validation / QC - Has the works been delivered to satisfactory standards meeting client requirements and specifications",
    "photo": "no",
    "type": "quality",
    "hascar": "No"
  },
  {
    "id": "Site Documents_01",
    "qnum": "01",
    "headername": "Site Documents",
    "qtext": "Site specific Risk Assessment conducted and recorded? (Forms given inside Gang Pack file or done online)",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Documents_02",
    "qnum": "02",
    "headername": "Site Documents",
    "qtext": "Job Method Statement/SMS available, briefed to and signed by all staff onsite?",
    "photo": "yes",
    "type": "documents",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_01",
    "qnum": "01",
    "headername": "Site Vehicles",
    "qtext": "Vehicle parked safely and not blocking traffic signs? (Not obstructing oncoming traffic or pedestrian routes etc)",
    "photo": "no",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_02",
    "qnum": "02",
    "headername": "Site Vehicles",
    "qtext": "Vehicle cabins kept clean and tidy? (No clutter on the dashboard, litter etc)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_03",
    "qnum": "03",
    "headername": "Site Vehicles",
    "qtext": "Vehicles bodywork kept clean and tidy? (Regularly washed)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "Site Vehicles_04",
    "qnum": "04",
    "headername": "Site Vehicles",
    "qtext": "All vehicle drivers conduct pre-use check prior to operation and records filled in daily?((Vehicle Inspection Form (vehicles below 7.5 tonne) / Drivers Defect Report (vehicles above 7.5 tonne) filled in daily?)",
    "photo": "yes",
    "type": "vehicles",
    "hascar": "No"
  },
  {
    "id": "TM/ Branding_01",
    "qnum": "01",
    "headername": "TM/ Branding",
    "qtext": "Appropriate Traffic Management in place? (As per Chapter 8 requirements Red Book)",
    "photo": "yes",
    "type": "branding",
    "hascar": "No"
  }
];

export const FULL_BODY_HARNESS_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "Full Body Harness_01",
    "qnum": "01",
    "headername": "Full Body Harness",
    "qtext": "Does the legible tag identify the harness, model, date of manufacture, name of manufacturer, limitations and warnings",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_02",
    "qnum": "02",
    "headername": "Full Body Harness",
    "qtext": "6 monthly Inspection Sticker/tag available",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_03",
    "qnum": "03",
    "headername": "Full Body Harness",
    "qtext": "Nylon webbing is free of cuts, burn marks, and chemical damage",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_04",
    "qnum": "04",
    "headername": "Full Body Harness",
    "qtext": "Webbing is free of tears, broken fibers, frayed edges, and pulled stitches",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_05",
    "qnum": "05",
    "headername": "Full Body Harness",
    "qtext": "Harness webbing has no additional holes",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_06",
    "qnum": "06",
    "headername": "Full Body Harness",
    "qtext": "D-rings are free of excessive wear, pits, deterioration, cracks, and sharp edges",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_07",
    "qnum": "07",
    "headername": "Full Body Harness",
    "qtext": "D-rings pivot freely",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_08",
    "qnum": "08",
    "headername": "Full Body Harness",
    "qtext": "Buckles are not deformed or cracked, and will operate correctly",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_09",
    "qnum": "09",
    "headername": "Full Body Harness",
    "qtext": "All grommets are secure and not deformed",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_10",
    "qnum": "10",
    "headername": "Full Body Harness",
    "qtext": "All rivets are tight and not deformed",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_11",
    "qnum": "11",
    "headername": "Full Body Harness",
    "qtext": "Tongue/straps show no excessive wear from repeated buckling",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_12",
    "qnum": "12",
    "headername": "Full Body Harness",
    "qtext": "Snaphooks have no hook and eye distortions",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_13",
    "qnum": "13",
    "headername": "Full Body Harness",
    "qtext": "Snaphooks have no cracks and pitted surfaces",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Full Body Harness_14",
    "qnum": "14",
    "headername": "Full Body Harness",
    "qtext": "Locking mechanism was tested to verify that keeper latches lock properly",
    "photo": "yes",
    "type": "Full Body Harness",
    "hascar": "No"
  },
  {
    "id": "Lanyard_15",
    "qnum": "15",
    "headername": "Lanyard",
    "qtext": "Labels are intact & legible",
    "photo": "yes",
    "type": "Lanyard",
    "hascar": "No"
  },
  {
    "id": "Lanyard_16",
    "qnum": "16",
    "headername": "Lanyard",
    "qtext": "Nylon webbing is free of cuts, abrasions, burn marks, and chemical damage",
    "photo": "yes",
    "type": "Lanyard",
    "hascar": "No"
  },
  {
    "id": "Lanyard_17",
    "qnum": "17",
    "headername": "Lanyard",
    "qtext": "Webbing is free of tears, broken fibers, frayed edges, and pulled stitches",
    "photo": "yes",
    "type": "Lanyard",
    "hascar": "No"
  },
  {
    "id": "Lanyard_18",
    "qnum": "18",
    "headername": "Lanyard",
    "qtext": "Shock absorber pack is free of burn holes and tears",
    "photo": "yes",
    "type": "Lanyard",
    "hascar": "No"
  },
  {
    "id": "Lanyard_19",
    "qnum": "19",
    "headername": "Lanyard",
    "qtext": "Shock absorber pack stitching is free of loose strands, rips, and deterioration",
    "photo": "yes",
    "type": "Lanyard",
    "hascar": "No"
  },
  {
    "id": "Lanyard_20",
    "qnum": "20",
    "headername": "Lanyard",
    "qtext": "Hook gate/rivets are intact",
    "photo": "yes",
    "type": "Lanyard",
    "hascar": "No"
  },
  {
    "id": "Lanyard_21",
    "qnum": "21",
    "headername": "Lanyard",
    "qtext": "Connectors are in good condition free from corrosion or damage",
    "photo": "yes",
    "type": "Lanyard",
    "hascar": "No"
  }
];

export const LADDER_STEPLADDER_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "Ladder/Stepladder_01",
    "qnum": "01",
    "headername": "Ladder/Stepladder",
    "qtext": "Has the ladder been modified, for example painted or shortened etc?",
    "photo": "yes",
    "type": "Ladder/Stepladder",
    "hascar": "No"
  },
  {
    "id": "Ladder/Stepladder_02",
    "qnum": "02",
    "headername": "Ladder/Stepladder",
    "qtext": "Are the stiles (uprights) free of damage or excessive wear (particularly at the head or foot of the ladder)?",
    "photo": "yes",
    "type": "Ladder/Stepladder",
    "hascar": "No"
  },
  {
    "id": "Ladder/Stepladder_03",
    "qnum": "03",
    "headername": "Ladder/Stepladder",
    "qtext": "Are the rungs (steps) clean and free of damage and excess wear?",
    "photo": "yes",
    "type": "Ladder/Stepladder",
    "hascar": "No"
  },
  {
    "id": "Ladder/Stepladder_04",
    "qnum": "04",
    "headername": "Ladder/Stepladder",
    "qtext": "Are all rungs (steps) and fittings in place (such as slip resistant feet on metal ladders etc)?",
    "photo": "yes",
    "type": "Ladder/Stepladder",
    "hascar": "No"
  },
  {
    "id": "Ladder/Stepladder_05",
    "qnum": "05",
    "headername": "Ladder/Stepladder",
    "qtext": "Are all rungs and stiles tightly fitted?",
    "photo": "yes",
    "type": "Ladder/Stepladder",
    "hascar": "No"
  },
  {
    "id": "Ladder/Stepladder_06",
    "qnum": "06",
    "headername": "Ladder/Stepladder",
    "qtext": "Are all tie rods in place and secure?",
    "photo": "yes",
    "type": "Ladder/Stepladder",
    "hascar": "No"
  },
  {
    "id": "Ladder/Stepladder_07",
    "qnum": "07",
    "headername": "Ladder/Stepladder",
    "qtext": "Is the ladder free from distortion or warping that could affect its stability?",
    "photo": "yes",
    "type": "Ladder/Stepladder",
    "hascar": "No"
  },
  {
    "id": "Ladder/Stepladder_08",
    "qnum": "08",
    "headername": "Ladder/Stepladder",
    "qtext": "Is the ladder free from damage such as cracks, corrosion or dents?",
    "photo": "yes",
    "type": "Ladder/Stepladder",
    "hascar": "No"
  },
  {
    "id": "Ladder/Stepladder_09",
    "qnum": "09",
    "headername": "Ladder/Stepladder",
    "qtext": "Are all fittings, such as rope pulleys or hinges, free from wear or damage?",
    "photo": "yes",
    "type": "Ladder/Stepladder",
    "hascar": "No"
  }
];

export const DEPOT_CHECK_SHEET_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "1.0 Health & Safety_1.1",
    "qnum": "1.1",
    "headername": "1.0 Health & Safety",
    "qtext": "Are fire extinguishers in date, tagged, and easily accessible? (Check a few during your walk-around of the depot)",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.2",
    "qnum": "1.2",
    "headername": "1.0 Health & Safety",
    "qtext": "Are first aid kits complete, tagged, and in date? (Check a few during your walk-around of the depot)",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.3",
    "qnum": "1.3",
    "headername": "1.0 Health & Safety",
    "qtext": "Is security fencing in good condition?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.4",
    "qnum": "1.4",
    "headername": "1.0 Health & Safety",
    "qtext": "Are all safety and warning signs visible and clear?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.5",
    "qnum": "1.5",
    "headername": "1.0 Health & Safety",
    "qtext": "Are walkways and traffic routes clearly marked and free from obstructions or trip hazards?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.6",
    "qnum": "1.6",
    "headername": "1.0 Health & Safety",
    "qtext": "Are all entrances and exits clear and accessible?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.7",
    "qnum": "1.7",
    "headername": "1.0 Health & Safety",
    "qtext": "Is lighting adequate and fully working in all areas?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.8",
    "qnum": "1.8",
    "headername": "1.0 Health & Safety",
    "qtext": "Are all areas clean and tidy?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.9",
    "qnum": "1.9",
    "headername": "1.0 Health & Safety",
    "qtext": "Are all stored items secure? (Don't stack higher than 3 pallets or 2 meters. Ensure unstable items are not stacked, and items on shelves are secured/strapped.)",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.10",
    "qnum": "1.10",
    "headername": "1.0 Health & Safety",
    "qtext": "Is a \"Yard Visitor Permit\" completed for all deliveries and services?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.11",
    "qnum": "1.11",
    "headername": "1.0 Health & Safety",
    "qtext": "Do you and your team have all 6 required PPE items? Is there enough stock of task-specific PPE (e.g., masks, gloves, hearing protection) in the PPE stores?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.12",
    "qnum": "1.12",
    "headername": "1.0 Health & Safety",
    "qtext": "Is there enough PPE (Clints list!) in stock in the PPE stores? ",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.13",
    "qnum": "1.13",
    "headername": "1.0 Health & Safety",
    "qtext": "Are ladders inspected, in good condition, and within their inspection date?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "1.0 Health & Safety_1.14",
    "qnum": "1.14",
    "headername": "1.0 Health & Safety",
    "qtext": "Are lifting equipment tags the correct colour? Please state colour.",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "2.0 Environment_2.1",
    "qnum": "2.1",
    "headername": "2.0 Environment",
    "qtext": "Have all outside taps been flushed for 5 minutes?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "2.0 Environment_2.2",
    "qnum": "2.2",
    "headername": "2.0 Environment",
    "qtext": "Are there any signs of pest infestation (e.g., rodents, insects)?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "2.0 Environment_2.3",
    "qnum": "2.3",
    "headername": "2.0 Environment",
    "qtext": "Is the designated vehicle washing area clear and appropriately set up? (Mark N/A if not applicable.)",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "2.0 Environment_2.4",
    "qnum": "2.4",
    "headername": "2.0 Environment",
    "qtext": "Are spill kits available and appropriate for potential spills? Is the yellow waste bin for spills tagged?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "2.0 Environment_2.5",
    "qnum": "2.5",
    "headername": "2.0 Environment",
    "qtext": "Have there been any environmental incidents like spills? (Report all incidents on QUEST!)",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "2.0 Environment_2.6",
    "qnum": "2.6",
    "headername": "2.0 Environment",
    "qtext": "Are there any visible signs of current spills",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "3.0 Waste and Material Storage_3.1",
    "qnum": "3.1",
    "headername": "3.0 Waste and Material Storage",
    "qtext": "Are skips and storage containers in their correct, designated locations, clearly labelled, and holding the right type of waste?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "3.0 Waste and Material Storage_3.2",
    "qnum": "3.2",
    "headername": "3.0 Waste and Material Storage",
    "qtext": "Are skips, containers, and waste bays in good condition and not overloaded?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "3.0 Waste and Material Storage_3.3",
    "qnum": "3.3",
    "headername": "3.0 Waste and Material Storage",
    "qtext": "Is the area around waste storage free from debris?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "3.0 Waste and Material Storage_3.4",
    "qnum": "3.4",
    "headername": "3.0 Waste and Material Storage",
    "qtext": "Is the hazardous waste area adequately segregated and clearly signed?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "4.0 Fuel, Gas Cylinders and Chemical Storage_4.1",
    "qnum": "4.1",
    "headername": "4.0 Fuel, Gas Cylinders and Chemical Storage",
    "qtext": "Are fuels, gas cylinders, and chemicals stored in designated, clearly signed areas? (Ensure \"No Smoking,\" \"Flammable,\" and \"Highly Flammable\" signs are visible.)",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "4.0 Fuel, Gas Cylinders and Chemical Storage_4.2",
    "qnum": "4.2",
    "headername": "4.0 Fuel, Gas Cylinders and Chemical Storage",
    "qtext": "Are full diesel/petrol cans locked in a fireproof, leak proof container and clearly signed? (no smoking and highly flammable and content)",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "4.0 Fuel, Gas Cylinders and Chemical Storage_4.3",
    "qnum": "4.3",
    "headername": "4.0 Fuel, Gas Cylinders and Chemical Storage",
    "qtext": "Are all chemicals stored on appropriate spill or drip trays?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "4.0 Fuel, Gas Cylinders and Chemical Storage_4.4",
    "qnum": "4.4",
    "headername": "4.0 Fuel, Gas Cylinders and Chemical Storage",
    "qtext": "Are canisters stored correctly in designated locked cages and are clearly signed? (no smoking, empty and full cylinders)",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "4.0 Fuel, Gas Cylinders and Chemical Storage_4.5",
    "qnum": "4.5",
    "headername": "4.0 Fuel, Gas Cylinders and Chemical Storage",
    "qtext": "Are empty and full cylinders segregated with signs in place and stored within Gas Cages? Gas cage locked? e.g. flammable, full, empty, no smoking)",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "5.0 Welfare_5.1",
    "qnum": "5.1",
    "headername": "5.0 Welfare",
    "qtext": "All portable equipment (Microwave, Kettle etc) PAT tested?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "5.0 Welfare_5.2",
    "qnum": "5.2",
    "headername": "5.0 Welfare",
    "qtext": "Is there clean and adequate welfare facilities? Sun cream/barrier cream/handwash/toilet paper",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "5.0 Welfare_5.3",
    "qnum": "5.3",
    "headername": "5.0 Welfare",
    "qtext": "First Aid kits tagged and in date?",
    "typeofans": [
      "select"
    ],
    "select": [
      "Yes",
      "No",
      "N/A"
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  }
];

export const MANAGERS_BASE_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "Welfare_1",
    "qnum": "1",
    "headername": "Welfare",
    "qtext": "Do workers have access to drinking water (Company provided)",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Water supply in welfare unit (static/ welfare)",
        "ncr": "No"
      },
      {
        "txt": "Company provided bottled water",
        "ncr": "No"
      },
      {
        "txt": "Workers provide themselves",
        "ncr": "No"
      },
      {
        "txt": "Drinking water not readily available",
        "ncr": "Major"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Welfare_2",
    "qnum": "2",
    "headername": "Welfare",
    "qtext": "Do workers have access to water, soap & towels (or wipes reactive works)",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Water, soap, towels and barrier cream in welfare",
        "ncr": "No"
      },
      {
        "txt": "Water, wipes, barrier cream in van",
        "ncr": "No"
      },
      {
        "txt": "Inadequate cleaning/ hand washing avaialble",
        "ncr": "Major"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Welfare_3",
    "qnum": "3",
    "headername": "Welfare",
    "qtext": "Do workers have easy access to flushing toilets (less than 5 minutes walk)",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Available on site/ in welfare",
        "ncr": "No"
      },
      {
        "txt": "Return to depot",
        "ncr": "No"
      },
      {
        "txt": "Using public facilities",
        "ncr": "No"
      },
      {
        "txt": "No access to suitable toilets",
        "ncr": "Major"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Welfare_4",
    "qnum": "4",
    "headername": "Welfare",
    "qtext": "Has welfare been position to avoid it being a hazard to others - blocking visibility  at junctions etc",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "No"
      },
      {
        "txt": "No",
        "ncr": "No"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Communications_1",
    "qnum": "1",
    "headername": "Communications",
    "qtext": "Have the items from the top three risks been effectively communicated via SSRA/ daily actvity briefing?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "No"
      },
      {
        "txt": "No",
        "ncr": "No"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Communications_2",
    "qnum": "2",
    "headername": "Communications",
    "qtext": "Can work force describe key risks & controls for the work they are doing",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "No"
      },
      {
        "txt": "No",
        "ncr": "No"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Communications_3",
    "qnum": "3",
    "headername": "Communications",
    "qtext": "Can workforce demonstrate they have been engaged with SSRA and /or daily briefing today",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "No"
      },
      {
        "txt": "No",
        "ncr": "No"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Communications_4",
    "qnum": "4",
    "headername": "Communications",
    "qtext": "Can workforce demonstrate they have been briefed and signed onto RAMS for works",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "No"
      },
      {
        "txt": "No",
        "ncr": "No"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Communications_5",
    "qnum": "5",
    "headername": "Communications",
    "qtext": "Do workforce offer any concerns over method of works",
    "typeofans": [
      "textarea"
    ],
    "hascar": "No",
    "mandatecond": [
      "comment"
    ]
  },
  {
    "id": "Overview of site_1",
    "qnum": "1",
    "headername": "Overview of site",
    "qtext": "Scale 1-10 your opion of overall safety of site",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Significant issues",
        "ncr": "No"
      },
      {
        "txt": "Minor weaknesses",
        "ncr": "No"
      },
      {
        "txt": "Compliant in all matters",
        "ncr": "No"
      },
      {
        "txt": "Good",
        "ncr": "No"
      },
      {
        "txt": "Excellent",
        "ncr": "No"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Overview of site_2",
    "qnum": "2",
    "headername": "Overview of site",
    "qtext": "Have you identified any actions that must be completed before you allow works to continue",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "No"
      },
      {
        "txt": "No",
        "ncr": "No"
      },
      {
        "txt": "N/A",
        "ncr": "No"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Overview of site_3",
    "qnum": "3",
    "headername": "Overview of site",
    "qtext": "Declaration: Other than those items have noted in this report, I have not observed any practices which require correction",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "No"
      },
      {
        "txt": "No",
        "ncr": "No"
      },
      {
        "txt": "N/A",
        "ncr": "No"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  }
];

export const MANAGERS_RISK_BANKS: Record<string, SiteInspectionQuestion[]> = {
  "Buried services": [
    {
      "id": "Buried services_1",
      "qnum": 1,
      "headername": "Buried services",
      "qtext": "Do gang have access to correct and in date stats drawings / files?",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Have access to drawings, expiry date after start of works",
          "ncr": "No"
        },
        {
          "txt": "Have access to drawings, expiry date before start of works",
          "ncr": "Minor"
        },
        {
          "txt": "Don’t have access to drawings",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Buried services_2",
      "qnum": 2,
      "headername": "Buried services",
      "qtext": "Is a fully completed permit to dig in place & available at site?",
      "typeofans": [
        "select",
        "imageURL"
      ],
      "select": [
        {
          "txt": "Permit complete - in date, correct services identified, authorised by second person (supervisor)",
          "ncr": "No"
        },
        {
          "txt": "Permit incomplete - 1 of date, services identified, authorsied by 2nd person incomplete",
          "ncr": "Minor"
        },
        {
          "txt": "Permit not suitable - permit not accessible or more than 1 ommsion (date, services,authorisation)",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans",
        "imageURL"
      ]
    },
    {
      "id": "Buried services_3",
      "qnum": 3,
      "headername": "Buried services",
      "qtext": "Is a CAT and Genny being used regularly by gang as excavations proceeds?",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Used at start of day/exacvation task & as excavation proceeds",
          "ncr": "No"
        },
        {
          "txt": "Used at start of day/excavation",
          "ncr": "No"
        },
        {
          "txt": "Not used at start of day/excavation task",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Buried services_4",
      "qnum": 4,
      "headername": "Buried services",
      "qtext": "Can foreman explain where services are and how they will be managed as excavation proceeds?",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Foreman identifies mains , property connection locations and safe digging practice",
          "ncr": "No"
        },
        {
          "txt": "Foreman identifies mains locations and safe digging practice, but not property connections",
          "ncr": "Minor"
        },
        {
          "txt": "Foreman fails to explain service locations and safe digging practice appropriately",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Buried services_5",
      "qnum": 5,
      "headername": "Buried services",
      "qtext": "How are trial holes recorded",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Recorded on trial hole permit",
          "ncr": "No"
        },
        {
          "txt": "Photograpghs taken",
          "ncr": "AFI"
        },
        {
          "txt": "Described in note book",
          "ncr": "AFI"
        },
        {
          "txt": "Not recorded",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    }
  ],
  "Interface with the public": [
    {
      "id": "Interface with the public_1",
      "qnum": 1,
      "headername": "Interface with the public",
      "qtext": "How are members of the public kept out of work area",
      "typeofans": [
        "select",
        "imageURL"
      ],
      "select": [
        {
          "txt": "Heras fencing/ metal pedestrian barrier",
          "ncr": "No"
        },
        {
          "txt": "Cone toppers & tape",
          "ncr": "No"
        },
        {
          "txt": "Red/white plastic barriers",
          "ncr": "No"
        },
        {
          "txt": "TM scheme",
          "ncr": "No"
        },
        {
          "txt": "No barriers to keep pedestrians out",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans",
        "imageURL"
      ]
    },
    {
      "id": "Interface with the public_2",
      "qnum": 2,
      "headername": "Interface with the public",
      "qtext": "Are areas around works (storage, welfare etc) managed to prevent being a hazard to public",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Interface with the public_3",
      "qnum": 3,
      "headername": "Interface with the public",
      "qtext": "Does site set a good example of MHL professional delivery of works",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Interface with the public_4",
      "qnum": 4,
      "headername": "Interface with the public",
      "qtext": "Does foreman have communication cards to help public contact company if required",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    }
  ],
  "Manual handling": [
    {
      "id": "Manual handling_1",
      "qnum": 1,
      "headername": "Manual handling",
      "qtext": "What items are being manually handled",
      "typeofans": [
        "multiselect"
      ],
      "multiselect": [
        {
          "txt": "Paving slabs/ flags",
          "id": 1,
          "ncr": "No"
        },
        {
          "txt": "Kerbs",
          "id": 2,
          "ncr": "No"
        },
        {
          "txt": "Pavious, blocks,granite sets",
          "id": 3,
          "ncr": "No"
        },
        {
          "txt": "Bagged materials ",
          "id": 4,
          "ncr": "No"
        },
        {
          "txt": "Drainage goods",
          "id": 5,
          "ncr": "No"
        },
        {
          "txt": "TM equipment",
          "id": 6,
          "ncr": "No"
        },
        {
          "txt": "Street Lighting equipment",
          "id": 7,
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "multiselectans"
      ]
    },
    {
      "id": "Manual handling_2",
      "qnum": 2,
      "headername": "Manual handling",
      "qtext": "Are mechanical aids, plant & tools being used to reduce manual handling",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Excavation for lifting",
          "ncr": "No"
        },
        {
          "txt": "Suction lifters/ hand lifters",
          "ncr": "No"
        },
        {
          "txt": "Block/ kerblifters",
          "ncr": "No"
        },
        {
          "txt": "Others",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Manual handling_3",
      "qnum": 3,
      "headername": "Manual handling",
      "qtext": "Are materials stocked/ available in locations that minimise need for manual handling ",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "At place of use",
          "ncr": "No"
        },
        {
          "txt": "Within 5m of place of use",
          "ncr": "No"
        },
        {
          "txt": "5- 10m of place of use",
          "ncr": "No"
        },
        {
          "txt": ">10m from place of use",
          "ncr": "Minor"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Manual handling_4",
      "qnum": 4,
      "headername": "Manual handling",
      "qtext": "Are works observing good manual handling practice (photo)",
      "typeofans": [
        "select",
        "imageURL"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans",
        "imageURL"
      ]
    }
  ],
  "Noise dust & vibration": [
    {
      "id": "Noise dust & vibration_1",
      "qnum": 1,
      "headername": "Noise dust & vibration",
      "qtext": "Are workers wearing task appropriate PPE - hearing protection, FFP3 masks, goggles",
      "typeofans": [
        "select",
        "imageURL"
      ],
      "select": [
        {
          "txt": "Yes - all of hearing protection, FFP3 masks & goggles worn during noisy & dust producing activities",
          "ncr": "No"
        },
        {
          "txt": "No -  one  of hearing protection, FFP3 mask or goggled not in use",
          "ncr": "Ncr"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans",
        "imageURL"
      ]
    },
    {
      "id": "Noise dust & vibration_2",
      "qnum": 2,
      "headername": "Noise dust & vibration",
      "qtext": "If tasks not being performed, is PPE readily available in easy reach",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "At place of use",
          "ncr": "No"
        },
        {
          "txt": "Within 5m of place of use",
          "ncr": "No"
        },
        {
          "txt": "5-10m of place of use",
          "ncr": "No"
        },
        {
          "txt": ">10m from place of use",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Noise dust & vibration_3",
      "qnum": 3,
      "headername": "Noise dust & vibration",
      "qtext": "Are workers who wear face masks clean shaven",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Workers likely to use FFP3 masks clean shaven",
          "ncr": "No"
        },
        {
          "txt": "Workers likely to use FFP3 mask have stubble",
          "ncr": "AFI"
        },
        {
          "txt": "Workers likely to use FFP3 masks have facial hair likely to affect mask effectiveness",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Noise dust & vibration_4",
      "qnum": 4,
      "headername": "Noise dust & vibration",
      "qtext": "Is there evidence of adequate water suppression/dust extraction in use",
      "typeofans": [
        "multiselect"
      ],
      "multiselect": [
        {
          "txt": "On tool dust extraction in use ",
          "id": 1,
          "ncr": "No"
        },
        {
          "txt": "Water suppression- constant water feed in use",
          "id": 2,
          "ncr": "No"
        },
        {
          "txt": "Water suppression - spray bottle in use",
          "id": 3,
          "ncr": "No"
        },
        {
          "txt": "Not adequately controlled- dust visible when cutting/ breaking",
          "id": 4,
          "ncr": "No"
        },
        {
          "txt": "N/A no cutting/ breaking observed at time of visit. Workers reminded of need for dust control when cutting",
          "id": 5,
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "multiselectans"
      ]
    },
    {
      "id": "Noise dust & vibration_5",
      "qnum": 5,
      "headername": "Noise dust & vibration",
      "qtext": "How is HAVs exposure being monitored",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Havi watches in use",
          "ncr": "No"
        },
        {
          "txt": "HAVS App on Quest - used today",
          "ncr": "No"
        },
        {
          "txt": "HAVS App on Quest - used last 2 days",
          "ncr": "No"
        },
        {
          "txt": "Paper records",
          "ncr": "AFI"
        },
        {
          "txt": "Not being monitored",
          "ncr": "Major"
        },
        {
          "txt": "N/A",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    }
  ],
  "Operating plant & machinery": [
    {
      "id": "Operating plant & machinery_1",
      "qnum": 1,
      "headername": "Operating plant & machinery",
      "qtext": "Is plant/ machinery operated by persons competent to do so",
      "typeofans": [
        "multiselect",
        "imageURL"
      ],
      "multiselect": [
        {
          "txt": "Large operated plant (excavators, planer, paver, hiab, mewps etc) - NPORS/CPCS cards evidenced for operators",
          "id": 1,
          "ncr": "No"
        },
        {
          "txt": "Small operated plant (ride on rollers etc) - NPORS/CPCS cards evidenced for operators",
          "id": 2,
          "ncr": "No"
        },
        {
          "txt": "Operators not able to show card, not accessible on Quest",
          "id": 3,
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "multiselectans",
        "imageURL"
      ]
    },
    {
      "id": "Operating plant & machinery_2",
      "qnum": 2,
      "headername": "Operating plant & machinery",
      "qtext": "Has plant been inspected (& inspection recorded) in last 24 hours - sample 2 plant items",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Operating plant & machinery_3",
      "qnum": 3,
      "headername": "Operating plant & machinery",
      "qtext": "Is lifting equipment, tagged, in date & undamaged",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        },
        {
          "txt": "NA",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Operating plant & machinery_4",
      "qnum": 4,
      "headername": "Operating plant & machinery",
      "qtext": "Has Grab (if working/ has been working on site) been signed on to SSRA",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        },
        {
          "txt": "NA",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    }
  ],
  "Overhead services": [
    {
      "id": "Overhead services_1",
      "qnum": 1,
      "headername": "Overhead services",
      "qtext": "From discussion are workforce aware of O/H services type, location",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        },
        {
          "txt": "NA",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Overhead services_2",
      "qnum": 2,
      "headername": "Overhead services",
      "qtext": "Are O/H services marked (blue cones, goal posts etc)",
      "typeofans": [
        "select",
        "imageURL"
      ],
      "select": [
        {
          "txt": "Blue cones in advance of OH services - both kerbs one side of cable",
          "ncr": "Minor"
        },
        {
          "txt": "Blue cones in advance of OH services - both kerbs both sides of cable",
          "ncr": "No"
        },
        {
          "txt": "Goal posts in advance of OH services - one side of cable",
          "ncr": "Minor"
        },
        {
          "txt": "Goal posts in advance of OH services - both side of cable",
          "ncr": "No"
        },
        {
          "txt": "Signage in advance of OH services - both kerbs one side of cable",
          "ncr": "Minor"
        },
        {
          "txt": "Signage in advance of OH services - both kerbs both side of cable",
          "ncr": "Minor"
        },
        {
          "txt": "No marking",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans",
        "imageURL"
      ]
    },
    {
      "id": "Overhead services_3",
      "qnum": 3,
      "headername": "Overhead services",
      "qtext": "How are plant movements (Hiab, excavators & lorries particularly) managed beneath overheads",
      "typeofans": [
        "multiselect"
      ],
      "multiselect": [
        {
          "txt": "Included in SSRA",
          "id": 1,
          "ncr": "Missing-Major"
        },
        {
          "txt": "Banksman monitoring movement under/ near O/H",
          "id": 2,
          "ncr": "No"
        },
        {
          "txt": "Lorry bodies lowered when passing beneath",
          "id": 3,
          "ncr": "No"
        },
        {
          "txt": "No Hiab lifting beneath O/H",
          "id": 4,
          "ncr": "No"
        },
        {
          "txt": "Excavator controlled by banksman when near/ beneath O/H",
          "id": 5,
          "ncr": "No"
        },
        {
          "txt": "No suitable controls in place",
          "id": 6,
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "multiselectans"
      ]
    }
  ],
  "Temporary works": [
    {
      "id": "Temporary works_1",
      "qnum": 1,
      "headername": "Temporary works",
      "qtext": "Who is appointed temporary works co-ordinator (confirm name)",
      "typeofans": [
        "modal"
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Temporary works_2",
      "qnum": 2,
      "headername": "Temporary works",
      "qtext": "Are a design, specification, working details for the temporary works being installed available at site?",
      "typeofans": [
        "multiselect"
      ],
      "multiselect": [
        {
          "txt": "Temp works design drawings",
          "id": 1,
          "ncr": "No"
        },
        {
          "txt": "Temp works specification",
          "id": 2,
          "ncr": "No"
        },
        {
          "txt": "Manufacturers guidance/ installation details",
          "id": 3,
          "ncr": "No"
        },
        {
          "txt": "No details available",
          "id": 4,
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "multiselectans"
      ]
    },
    {
      "id": "Temporary works_3",
      "qnum": 3,
      "headername": "Temporary works",
      "qtext": "Are the works in accordance with design detail, specification etc?",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    }
  ],
  "Worker/construction plant interface": [
    {
      "id": "Worker/construction plant interface_1",
      "qnum": 1,
      "headername": "Worker/construction plant interface",
      "qtext": "Are the risks of workers (on foot) coming into contact with operated plant well controlled",
      "typeofans": [
        "select",
        "imageURL"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans",
        "imageURL"
      ]
    },
    {
      "id": "Worker/construction plant interface_2",
      "qnum": 2,
      "headername": "Worker/construction plant interface",
      "qtext": "What controls are in place to mitigate worker/plant risk ",
      "typeofans": [
        "multiselect",
        "imageURL"
      ],
      "multiselect": [
        {
          "txt": "SSRA/ briefing highlights controls",
          "id": 1,
          "ncr": "Missing-Major"
        },
        {
          "txt": "Vehicle banksman with reversing plant/ vehicles",
          "id": 2,
          "ncr": "No"
        },
        {
          "txt": "Vehicle/ pedestrian spotters in use",
          "id": 3,
          "ncr": "No"
        },
        {
          "txt": "Zonal working applied to manage vehicle/ pedestrian interfaces",
          "id": 4,
          "ncr": "No"
        },
        {
          "txt": "Vehicles equipment with reversing sounder/ alarm",
          "id": 5,
          "ncr": "No"
        },
        {
          "txt": "Vehicles equipped with reversing camera",
          "id": 6,
          "ncr": "No"
        },
        {
          "txt": "Controls not sufficient",
          "id": 7,
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "multiselectans",
        "imageURL"
      ]
    },
    {
      "id": "Worker/construction plant interface_3",
      "qnum": 3,
      "headername": "Worker/construction plant interface",
      "qtext": "From discussion with workers, do they perceive adequate controls are in place to manage plant interface",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        },
        {
          "txt": "Improvements suggested",
          "ncr": "AFI"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Worker/construction plant interface_4",
      "qnum": 4,
      "headername": "Worker/construction plant interface",
      "qtext": "Is grab working on/ visiting site - How is SSRA addressed",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "N/A grab not required on site",
          "ncr": "No"
        },
        {
          "txt": "Grab signed onto site SSRA",
          "ncr": "No"
        },
        {
          "txt": "Grab not signed onto any SSRA",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    }
  ],
  "Working at height": [
    {
      "id": "Working at height_1",
      "qnum": 1,
      "headername": "Working at height",
      "qtext": "What are working at height risks here",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Falls below ground (into excavations/ chambers etc)",
          "ncr": "No"
        },
        {
          "txt": "Working from MEWPS",
          "ncr": "No"
        },
        {
          "txt": "Working from scaffold/ mobile tower",
          "ncr": "No"
        },
        {
          "txt": "Working from vehicle bed",
          "ncr": "No"
        },
        {
          "txt": "Falling tools, equipment, materials",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Working at height_2",
      "qnum": 2,
      "headername": "Working at height",
      "qtext": "Are these risks adequately controlled",
      "typeofans": [
        "multiselect",
        "imageURL"
      ],
      "multiselect": [
        {
          "txt": "Excavations barriered",
          "id": 1,
          "ncr": "Missing-Major"
        },
        {
          "txt": "harnessed operator",
          "id": 2,
          "ncr": "No"
        },
        {
          "txt": "Competent operator",
          "id": 3,
          "ncr": "No"
        },
        {
          "txt": "Erection by competent person",
          "id": 4,
          "ncr": "No"
        },
        {
          "txt": "Handover certificate & weekly inspections ",
          "id": 5,
          "ncr": "No"
        },
        {
          "txt": "Edge barrier to prevent falls from vehicle",
          "id": 6,
          "ncr": "No"
        },
        {
          "txt": "Tool tethers",
          "id": 7,
          "ncr": "No"
        },
        {
          "txt": "Exclusion zone",
          "id": 8,
          "ncr": "No"
        },
        {
          "txt": "Not adequately controlled ",
          "id": 9,
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "multiselectans",
        "imageURL"
      ]
    },
    {
      "id": "Working at height_3",
      "qnum": 3,
      "headername": "Working at height",
      "qtext": "From discussion can workers explain how these risks are being controlled",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    }
  ],
  "Work in/beside live traffic": [
    {
      "id": "Work in/beside live traffic_1",
      "qnum": 1,
      "headername": "Work in/beside live traffic",
      "qtext": "Is work area within defined TM scheme (signed, cones, barriers)",
      "typeofans": [
        "select",
        "imageURL"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        },
        {
          "txt": "N/A",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans",
        "imageURL"
      ]
    },
    {
      "id": "Work in/beside live traffic_2",
      "qnum": 2,
      "headername": "Work in/beside live traffic",
      "qtext": "Does closure provide safety zone between traffic & work area (appropriate to road speed)",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Work in/beside live traffic_3",
      "qnum": 3,
      "headername": "Work in/beside live traffic",
      "qtext": "TM installed as Layouts plans developed by TM",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Drawing available on site followed",
          "ncr": "No"
        },
        {
          "txt": "Drawings available on site not followed",
          "ncr": "Minor"
        },
        {
          "txt": "Routine chapter 8 installed correctly by working gang",
          "ncr": "No"
        },
        {
          "txt": "Routine chapter 8 not installed correctly by working gang",
          "ncr": "Minor"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Work in/beside live traffic_4",
      "qnum": 4,
      "headername": "Work in/beside live traffic",
      "qtext": "How cyclists, Peds & special needs fully catered for within TM Schedules",
      "typeofans": [
        "textarea"
      ],
      "hascar": "No",
      "mandatecond": [
        "comment"
      ]
    }
  ],
  "Working with/on live electrical circuits": [
    {
      "id": "Working with/on live electrical circuits_1",
      "qnum": 1,
      "headername": "Working with/on live electrical circuits",
      "qtext": "Is there a permit in place for work on live electrical circuits",
      "typeofans": [
        "select",
        "imageURL"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans",
        "imageURL"
      ]
    },
    {
      "id": "Working with/on live electrical circuits_2",
      "qnum": 2,
      "headername": "Working with/on live electrical circuits",
      "qtext": "Is a specific method statement (or risk assessment) available at site to set out safe controls for live working",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Working with/on live electrical circuits_3",
      "qnum": 3,
      "headername": "Working with/on live electrical circuits",
      "qtext": "Who is the competent person, what competence do they have",
      "typeofans": [
        "modal"
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Working with/on live electrical circuits_4",
      "qnum": 4,
      "headername": "Working with/on live electrical circuits",
      "qtext": "Can person in charge demonstrate the key safety controls are in place",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    }
  ],
  "Working on/near water": [
    {
      "id": "Working on/near water_1",
      "qnum": 1,
      "headername": "Working on/near water",
      "qtext": "What is the nature of the body of water at workplace ",
      "typeofans": [
        "select",
        "imageURL"
      ],
      "select": [
        {
          "txt": "Pond/ lake",
          "ncr": "No"
        },
        {
          "txt": "Stream/ slow moving river",
          "ncr": "No"
        },
        {
          "txt": "Fast flowing river",
          "ncr": "No"
        },
        {
          "txt": "Canal",
          "ncr": "No"
        },
        {
          "txt": "Tidal water",
          "ncr": "No"
        },
        {
          "txt": "Others",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans",
        "imageURL"
      ]
    },
    {
      "id": "Working on/near water_2",
      "qnum": 2,
      "headername": "Working on/near water",
      "qtext": "Are appropriate controls in place",
      "typeofans": [
        "multiselect"
      ],
      "multiselect": [
        {
          "txt": "Addressed in SSRA/Method statement",
          "id": 1,
          "ncr": "No"
        },
        {
          "txt": "Edge barriers/ marking",
          "id": 2,
          "ncr": "No"
        },
        {
          "txt": "Restrictions on footwear (wellington boots)",
          "id": 3,
          "ncr": "No"
        },
        {
          "txt": "Personal floatation devices ",
          "id": 4,
          "ncr": "No"
        },
        {
          "txt": "Lifebelts/ rings",
          "id": 5,
          "ncr": "No"
        },
        {
          "txt": "Rescue boat",
          "id": 6,
          "ncr": "No"
        },
        {
          "txt": "Others",
          "id": 7,
          "ncr": "No"
        },
        {
          "txt": "Leptospirosis awareness/ control",
          "id": 8,
          "ncr": "No"
        },
        {
          "txt": "Not adequately controlled",
          "id": 9,
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "multiselectans"
      ]
    },
    {
      "id": "Working on/near water_3",
      "qnum": 3,
      "headername": "Working on/near water",
      "qtext": "Can workforce describe how risks of working on/ near water implemented",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "Major"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    }
  ],
  "Hot Works": [
    {
      "id": "Hot Works_1",
      "qnum": 1,
      "headername": "Hot Works",
      "qtext": "Do work activities involve use of naked flame, or likely to generate sparks",
      "typeofans": [
        "select"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans"
      ]
    },
    {
      "id": "Hot Works_2",
      "qnum": 2,
      "headername": "Hot Works",
      "qtext": "Has hot work permit been correctly completed & issued for the task?",
      "typeofans": [
        "select",
        "imageURL"
      ],
      "select": [
        {
          "txt": "Yes",
          "ncr": "No"
        },
        {
          "txt": "No",
          "ncr": "No"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "selectans",
        "imageURL"
      ]
    },
    {
      "id": "Hot Works_3",
      "qnum": 3,
      "headername": "Hot Works",
      "qtext": "Is work area suitable for Hot works?",
      "typeofans": [
        "multiselect"
      ],
      "multiselect": [
        {
          "txt": "Combustible materials removed ",
          "id": 1,
          "ncr": "No"
        },
        {
          "txt": "Flames/ sparks away from workers/ public",
          "id": 2,
          "ncr": "No"
        },
        {
          "txt": "Fire extinguisher to hand ",
          "id": 3,
          "ncr": "No"
        },
        {
          "txt": "Naked flame not left unattended",
          "id": 4,
          "ncr": "No"
        },
        {
          "txt": "Not Any",
          "id": 5,
          "ncr": "Minor"
        }
      ],
      "hascar": "No",
      "mandatecond": [
        "multiselectans"
      ]
    }
  ]
};

export const ROAD_MARKING_TEST_QUESTIONS: SiteInspectionQuestion[] = [
  {
    "id": "Road Marking (Test)_1",
    "qnum": 1,
    "headername": "Road Marking (Test)",
    "qtext": "Road Marking Method Statement available for the job?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "id": 1,
        "txt": "Method Statement available and signed by all staff",
        "ncr": "Compliant"
      },
      {
        "id": 2,
        "txt": "Method Statement available but missing gang signatures",
        "ncr": "Minor"
      },
      {
        "id": 3,
        "txt": "Workers provide themselves",
        "ncr": "Major"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Road Marking (Test)_2",
    "qnum": 2,
    "headername": "Road Marking (Test)",
    "qtext": "Site specific Risk Assessment conducted and recorded?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "id": 1,
        "txt": "Foreman completed the SSRA identifying significant risks, gang briefed, and signed into.",
        "ncr": "Compliant"
      },
      {
        "id": 2,
        "txt": "Foreman completed the SSRA identifying significant risks, gang not briefed or missing signatures.",
        "ncr": "Minor"
      },
      {
        "id": 3,
        "txt": "Incomplete SSRA with gangs signatures",
        "ncr": "Minor"
      },
      {
        "id": 4,
        "txt": "SSRA not completed for the job ( Stop Work)",
        "ncr": "Major"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Road Marking (Test)_3",
    "qnum": 3,
    "headername": "Road Marking (Test)",
    "qtext": "Identified first aider & Emergency equipment available at the site?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "id": 1,
        "txt": "First aider identified in the Method Statement and in-date and tagged emergency equipment available on site",
        "ncr": "Compliant"
      },
      {
        "id": 2,
        "txt": "Trained first aider not present on site or Training ticket Expired but refresher not booked",
        "ncr": "Minor"
      },
      {
        "id": 3,
        "txt": "Emergency Equipment not tagged or expired items found on site",
        "ncr": "Minor"
      },
      {
        "id": 4,
        "txt": "No trained first aider on site and emergency equipment unavailable ",
        "ncr": "Major"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Road Marking (Test)_4",
    "qnum": 4,
    "headername": "Road Marking (Test)",
    "qtext": "Competency of Staff undertaking the task?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "ID Cards checked, training tickets available as per the training need analysis matrix",
            "ncr": "Compliant"
          },
          {
            "id": 2,
            "txt": "New Starter working under experienced operative's supervision",
            "ncr": "Compliant"
          }
        ]
      },
      {
        "txt": "No",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "New Starter working unsupervised",
            "ncr": "Major",
            "comment1": "",
            "comments1": "yes"
          },
          {
            "id": 2,
            "txt": "Training Ticket Expired, refresher not booked",
            "ncr": "Minor",
            "comment1": "",
            "comments1": "yes"
          },
          {
            "id": 3,
            "txt": "Member of the staff undertaking task without adequate training",
            "ncr": "Major",
            "comment1": "",
            "comments1": "yes"
          }
        ]
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans",
      "multiselectsubans"
    ]
  },
  {
    "id": "Road Marking (Test)_5",
    "qnum": 5,
    "headername": "Road Marking (Test)",
    "qtext": "Is the vehicle parked safely on-site?",
    "typeofans": [
      "select",
      "imageURL"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Parked in designated bays with Amber Beacons switched on.",
            "ncr": "Compliant"
          },
          {
            "id": 2,
            "txt": "Parked safely off the road, not obstructing footways or cycle lanes. Amber Beacons switched on.",
            "ncr": "Compliant"
          },
          {
            "id": 3,
            "txt": "Parked Safely with cones around the vehicle (retractable cone barrier tape used in footways), Beacon lights switched on.",
            "ncr": "Compliant"
          }
        ]
      },
      {
        "txt": "No",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Vehicle not Parked within 10m of work area and left unattended",
            "ncr": "Minor"
          },
          {
            "id": 2,
            "txt": "Vehicle parked in such a way causing imminent danger to public",
            "ncr": "Major"
          }
        ]
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans",
      "imageURL",
      "selectsubans"
    ]
  },
  {
    "id": "Road Marking (Test)_6",
    "qnum": 6,
    "headername": "Road Marking (Test)",
    "qtext": "Vehicle reversing and difficult maneuvers controlled",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Vehicle Marshalling undertaken by the person identified in the SSRA",
            "ncr": "Compliant"
          },
          {
            "id": 2,
            "txt": "Clear Communication between the driver and the vehicle Marshall",
            "ncr": "Compliant"
          }
        ]
      },
      {
        "txt": "No",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Observed vehicle reversing/ difficult maneuvers without presence of vehicle marshal",
            "ncr": "Major"
          }
        ]
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans",
      "multiselectsubans"
    ]
  },
  {
    "id": "Road Marking (Test)_7",
    "qnum": 7,
    "headername": "Road Marking (Test)",
    "qtext": "Sufficient Traffic Management Arrangements on Site?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Sufficient and installed as per the SSRA",
            "ncr": "Compliant"
          }
        ]
      },
      {
        "txt": "No",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Insufficient, not installed as per the SSRA",
            "ncr": "Minor",
            "comments1": "Corrective Action done on site",
            "comments2": "Cant be rectified, Stop Work",
            "comment1": "",
            "comment2": ""
          },
          {
            "id": 2,
            "txt": "Insufficient, not identified in the SSRA, imminent Danger to the public and site crew",
            "ncr": "Major",
            "comments1": "Corrective Action done on site",
            "comments2": "Cant be rectified, Stop Work",
            "comment1": "",
            "comment2": ""
          }
        ]
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans",
      "selectsubans"
    ]
  },
  {
    "id": "Road Marking (Test)_8",
    "qnum": 8,
    "headername": "Road Marking (Test)",
    "qtext": "Pedestrian Management on Site Acceptable",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Pedestrians, Cyclists are not affected by the works (vehicle parking and lining).",
            "ncr": "Compliant"
          },
          {
            "id": 2,
            "txt": "Min 1m unobstructed width available in footways, retractable cone barrier tape used. Safe Practice.",
            "ncr": "Compliant"
          }
        ]
      },
      {
        "txt": "No",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Safety of Pedestrians and cyclists not achieved. ",
            "ncr": "Major",
            "comments1": "Corrective Action done on site",
            "comments2": "Cant be rectified, Stop Work",
            "comment1": "",
            "comment2": ""
          }
        ]
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans",
      "selectsubans"
    ]
  },
  {
    "id": "Road Marking (Test)_9",
    "qnum": 9,
    "headername": "Road Marking (Test)",
    "qtext": "Description of Works identified in SSRA and risks managed?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Identified correctly in the SSRA, Risks considered",
            "ncr": "Compliant"
          }
        ]
      },
      {
        "txt": "No",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Not identified in the SSRA, Risks managed",
            "ncr": "Minor"
          },
          {
            "id": 2,
            "txt": "Not identified in the SSRA, Risks not managed",
            "ncr": "Major",
            "comments1": "Corrective Action done on site",
            "comments2": "Cant be rectified, Stop Work",
            "comment1": "",
            "comment2": ""
          }
        ]
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans",
      "selectsubans"
    ]
  },
  {
    "id": "Road Marking (Test)_10",
    "qnum": 10,
    "headername": "Road Marking (Test)",
    "qtext": "Public Protected from Hot surface and hot materials",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Cone Topper Tapes Installed to prevent unauthorised access",
            "ncr": "Compliant"
          },
          {
            "id": 2,
            "txt": "Standby Person near vehicle at all times",
            "ncr": "Compliant"
          },
          {
            "id": 3,
            "txt": "Vehicle parked such that public is not exposed to hot surfaces",
            "ncr": "Compliant"
          },
          {
            "id": 4,
            "txt": "Hot paint Jugs never left unattended on footways",
            "ncr": "Compliant"
          },
          {
            "id": 5,
            "txt": "Hot surface Warning Stickers on vehicle",
            "ncr": "Compliant"
          }
        ]
      },
      {
        "txt": "No",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Risk to Public is high (Stop Work)",
            "ncr": "Major"
          },
          {
            "id": 2,
            "txt": "Risk to public is Low",
            "ncr": "Minor",
            "comments1": "Corrective Action done on site",
            "comments2": "Cant be rectified, Stop Work",
            "comment1": "",
            "comment2": ""
          }
        ]
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans",
      "multiselectsubans"
    ]
  },
  {
    "id": "Road Marking (Test)_11",
    "qnum": 11,
    "headername": "Road Marking (Test)",
    "qtext": "Work Equipment Condition Acceptable?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Plant Pre-use checks completed, no faults raised",
            "ncr": "Compliant"
          },
          {
            "id": 2,
            "txt": "Thermoplastic/ bitumen boilers and pre-heaters visually checked, no concerns",
            "ncr": "Compliant"
          },
          {
            "id": 3,
            "txt": "Leak Test performed in LPG lines and connections, no issues",
            "ncr": "Compliant"
          },
          {
            "id": 4,
            "txt": "Pressure hoses, anti blowback and safety devises visually checked, no faults",
            "ncr": "Compliant"
          },
          {
            "id": 5,
            "txt": "Thermometers, thermostats and temperature-regulating apparatus visually checked and are working correctly",
            "ncr": "Compliant"
          }
        ]
      },
      {
        "txt": "No",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Plant Pre-use check not completed, Plant in good condition",
            "ncr": "Minor"
          },
          {
            "id": 2,
            "txt": "Faulty Plant found on site, Plant Pre-use check not completed (stop plant use)",
            "ncr": "Major"
          },
          {
            "id": 3,
            "txt": "Plant Pre-use check completed, faults not recorded (stop plant use)",
            "ncr": "Minor"
          }
        ]
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans",
      "multiselectsubans"
    ]
  },
  {
    "id": "Road Marking (Test)_12",
    "qnum": 12,
    "headername": "Road Marking (Test)",
    "qtext": "Staff adhering to PPE requirements?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "High vis flame retardant clothing, safety boots, gloves, light eye protection as standard",
            "ncr": "Compliant"
          },
          {
            "id": 2,
            "txt": "Gauntlets worn for all hot works other than operating the pram",
            "ncr": "Compliant"
          },
          {
            "id": 3,
            "txt": "Face visor worn for line removal activities , use of leaf blowers",
            "ncr": "Compliant"
          },
          {
            "id": 4,
            "txt": "Hard Hat worn working on a surfacing/ planing site",
            "ncr": "Compliant"
          },
          {
            "id": 5,
            "txt": "Hard Hat worn - Overhead hazards, client requirement, loading/ unloading activity",
            "ncr": "Compliant"
          },
          {
            "id": 6,
            "txt": "Ear Defenders worn Line Removal Activities",
            "ncr": "Compliant"
          }
        ]
      },
      {
        "txt": "No",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "High vis flame retardant clothing, safety boots, gloves, light eye protection not worn",
            "ncr": "Minor",
            "comments1": "Corrective Action done on site",
            "comment1": ""
          },
          {
            "id": 2,
            "txt": "Gauntlets not worn for all hot works other than operating the pram",
            "ncr": "Major",
            "comments1": "Cant be rectified, Stop Work",
            "comment1": ""
          },
          {
            "id": 3,
            "txt": "Face visor not worn for line removal activities, use of leaf blowers",
            "ncr": "Major"
          },
          {
            "id": 4,
            "txt": "Hard Hat not worn working on a surfacing/ planing site",
            "ncr": "Minor"
          },
          {
            "id": 5,
            "txt": "Hard Hat not worn - Overhead hazards, client requirement, loading/unloading activity",
            "ncr": "Minor"
          },
          {
            "id": 6,
            "txt": "Ear Defenders not worn Line Removal Activities",
            "ncr": "Major"
          }
        ]
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans",
      "multiselectsubans"
    ]
  },
  {
    "id": "Road Marking (Test)_13",
    "qnum": 13,
    "headername": "Road Marking (Test)",
    "qtext": "Hot Works Managed safely?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Hot Works permit in place, risks managed",
            "ncr": "Compliant"
          }
        ]
      },
      {
        "txt": "No",
        "ncr": "no",
        "subselection": [
          {
            "id": 1,
            "txt": "Hot Works permit in place, risks not managed",
            "ncr": "Minor",
            "comments1": "Corrective Action done on site",
            "comments2": "Cant be rectified, Stop Work",
            "comment1": ""
          },
          {
            "id": 2,
            "txt": "Hot Works permit not completed (Stop Work)",
            "ncr": "Minor"
          }
        ]
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans",
      "multiselectsubans"
    ]
  },
  {
    "id": "Road Marking (Test)_14",
    "qnum": 14,
    "headername": "Road Marking (Test)",
    "qtext": "Compressed Gas Cylinder Security",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "id": 1,
        "txt": "Stored in upright position, chained and secured",
        "ncr": "Compliant"
      },
      {
        "id": 2,
        "txt": "Cylinders not secured, Improvements required",
        "ncr": "Minor"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Road Marking (Test)_15",
    "qnum": 15,
    "headername": "Road Marking (Test)",
    "qtext": "Any other H&S Observations from site or suggestions to improve H&S on site?",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Yes",
        "ncr": "No"
      },
      {
        "txt": "No",
        "ncr": "No"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  },
  {
    "id": "Road Marking (Test)_16",
    "qnum": 16,
    "headername": "Road Marking (Test)",
    "qtext": "Overview of site",
    "typeofans": [
      "select"
    ],
    "select": [
      {
        "txt": "Significant issues",
        "ncr": "No"
      },
      {
        "txt": "Minor weaknesses",
        "ncr": "No"
      },
      {
        "txt": "Compliant in all matters",
        "ncr": "No"
      },
      {
        "txt": "Good",
        "ncr": "No"
      },
      {
        "txt": "Excellent",
        "ncr": "No"
      }
    ],
    "hascar": "No",
    "mandatecond": [
      "selectans"
    ]
  }
];

// ============================================================================
// 3. REGISTRIES & HELPER UTILITIES
// ============================================================================

/**
 * Composite ID generator
 */
export function getCompositeQuestionId(headername: string, qnum: string | number): string {
  return `${headername}_${qnum}`;
}

/**
 * Map of all standard static question banks
 */
export const SITE_INSPECTION_QUESTION_BANKS: Record<string, SiteInspectionQuestion[]> = {
  'Civil/Other': CIVIL_OTHER_QUESTIONS,
  'Street Lighting': STREET_LIGHTING_QUESTIONS,
  'Road Marking': ROAD_MARKING_QUESTIONS,
  'Road Surfacing': ROAD_SURFACING_QUESTIONS,
  'Traffic Management (12D)': TRAFFIC_MANAGEMENT_12D_QUESTIONS,
  'Traffic Management (12AB)': TRAFFIC_MANAGEMENT_12AB_QUESTIONS,
  'Full Body Harness': FULL_BODY_HARNESS_QUESTIONS,
  'Ladder/Stepladder': LADDER_STEPLADDER_QUESTIONS,
  'Depot Check Sheet': DEPOT_CHECK_SHEET_QUESTIONS,
  'Road Marking (Test)': ROAD_MARKING_TEST_QUESTIONS,
};

/**
 * All supported department names in Quest
 */
export const SUPPORTED_DEPARTMENTS: string[] = [
  'Civil/Other',
  'Street Lighting',
  'Road Marking',
  'Road Surfacing',
  'Traffic Management',
  'Harness and Lanyard',
  'Ladder/Stepladder',
  'Managers Site Inspection',
  'Road Marking (Test)',
  'Depot Check Sheet'
];

/**
 * Retrieve questions for a department, resolving trafficType and Managers risk selections
 */
export function getQuestionsForDepartment(
  department: string,
  trafficType?: string,
  selectedRiskCategories?: string[]
): SiteInspectionQuestion[] {
  if (department === 'Civil/Other') {
    return CIVIL_OTHER_QUESTIONS;
  }
  if (department === 'Street Lighting') {
    return STREET_LIGHTING_QUESTIONS;
  }
  if (department === 'Road Marking') {
    return ROAD_MARKING_QUESTIONS;
  }
  if (department === 'Road Surfacing') {
    return ROAD_SURFACING_QUESTIONS;
  }
  if (department === 'Traffic Management') {
    return trafficType === '12AB'
      ? TRAFFIC_MANAGEMENT_12AB_QUESTIONS
      : TRAFFIC_MANAGEMENT_12D_QUESTIONS;
  }
  if (department === 'Harness and Lanyard') {
    return FULL_BODY_HARNESS_QUESTIONS;
  }
  if (department === 'Ladder/Stepladder') {
    return LADDER_STEPLADDER_QUESTIONS;
  }
  if (department === 'Depot Check Sheet') {
    return DEPOT_CHECK_SHEET_QUESTIONS;
  }
  if (department === 'Road Marking (Test)') {
    return ROAD_MARKING_TEST_QUESTIONS;
  }
  if (department === 'Managers Site Inspection') {
    const list = [...MANAGERS_BASE_QUESTIONS];
    if (selectedRiskCategories && selectedRiskCategories.length > 0) {
      selectedRiskCategories.forEach(cat => {
        if (MANAGERS_RISK_BANKS[cat]) {
          list.push(...MANAGERS_RISK_BANKS[cat]);
        }
      });
    }
    return list;
  }
  return CIVIL_OTHER_QUESTIONS;
}

/**
 * Evaluate whether a conditional question is applicable/visible based on parent answers
 */
export function evaluateConditionalRule(
  question: SiteInspectionQuestion,
  answers: Record<string, { selectans?: string; multiselectans?: any[]; rating?: string }>
): boolean {
  if (!question.conditionalRule) {
    return true;
  }

  const rule = question.conditionalRule;
  const parentAnswer = answers[rule.parentQuestionId];
  if (!parentAnswer) {
    return false;
  }

  if (rule.condition === 'equals') {
    return rule.targetValues.includes(parentAnswer.selectans);
  }

  if (rule.condition === 'selectIndexIn') {
    // For Road Surfacing Q4, options are:
    // [0] Incorrect barrier for footpath width (score 1)
    // [1] Correct barrier for footpath width, pedestrian marshall not visible/ evident (score 2)
    // [2] Correct barrier for footpath width, pedestrian marshall active, large gaps in barrier: single gap >2m (score 3)
    // [3] Correct barrier for footpath width, pedestrian marshall active, small gaps in barrier (score 4)
    // [4] Correct barrier for footpath width. Barrier complete throughout works & maintained (score 5)
    const q4Options = [
      'Incorrect barrier for footpath width',
      'Correct barrier for footpath width, pedestrian marshall not visible/ evident',
      'Correct barrier for footpath width, pedestrian marshall active, large gaps in barrier: single gap >2m',
      'Correct barrier for footpath width, pedestrian marshall active, small gaps in barrier (no more than 4 gap, max gap <2m)',
      'Correct barrier for footpath width. Barrier complete throughout works & maintained. Pedestrian mashal active'
    ];
    const idx = q4Options.indexOf(parentAnswer.selectans || '');
    return idx >= 0 && rule.targetValues.includes(idx);
  }

  if (rule.condition === 'multiselectContains') {
    if (!Array.isArray(parentAnswer.multiselectans)) return false;
    return parentAnswer.multiselectans.some(item => {
      const txt = typeof item === 'string' ? item : item?.txt;
      return rule.targetValues.some(target => txt && txt.includes(target));
    });
  }

  return true;
}

/**
 * Group questions by headername for accordion / tab display
 */
export function groupQuestionsByHeader(questions: SiteInspectionQuestion[]): QuestionGroup[] {
  const groups: Record<string, SiteInspectionQuestion[]> = {};
  questions.forEach(q => {
    const header = q.headername || 'General';
    if (!groups[header]) {
      groups[header] = [];
    }
    groups[header].push(q);
  });
  return Object.keys(groups).map(headername => ({
    headername,
    questions: groups[headername]
  }));
}
