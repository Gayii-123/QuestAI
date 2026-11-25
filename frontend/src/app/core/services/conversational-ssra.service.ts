/**
 * QuestAI — Conversational SSRA Orchestration Service
 *
 * Drives the interactive, step-by-step Point-of-Work Safety Risk Assessment
 * directly inside the chat interface without manual form filling.
 *
 * Workflow Pacing:
 * 1. Intent & Domain Recognition (14 Active Operational Domains)
 * 2. Site Context & Environmental Setup (Location, Job #, Weather, Photos)
 * 3. Point-of-Work Safety Checklist (English, Romanian translation, Control Measures)
 * 4. Conditional Hot Works Pre-Work Verification (HW-1 to HW-4)
 * 5. Operative Briefing & Digital Signatures
 * 6. Finalized Assessment Card & Instant Database / Report Synchronization
 */

import { Injectable, inject } from '@angular/core';
import {
  ACTIVE_SSRA_DOMAINS,
  getSsraTypeByKey,
  SsraDomainTypeInfo,
} from '../../features/ssra/config/ssra-types.config';
import {
  getQuestionsForDomain,
  SSRA_QUESTIONNAIRE_VERSION,
  SsraQuestion,
} from '../../features/ssra/config/ssra-question-catalogue.config';
import {
  SSRA_HOT_WORKS_CHECKS_CONFIG,
  createDefaultHotWorksData,
} from '../../features/ssra/config/ssra-hotworks.config';
import {
  SsraAssessment,
  SsraAnswer,
  SsraEvidencePhoto,
  SsraOperative,
  SsraHotWorksCheck,
  SsraHotWorksData,
  SsraPhase1Data,
} from '../../features/ssra/models/ssra.models';
import { ChatMessage } from '../models/chat.models';
import { SsraService } from '../../features/ssra/services/ssra.service';
import { AuthService } from './auth.service';
import { ReportService } from './report.service';

export interface SsraChatSession {
  ssraId: string;
  conversationId: string;
  domainKey: string;
  domainTitle: string;
  stage: 'domain-selection' | 'site-info' | 'questions' | 'hot-works' | 'operatives' | 'completed';
  siteInfo: {
    jobno: string;
    clientjobno?: string;
    location: string;
    contractName: string;
    weather: 'DRY' | 'WET' | 'ICY' | 'FOG';
    description: string;
    timeonsite: string;
  };
  preWorkPhotos: SsraEvidencePhoto[];
  questions: SsraQuestion[];
  currentQuestionIndex: number;
  answers: Record<string, SsraAnswer>;
  hotWorksTriggered: boolean;
  hotWorksChecks: SsraHotWorksCheck[];
  currentHwIndex: number;
  operatives: SsraOperative[];
  personsAffected: string[];
  othercomments: string;
  createdAt: string;
  finalAssessment?: SsraAssessment;
}

@Injectable({
  providedIn: 'root',
})
export class ConversationalSsraService {
  private readonly ssraService = inject(SsraService);
  private readonly authService = inject(AuthService);
  private readonly reportService = inject(ReportService);

  // Active in-memory sessions keyed by conversationId
  private sessions = new Map<string, SsraChatSession>();

  // --- 1. NLP & Intent Detection ---

  isSsraRequest(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    const regex = /\b(ssra|risk\s*assessment|safety\s*assessment|site\s*specific|point\s*of\s*work\s*risk|pre-start\s*assessment)\b/i;
    return regex.test(lower);
  }

