import { env } from '../../config/env';
import {
  AiSuggestedRating,
  InspectionPhotoPayload,
  PhotoInspectionRequest,
  PhotoInspectionResult,
  QuestionAiEvaluation,
  SeverityLevel,
  SupportedImageMimeType,
} from './ai.interface';
import {
  resolveInspectionBank,
  getAllowedSelectOptions,
  getAllowedMultiSelectOptions,
  SiteInspectionQuestion,
  evaluateConditionalRule,
} from '../../models/quest-bank-registry';

export interface ValidatedPhoto {
  id: string;
  name: string;
  mimeType: SupportedImageMimeType;
  base64Data: string;
  byteLength: number;
}

export interface ValidationFailure {
  valid: false;
  errors: string[];
}

export interface RequestValidationSuccess {
  valid: true;
  value: PhotoInspectionRequest;
  canonicalQuestions: SiteInspectionQuestion[];
  validatedPhotos: ValidatedPhoto[];
}

export type RequestValidationResult = RequestValidationSuccess | ValidationFailure;

export interface ResponseValidationSuccess {
  valid: true;
  value: PhotoInspectionResult;
}

export type ResponseValidationResult = ResponseValidationSuccess | ValidationFailure;

export interface PhotoValidationOptions {
  maxPhotos?: number;
  maxImageBytes?: number;
  maxTotalBytes?: number;
}

const ALLOWED_MIME_TYPES = new Set<string>(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set<string>(['.jpg', '.jpeg', '.png', '.webp']);
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Inspects the binary magic bytes of a Buffer to determine its genuine image format.
 * Returns null if the bytes are not a valid JPEG, PNG, or WEBP header.
 */
export function detectImageMimeFromMagicBytes(buf: Buffer): SupportedImageMimeType | null {
  if (!Buffer.isBuffer(buf) || buf.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: "RIFF" at 0..3 and "WEBP" at 8..11
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

function normalizeMime(mime: string): SupportedImageMimeType | string {
  const m = mime.trim().toLowerCase();
  return m === 'image/jpg' ? 'image/jpeg' : m;
}

/**
 * Validates a single uploaded photograph's metadata, size, and actual binary magic bytes.
 */
export function validateAndDecodePhoto(
  photo: InspectionPhotoPayload,
  index: number,
  maxImageBytes: number = env.MAX_IMAGE_SIZE_BYTES
): { valid: true; photo: ValidatedPhoto } | ValidationFailure {
  if (!photo || typeof photo !== 'object') {
    return { valid: false, errors: [`Photograph at index ${index} must be an object`] };
  }

  const id = typeof photo.id === 'string' && photo.id.trim() ? photo.id.trim() : `photo_${index + 1}`;
  const name = typeof photo.name === 'string' && photo.name.trim() ? photo.name.trim() : `${id}.jpg`;

  // Check file extension if present
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx !== -1) {
    const ext = name.slice(dotIdx).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        errors: [
          `Photograph "${name}" has unsupported file extension "${ext}". Allowed formats: JPEG, JPG, PNG, WEBP.`,
        ],
      };
    }
  }

  const rawSource = (typeof photo.url === 'string' && photo.url.trim()) ||
    (typeof photo.base64Data === 'string' && photo.base64Data.trim()) ||
    '';

  if (!rawSource) {
    return {
      valid: false,
      errors: [`Photograph "${name}" is missing image data (url or base64Data required).`],
    };
  }

  let declaredMime: string | undefined = photo.mimeType ? normalizeMime(photo.mimeType) : undefined;
  let base64Body = rawSource;

  if (rawSource.startsWith('data:')) {
    const match = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(rawSource);
    if (!match) {
      return {
        valid: false,
        errors: [`Photograph "${name}" has a malformed data URL header.`],
      };
    }
    declaredMime = normalizeMime(match[1]);
    base64Body = match[2];
  }

  if (declaredMime && !ALLOWED_MIME_TYPES.has(declaredMime)) {
    return {
      valid: false,
      errors: [
        `Photograph "${name}" has unsupported MIME type "${declaredMime}". Allowed types: image/jpeg, image/png, image/webp.`,
      ],
    };
  }

  const cleanedBase64 = base64Body.replace(/\s+/g, '');
  if (!cleanedBase64 || cleanedBase64.length % 4 !== 0 || !BASE64_REGEX.test(cleanedBase64)) {
    return {
      valid: false,
      errors: [`Photograph "${name}" contains invalid base64 encoding.`],
    };
  }

  // Decode into memory buffer to validate byte size and magic bytes
  const buf = Buffer.from(cleanedBase64, 'base64');

  if (buf.length === 0) {
    return {
      valid: false,
      errors: [`Photograph "${name}" decoded to an empty buffer.`],
    };
  }

  if (buf.length > maxImageBytes) {
    const limitMb = (maxImageBytes / (1024 * 1024)).toFixed(2);
    const actualMb = (buf.length / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      errors: [
        `Photograph "${name}" (${actualMb} MB) exceeds maximum allowed image size of ${limitMb} MB.`,
      ],
    };
  }

  const actualMime = detectImageMimeFromMagicBytes(buf);
  if (!actualMime) {
    return {
      valid: false,
      errors: [
        `Photograph "${name}" failed binary content inspection: file content is not a valid JPEG, PNG, or WEBP image.`,
      ],
    };
  }

  if (declaredMime && declaredMime !== actualMime) {
    return {
      valid: false,
      errors: [
        `Photograph "${name}" declared MIME type "${declaredMime}" does not match actual binary content "${actualMime}".`,
      ],
    };
  }

  return {
    valid: true,
    photo: {
      id,
      name,
      mimeType: actualMime,
      base64Data: buf.toString('base64'),
      byteLength: buf.length,
    },
  };
}

