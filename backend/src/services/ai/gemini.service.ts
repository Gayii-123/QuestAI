import { GoogleGenAI, Part, Type, createPartFromBase64 } from '@google/genai';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import {
  IAIService,
  AIServiceStatus,
  AIConnectionState,
  SiteInspectionAnalysisRequest,
  SiteInspectionAnalysisResult,
  InspectionFinding,
  PhotoInspectionRequest,
  PhotoInspectionResult,
  TextGenerationResult,
} from './ai.interface';
import {
  validatePhotoInspectionRequest,
  validateGeminiPhotoAnalysisResponse,
} from './photo-inspection.validator';
import {
  SiteInspectionQuestion,
  getAllowedSelectOptions,
  getAllowedMultiSelectOptions,
} from '../../models/quest-bank-registry';

/** Error raised for Gemini failures; carries a machine-readable state and a safe HTTP status. */
export class AIServiceError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    public readonly state: AIConnectionState,
    details?: unknown
  ) {
    super(message, statusCode, details);
    this.name = 'AIServiceError';
  }
}

const PROVIDER = 'Google Cloud Agent Platform (Vertex AI, API-key Express mode)';
const REQUEST_TIMEOUT_MS = 90_000;
const VERIFY_TTL_MS = 10 * 60 * 1000; // re-verify a healthy connection at most every 10 minutes
const FAILURE_TTL_MS = 60 * 1000; // re-try a failed verification at most once a minute

const MULTIMODAL_SYSTEM_INSTRUCTION = `You are QuestAI, an expert UK highways and civil engineering health, safety, and compliance site-inspection assistant for Marlborough Highways.
Your role is to examine uploaded site photographs and suggest evidence-based answers for the official Quest Site Inspection checklist.

MANDATORY ANALYSIS RULES:
1. Examine every uploaded photograph carefully and identify only genuinely visible site conditions, equipment, signage, barriers, PPE, and hazards.
2. Compare the visible evidence against each supplied Quest inspection question using its exact composite questionId.
3. Rating conventions (use ONLY these exact values):
   - "1"  = Pass / Compliant: Visible photographic evidence clearly demonstrates compliance with the question requirement.
   - "-1" = CAR Required / Non-compliant: Visible photographic evidence clearly shows a safety hazard, defect, or non-compliance. Provide a specific, actionable "carActionPlan".
   - "0"  = Not Applicable: The photographs clearly show the activity or equipment is not applicable to the work scope. NEVER assign "0" merely because something is not visible in the frame.
   - null = Insufficient evidence / Requires human verification: The photographs do not show enough information to confirm compliance or non-compliance (e.g., paperwork, permits to dig, daily inspection records, calibration certificates, briefings, or areas outside the camera frame).
4. NEVER automatically assign a CAR ("-1") based on an uncertain or ambiguous observation.
5. NEVER invent, assume, or extrapolate details that are not visible in the photographs.
6. Whenever rating is null or evidence is partial/ambiguous, set "needsHumanVerification" to true.
7. Confidence must be a number between 0.0 and 1.0 reflecting visual certainty.
8. For questions with "select" options, "selectAnswer" must either be null (if unverifiable) or match one of the question's exact allowed option strings.
9. For questions with "multiselect" options, "multiselectAnswers" must either be null (if unverifiable) or an array containing only exact allowed option strings for that question.
10. For conditional questions (marked with CONDITIONAL RULE), if the parent question's evaluated answer does NOT satisfy the stated condition, you MUST set rating: null, selectAnswer: null, multiselectAnswers: null, and needsHumanVerification: false.`;