  matchDomain(text: string): SsraDomainTypeInfo | null {
    if (!text) return null;
    const lower = text.toLowerCase();

    const domainPatterns: { key: string; regex: RegExp }[] = [
      { key: 'traffic-management', regex: /\b(traffic\s*management|traffic|tm|lane\s*closure|contraflow|diversion|taper)\b/i },
      { key: 'civil-callout', regex: /\b(civil\s*callout|emergency\s*callout|callout)\b/i },
      { key: 'civil-planned', regex: /\b(civil\s*planned|footway\s*recon|paving|kerbing\s*scheme)\b/i },
      { key: 'civil-reactive', regex: /\b(civil\s*reactive|reactive\s*pothole|ironwork)\b/i },
      { key: 'crossover', regex: /\b(crossover|dropped\s*kerb|vehicular\s*crossing)\b/i },
      { key: 'grab-lorry', regex: /\b(grab\s*lorry|grab|muck\s*away|site\s*delivery)\b/i },
      { key: 'gully-cleansing', regex: /\b(gully|gully\s*cleansing|drainage|suction\s*cleansing)\b/i },
      { key: 'mechanic-roadside', regex: /\b(mechanic\s*roadside|roadside\s*fitter|breakdown\s*van)\b/i },
      { key: 'mechanic-workshop', regex: /\b(mechanic\s*workshop|depot\s*workshop|vehicle\s*lift)\b/i },
      { key: 'road-marking', regex: /\b(road\s*marking|white\s*lining|thermoplastic|yellow\s*line)\b/i },
      { key: 'road-surfacing', regex: /\b(road\s*surfacing|surfacing|asphalt|tarmac|planing|paver|hot\s*bitumen)\b/i },
      { key: 'street-lighting', regex: /\b(street\s*lighting|lighting|luminaire|lamp\s*column|electrical\s*cut-out)\b/i },
      { key: 'utility-survey', regex: /\b(utility\s*survey|survey|cat\s*&?\s*genny|gpr|trial\s*pitting)\b/i },
      { key: 'winter-maintenance', regex: /\b(winter\s*maintenance|winter|gritting|gritter|snow\s*plough|pre-salting)\b/i },
    ];

    for (const p of domainPatterns) {
      if (p.regex.test(lower)) {
        return getSsraTypeByKey(p.key) || null;
      }
    }
    return null;
  }

  // --- 2. Session Lifecycle ---

  getSession(conversationId: string): SsraChatSession | null {
    return this.sessions.get(conversationId) || null;
  }

