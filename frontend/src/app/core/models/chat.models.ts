import type { InspectionPhoto } from '../../features/inspection/site-inspection.models';
export type { InspectionPhoto } from '../../features/inspection/site-inspection.models';
import {
  InspectionEvidenceViewModel,
  InspectionQuestionBatchViewModel,
  InspectionProgressViewModel,
  InspectionDraftSummaryViewModel,
} from './inspection-view.models';

export interface ThinkingStep {
  title: string;
  detail?: string;
  timestamp?: Date;
}

export interface InspectionFindingPreview {
  id?: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  location?: string;
  recommendation?: string;
  confidenceScore?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachmentName?: string;
  photos?: InspectionPhoto[];
  structuredInspection?: {
    summary?: string;
    overallRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
    findings?: InspectionFindingPreview[];
    modelIdentifier?: string;
    isMock?: boolean;
  };
  modelIdentifier?: string;
  isError?: boolean;
  retryPrompt?: string;
  showInspectionCategories?: boolean;
  categorySelected?: boolean;
  showInlinePhotoUpload?: boolean;
  showInternalAuditUpload?: boolean;
  internalAuditResult?: any;
  internalAuditSession?: any;
  suggestedBankId?: string;
  selectedBankId?: string;

  // Legacy full-component embed flag (preserved for backwards-compatibility & tests)
  isInspectionWorkflowMessage?: boolean;
  inspectionBankId?: string;

  // New Adaptive Grouped Conversation Properties
  inspectionId?: string;
  evidenceMessage?: InspectionEvidenceViewModel;
  questionBatch?: InspectionQuestionBatchViewModel;
  singleQuestion?: any;
  singleQuestionIndex?: number;
  singleQuestionTotal?: number;
  inspectionProgress?: InspectionProgressViewModel;
  draftSummary?: InspectionDraftSummaryViewModel;
  isAdditionalPhotoRequest?: boolean;
  targetQuestionId?: string;

  // Conversational SSRA Properties
  isSsraSession?: boolean;
  ssraId?: string;
  showSsraDomainSelector?: boolean;
  selectedSsraDomainKey?: string;
  ssraQuestion?: {
    id: string;
    domainKey: string;
    domainTitle: string;
    questionNumber: number;
    totalQuestions: number;
    text: string;
    roText?: string;
    cm?: string;
    answerType: 'yes-no' | 'yes-no-na' | 'select' | 'multiselect';
    options?: any[];
    triggersHotWorks?: boolean;
    currentValue?: string;
    notes?: string;
    answered?: boolean;
  };
  ssraHotWorksCheck?: {
    checkId: string;
    checkNumber: number;
    totalChecks: number;
    title: string;
    description: string;
    status?: 'Pass' | 'Fail' | 'N/A';
    notes?: string;
    answered?: boolean;
  };
  ssraOperativesPrompt?: {
    operatives: { name: string; role: string; signed: boolean }[];
    confirmed?: boolean;
  };
  ssraResult?: any;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: Date;
  previewSnippet: string;
  lastMessagePreview?: string;
  messages: ChatMessage[];
  selectedBankId?: string;
  activeInspectionId?: string;
  isInternalAudit?: boolean;
  isSsra?: boolean;
  activeSsraId?: string;
}

export interface SuggestionPrompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: 'document' | 'evidence' | 'response';
}
