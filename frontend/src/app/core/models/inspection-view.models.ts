import {
  QuestRatingValue,
  QuestionAnswerType,
  SelectOption,
  MultiSelectOption,
  ConditionalDisplayRule,
} from './site-inspection.schema';
import { InspectionPhoto, QuestionAnswer } from '../../features/inspection/site-inspection.models';

/**
 * Question evaluation & assessment status as provided by backend reasoning engine.
 */
export type QuestionAssessmentStatus =
  | 'unassessed'              // Not yet evaluated or addressed
  | 'ai_suggested'            // AI proposed an answer based on visual evidence
  | 'conversational_pending'  // Currently being asked in the chat
  | 'user_answered'           // User provided answer conversationally
  | 'needs_verification'      // Flagged for physical verification on site
  | 'inspector_confirmed'     // Inspector explicitly reviewed and locked
  | 'conditional_hidden';     // Parent condition not satisfied; question bypassed

/**
 * Origin of the recorded answer.
 */
export type AnswerSourceType =
  | 'ai_vision'
  | 'user_conversational'
  | 'inspector_manual'
  | 'not_answered';

/**
 * Individual Question View Model for conversational rendering.
 * Strictly preserves original canonical question ID, wording, options, and conditional rules.
 */
export interface InspectionQuestionViewModel {
  /** Canonical composite Question ID, e.g. "Pre-Use Inspection_01" or "TM/ Branding_01" */
  questionId: string;
  /** Original Question Number in Quest, e.g. "01" */
  qnum: string | number;
  /** Section / Category Header, e.g. "Pre-Use Inspection" */
  headername: string;
  /** Exact Question Text from authoritative schema */
  qtext: string;
  /** Guidance / Guidance Notes for inspector */
  guidance?: string;
  /** Expected input types from schema */
  typeofans: (QuestionAnswerType | string)[];
  /** Single-select options from schema (if applicable) */
  selectOptions?: (string | SelectOption)[];
  /** Multi-select options from schema (if applicable) */
  multiselectOptions?: MultiSelectOption[];
  /** Corrective Action Plan required flag */
  hascar?: 'Yes' | 'No' | string;
  /** Conditional visibility rule */
  conditionalRule?: ConditionalDisplayRule;

  // --- Dynamic Assessment State ---
  status: QuestionAssessmentStatus;
  answerSource?: AnswerSourceType;
  /** AI suggested rating ('1', '-1', '0', or null) */
  suggestedRating?: QuestRatingValue | null;
  /** User provided rating ('1', '-1', '0', or null) */
  userAnswerRating?: QuestRatingValue | null;
  /** User provided single-select choice */
  userAnswerSelect?: string | null;
  /** User provided multi-select choices */
  userAnswerMultiselect?: string[] | null;
  /** User free-text comment or response */
  userAnswerText?: string | null;
  /** Factual visual evidence observed from site photographs */
  evidenceObserved?: string;
  /** AI reasoning / safety justification */
  reasoning?: string;
  /** Corrective Action Plan when non-compliant */
  carActionPlan?: string | null;
  /** IDs of photos supporting this assessment */
  supportingPhotoIds?: string[];
  /** Human verification requirement */
  needsHumanVerification?: boolean;
  /** Clarification context if question was reopened due to conflicting evidence */
  clarificationContext?: string;
  /** Whether the question has an answer recorded */
  isAnswered: boolean;
}

/**
 * Adaptive Grouped Question Batch View Model.
 * Represents 1 or 2–4 related follow-up questions delivered together within one assistant message.
 */
export interface InspectionQuestionBatchViewModel {
  /** Unique batch identifier, e.g. "batch-1731500000-1" */
  batchId: string;
  /** Associated inspection session ID */
  inspectionId: string;
  /** Optional section or group title */
  title?: string;
  /** Conversational introductory prompt, e.g. "I have 3 quick questions about ladder stability..." */
  promptIntro?: string;
  /** Questions included in this adaptive group */
  questions: InspectionQuestionViewModel[];
  /** True when all questions in the batch have been answered */
  isComplete: boolean;
  /** Timestamp when the batch was submitted */
  submittedAt?: string;
}

/**
 * Structure of a user response to a question within a batch.
 */
export interface InspectionAnswerViewModel {
  questionId: string;
  rating?: QuestRatingValue;
  selectans?: string;
  multiselectans?: string[];
  textAnswer?: string;
  photos?: InspectionPhoto[];
  carActionPlan?: string;
  answeredAt: string;
}

/**
 * Evidence-supported AI finding for an original question.
 * Clearly preserved as an AI suggestion, never implied as inspector-confirmed.
 */
