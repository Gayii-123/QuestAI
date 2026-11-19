/**
 * QuestAI - Internal Audit Data Models & Interfaces
 *
 * Provides strongly-typed representations of:
 * - Internal Audit Sessions
 * - Uploaded Site Photographs
 * - AI Generated & User Edited Observations
 * - Corrective Action Recommendations (CAR)
 * - Backend API Request & Response Contracts
 */

import { InternalAuditRating } from './internal-audit-conditions.config';

export interface InternalAuditPhoto {
  id: string;
  name: string;
  url: string; // Base64 data URL
  mimeType?: string;
  size?: number; // Size in bytes
  timestamp: string;
}

export interface InternalAuditObservation {
  id: string; // Unique observation id (e.g., 'obs-1')
  focusArea: string; // e.g., 'Appropriate PPE'
  focusAreaRef: string; // e.g., 'FA01'
  finding: string; // Empirical visual finding observed in photos (plain text or clean paragraphs)
  suggestedAction: string; // Specific corrective / remedial action requirement
  rating: InternalAuditRating;
  photoIds: string[]; // IDs of photos associated as visual evidence
  photoUrls: string[]; // URLs/previews of associated photos
  hasCar: 'Yes' | 'No'; // 'Yes' if rating is Area for Improvement, Minor NCR, or Major NCR
  carRefNo?: string; // e.g., 'CA-IA-...'
  resolveByDate?: number | null; // Timestamp (typically 30 days from audit date for CARs)
  isEdited?: boolean; // Flag to track inspector edits
}

export interface InternalAuditAnalysisResult {
  location: string;
  auditorSummary: string;
  observations: InternalAuditObservation[];
  totalPhotosAnalyzed: number;
  goodPracticeCount: number;
  compliantCount: number;
  observationsOnlyCount: number;
  areaForImprovementCount: number;
  minorNcrCount: number;
  majorNcrCount: number;
  totalCarCount: number;
  overallComplianceScore?: number; // Calculated percentage
  analyzedAt: string;
  modelIdentifier?: string;
}

export type InternalAuditStatus =
  | 'uploading'
  | 'analyzing'
  | 'review'
  | 'draft_saved'
  | 'completed';

export interface InternalAuditSession {
  sessionId: string; // e.g., 'ia_sess_1700000000000_abc'
  referenceNumber: string; // Human-readable e.g., 'IA-2026-0042'
  status: InternalAuditStatus;
  location: string;
  siteName?: string;
  auditorName: string;
  auditorSummary: string;
  photos: InternalAuditPhoto[];
  observations: InternalAuditObservation[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  analysisResult?: InternalAuditAnalysisResult;
}

// ============================================================================
// API Service Contracts
// ============================================================================

export interface InternalAuditAnalyzeRequest {
  sessionId: string;
  siteName?: string;
  location?: string;
  auditorName?: string;
  notes?: string;
  photos: Array<{
    id: string;
    name: string;
    base64Data: string;
    mimeType: string;
  }>;
}

export interface InternalAuditAnalyzeResponse {
  success: boolean;
  data: {
    sessionId: string;
    location: string;
    auditorSummary: string;
    observations: Array<{
      focusArea: string;
      focusAreaRef?: string;
      finding: string;
      suggestedAction: string;
      rating: string;
      evidencePhotoIndices: number[];
    }>;
    analyzedAt: string;
    modelIdentifier?: string;
  };
  message?: string;
  timestamp: string;
}

export interface InternalAuditSaveRequest {
  session: InternalAuditSession;
}

export interface InternalAuditSaveResponse {
  success: boolean;
  id: string;
  referenceNumber: string;
  message: string;
  timestamp: string;
}
