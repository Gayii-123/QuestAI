import { Injectable } from '@angular/core';
import { SiteInspectionQuestion } from '../models/site-inspection.schema';
import { InspectionPhoto, QuestionAnswer } from '../../features/inspection/site-inspection.models';

export interface AiFillResult {
  bankId: string;
  bankName: string;
  department: string;
  answers: Record<string, QuestionAnswer>;
  photoCount: number;
  totalEvaluated: number;
  passedCount: number;
  carCount: number;
  naCount: number;
  needsReviewCount: number;
  timestamp: string;
  evidenceNotes: string;
}

/**
 * Known hardcoded legacy mock strings produced by the pre-Gemini AiInspectionFillService.
 * Used exclusively by the localStorage draft migration to safely detect and remove stale
 * mock AI comments, ratings, and auto-attached photos without touching genuine inspector answers.
 */
export const LEGACY_MOCK_STRING_PREFIXES: readonly string[] = [
  'Class 1 industrial ladder stiles, rungs, and anti-slip rubber feet intact. 1:4 angle positioning verified in',
  'Column alignment and isolations verified in',
  'Chapter 8 signage clean, unobstructed, and ballasted in accordance with Red Book standards as verified in',
  'Harness webbing, stitch patterns, and carabiner double-locking gates inspected in',
  'Paving plant exclusion zones delineated. Rollers fitted with functional amber beacons and reversing alarms as verified in',
  'Bunded fuel store secure. Spill kit stocked and emergency eyewash station accessible in depot yard photo.',
  'Mandatory 5-point PPE (hard hat, hi-vis class 3, safety footwear, safety eyewear, gloves) verified in site photo.',
  'Verified compliant against site safety specifications from visual inspection of',
  'Visual deficiency noted in photo: Temporary road work sign sandbag ballast dislodged.',
  'Visual deficiency noted in photo: Trench edge protection adjacent to lighting column excavation',
  'Visual check: Carabiner gate minor surface grit accumulation.',
  'Deficiency observed in site photograph: Temporary walkway plate requires realignment',
  'Requires human verification: Check documentation or physical measurements before confirming compliance.',
  'Activity / equipment not active in current operational phase shown in photo evidence.',
  'Physical measurement / permit documentation required; cannot be verified by photo alone.',
  'Observed deficiency in site photograph: Non-compliance with safety demarcation / housekeeping.',
  'Workzone photograph shows activity not taking place in this scheme section.',
  'Visual inspection of photo confirms equipment in satisfactory condition, properly installed.',
  'Statutory standard requires manual inspection of certificates, torque gauges, or permits on site.',
  'Visual condition presents potential hazard. Corrective Action Required (CAR) to restore standard.',
  'Equipment or process not deployed on site during inspection time.',
  'Compliant with standard operating procedures and site safety handbook requirements.',
  'Immediate Action: Re-position double sandbag ballast to rear base legs before opening lane to traffic.',
  'Immediate Action: Install rigid Chapter 8 barrier panels around excavation perimeter with 0.5m setback from kerb.',
  'Immediate Action: Level pedestrian ramp, secure anti-slip decking screws, and verify barrier stability.',
];

export function isLegacyMockString(value: string | undefined | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return LEGACY_MOCK_STRING_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * Determines whether a stored QuestionAnswer object (or specific fields within it)
 * originated from the legacy pre-Gemini mock service.
 */
export function isLegacyMockAnswerEntry(ans: QuestionAnswer | undefined | null): boolean {
  if (!ans || typeof ans !== 'object') return false;
  if (isLegacyMockString(ans.comment)) return true;
  if (isLegacyMockString(ans.aiEvidence)) return true;
  if (isLegacyMockString(ans.aiReasoning)) return true;
  if (isLegacyMockString(ans.carActionPlan)) return true;
  // Legacy mock service stored aiConfidence as a fractional float (e.g. 0.92, 0.93, 0.65) without aiModel
  if (
    typeof ans.aiConfidence === 'number' &&
    ans.aiConfidence > 0 &&
    ans.aiConfidence < 1 &&
    !ans.aiModel
  ) {
    return true;
  }
  return false;
}

/**
 * @deprecated Legacy pre-Gemini mock fill service. Isolated from the active photo-analysis workflow.
 * All photo analysis must go through POST /api/ai/inspect-photos via ApiService.analyzeInspectionPhotos().
 */
@Injectable({
  providedIn: 'root',
})
export class AiInspectionFillService {
  /**
   * @deprecated Isolated legacy stub. Returns an empty unanswered result without generating
   * mock ratings, predefined comments, or automatic photo attachments.
   */
  public generateAiInspectionAnswers(
    bankId: string,
    department: string,
    _questions: SiteInspectionQuestion[],
    photos: InspectionPhoto[],
    siteNotes?: string
  ): AiFillResult {
    return {
      bankId,
      bankName: department,
      department,
      answers: {},
      photoCount: photos.length,
      totalEvaluated: 0,
      passedCount: 0,
      carCount: 0,
      naCount: 0,
      needsReviewCount: 0,
      timestamp: new Date().toISOString(),
      evidenceNotes: siteNotes || '',
    };
  }
}