export interface AiSuggestedFinding {
  questionId: string;
  qtext: string;
  headername: string;
  suggestedRating: QuestRatingValue;
  confidence: number;
  evidenceObserved: string;
  reasoning: string;
  supportingPhotoIds?: string[];
  needsHumanVerification?: boolean;
}

/**
 * Assistant Evidence Observations View Model.
 * Represents concise visual observations, photo thumbnails, evidence-supported findings, and targeted photo requests.
 */
export interface InspectionEvidenceViewModel {
  evidenceId: string;
  inspectionId: string;
  summary: string;
  observations: string[];
  photos: InspectionPhoto[];
  aiSuggestions?: AiSuggestedFinding[];
  relevantQuestionIds?: string[];
  needsAdditionalPhotos?: boolean;
  additionalPhotoPrompt?: string;
  createdAt: string;
}

/**
 * Backend Turn Analysis Request Payload Contract.
 * Standardized data transfer boundary for backend reasoning engine.
 */
export interface BackendInspectionTurnRequest {
  inspectionId: string;
  conversationId: string;
  bankId: string;
  department: string;
  trafficSubtype?: '12D' | '12AB';
  selectedRiskBanks?: string[];
  newPhotos?: InspectionPhoto[];
  allPhotos?: InspectionPhoto[];
  userText?: string;
  answers?: InspectionAnswerViewModel[];
  answeredQuestionIds?: string[];
  siteNotes?: string;
}

/**
 * Backend Turn Analysis Response Contract.
 * Output returned by backend multimodal reasoning engine.
 */
export interface BackendInspectionTurnResponse {
  inspectionId: string;
  workflowStatus: 'in_progress' | 'draft_ready' | 'needs_more_photos' | 'completed';
  conversationalSummary: string;
  evidenceObservations: string[];
  evidencePhotos: InspectionPhoto[];
  needsAdditionalPhotos?: boolean;
  additionalPhotoPrompt?: string;
  aiSuggestedAssessments?: AiSuggestedFinding[];
  nextClarificationBatch?: {
    batchId: string;
    title?: string;
    promptIntro?: string;
    questionIds: string[];
    clarificationReasons?: Record<string, string>;
  };
  isDraftReady: boolean;
  draftSummary?: InspectionDraftSummaryViewModel;
}

/**
 * Compact Inspection Progress View Model.
 * Displays only real backend-provided or session-computed numbers.
 */
export interface InspectionProgressViewModel {
  inspectionId: string;
  bankId: string;
  bankName: string;
  assessedCount: number;
  totalApplicableCount: number;
  clarificationCount: number;
  carCount: number;
  isDraftReady: boolean;
}

/**
 * Final Inspection Draft Summary View Model.
 * Presented when all applicable questions have been evaluated.
 */
export interface InspectionDraftSummaryViewModel {
  inspectionId: string;
  bankId: string;
  bankName: string;
  department: string;
  referenceNumber: string;
  totalApplicable: number;
  passCount: number;
  carCount: number;
  naCount: number;
  unresolvedCount: number;
  needsVerificationCount: number;
  aiSuggestionsCount?: number;
  userResponsesCount?: number;
  photoCount: number;
  answers: Record<string, QuestionAnswer>;
  generatedAt: string;
  isConfirmedByInspector: boolean;
  confirmedAt?: string;
}

/**
 * Central Inspection Session View Model.
 * Each inspection attempt has a unique inspectionId, decoupling multiple inspections of the same bank.
 */
export interface InspectionSessionViewModel {
  /** Unique inspection session identifier (e.g. "ins-1731500000-x9a2") */
  inspectionId: string;
  /** Associated conversation ID */
  conversationId: string;
  /** Selected question bank ID (e.g. "ladder-stepladder") */
  bankId: string;
  bankName: string;
  department: string;
  trafficSubtype?: '12D' | '12AB';
  selectedRiskBanks?: string[];
  workflowStatus:
    | 'category_selected'
    | 'evidence_gathering'
    | 'in_progress'
    | 'draft_ready'
    | 'completed'
    | 'abandoned';
  currentBatchId?: string;
  totalApplicableQuestions: number;
  assessedQuestionsCount: number;
  passCount: number;
  carCount: number;
  naCount: number;
  clarificationCount: number;
  uploadedPhotos: InspectionPhoto[];
  answers: Record<string, QuestionAnswer>;
  questionAssessments: Record<string, InspectionQuestionViewModel>;
  draftSummary?: InspectionDraftSummaryViewModel;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