/**
 * Validates the incoming POST /api/ai/inspect-photos request payload against the
 * official Quest inspection banks, question IDs, and image content/size rules.
 */
export function validatePhotoInspectionRequest(
  data: unknown,
  options: PhotoValidationOptions = {}
): RequestValidationResult {
  const errors: string[] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const raw = data as Record<string, unknown>;
  const maxPhotos = options.maxPhotos ?? env.MAX_PHOTOS_PER_REQUEST;
  const maxImageBytes = options.maxImageBytes ?? env.MAX_IMAGE_SIZE_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? env.MAX_TOTAL_IMAGES_BYTES;

  // 1. Validate bankId / inspectionBankId
  const rawBankId =
    (typeof raw.bankId === 'string' && raw.bankId.trim()) ||
    (typeof raw.inspectionBankId === 'string' && raw.inspectionBankId.trim()) ||
    '';

  if (!rawBankId) {
    errors.push('bankId is required and must be a non-empty string');
  }

  const trafficSubtype =
    raw.trafficSubtype === '12D' || raw.trafficSubtype === '12AB' ? raw.trafficSubtype : undefined;
  const selectedRiskBanks = Array.isArray(raw.selectedRiskBanks)
    ? raw.selectedRiskBanks.filter((s): s is string => typeof s === 'string')
    : undefined;

  const resolvedBank = rawBankId
    ? resolveInspectionBank(rawBankId, { trafficSubtype, selectedRiskBanks })
    : null;

  if (rawBankId && !resolvedBank) {
    errors.push(
      `Invalid or unknown inspection bank "${rawBankId}". Must be one of the 12 official Quest inspection banks.`
    );
  }

  // 2. Validate photographs
  if (!Array.isArray(raw.photos) || raw.photos.length === 0) {
    errors.push('photos is required and must contain at least one photograph');
  } else if (raw.photos.length > maxPhotos) {
    errors.push(
      `Too many photographs uploaded (${raw.photos.length}). Maximum allowed per request is ${maxPhotos}.`
    );
  }

  const validatedPhotos: ValidatedPhoto[] = [];
  let totalImageBytes = 0;

  if (Array.isArray(raw.photos) && raw.photos.length > 0 && raw.photos.length <= maxPhotos) {
    for (let i = 0; i < raw.photos.length; i++) {
      const check = validateAndDecodePhoto(raw.photos[i] as InspectionPhotoPayload, i, maxImageBytes);
      if (!check.valid) {
        errors.push(...check.errors);
      } else {
        validatedPhotos.push(check.photo);
        totalImageBytes += check.photo.byteLength;
      }
    }

    if (totalImageBytes > maxTotalBytes) {
      const limitMb = (maxTotalBytes / (1024 * 1024)).toFixed(2);
      const actualMb = (totalImageBytes / (1024 * 1024)).toFixed(2);
      errors.push(
        `Total uploaded photographs size (${actualMb} MB) exceeds maximum total limit of ${limitMb} MB.`
      );
    }
  }

  // 3. Validate questions against the selected Quest inspection bank
  let canonicalQuestions: SiteInspectionQuestion[] = [];
  if (resolvedBank) {
    if (raw.questions !== undefined) {
      if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
        errors.push('questions, when provided, must be a non-empty array');
      } else {
        const seenReqIds = new Set<string>();
        for (let i = 0; i < raw.questions.length; i++) {
          const qItem = raw.questions[i] as { id?: unknown; qtext?: unknown } | null;
          if (!qItem || typeof qItem !== 'object' || typeof qItem.id !== 'string' || !qItem.id.trim()) {
            errors.push(`Question at index ${i} must have a non-empty string "id"`);
            continue;
          }
          const qId = qItem.id.trim();
          if (seenReqIds.has(qId)) {
            errors.push(`Duplicate question ID "${qId}" in request payload`);
            continue;
          }
          seenReqIds.add(qId);

          const canonical = resolvedBank.questionById.get(qId);
          if (!canonical) {
            errors.push(
              `Question ID "${qId}" does not belong to the selected inspection bank "${resolvedBank.bankName}"`
            );
            continue;
          }
          canonicalQuestions.push(canonical);
        }
      }
    } else {
      canonicalQuestions = resolvedBank.questions;
    }
  }

  if (errors.length > 0 || !resolvedBank) {
    return { valid: false, errors };
  }

  const bankName =
    (typeof raw.bankName === 'string' && raw.bankName.trim()) ||
    (typeof raw.inspectionBankName === 'string' && raw.inspectionBankName.trim()) ||
    resolvedBank.bankName;

  const department =
    (typeof raw.department === 'string' && raw.department.trim()) || resolvedBank.department;

  return {
    valid: true,
    canonicalQuestions,
    validatedPhotos,
    value: {
      bankId: resolvedBank.bankId,
      bankName,
      department,
      trafficSubtype: resolvedBank.trafficSubtype ?? trafficSubtype,
      selectedRiskBanks,
      questions: canonicalQuestions.map((q) => ({
        id: q.id,
        qtext: q.qtext,
        headername: q.headername,
        qnum: q.qnum,
        typeofans: q.typeofans,
        select: q.select,
        multiselect: q.multiselect,
        conditionalRule: q.conditionalRule,
      })),
      photos: validatedPhotos.map((p) => ({
        id: p.id,
        name: p.name,
        mimeType: p.mimeType,
        base64Data: p.base64Data,
        size: p.byteLength,
      })),
      siteName: typeof raw.siteName === 'string' ? raw.siteName.trim() : undefined,
      inspectionDate: typeof raw.inspectionDate === 'string' ? raw.inspectionDate.trim() : undefined,
      siteNotes: typeof raw.siteNotes === 'string' ? raw.siteNotes.trim() : undefined,
      inspectorName: typeof raw.inspectorName === 'string' ? raw.inspectorName.trim() : undefined,
      jobReference: typeof raw.jobReference === 'string' ? raw.jobReference.trim() : undefined,
    },
  };
}