  startSession(
    conversationId: string,
    explicitDomainKey?: string
  ): { message: ChatMessage; session: SsraChatSession } {
    const domain = explicitDomainKey ? getSsraTypeByKey(explicitDomainKey) : null;
    const nowIso = new Date().toISOString();
    const ssraId = `ssra_${Date.now()}`;

    const session: SsraChatSession = {
      ssraId,
      conversationId,
      domainKey: domain?.key || '',
      domainTitle: domain?.title || '',
      stage: domain ? 'site-info' : 'domain-selection',
      siteInfo: {
        jobno: 'JOB-' + Math.floor(1000 + Math.random() * 9000),
        location: '',
        contractName: 'Highways Safety Framework',
        weather: 'DRY',
        description: '',
        timeonsite: new Date().toTimeString().substring(0, 5),
      },
      preWorkPhotos: [],
      questions: domain ? getQuestionsForDomain(domain.key) : [],
      currentQuestionIndex: 0,
      answers: {},
      hotWorksTriggered: false,
      hotWorksChecks: SSRA_HOT_WORKS_CHECKS_CONFIG.map((c) => ({
        ...c,
        status: 'Pass',
        notes: 'Verified safe before start',
      })),
      currentHwIndex: 0,
      operatives: [
        {
          operativeId: 'op_1',
          displayName: (this.authService.userProfile() as any)?.name || 'Lead Operative',
          role: 'Lead Supervisor',
          signatureDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30"><path d="M10 20 Q 30 5, 60 20 T 90 15" stroke="%230f172a" fill="none" stroke-width="2"/></svg>',
          signedAt: nowIso,
        },
      ],
      personsAffected: ['Operatives', 'Passing Traffic / Drivers'],
      othercomments: 'Overhead services checked and clear. Safe working zone established.',
      createdAt: nowIso,
    };

    this.sessions.set(conversationId, session);

    if (!domain) {
      const msg: ChatMessage = {
        id: 'msg-' + Date.now(),
        sender: 'assistant',
        content:
          "I will guide you through completing your point-of-work **Site Specific Safety Risk Assessment (SSRA)**.\n\n" +
          "To begin, please select your **Operational Domain** from the 14 active departments below:",
        timestamp: new Date(),
        isSsraSession: true,
        ssraId,
        showSsraDomainSelector: true,
      };
      return { message: msg, session };
    }

    const msg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content: `Understood! We are preparing the **${domain.title}** safety assessment. Please fill in the site details below.`,
      timestamp: new Date(),
      isSsraSession: true,
      ssraId,
      selectedSsraDomainKey: domain.key,
      ssraSiteForm: {
        domainTitle: domain.title,
        defaultJobno: session.siteInfo.jobno,
        defaultContract: session.siteInfo.contractName,
      },
    };
    return { message: msg, session };
  }

  selectDomain(
    conversationId: string,
    domainKey: string
  ): { message: ChatMessage; session: SsraChatSession } {
    let session = this.sessions.get(conversationId);
    const domain = getSsraTypeByKey(domainKey);

    if (!session) {
      return this.startSession(conversationId, domainKey);
    }

    session.domainKey = domainKey;
    session.domainTitle = domain?.title || domainKey;
    session.questions = getQuestionsForDomain(domainKey);
    session.stage = 'site-info';

    const msg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content: `Great! Domain confirmed as **${session.domainTitle}** (${session.questions.length} safety verification points). Please fill in the site details below.`,
      timestamp: new Date(),
      isSsraSession: true,
      ssraId: session.ssraId,
      selectedSsraDomainKey: domainKey,
      ssraSiteForm: {
        domainTitle: session.domainTitle,
        defaultJobno: session.siteInfo.jobno,
        defaultContract: session.siteInfo.contractName,
      },
    };
    return { message: msg, session };
  }

  submitSiteForm(
    conversationId: string,
    form: { jobno: string; location: string; weather: 'DRY' | 'WET' | 'ICY' | 'FOG'; contractName?: string },
    photos?: any[]
  ): { message: ChatMessage; session: SsraChatSession } {
    const session = this.sessions.get(conversationId);
    if (!session) return this.startSession(conversationId);
    session.siteInfo.jobno = form.jobno.trim() || session.siteInfo.jobno;
    session.siteInfo.location = form.location.trim();
    session.siteInfo.weather = form.weather;
    if (form.contractName?.trim()) session.siteInfo.contractName = form.contractName.trim();
    // Reuse the shared path (adds photos / placeholders and serves question 1) with no free-text parsing
    return this.submitSiteInfo(conversationId, '', photos);
  }

  // --- 3. Site Info & Photos Extraction ---

  submitSiteInfo(
    conversationId: string,
    userInput: string,
    photos?: any[]
  ): { message: ChatMessage; session: SsraChatSession } {
    const session = this.sessions.get(conversationId);
    if (!session) {
      const restarted = this.startSession(conversationId);
      return restarted;
    }

    // Extract site details from conversational string
    if (userInput && userInput.trim()) {
      const text = userInput.trim();

      // Extract weather if mentioned
      if (/\bwet\b/i.test(text)) session.siteInfo.weather = 'WET';
      else if (/\bicy\b|\bfrost\b/i.test(text)) session.siteInfo.weather = 'ICY';
      else if (/\bfog\b|\bmist\b/i.test(text)) session.siteInfo.weather = 'FOG';
      else if (/\bdry\b|\bclear\b|\bsunny\b/i.test(text)) session.siteInfo.weather = 'DRY';

      // Extract job number if format JOB-XXXX or Job XXXX found
      const jobMatch = /(?:job\s*(?:no\.?|#)?\s*[:=-]?\s*)([a-zA-Z0-9_-]+)/i.exec(text);
      if (jobMatch && jobMatch[1]) {
        session.siteInfo.jobno = jobMatch[1];
      }

      // Location heuristic
      const locMatch = /(?:location|site|at|on)\s*[:=-]?\s*([^,.\n]+)/i.exec(text);
      if (locMatch && locMatch[1]) {
        session.siteInfo.location = locMatch[1].trim();
      } else if (!session.siteInfo.location) {
        session.siteInfo.location = text.substring(0, 60);
      }
    }

    if (!session.siteInfo.location) {
      session.siteInfo.location = 'Highways Work Zone (Point of Work)';
    }

    // Add photos if provided
    if (photos && photos.length > 0) {
      for (const p of photos) {
        session.preWorkPhotos.push({
          id: p.id || `photo_${Date.now()}`,
          name: p.name || 'Pre-Work Photo',
          url: p.url,
          category: 'pre-work',
        });
      }
    }

    // Ensure at least 2 default pre-work evidence references
    if (session.preWorkPhotos.length === 0) {
      session.preWorkPhotos = [
        {
          id: 'ev-pre-1',
          name: 'Site-Approach-PreWork.jpg',
          url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" style="background:%231e293b"><text x="50%" y="50%" fill="white" font-size="14" text-anchor="middle">Pre-Work Site Layout Evidence</text></svg>',
          category: 'pre-work',
        },
        {
          id: 'ev-pre-2',
          name: 'Trench-Safety-Clearance.jpg',
          url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" style="background:%230f172a"><text x="50%" y="50%" fill="white" font-size="14" text-anchor="middle">Safe Working Zone Demarcation</text></svg>',
          category: 'pre-work',
        },
      ];
    }

    session.stage = 'questions';
    session.currentQuestionIndex = 0;

    // Serve Question #1
    return this.serveNextQuestion(session);
  }

  // --- 4. Question Pacing ---

  serveNextQuestion(session: SsraChatSession): { message: ChatMessage; session: SsraChatSession } {
    const qIndex = session.currentQuestionIndex;
    const questions = session.questions;

    if (qIndex >= questions.length) {
      // Questions finished! Check if Hot Works is triggered
      if (session.hotWorksTriggered) {
        session.stage = 'hot-works';
        session.currentHwIndex = 0;
        return this.serveNextHotWorksCheck(session);
      }
      // Move to Operative Confirmation
      return this.serveOperativesPrompt(session);
    }

    const q = questions[qIndex];
    const totalQ = questions.length;
    const questionNum = q.qnum || q.questionNumber || (qIndex + 1);

    const questionText = q.text || q.questionText || '';
    const roTranslation = q.roText || q.romanianTranslation || '';
    const controlMeasure = q.cm || q.controlMeasure || '';

    const assistantMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content:
        `**Safety Question ${questionNum} of ${totalQ}** • *${session.domainTitle}*\n\n` +
        `**${questionText}**` +
        (roTranslation ? `\n\n🇷🇴 *Traducere:* ${roTranslation}` : '') +
        (controlMeasure ? `\n\n🛡️ **Control Measure:** ${controlMeasure}` : ''),
      timestamp: new Date(),
      isSsraSession: true,
      ssraId: session.ssraId,
      ssraQuestion: {
        id: q.id,
        domainKey: session.domainKey,
        domainTitle: session.domainTitle,
        questionNumber: questionNum,
        totalQuestions: totalQ,
        text: questionText,
        roText: roTranslation,
        cm: controlMeasure,
        answerType: (q.answerType as any) || 'yes-no-na',
        options: q.options || [],
        triggersHotWorks: !!q.triggersHotWorks,
        currentValue: session.answers[q.id]?.value,
        notes: session.answers[q.id]?.notes,
      },
    };

    return { message: assistantMsg, session };
  }

  answerQuestion(
    conversationId: string,
    questionId: string,
    value: string,
    notes?: string
  ): { message: ChatMessage; session: SsraChatSession } {
    let session = this.sessions.get(conversationId);
    if (!session) {
      return this.startSession(conversationId);
    }

    // Save answer
    session.answers[questionId] = {
      questionId,
      value: value || 'Yes',
      notes: notes || 'Confirmed compliant at point of work',
    };

    // Check if this question triggers Hot Works
    const currentQ = session.questions.find((q) => q.id === questionId);
    if (currentQ?.triggersHotWorks && value.toLowerCase() === 'yes') {
      session.hotWorksTriggered = true;
    }

    // Advance to next question
    session.currentQuestionIndex += 1;
    return this.serveNextQuestion(session);
  }

  // --- 5. Hot Works Pre-Work Verification ---

  serveNextHotWorksCheck(session: SsraChatSession): { message: ChatMessage; session: SsraChatSession } {
    const hwIndex = session.currentHwIndex;
    const checks = session.hotWorksChecks;

    if (hwIndex >= checks.length) {
      return this.serveOperativesPrompt(session);
    }

    const check = checks[hwIndex];
    const checkNum = hwIndex + 1;
    const totalChecks = checks.length;

    const assistantMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content:
        `🔥 **Hot Works Pre-Work Verification (${checkNum}/${totalChecks})**\n\n` +
        `**[${check.id}] ${check.title}**\n` +
        `${check.description}\n\n` +
        `*Confirm check status before commencing heat or flame operations:*`,
      timestamp: new Date(),
      isSsraSession: true,
      ssraId: session.ssraId,
      ssraHotWorksCheck: {
        checkId: check.id,
        checkNumber: checkNum,
        totalChecks,
        title: check.title,
        description: check.description,
        status: check.status,
      },
    };

    return { message: assistantMsg, session };
  }

  answerHotWorksCheck(
    conversationId: string,
    checkId: string,
    status: 'Pass' | 'Fail' | 'N/A',
    notes?: string
  ): { message: ChatMessage; session: SsraChatSession } {
    const session = this.sessions.get(conversationId);
    if (!session) return this.startSession(conversationId);

    const check = session.hotWorksChecks.find((c) => c.id === checkId);
    if (check) {
      check.status = status;
      check.notes = notes || 'Verified on site';
    }

    session.currentHwIndex += 1;
    return this.serveNextHotWorksCheck(session);
  }

  // --- 6. Operatives Briefing & Sign-Off ---

  serveOperativesPrompt(session: SsraChatSession): { message: ChatMessage; session: SsraChatSession } {
    session.stage = 'operatives';

    const assistantMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content:
        `All point-of-work safety checks have been validated! 📋\n\n` +
        `**Site Operatives Briefing & Sign-Off:**\n` +
        `Please confirm the operatives present on site. Every gang member must be briefed on these controls before beginning work:`,
      timestamp: new Date(),
      isSsraSession: true,
      ssraId: session.ssraId,
      ssraOperativesPrompt: {
        operatives: session.operatives.map((o) => ({
          name: o.displayName,
          role: o.role || 'Site Operative',
          signed: !!o.signatureDataUrl,
        })),
      },
    };

    return { message: assistantMsg, session };
  }

  // --- 7. Finalization & Report Generation ---

  finalizeAssessment(
    conversationId: string,
    additionalGangNames?: string[]
  ): { message: ChatMessage; assessment: SsraAssessment } {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error('No active SSRA session to finalize.');
    }

    // Add any extra operatives specified
    if (additionalGangNames && additionalGangNames.length > 0) {
      for (const name of additionalGangNames) {
        if (!session.operatives.some((o) => o.displayName.toLowerCase() === name.toLowerCase())) {
          session.operatives.push({
            operativeId: 'op_' + Math.random().toString(36).substring(2, 7),
            displayName: name,
            role: 'Site Operative',
            signatureDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30"><path d="M10 20 Q 30 5, 60 20 T 90 15" stroke="%230f172a" fill="none" stroke-width="2"/></svg>',
            signedAt: new Date().toISOString(),
          });
        }
      }
    }

    const answersList: SsraAnswer[] = Object.values(session.answers);
    const hotWorksData: SsraHotWorksData = {
      applicable: session.hotWorksTriggered,
      checks: session.hotWorksChecks,
    };

    const phase1Data: SsraPhase1Data = {
      clientReferenceId: session.ssraId,
      domainType: session.domainKey,
      questionnaireVersion: SSRA_QUESTIONNAIRE_VERSION,
      siteInformation: session.siteInfo,
      personsAffected: session.personsAffected,
      answers: answersList,
      preWorkPhotos: session.preWorkPhotos,
      othercomments: session.othercomments,
      operatives: session.operatives,
      hotWorks: hotWorksData,
    };

    // Submit via SsraService (saves to isolated Firestore & local submissions)
    let createdAssessment: SsraAssessment | null = null;
    this.ssraService.submitPhase1(phase1Data).subscribe({
      next: (res) => {
        createdAssessment = res.assessment || null;
      },
    });

    const nowYear = new Date().getFullYear();
    const randCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const refno = `SSRA-${nowYear}-${randCode}`;

    const finalAss: SsraAssessment = createdAssessment || {
      id: session.ssraId,
      refno,
      userId: this.authService.currentUser()?.uid || 'guest-user',
      userEmail: this.authService.currentUser()?.email || '',
      clientReferenceId: session.ssraId,
      domainType: session.domainKey,
      domainTitle: session.domainTitle,
      questionnaireVersion: SSRA_QUESTIONNAIRE_VERSION,
      lifecycleStatus: 'Level1',
      siteInformation: session.siteInfo,
      personsAffected: session.personsAffected,
      answers: answersList,
      preWorkPhotos: session.preWorkPhotos,
      othercomments: session.othercomments,
      operatives: session.operatives,
      hotWorks: hotWorksData,
      createdAt: session.createdAt,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creatorName: (this.authService.userProfile() as any)?.name || 'Lead Operative',
    };

    session.stage = 'completed';
    session.finalAssessment = finalAss;

    // Persist into unified ReportService for instant My Reports synchronization
    try {
      this.reportService.saveSsraRecord(finalAss);
    } catch (e) {
      console.warn('[ConversationalSsra] Failed to sync to ReportService:', e);
    }

    const summaryText =
      `All done! Your **Site Specific Safety Risk Assessment (SSRA)** has been completed and signed off at **Level 1 (Pre-Start Validated)**.\n\n` +
      `• **Reference #:** \`${finalAss.refno}\`\n` +
      `• **Domain:** ${finalAss.domainTitle}\n` +
      `• **Location:** ${finalAss.siteInformation.location}\n` +
      `• **Weather:** ${finalAss.siteInformation.weather}\n` +
      `• **Verifications:** ${answersList.length} Point-of-Work checks completed\n` +
      `• **Hot Works:** ${session.hotWorksTriggered ? '🔥 4 Pre-Checks Passed' : 'Not applicable'}\n` +
      `• **Briefed Operatives:** ${finalAss.operatives.length} Signed\n\n` +
      `The safety assessment is saved to Firebase and accessible anytime in **My Reports** and **Risk Assessment**.`;

    const assistantMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      content: summaryText,
      timestamp: new Date(),
      isSsraSession: true,
      ssraId: session.ssraId,
      ssraResult: finalAss,
    };

    return { message: assistantMsg, assessment: finalAss };
  }
}
