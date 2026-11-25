/**
 * QuestAI — SSRA Domain Models
 *
 * Site Specific Safety Risk Assessment (SSRA)
 * Point-of-work operative safety assessment.
 * Strictly qualitative checklist workflow; no numerical likelihood × severity calculations.
 */

export type SsraLifecycleStatus = 'Incomplete' | 'Level1' | 'Complete';

export type SsraWeatherType = 'DRY' | 'WET' | 'ICY' | 'FOG';

export type SsraYesNo = 'YES' | 'NO';

export interface SsraSiteInformation {
  jobno: string;
  clientjobno?: string;
  location: string;
  contractName: string;
  contractId?: string;
  depot?: string;
  weather: SsraWeatherType;
  description: string;
  timeonsite: string;
}

export interface SsraAnswer {
  questionId: string;
  value: string; // 'Yes' | 'No' | 'N/A' or specific option
  notes?: string;
  selectedOptionIds?: string[];
}

export interface SsraEvidencePhoto {
  id: string;
  name: string;
  url: string; // Base64 data URL or storage URL
  category: 'pre-work' | 'closing' | 'question';
  size?: number;
  mimeType?: string;
  capturedAt?: string;
}

export interface SsraOperative {
  operativeId: string;
  displayName: string;
  role?: string;
  signatureEvidenceId?: string;
  signatureDataUrl?: string;
  signedAt?: string;
}

export interface SsraHotWorksCheck {
  id: string;
  title: string;
  description: string;
  status: 'Pass' | 'Fail' | 'N/A';
  notes?: string;
}

export interface SsraHotWorksData {
  applicable: boolean;
  triggerQuestionId?: string;
  checks: SsraHotWorksCheck[];
}

export interface SsraClosingReport {
  timeoffsite: string;
  jobstatus: {
    tmleft: SsraYesNo;
    tmcomment?: string;
    visitagain: SsraYesNo;
    visitagaincomment?: string;
    followup: SsraYesNo;
    followupcomment?: string;
  };
  jobfinish: SsraYesNo;
  usedmaterials: string[];
  materialsuseddescription?: string;
  closingreport: {
    moreimages: SsraEvidencePhoto[];
    comments: string;
  };
  closedAt?: string;
  closedBy?: string;
}

export interface SsraPhase1Data {
  clientReferenceId: string;
  domainType: string;
  questionnaireVersion: string;
  siteInformation: SsraSiteInformation;
  personsAffected: string[];
  answers: SsraAnswer[];
  preWorkPhotos: SsraEvidencePhoto[];
  othercomments: string;
  operatives: SsraOperative[];
  hotWorks: SsraHotWorksData;
}

export interface SsraAssessment {
  id: string;
  refno: string;
  userId: string;
  userEmail?: string;
  clientReferenceId: string;
  domainType: string;
  domainTitle: string;
  questionnaireVersion: string;
  lifecycleStatus: SsraLifecycleStatus;
  siteInformation: SsraSiteInformation;
  personsAffected: string[];
  answers: SsraAnswer[];
  preWorkPhotos: SsraEvidencePhoto[];
  othercomments: string;
  operatives: SsraOperative[];
  hotWorks: SsraHotWorksData;
  closingReport?: SsraClosingReport;
  createdAt: string;
  submittedAt?: string;
  completedAt?: string;
  updatedAt: string;
  creatorName: string;
}

export interface SsraQuestionDefinition {
  id: string;
  qnum?: number;
  questionNumber?: number;
  header?: string;
  text?: string;
  questionText?: string;
  roText?: string;
  romanianTranslation?: string;
  cm?: string; // Control measure
  controlMeasure?: string;
  answerType?: 'yes-no' | 'select' | 'multiselect' | 'yes-no-na' | 'text';
  options?: any[];
  defaultValue?: string;
  isMandatory?: boolean;
  mandatory?: boolean;
  triggersHotWorks?: boolean;
}

export type SsraQuestion = SsraQuestionDefinition;

export interface SsraDomainTypeInfo {
  key: string;
  title: string;
  department: string;
  icon: string;
  description: string;
  isLegacy?: boolean;
  hotWorksTriggerQId?: string;
}
