import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectImageMimeFromMagicBytes,
  validateAndDecodePhoto,
  validatePhotoInspectionRequest,
  validateGeminiPhotoAnalysisResponse,
} from './photo-inspection.validator';
import { resolveInspectionBank } from '../../models/quest-bank-registry';

// Minimal genuine binary headers (magic bytes + padding >= 12 bytes) for testing
const VALID_JPEG_BUF = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);
const VALID_PNG_BUF = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const VALID_WEBP_BUF = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);

const VALID_JPEG_DATA_URL = `data:image/jpeg;base64,${VALID_JPEG_BUF.toString('base64')}`;
const VALID_PNG_DATA_URL = `data:image/png;base64,${VALID_PNG_BUF.toString('base64')}`;
const VALID_WEBP_DATA_URL = `data:image/webp;base64,${VALID_WEBP_BUF.toString('base64')}`;

describe('QuestAI Phase 2 – Multimodal Photo Inspection Validation Suite', () => {
  // ---------------------------------------------------------------------------
  // 1. Missing photographs
  // ---------------------------------------------------------------------------
  it('1. rejects requests with missing or empty photographs array', () => {
    const missingPhotos = validatePhotoInspectionRequest({
      bankId: 'civil-other',
    });
    assert.equal(missingPhotos.valid, false);
    assert.ok(missingPhotos.errors.some((e) => e.includes('photos is required')));

    const emptyPhotos = validatePhotoInspectionRequest({
      bankId: 'civil-other',
      photos: [],
    });
    assert.equal(emptyPhotos.valid, false);
    assert.ok(emptyPhotos.errors.some((e) => e.includes('at least one photograph')));

    const tooManyPhotos = validatePhotoInspectionRequest(
      {
        bankId: 'civil-other',
        photos: [
          { id: 'p1', name: '1.jpg', url: VALID_JPEG_DATA_URL },
          { id: 'p2', name: '2.jpg', url: VALID_JPEG_DATA_URL },
          { id: 'p3', name: '3.jpg', url: VALID_JPEG_DATA_URL },
        ],
      },
      { maxPhotos: 2 }
    );
    assert.equal(tooManyPhotos.valid, false);
    assert.ok(tooManyPhotos.errors.some((e) => e.includes('Too many photographs')));
  });

  // ---------------------------------------------------------------------------
  // 2. Invalid image formats (including binary magic-byte inspection)
  // ---------------------------------------------------------------------------
  it('2. validates genuine JPEG/PNG/WEBP magic bytes and rejects disguised or unsupported formats', () => {
    // Genuine magic bytes pass
    assert.equal(detectImageMimeFromMagicBytes(VALID_JPEG_BUF), 'image/jpeg');
    assert.equal(detectImageMimeFromMagicBytes(VALID_PNG_BUF), 'image/png');
    assert.equal(detectImageMimeFromMagicBytes(VALID_WEBP_BUF), 'image/webp');

    const okJpeg = validateAndDecodePhoto({ id: '1', name: 'site.jpg', url: VALID_JPEG_DATA_URL }, 0);
    assert.equal(okJpeg.valid, true);
    const okPng = validateAndDecodePhoto({ id: '2', name: 'site.png', url: VALID_PNG_DATA_URL }, 0);
    assert.equal(okPng.valid, true);
    const okWebp = validateAndDecodePhoto({ id: '3', name: 'site.webp', url: VALID_WEBP_DATA_URL }, 0);
    assert.equal(okWebp.valid, true);

    // Unsupported file extension (.gif, .pdf)
    const gifExt = validateAndDecodePhoto({ id: '4', name: 'anim.gif', url: VALID_JPEG_DATA_URL }, 0);
    assert.equal(gifExt.valid, false);
    assert.ok(gifExt.errors.some((e) => e.includes('unsupported file extension')));

    // Spoofed JPEG: claims image/jpeg and .jpg filename, but binary bytes are ASCII text
    const fakeJpegBytes = Buffer.from('This is plain text pretending to be a JPEG image file!!', 'utf8');
    const spoofedJpeg = validateAndDecodePhoto(
      {
        id: '5',
        name: 'spoofed.jpg',
        url: `data:image/jpeg;base64,${fakeJpegBytes.toString('base64')}`,
      },
      0
    );
    assert.equal(spoofedJpeg.valid, false);
    assert.ok(spoofedJpeg.errors.some((e) => e.includes('failed binary content inspection')));

    // Mismatched MIME header vs actual magic bytes (claims image/png, actually JPEG bytes)
    const mismatchedMime = validateAndDecodePhoto(
      {
        id: '6',
        name: 'mismatch.png',
        url: `data:image/png;base64,${VALID_JPEG_BUF.toString('base64')}`,
      },
      0
    );
    assert.equal(mismatchedMime.valid, false);
    assert.ok(mismatchedMime.errors.some((e) => e.includes('does not match actual binary content')));
  });

  // ---------------------------------------------------------------------------
  // 3. Oversized image uploads
  // ---------------------------------------------------------------------------
  it('3. rejects oversized single images and oversized total photo payloads', () => {
    const bigJpeg = Buffer.concat([VALID_JPEG_BUF, Buffer.alloc(2048, 0)]);
    const singleOversize = validatePhotoInspectionRequest(
      {
        bankId: 'ladder-stepladder',
        photos: [
          {
            id: 'big1',
            name: 'large.jpg',
            url: `data:image/jpeg;base64,${bigJpeg.toString('base64')}`,
          },
        ],
      },
      { maxImageBytes: 512 }
    );
    assert.equal(singleOversize.valid, false);
    assert.ok(singleOversize.errors.some((e) => e.includes('exceeds maximum allowed image size')));

    const totalOversize = validatePhotoInspectionRequest(
      {
        bankId: 'ladder-stepladder',
        photos: [
          {
            id: 'p1',
            name: '1.jpg',
            url: `data:image/jpeg;base64,${bigJpeg.toString('base64')}`,
          },
          {
            id: 'p2',
            name: '2.jpg',
            url: `data:image/jpeg;base64,${bigJpeg.toString('base64')}`,
          },
        ],
      },
      { maxImageBytes: 4096, maxTotalBytes: 3000 }
    );
    assert.equal(totalOversize.valid, false);
    assert.ok(totalOversize.errors.some((e) => e.includes('Total uploaded photographs size')));
  });

  // ---------------------------------------------------------------------------
  // 4. Missing or invalid bank ID
  // ---------------------------------------------------------------------------
  it('4. rejects missing or unknown inspection bank IDs', () => {
    const missingBank = validatePhotoInspectionRequest({
      photos: [{ id: 'p1', name: '1.jpg', url: VALID_JPEG_DATA_URL }],
    });
    assert.equal(missingBank.valid, false);
    assert.ok(missingBank.errors.some((e) => e.includes('bankId is required')));

    const unknownBank = validatePhotoInspectionRequest({
      bankId: 'non-existent-department-999',
      photos: [{ id: 'p1', name: '1.jpg', url: VALID_JPEG_DATA_URL }],
    });
    assert.equal(unknownBank.valid, false);
    assert.ok(unknownBank.errors.some((e) => e.includes('Invalid or unknown inspection bank')));
  });

  // ---------------------------------------------------------------------------
  // 5. Invalid question IDs & questions from unrelated banks
  // ---------------------------------------------------------------------------
  it('5. rejects invalid question IDs and questions belonging to unrelated banks in both request and response', () => {
    // Request with a Road Surfacing question ID submitted against Ladder/Stepladder bank
    const unrelatedInReq = validatePhotoInspectionRequest({
      bankId: 'ladder-stepladder',
      questions: [{ id: 'Setting up work environment_1', qtext: 'Road Surfacing question' }],
      photos: [{ id: 'p1', name: '1.jpg', url: VALID_JPEG_DATA_URL }],
    });
    assert.equal(unrelatedInReq.valid, false);
    assert.ok(
      unrelatedInReq.errors.some((e) =>
        e.includes('Question ID "Setting up work environment_1" does not belong to the selected inspection bank')
      )
    );

    // Response with an unknown/unrelated questionId
    const ladderBank = resolveInspectionBank('ladder-stepladder')!;
    const unrelatedInRes = validateGeminiPhotoAnalysisResponse(
      {
        summary: 'Test summary',
        overallSiteRisk: 'low',
        evaluations: [
          {
            questionId: 'TM/ Branding_01', // belongs to Civil/Street Lighting, not Ladder/Stepladder
            rating: '1',
            confidence: 0.9,
            evidenceObserved: 'Visible sign',
            reasoning: 'Compliant',
            needsHumanVerification: false,
            carActionPlan: null,
          },
        ],
        recommendations: [],
      },
      ladderBank.questions,
      {
        bankId: ladderBank.bankId,
        bankName: ladderBank.bankName,
        department: ladderBank.department,
        photoCount: 1,
        modelIdentifier: 'gemini-3.8-flash',
      }
    );
    assert.equal(unrelatedInRes.valid, false);
    assert.ok(unrelatedInRes.errors.some((e) => e.includes('Invalid questionId "TM/ Branding_01"')));
  });

  // ---------------------------------------------------------------------------
  // 6. Invalid rating values
  // ---------------------------------------------------------------------------
  it('6. rejects invalid rating values and accepts only "1", "-1", "0", or null', () => {
    const ladderBank = resolveInspectionBank('ladder-stepladder')!;
    const firstQ = ladderBank.questions[0];

    for (const badRating of ['2', 'pass', 'Yes', '', 1, true]) {
      const check = validateGeminiPhotoAnalysisResponse(
        {
          summary: 'Test',
          overallSiteRisk: 'low',
          evaluations: [
            {
              questionId: firstQ.id,
              rating: badRating,
              confidence: 0.85,
              evidenceObserved: 'Observed',
              reasoning: 'Reason',
              needsHumanVerification: false,
              carActionPlan: null,
            },
          ],
          recommendations: [],
        },
        ladderBank.questions,
        {
          bankId: ladderBank.bankId,
          bankName: ladderBank.bankName,
          department: ladderBank.department,
          photoCount: 1,
          modelIdentifier: 'gemini-3.8-flash',
        }
      );
      assert.equal(check.valid, false, `Expected rating ${JSON.stringify(badRating)} to be rejected`);
      assert.ok(check.errors.some((e) => e.includes('Invalid rating value')));
    }

    // Valid ratings ('1', '-1', '0', null) succeed, and null enforces needsHumanVerification=true
    const validNullCheck = validateGeminiPhotoAnalysisResponse(
      {
        summary: 'Test',
        overallSiteRisk: 'low',
        evaluations: [
          {
            questionId: firstQ.id,
            rating: null,
            confidence: 0.25,
            evidenceObserved: 'Tag not visible in photograph',
            reasoning: 'Requires physical check by inspector',
            needsHumanVerification: false, // validator must enforce true when rating is null
            carActionPlan: null,
          },
        ],
        recommendations: [],
      },
      ladderBank.questions,
      {
        bankId: ladderBank.bankId,
        bankName: ladderBank.bankName,
        department: ladderBank.department,
        photoCount: 1,
        modelIdentifier: 'gemini-3.8-flash',
      }
    );
    assert.equal(validNullCheck.valid, true);
    assert.equal(validNullCheck.value.evaluations[0].rating, null);
    assert.equal(validNullCheck.value.evaluations[0].needsHumanVerification, true);
  });

  // ---------------------------------------------------------------------------
  // 7. Duplicate question IDs
  // ---------------------------------------------------------------------------
  it('7. rejects duplicate question IDs in both request and Gemini response', () => {
    const ladderBank = resolveInspectionBank('ladder-stepladder')!;
    const qId = ladderBank.questions[0].id;

    const dupReq = validatePhotoInspectionRequest({
      bankId: 'ladder-stepladder',
      questions: [
        { id: qId, qtext: 'First' },
        { id: qId, qtext: 'Duplicate' },
      ],
      photos: [{ id: 'p1', name: '1.jpg', url: VALID_JPEG_DATA_URL }],
    });
    assert.equal(dupReq.valid, false);
    assert.ok(dupReq.errors.some((e) => e.includes('Duplicate question ID')));

    const dupRes = validateGeminiPhotoAnalysisResponse(
      {
        summary: 'Test',
        overallSiteRisk: 'low',
        evaluations: [
          {
            questionId: qId,
            rating: '1',
            confidence: 0.9,
            evidenceObserved: 'First observation',
            reasoning: 'First reasoning',
            needsHumanVerification: false,
            carActionPlan: null,
          },
          {
            questionId: qId,
            rating: '-1',
            confidence: 0.8,
            evidenceObserved: 'Second observation',
            reasoning: 'Second reasoning',
            needsHumanVerification: false,
            carActionPlan: 'Fix',
          },
        ],
        recommendations: [],
      },
      ladderBank.questions,
      {
        bankId: ladderBank.bankId,
        bankName: ladderBank.bankName,
        department: ladderBank.department,
        photoCount: 1,
        modelIdentifier: 'gemini-3.8-flash',
      }
    );
    assert.equal(dupRes.valid, false);
    assert.ok(dupRes.errors.some((e) => e.includes('Duplicate questionId')));
  });

  // ---------------------------------------------------------------------------
  // 8. Invalid confidence values
  // ---------------------------------------------------------------------------
  it('8. rejects confidence scores outside [0, 1] or non-numeric values', () => {
    const ladderBank = resolveInspectionBank('ladder-stepladder')!;
    const qId = ladderBank.questions[0].id;

    for (const badConf of [-0.01, 1.05, NaN, Infinity, '0.9', null]) {
      const res = validateGeminiPhotoAnalysisResponse(
        {
          summary: 'Test',
          overallSiteRisk: 'low',
          evaluations: [
            {
              questionId: qId,
              rating: '1',
              confidence: badConf,
              evidenceObserved: 'Visible',
              reasoning: 'Good',
              needsHumanVerification: false,
              carActionPlan: null,
            },
          ],
          recommendations: [],
        },
        ladderBank.questions,
        {
          bankId: ladderBank.bankId,
          bankName: ladderBank.bankName,
          department: ladderBank.department,
          photoCount: 1,
          modelIdentifier: 'gemini-3.8-flash',
        }
      );
      assert.equal(res.valid, false, `Expected confidence ${String(badConf)} to be rejected`);
      assert.ok(res.errors.some((e) => e.includes('Invalid confidence value')));
    }
  });

  // ---------------------------------------------------------------------------
  // 9. Malformed Gemini response
  // ---------------------------------------------------------------------------
  it('9. handles malformed Gemini responses gracefully without fabricating replacement answers', () => {
    const ladderBank = resolveInspectionBank('ladder-stepladder')!;
    const ctx = {
      bankId: ladderBank.bankId,
      bankName: ladderBank.bankName,
      department: ladderBank.department,
      photoCount: 1,
      modelIdentifier: 'gemini-3.8-flash',
    };

    const nonJson = validateGeminiPhotoAnalysisResponse('Not valid JSON {', ladderBank.questions, ctx);
    assert.equal(nonJson.valid, false);
    assert.ok(nonJson.errors.some((e) => e.includes('not valid JSON')));

    const missingEvaluations = validateGeminiPhotoAnalysisResponse(
      JSON.stringify({ summary: 'Missing evaluations array' }),
      ladderBank.questions,
      ctx
    );
    assert.equal(missingEvaluations.valid, false);
    assert.ok(missingEvaluations.errors.some((e) => e.includes('missing required "evaluations" array')));

    // Partial evaluations list does NOT fabricate missing questions
    const singleQ = ladderBank.questions[0];
    const partialValid = validateGeminiPhotoAnalysisResponse(
      {
        summary: 'Only one question evaluated',
        overallSiteRisk: 'low',
        evaluations: [
          {
            questionId: singleQ.id,
            rating: '1',
            confidence: 0.91,
            evidenceObserved: 'Ladder stiles intact',
            reasoning: 'Stiles straight with no dents',
            needsHumanVerification: false,
            carActionPlan: null,
          },
        ],
        recommendations: [],
      },
      ladderBank.questions,
      ctx
    );
    assert.equal(partialValid.valid, true);
    assert.equal(partialValid.value.evaluations.length, 1);
  });

  // ---------------------------------------------------------------------------
  // 10. Conditional question & select/multiselect option validation
  // ---------------------------------------------------------------------------
  it('10. validates select/multiselect options and enforces conditional question rules', () => {
    const surfacingBank = resolveInspectionBank('road-surfacing')!;
    const ctx = {
      bankId: surfacingBank.bankId,
      bankName: surfacingBank.bankName,
      department: surfacingBank.department,
      photoCount: 1,
      modelIdentifier: 'gemini-3.8-flash',
    };

    // A) Invalid select option on "Task Specific Risks_18" (allowed: ["Yes", "No"])
    const badSelect = validateGeminiPhotoAnalysisResponse(
      {
        summary: 'Test',
        overallSiteRisk: 'low',
        evaluations: [
          {
            questionId: 'Task Specific Risks_18',
            rating: '1',
            selectAnswer: 'Maybe Later', // Not in ["Yes", "No"]
            confidence: 0.8,
            evidenceObserved: 'Workers seen',
            reasoning: 'Test',
            needsHumanVerification: false,
            carActionPlan: null,
          },
        ],
        recommendations: [],
      },
      surfacingBank.questions,
      ctx
    );
    assert.equal(badSelect.valid, false);
    assert.ok(badSelect.errors.some((e) => e.includes('Invalid selectAnswer "Maybe Later"')));

    // B) Conditional rule violation: "Task Specific Risks_18 a" is only applicable when
    //    parent "Task Specific Risks_18" selectAnswer === "No".
    //    When parent is "Yes", an active answer on "Task Specific Risks_18 a" must be rejected.
    const violatedConditional = validateGeminiPhotoAnalysisResponse(
      {
        summary: 'Test',
        overallSiteRisk: 'low',
        evaluations: [
          {
            questionId: 'Task Specific Risks_18',
            rating: '1',
            selectAnswer: 'Yes',
            confidence: 0.9,
            evidenceObserved: 'All operatives wearing safety glasses',
            reasoning: 'Compliant',
            needsHumanVerification: false,
            carActionPlan: null,
          },
          {
            questionId: 'Task Specific Risks_18 a',
            rating: '1',
            multiselectAnswers: ['Eye protection to be worn when cutting/ breaking'],
            confidence: 0.8,
            evidenceObserved: 'Should not be answered when Q18 is Yes',
            reasoning: 'Conditional violation',
            needsHumanVerification: false,
            carActionPlan: null,
          },
        ],
        recommendations: [],
      },
      surfacingBank.questions,
      ctx
    );
    assert.equal(violatedConditional.valid, false);
    assert.ok(
      violatedConditional.errors.some((e) =>
        e.includes('Conditional question "Task Specific Risks_18 a" cannot have an active answer')
      )
    );

    // C) Conditional rule satisfied: when parent "Task Specific Risks_18" is "No",
    //    answering "Task Specific Risks_18 a" with a valid schema multiselect option succeeds.
    const satisfiedConditional = validateGeminiPhotoAnalysisResponse(
      {
        summary: 'Test',
        overallSiteRisk: 'medium',
        evaluations: [
          {
            questionId: 'Task Specific Risks_18',
            rating: '-1',
            selectAnswer: 'No',
            confidence: 0.92,
            evidenceObserved: 'Operative raking asphalt without safety glasses',
            reasoning: 'Eye protection not worn',
            needsHumanVerification: false,
            carActionPlan: 'Remind operative to wear eye protection when cutting/breaking',
          },
          {
            questionId: 'Task Specific Risks_18 a',
            rating: null,
            multiselectAnswers: ['Eye protection not worn no risk of eye injury whilst raking/ laying blacktop'],
            confidence: 0.85,
            evidenceObserved: 'Operative raking blacktop only',
            reasoning: 'Matches schema option for raking/laying blacktop',
            needsHumanVerification: true,
            carActionPlan: null,
          },
        ],
        recommendations: [],
      },
      surfacingBank.questions,
      ctx
    );
    assert.equal(satisfiedConditional.valid, true);
  });
});