const PHOTO_ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ['summary', 'overallSiteRisk', 'evaluations', 'recommendations'],
  properties: {
    summary: {
      type: Type.STRING,
      description: 'Concise factual summary of the visual conditions observed across the uploaded site photographs.',
    },
    overallSiteRisk: {
      type: Type.STRING,
      enum: ['low', 'medium', 'high', 'critical'],
      description: 'Overall risk level based on visible site conditions.',
    },
    evaluations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          'questionId',
          'rating',
          'confidence',
          'evidenceObserved',
          'reasoning',
          'needsHumanVerification',
          'carActionPlan',
        ],
        properties: {
          questionId: {
            type: Type.STRING,
            description: 'Exact composite question ID from the supplied checklist.',
          },
          rating: {
            type: Type.STRING,
            nullable: true,
            enum: ['1', '-1', '0'],
            description: '"1" (Pass), "-1" (CAR Required), "0" (Not Applicable), or null (Insufficient evidence / Needs human verification).',
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Visual confidence score between 0.0 and 1.0.',
          },
          evidenceObserved: {
            type: Type.STRING,
            description: 'Factual description of what is (or is not) visible in the photographs relevant to this question.',
          },
          reasoning: {
            type: Type.STRING,
            description: 'Explanation of how the visual evidence supports the suggested rating or why human verification is required.',
          },
          needsHumanVerification: {
            type: Type.BOOLEAN,
            description: 'True whenever rating is null or human verification on site is needed.',
          },
          carActionPlan: {
            type: Type.STRING,
            nullable: true,
            description: 'Concrete corrective action required when rating is "-1"; otherwise null.',
          },
          selectAnswer: {
            type: Type.STRING,
            nullable: true,
            description: 'For select questions only: exact option string from the question schema, or null if unverifiable.',
          },
          multiselectAnswers: {
            type: Type.ARRAY,
            nullable: true,
            items: { type: Type.STRING },
            description: 'For multiselect questions only: array of exact option strings from the question schema, or null.',
          },
          photoIds: {
            type: Type.ARRAY,
            nullable: true,
            items: { type: Type.STRING },
            description: 'IDs of the uploaded photographs that provide evidence for this evaluation.',
          },
        },
      },
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Practical safety and compliance recommendations based on visible site conditions.',
    },
  },
};

interface VerificationCache {
  state: AIConnectionState;
  error: string | null;
  at: number;
}

export class GeminiAIService implements IAIService {
  private client: GoogleGenAI | null = null;
  private clientError: string | null = null;
  private verification: VerificationCache | null = null;
  private verifying: Promise<void> | null = null;

  // ---------------------------------------------------------------------------
  // Client initialisation (Vertex AI / Agent Platform, API-key Express mode)
  // ---------------------------------------------------------------------------
  private getClient(): GoogleGenAI {
    if (!env.IS_GEMINI_CONFIGURED || !env.GEMINI_API_KEY || !env.GEMINI_MODEL) {
      throw new AIServiceError(
        `Gemini is not configured. Missing: ${env.GEMINI_MISSING_VARS.join(', ')}.`,
        503,
        'not_configured'
      );
    }
    if (!this.client) {
      try {
        this.client = new GoogleGenAI({
          vertexai: true,
          apiKey: env.GEMINI_API_KEY,
          httpOptions: { timeout: REQUEST_TIMEOUT_MS },
        });
        this.clientError = null;
      } catch (err) {
        this.clientError = (err as Error).message?.slice(0, 200) || 'SDK initialisation failed';
        throw new AIServiceError(`Gemini SDK could not be initialised: ${this.clientError}`, 500, 'configured');
      }
    }
    return this.client;
  }

