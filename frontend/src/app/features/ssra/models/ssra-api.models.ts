/**
 * QuestAI — SSRA API Contracts
 *
 * RESTful interface contracts for SSRA endpoints:
 * GET  /api/v1/ssra
 * POST /api/v1/ssra
 * GET  /api/v1/ssra/:id
 * PUT  /api/v1/ssra/:id/close
 * GET  /api/v1/ssra/:id/pdf
 */

import {
  SsraAssessment,
  SsraClosingReport,
  SsraLifecycleStatus,
  SsraPhase1Data,
} from './ssra.models';

export interface SsraListQuery {
  page?: number;
  pageSize?: number;
  status?: SsraLifecycleStatus | 'ALL';
  domainType?: string;
  search?: string;
}

export interface SsraListResponse {
  success: boolean;
  total: number;
  page: number;
  pageSize: number;
  assessments: SsraAssessment[];
}

export type SsraCreatePhase1Request = SsraPhase1Data;

export interface SsraCreatePhase1Response {
  success: boolean;
  id: string;
  refno: string;
  lifecycleStatus: 'Level1';
  submittedAt: string;
  assessment: SsraAssessment;
  message?: string;
}

export interface SsraDetailResponse {
  success: boolean;
  assessment: SsraAssessment;
}

export interface SsraClosePhase2Request {
  closingReport: SsraClosingReport;
}

export interface SsraClosePhase2Response {
  success: boolean;
  id: string;
  refno: string;
  lifecycleStatus: 'Complete';
  completedAt: string;
  assessment: SsraAssessment;
  message?: string;
}

export interface SsraUploadResponse {
  success: boolean;
  id: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface SsraApiError {
  success: false;
  code: string;
  message: string;
  validationErrors?: { field: string; message: string }[];
}
