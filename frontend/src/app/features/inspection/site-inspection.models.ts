import { QuestRatingValue, SiteInspectionQuestion } from '../../core/models/site-inspection.schema';

export type InspectionStep =
  | 'category-select'
  | 'photo-upload'
  | 'ai-scanning'
  | 'review-form'
  | 'finalized';

export interface InspectionBankOption {
  id: string;
  name: string;
  department: string;
  trafficSubtype?: '12D' | '12AB';
  isManagers?: boolean;
  isManagersRiskDirect?: boolean;
  icon: string;
  badge: string;
  description: string;
  baseQuestionCount: number;
}

export interface InspectionPhoto {
  id: string;
  name: string;
  url: string; // Base64 data URL
  size?: number;
  timestamp: string;
}

export interface QuestionAnswer {
  rating?: QuestRatingValue; // '1' | '-1' | '0' | ''
  selectans?: string;
  multiselectans?: { txt: string; id?: any; ncr?: string }[];
  comment?: string;
  componentres?: string;
  modalres?: string;
  photoAttached?: boolean;
  photos?: InspectionPhoto[];
  carActionPlan?: string;

  // AI Evaluation Metadata
  aiSuggestedRating?: QuestRatingValue;
  aiEvidence?: string;
  aiReasoning?: string;
  aiConfidence?: number;
  requiresHumanVerification?: boolean;
  isHumanVerified?: boolean;
}

export interface InspectionMetadata {
  inspectorName: string;
  siteLocation: string;
  jobReference: string;
  inspectionDate: string;
  weatherCondition: string;
  supervisorName: string;
  notes: string;
}

export interface SectionGroup {
  headername: string;
  questions: SiteInspectionQuestion[];
  answeredCount: number;
  totalCount: number;
  hasCar: boolean;
}

export interface FinalizedInspectionReport {
  referenceNumber: string; // e.g. SI-2026-784912
  bankId: string;
  bankName: string;
  department: string;
  finalizedAt: string;
  inspectorName: string;
  siteLocation: string;
  jobReference: string;
  stats: {
    total: number;
    answered: number;
    passCount: number;
    carCount: number;
    naCount: number;
    needsReviewCount: number;
    verifiedCount: number;
  };
  answers: Record<string, QuestionAnswer>;
  photoCount: number;
  modelIdentifier: string;
  isMock: boolean;
}