/**
 * Validates and sanitizes the structured JSON returned by Gemini against the
 * selected Quest inspection bank schema, option lists, and conditional display rules.
 * Never fabricates replacement answers.
 */
export function validateGeminiPhotoAnalysisResponse(
  rawResponse: unknown,
  bankQuestions: SiteInspectionQuestion[],
  context: {
    bankId: string;
    bankName: string;
    department: string;
    photoCount: number;
    modelIdentifier: string;
    validPhotoIds?: string[];
  }
): ResponseValidationResult {
  let parsed: unknown = rawResponse;

  if (typeof rawResponse === 'string') {
    const cleaned = rawResponse
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    if (!cleaned) {
      return { valid: false, errors: ['Malformed Gemini response: empty response text'] };
    }
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { valid: false, errors: ['Malformed Gemini response: response is not valid JSON'] };
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, errors: ['Malformed Gemini response: top-level JSON value must be an object'] };
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.evaluations)) {
    return {
      valid: false,
      errors: ['Malformed Gemini response: missing required "evaluations" array'],
    };
  }

  const questionById = new Map<string, SiteInspectionQuestion>();
  for (const q of bankQuestions) {
    questionById.set(q.id, q);
  }

  const errors: string[] = [];
  const seenQuestionIds = new Set<string>();
  const evaluations: QuestionAiEvaluation[] = [];
  const evaluationsMap: Record<string, QuestionAiEvaluation> = {};

  const allowedPhotoIds = context.validPhotoIds ? new Set(context.validPhotoIds) : null;

  for (let i = 0; i < obj.evaluations.length; i++) {
    const rawEv = obj.evaluations[i];
    if (!rawEv || typeof rawEv !== 'object' || Array.isArray(rawEv)) {
      errors.push(`Evaluation at index ${i} must be an object`);
      continue;
    }

    const ev = rawEv as Record<string, unknown>;
    const questionId = typeof ev.questionId === 'string' ? ev.questionId.trim() : '';

    if (!questionId) {
      errors.push(`Evaluation at index ${i} is missing a valid "questionId" string`);
      continue;
    }

    const schemaQuestion = questionById.get(questionId);
    if (!schemaQuestion) {
      errors.push(
        `Invalid questionId "${questionId}": question does not exist in selected inspection bank "${context.bankName}"`
      );
      continue;
    }

    if (seenQuestionIds.has(questionId)) {
      errors.push(`Duplicate questionId "${questionId}" in Gemini response`);
      continue;
    }
    seenQuestionIds.add(questionId);

    // Validate rating: must be '1', '-1', '0', or null
    const rawRating = ev.rating !== undefined ? ev.rating : ev.suggestedRating;
    if (
      rawRating !== '1' &&
      rawRating !== '-1' &&
      rawRating !== '0' &&
      rawRating !== null
    ) {
      errors.push(
        `Invalid rating value ${JSON.stringify(rawRating)} for question "${questionId}". Allowed values: "1", "-1", "0", or null.`
      );
      continue;
    }
    const rating: AiSuggestedRating = rawRating;

    // Validate confidence: must be a finite number between 0 and 1
    const rawConfidence = ev.confidence !== undefined ? ev.confidence : ev.confidenceScore;
    if (
      typeof rawConfidence !== 'number' ||
      !Number.isFinite(rawConfidence) ||
      rawConfidence < 0 ||
      rawConfidence > 1
    ) {
      errors.push(
        `Invalid confidence value ${JSON.stringify(rawConfidence)} for question "${questionId}". Must be a number between 0 and 1.`
      );
      continue;
    }
    const confidence = Number(rawConfidence.toFixed(4));

    // Validate evidenceObserved and reasoning
    const rawEvidence = ev.evidenceObserved !== undefined ? ev.evidenceObserved : ev.evidence;
    if (typeof rawEvidence !== 'string' || !rawEvidence.trim()) {
      errors.push(`Evaluation for "${questionId}" must include a non-empty "evidenceObserved" string`);
      continue;
    }
    const evidenceObserved = rawEvidence.trim();

    if (typeof ev.reasoning !== 'string' || !ev.reasoning.trim()) {
      errors.push(`Evaluation for "${questionId}" must include a non-empty "reasoning" string`);
      continue;
    }
    const reasoning = ev.reasoning.trim();

    // Validate selectAnswer if provided
    let selectAnswer: string | null = null;
    if (ev.selectAnswer !== undefined && ev.selectAnswer !== null) {
      if (typeof ev.selectAnswer !== 'string') {
        errors.push(`Invalid selectAnswer for "${questionId}": must be a string or null`);
        continue;
      }
      const trimmedSelect = ev.selectAnswer.trim();
      if (trimmedSelect) {
        const allowedSelect = getAllowedSelectOptions(schemaQuestion);
        if (allowedSelect.length > 0 && !allowedSelect.includes(trimmedSelect)) {
          errors.push(
            `Invalid selectAnswer "${trimmedSelect}" for question "${questionId}". Must match one of the schema options: ${allowedSelect.join(' | ')}`
          );
          continue;
        }
        selectAnswer = trimmedSelect;
      }
    }

    // Validate multiselectAnswers if provided
    let multiselectAnswers: string[] | null = null;
    if (ev.multiselectAnswers !== undefined && ev.multiselectAnswers !== null) {
      if (!Array.isArray(ev.multiselectAnswers)) {
        errors.push(`Invalid multiselectAnswers for "${questionId}": must be an array of strings or null`);
        continue;
      }
      const allowedMulti = getAllowedMultiSelectOptions(schemaQuestion);
      const selectedList: string[] = [];
      let multiInvalid = false;
      for (const item of ev.multiselectAnswers) {
        if (typeof item !== 'string') {
          errors.push(`Invalid multiselectAnswers element in "${questionId}": must be a string`);
          multiInvalid = true;
          break;
        }
        const trimmedItem = item.trim();
        if (!trimmedItem) continue;
        if (allowedMulti.length > 0 && !allowedMulti.includes(trimmedItem)) {
          errors.push(
            `Invalid multiselect option "${trimmedItem}" for question "${questionId}". Must match schema options: ${allowedMulti.join(' | ')}`
          );
          multiInvalid = true;
          break;
        }
        if (!selectedList.includes(trimmedItem)) {
          selectedList.push(trimmedItem);
        }
      }
      if (multiInvalid) continue;
      multiselectAnswers = selectedList.length > 0 ? selectedList : null;
    }

    const rawNeedsHuman =
      ev.needsHumanVerification !== undefined
        ? ev.needsHumanVerification
        : ev.requiresHumanVerification;

    // If rating is null (and no select/multiselect option was confirmed), human verification is always required
    const hasConfirmedAnswer =
      rating !== null || selectAnswer !== null || (multiselectAnswers !== null && multiselectAnswers.length > 0);
    const needsHumanVerification = !hasConfirmedAnswer ? true : Boolean(rawNeedsHuman);

    const carActionPlan =
      rating === '-1' && typeof ev.carActionPlan === 'string' && ev.carActionPlan.trim()
        ? ev.carActionPlan.trim()
        : null;

    const photoIds = Array.isArray(ev.photoIds)
      ? ev.photoIds
          .filter((p): p is string => typeof p === 'string')
          .filter((p) => (allowedPhotoIds ? allowedPhotoIds.has(p) : true))
      : [];

    const validatedItem: QuestionAiEvaluation = {
      questionId,
      rating,
      suggestedRating: rating ?? '',
      selectAnswer,
      multiselectAnswers,
      confidence,
      confidenceScore: confidence,
      evidenceObserved,
      evidence: evidenceObserved,
      reasoning,
      needsHumanVerification,
      requiresHumanVerification: needsHumanVerification,
      carActionPlan,
      photoIds,
    };

    evaluations.push(validatedItem);
    evaluationsMap[questionId] = validatedItem;
  }

  // Validate conditional question rules across the evaluated answers
  if (errors.length === 0) {
    const answersForConditionalCheck: Record<
      string,
      { selectans?: string; multiselectans?: { txt: string }[]; rating?: string }
    > = {};

    for (const [qId, ev] of Object.entries(evaluationsMap)) {
      answersForConditionalCheck[qId] = {
        rating: ev.rating ?? undefined,
        selectans: ev.selectAnswer ?? undefined,
        multiselectans: ev.multiselectAnswers
          ? ev.multiselectAnswers.map((txt) => ({ txt }))
          : undefined,
      };
    }

    for (const ev of evaluations) {
      const schemaQ = questionById.get(ev.questionId);
      if (!schemaQ?.conditionalRule) continue;

      const isApplicable = evaluateConditionalRule(schemaQ, answersForConditionalCheck);
      const hasActiveAnswer =
        ev.rating !== null ||
        ev.selectAnswer !== null ||
        (ev.multiselectAnswers !== null && ev.multiselectAnswers.length > 0);

      if (!isApplicable && hasActiveAnswer) {
        errors.push(
          `Conditional question "${schemaQ.id}" cannot have an active answer when parent question "${schemaQ.conditionalRule.parentQuestionId}" does not satisfy condition "${schemaQ.conditionalRule.condition}" (${schemaQ.conditionalRule.description}).`
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const allowedRisks: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
  const rawRisk = typeof obj.overallSiteRisk === 'string' ? obj.overallSiteRisk.toLowerCase() : '';
  const overallSiteRisk: SeverityLevel = allowedRisks.includes(rawRisk as SeverityLevel)
    ? (rawRisk as SeverityLevel)
    : evaluations.some((e) => e.rating === '-1')
      ? 'medium'
      : 'low';

  const summary =
    typeof obj.summary === 'string' && obj.summary.trim()
      ? obj.summary.trim()
      : `Evaluated ${evaluations.length} inspection question(s) across ${context.photoCount} site photograph(s).`;

  const recommendations = Array.isArray(obj.recommendations)
    ? obj.recommendations
        .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        .map((r) => r.trim())
    : [];

  const passCount = evaluations.filter((e) => e.rating === '1').length;
  const carCount = evaluations.filter((e) => e.rating === '-1').length;
  const naCount = evaluations.filter((e) => e.rating === '0').length;
  const needsReviewCount = evaluations.filter((e) => e.needsHumanVerification).length;

  return {
    valid: true,
    value: {
      inspectionBankId: context.bankId,
      inspectionBankName: context.bankName,
      bankId: context.bankId,
      bankName: context.bankName,
      department: context.department,
      photoCount: context.photoCount,
      summary,
      overallSiteRisk,
      totalEvaluated: evaluations.length,
      passCount,
      carCount,
      naCount,
      needsReviewCount,
      evaluations,
      evaluationsMap,
      recommendations,
      analyzedAt: new Date().toISOString(),
      modelIdentifier: context.modelIdentifier,
      isMock: false,
      notes:
        'AI-generated inspection suggestions only. Inspector review and confirmation are required before official submission.',
    },
  };
}