  // ---------------------------------------------------------------------------
  // Real text generation (Phase 1)
  // ---------------------------------------------------------------------------
  public async generateText(prompt: string): Promise<TextGenerationResult> {
    const client = this.getClient();
    const model = env.GEMINI_MODEL as string;
    const started = Date.now();

    const systemInstruction = [
      'You are QuestAI, a clean, friendly, and concise conversational AI assistant.',
      'Follow these strict conversational rules:',
      '1. For greetings (such as "Hi", "Hello", "Hey", "Hii") or casual check-ins ("How are you?"), reply with ONE short, natural conversational sentence (for example: "Hi! How can I help you today?" or "Hello! What can I help you with?").',
      '2. Do NOT introduce all QuestAI features, question counts, or category lists during greetings or ordinary chat.',
      '3. For general or safety-related questions, provide clear, concise, helpful answers like ChatGPT.',
      '4. ONLY when the user explicitly asks to fill, start, open, or complete a site inspection form or checklist, respond with the single sentence: "Sure! Which inspection form would you like to fill?" Do not list the categories in text because the UI displays interactive category chips automatically.',
    ].join('\n');

    let response;
    try {
      response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
        },
      });
    } catch (err) {
      const mapped = this.mapError(err);
      this.recordVerification(mapped.state, mapped.message);
      throw mapped;
    }

    const text = response.text?.trim();
    if (!text) {
      const reason = response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason;
      throw new AIServiceError(
        `Gemini returned an empty response${reason ? ` (${reason})` : ''}.`,
        502,
        'configured'
      );
    }

    this.recordVerification('connected', null);
    return { text, model, generatedAt: new Date().toISOString(), latencyMs: Date.now() - started };
  }

  // ---------------------------------------------------------------------------
  // Status / controlled verification (cached - the status endpoint is safe to poll)
  // ---------------------------------------------------------------------------
  public async getStatus(options: { forceVerify?: boolean } = {}): Promise<AIServiceStatus> {
    if (!env.IS_GEMINI_CONFIGURED) {
      return this.buildStatus('not_configured', null, false);
    }

    let sdkInitialized = this.client !== null;
    try {
      this.getClient();
      sdkInitialized = true;
    } catch {
      sdkInitialized = false;
    }

    const cache = this.verification;
    const ttl = cache?.state === 'connected' ? VERIFY_TTL_MS : FAILURE_TTL_MS;
    const stale = !cache || Date.now() - cache.at >= ttl;

    if (sdkInitialized && options.forceVerify && stale) {
      await this.verifyConnection();
    }

    const v = this.verification;
    if (!sdkInitialized) return this.buildStatus('configured', this.clientError, false);
    return v ? this.buildStatus(v.state, v.error, true, v.at) : this.buildStatus('configured', null, true);
  }

  /** Performs one tiny real request, de-duplicated across concurrent callers. */
  private async verifyConnection(): Promise<void> {
    if (!this.verifying) {
      this.verifying = (async () => {
        try {
          await this.generateText('Reply with exactly the single word: pong');
        } catch {
          /* state already recorded by generateText */
        } finally {
          this.verifying = null;
        }
      })();
    }
    await this.verifying;
  }

  private recordVerification(state: AIConnectionState, error: string | null): void {
    this.verification = { state, error, at: Date.now() };
  }

  private buildStatus(
    state: AIConnectionState,
    error: string | null,
    sdkInitialized: boolean,
    verifiedAt?: number
  ): AIServiceStatus {
    const connected = state === 'connected';
    const notes: Record<AIConnectionState, string> = {
      not_configured: `Missing configuration: ${env.GEMINI_MISSING_VARS.join(', ')}. Set them in backend/.env.`,
      configured:
        'Configuration present and SDK ready. Connection has not been verified yet - call GET /api/ai/status?verify=true.',
      connected: 'A real Gemini request succeeded. Connection verified.',
      auth_error: 'Gemini rejected the credentials (invalid API key or missing permission).',
      model_not_found: 'The configured model was not found or is not available on this endpoint.',
      quota_exceeded: 'Gemini quota or rate limit reached.',
      unreachable: 'Gemini could not be reached (network error, timeout or service unavailable).',
    };
    return {
      provider: PROVIDER,
      serviceName: 'Google Gemini Site Inspection Service',
      configured: env.IS_GEMINI_CONFIGURED,
      sdkInitialized,
      connectionVerified: connected,
      model: env.GEMINI_MODEL ?? null,
      status: state,
      missingConfig: env.GEMINI_MISSING_VARS,
      lastVerifiedAt: verifiedAt ? new Date(verifiedAt).toISOString() : null,
      lastError: connected ? null : error,
      notes: notes[state],
      version: '3.0.0',
      ready: connected,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /api/ai/inspect - text-based inspection analysis
  // ---------------------------------------------------------------------------
  public async analyzeInspection(
    request: SiteInspectionAnalysisRequest
  ): Promise<SiteInspectionAnalysisResult> {
    const prompt =
      'You are a UK highways construction health and safety assistant. Based ONLY on the text below, write a concise safety review. ' +
      'Do not invent facts that are not in the text.\n' +
      `Site: ${request.siteName}\nNotes: ${request.notes || 'none'}\n\n` +
      'Respond with JSON only: {"summary": string, "overallRiskLevel": "low"|"medium"|"high"|"critical", ' +
      '"findings": [{"category": "safety"|"structural"|"finish"|"compliance"|"other", "severity": "low"|"medium"|"high"|"critical", ' +
      '"title": string, "description": string, "location": string, "recommendation": string, "confidenceScore": number}]}';

    const result = await this.generateText(prompt);
    const parsed = parseJsonLoose(result.text);

    const findings: InspectionFinding[] = (Array.isArray(parsed.findings) ? parsed.findings : []).map(
      (f: any, i: number) => ({
        id: `finding-${i + 1}`,
        category: f.category || 'other',
        severity: f.severity || 'low',
        title: String(f.title || 'Finding'),
        description: String(f.description || ''),
        location: f.location ? String(f.location) : undefined,
        recommendation: String(f.recommendation || ''),
        confidenceScore: Number.isFinite(Number(f.confidenceScore))
          ? Math.min(1, Math.max(0, Number(f.confidenceScore)))
          : 0.5,
      })
    );

    return {
      inspectionId: request.inspectionId,
      summary: String(parsed.summary || ''),
      overallRiskLevel: parsed.overallRiskLevel || 'low',
      findings,
      analyzedAt: result.generatedAt,
      modelIdentifier: result.model,
      isMock: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Real Gemini Multimodal Site Photograph Analysis (POST /api/ai/inspect-photos)
  // ---------------------------------------------------------------------------
  public async analyzeInspectionPhotos(
    request: PhotoInspectionRequest
  ): Promise<PhotoInspectionResult> {
    // 1. Validate request payload, bankId, question IDs, and binary image magic bytes
    const validation = validatePhotoInspectionRequest(request);
    if (!validation.valid) {
      throw new AppError('Invalid photo inspection request', 400, validation.errors);
    }

    const { value: validatedReq, canonicalQuestions, validatedPhotos } = validation;
    const client = this.getClient();
    const model = env.GEMINI_MODEL as string;

    // 2. Build multimodal contents parts (in-memory only; released after request)
    const parts: Part[] = [];
    for (let i = 0; i < validatedPhotos.length; i++) {
      const photo = validatedPhotos[i];
      parts.push({
        text: `Site Photograph #${i + 1} [id="${photo.id}", name="${photo.name}"]:`,
      });
      parts.push(createPartFromBase64(photo.base64Data, photo.mimeType));
    }

    const promptText = this.buildMultimodalInspectionPrompt(validatedReq, canonicalQuestions);
    parts.push({ text: promptText });

    let rawText: string | undefined;
    try {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: MULTIMODAL_SYSTEM_INSTRUCTION,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: PHOTO_ANALYSIS_RESPONSE_SCHEMA,
        },
      });

      rawText = response.text?.trim();
      if (!rawText) {
        const reason =
          response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason;
        throw new AIServiceError(
          `Gemini returned an empty multimodal response${reason ? ` (${reason})` : ''}.`,
          502,
          'configured'
        );
      }
      this.recordVerification('connected', null);
    } catch (err) {
      const mapped = this.mapError(err);
      this.recordVerification(mapped.state, mapped.message);
      throw mapped;
    } finally {
      // Clear references to base64 image buffers so memory is released immediately
      parts.length = 0;
      for (const p of validatedPhotos) {
        p.base64Data = '';
      }
    }

    // 3. Strictly validate Gemini's structured JSON against the Quest bank schema
    const responseCheck = validateGeminiPhotoAnalysisResponse(rawText, canonicalQuestions, {
      bankId: validatedReq.bankId,
      bankName: validatedReq.bankName,
      department: validatedReq.department,
      photoCount: validatedPhotos.length,
      modelIdentifier: model,
      validPhotoIds: validatedPhotos.map((p) => p.id),
    });

    if (!responseCheck.valid) {
      throw new AIServiceError(
        `Gemini returned a response that failed schema validation: ${responseCheck.errors.join('; ')}`,
        502,
        'configured',
        responseCheck.errors
      );
    }

    return responseCheck.value;
  }

  /**
   * Formats the selected Quest inspection bank questions (preserving composite IDs,
   * exact question text, select/multiselect option lists, and conditional rules).
   */
  private buildMultimodalInspectionPrompt(
    request: PhotoInspectionRequest,
    questions: SiteInspectionQuestion[]
  ): string {
    const metaLines: string[] = [
      `Inspection Bank ID: ${request.bankId}`,
      `Inspection Bank Name: ${request.bankName}`,
      `Department: ${request.department}`,
    ];
    if (request.trafficSubtype) metaLines.push(`Traffic Subtype: ${request.trafficSubtype}`);
    if (request.siteName) metaLines.push(`Site Name: ${request.siteName}`);
    if (request.inspectionDate) metaLines.push(`Inspection Date: ${request.inspectionDate}`);
    if (request.siteNotes) metaLines.push(`Inspector Site Notes: ${request.siteNotes}`);

    const formattedQuestions = questions
      .map((q, idx) => {
        const details: string[] = [
          `${idx + 1}. questionId="${q.id}" [Section: "${q.headername}", Q#${q.qnum}]`,
          `   Question: ${q.qtext}`,
        ];
        if (q.cm && q.cm.trim()) {
          details.push(`   Guidance: ${q.cm.trim()}`);
        }
        const selectOpts = getAllowedSelectOptions(q);
        if (selectOpts.length > 0) {
          details.push(
            `   Input Type: select | Allowed selectAnswer options (MUST match exact string or be null): ${JSON.stringify(selectOpts)}`
          );
        }
        const multiOpts = getAllowedMultiSelectOptions(q);
        if (multiOpts.length > 0) {
          details.push(
            `   Input Type: multiselect | Allowed multiselectAnswers options (MUST match exact strings or be null): ${JSON.stringify(multiOpts)}`
          );
        }
        if (q.conditionalRule) {
          details.push(
            `   CONDITIONAL RULE: Depends on parentQuestionId="${q.conditionalRule.parentQuestionId}" (${q.conditionalRule.description}). If the parent question does NOT satisfy this condition, set rating=null, selectAnswer=null, multiselectAnswers=null, and needsHumanVerification=false.`
          );
        }
        return details.join('\n');
      })
      .join('\n\n');

    return (
      `Analyse the ${request.photos.length} uploaded site photograph(s) against the following official Quest Site Inspection questions.\n\n` +
      `${metaLines.join('\n')}\n\n` +
      `OFFICIAL QUEST QUESTIONS TO EVALUATE (${questions.length} questions):\n` +
      `${formattedQuestions}\n\n` +
      `Return a single JSON object conforming to the response schema. Do not invent unseen evidence; mark unverifiable questions with rating: null and needsHumanVerification: true.`
    );
  }

  // ---------------------------------------------------------------------------
  // Error mapping (never includes the API key or image/request content)
  // ---------------------------------------------------------------------------
  private mapError(err: unknown): AIServiceError {
    if (err instanceof AIServiceError) return err;
    const e = err as { status?: number; message?: string; name?: string; code?: string };
    const status = typeof e?.status === 'number' ? e.status : undefined;
    const rawMsg = String(e?.message || '');
    const msg = extractMessage(rawMsg);
    const lower = rawMsg.toLowerCase();

    if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
      return new AIServiceError(
        'Gemini quota or rate limit reached. Please try again later.',
        429,
        'quota_exceeded'
      );
    }
    if (
      status === 401 ||
      status === 403 ||
      lower.includes('api key not valid') ||
      lower.includes('api_key_invalid') ||
      lower.includes('permission_denied') ||
      lower.includes('unauthenticated')
    ) {
      return new AIServiceError(`Gemini authentication/permission error: ${msg}`, 502, 'auth_error');
    }
    if (status === 404 || lower.includes('not_found') || lower.includes('model not found')) {
      return new AIServiceError(
        `Gemini model "${env.GEMINI_MODEL}" was not found or is unavailable: ${msg}`,
        502,
        'model_not_found'
      );
    }
    if (status === 400) {
      return new AIServiceError(`Gemini rejected the request: ${msg}`, 502, 'configured');
    }
    if (status === 500 || status === 502 || status === 503 || status === 504) {
      return new AIServiceError('Gemini service is temporarily unavailable.', 503, 'unreachable');
    }
    if (e?.name === 'AbortError' || lower.includes('timeout') || lower.includes('timed out')) {
      return new AIServiceError('Gemini request timed out.', 504, 'unreachable');
    }
    return new AIServiceError('Could not reach the Gemini service.', 502, 'unreachable');
  }
}

// --- helpers ---------------------------------------------------------------

function extractMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return String(parsed?.error?.message || 'Unknown error').slice(0, 300);
  } catch {
    return raw.replace(/key=[^&\s"]+/gi, 'key=***').slice(0, 300) || 'Unknown error';
  }
}

function parseJsonLoose(text: string): any {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AIServiceError('Gemini returned a response that was not valid JSON.', 502, 'configured');
  }
}

export const aiService: IAIService = new GeminiAIService();
