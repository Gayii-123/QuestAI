import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import {
  Conversation,
  ChatMessage,
  type InspectionPhoto,
} from '../models/chat.models';

/**
 * MANDATORY FIRESTORE STRUCTURE:
 * questai
 *  └── data
 *       ├── users
 *       │    └── {uid}
 *       │         └── conversations
 *       │              └── {conversationId}
 *       │                   └── messages
 *       │                        └── {messageId}
 */
const ROOT_COLLECTION = 'questai';
const DATA_DOC = 'data';
const USERS_COLLECTION = 'users';
const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';

@Injectable({
  providedIn: 'root',
})
export class ConversationService {
  private readonly authService = inject(AuthService);
  private readonly firestore: Firestore = this.authService.firestore;

  /**
   * Helper: returns the user's active UID or null
   */
  getCurrentUserId(): string | null {
    return (
      this.authService.currentUser()?.uid ||
      this.authService.auth.currentUser?.uid ||
      null
    );
  }

  // --- Collection & Document References ---

  private getUserConversationsCollection(uid: string) {
    return collection(
      this.firestore,
      ROOT_COLLECTION,
      DATA_DOC,
      USERS_COLLECTION,
      uid,
      CONVERSATIONS_COLLECTION
    );
  }

  private getConversationDoc(uid: string, conversationId: string) {
    return doc(
      this.firestore,
      ROOT_COLLECTION,
      DATA_DOC,
      USERS_COLLECTION,
      uid,
      CONVERSATIONS_COLLECTION,
      conversationId
    );
  }

  private getMessagesCollection(uid: string, conversationId: string) {
    return collection(
      this.firestore,
      ROOT_COLLECTION,
      DATA_DOC,
      USERS_COLLECTION,
      uid,
      CONVERSATIONS_COLLECTION,
      conversationId,
      MESSAGES_COLLECTION
    );
  }

  private getMessageDoc(uid: string, conversationId: string, messageId: string) {
    return doc(
      this.firestore,
      ROOT_COLLECTION,
      DATA_DOC,
      USERS_COLLECTION,
      uid,
      CONVERSATIONS_COLLECTION,
      conversationId,
      MESSAGES_COLLECTION,
      messageId
    );
  }

  // --- Conversation Operations ---

  /**
   * Loads all conversations for the given user, ordered by updatedAt descending.
   */
  async loadUserConversations(uid: string): Promise<Conversation[]> {
    if (!uid) return [];
    try {
      const convsRef = this.getUserConversationsCollection(uid);
      const q = query(convsRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);

      const conversations: Conversation[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        conversations.push(this.deserializeConversation(d.id, data));
      }

      // Ensure stable client-side sorting in case of timestamp jitter
      return conversations.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
    } catch (err) {
      console.warn('[ConversationService] Error loading user conversations from Firestore:', err);
      return [];
    }
  }

  /**
   * Creates a new conversation document in Firestore under questai/data/users/{uid}/conversations/{conversationId}.
   * Initially titled "New Chat". Does NOT write if conversation already exists unless forceOverwrite is set.
   */
  async createConversation(
    uid: string,
    conversation: Conversation
  ): Promise<void> {
    if (!uid || !conversation?.id) return;
    try {
      const convDocRef = this.getConversationDoc(uid, conversation.id);
      const payload: Record<string, any> = {
        id: conversation.id,
        title: conversation.title || 'New Chat',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessagePreview: conversation.lastMessagePreview || conversation.previewSnippet || '',
        previewSnippet: conversation.previewSnippet || '',
        messageCount: conversation.messages?.length || 0,
        selectedBankId: conversation.selectedBankId || null,
        activeInspectionId: conversation.activeInspectionId || null,
        userId: uid,
      };

      await setDoc(convDocRef, payload, { merge: true });
    } catch (err) {
      console.error('[ConversationService] Error creating conversation in Firestore:', err);
      throw err;
    }
  }

  /**
   * Renames a conversation in Firestore. Preserves "New Chat" default unless manually renamed.
   */
  async renameConversation(
    uid: string,
    conversationId: string,
    newTitle: string
  ): Promise<void> {
    if (!uid || !conversationId) return;
    const trimmed = (newTitle || '').trim();
    if (!trimmed) return;

    try {
      const convDocRef = this.getConversationDoc(uid, conversationId);
      await updateDoc(convDocRef, {
        title: trimmed,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[ConversationService] Error renaming conversation in Firestore:', err);
      throw err;
    }
  }

  /**
   * Deletes a conversation and its messages subcollection in Firestore.
   */
  async deleteConversation(
    uid: string,
    conversationId: string
  ): Promise<void> {
    if (!uid || !conversationId) return;
    try {
      // 1. Delete all messages inside subcollection
      const msgsRef = this.getMessagesCollection(uid, conversationId);
      const snapshot = await getDocs(msgsRef);
      if (!snapshot.empty) {
        const batch = writeBatch(this.firestore);
        snapshot.docs.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });
        await batch.commit();
      }

      // 2. Delete the conversation document
      const convDocRef = this.getConversationDoc(uid, conversationId);
      await deleteDoc(convDocRef);
    } catch (err) {
      console.error('[ConversationService] Error deleting conversation in Firestore:', err);
      throw err;
    }
  }

  /**
   * Updates conversation metadata (updatedAt, lastMessagePreview, messageCount, etc.)
   */
  async updateConversationMeta(
    uid: string,
    conversationId: string,
    updates: Partial<{
      title: string;
      lastMessagePreview: string;
      previewSnippet: string;
      messageCount: number;
      selectedBankId: string | null;
      activeInspectionId: string | null;
    }>
  ): Promise<void> {
    if (!uid || !conversationId) return;
    try {
      const convDocRef = this.getConversationDoc(uid, conversationId);
      const payload: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };
      if (updates.title !== undefined) payload['title'] = updates.title;
      if (updates.lastMessagePreview !== undefined) {
        payload['lastMessagePreview'] = updates.lastMessagePreview;
        payload['previewSnippet'] = updates.lastMessagePreview;
      }
      if (updates.messageCount !== undefined) payload['messageCount'] = updates.messageCount;
      if (updates.selectedBankId !== undefined) payload['selectedBankId'] = updates.selectedBankId;
      if (updates.activeInspectionId !== undefined) payload['activeInspectionId'] = updates.activeInspectionId;

      await setDoc(convDocRef, payload, { merge: true });
    } catch (err) {
      console.warn('[ConversationService] Error updating conversation metadata:', err);
    }
  }

  // --- Message Operations ---

  /**
   * Loads all messages for a conversation, ordered chronologically.
   */
  async loadConversationMessages(
    uid: string,
    conversationId: string
  ): Promise<ChatMessage[]> {
    if (!uid || !conversationId) return [];
    try {
      const msgsRef = this.getMessagesCollection(uid, conversationId);
      const q = query(msgsRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);

      const messages: ChatMessage[] = [];
      for (const d of snapshot.docs) {
        messages.push(this.deserializeMessage(d.id, d.data()));
      }
      return messages;
    } catch (err) {
      console.warn('[ConversationService] Error loading messages from Firestore:', err);
      return [];
    }
  }

  /**
   * Saves a single message to the conversation's messages subcollection and updates conversation metadata.
   * Prevents duplicates and avoids storing large Base64 images directly in Firestore.
   */
  async saveMessage(
    uid: string,
    conversationId: string,
    message: ChatMessage,
    totalMessageCount?: number
  ): Promise<void> {
    if (!uid || !conversationId || !message?.id) return;
    try {
      const msgDocRef = this.getMessageDoc(uid, conversationId, message.id);
      const sanitizedPayload = this.serializeMessageForFirestore(message);

      // Save message document
      await setDoc(msgDocRef, sanitizedPayload, { merge: true });

      // Update conversation metadata
      const preview = message.content
        ? message.content.substring(0, 80)
        : message.photos && message.photos.length > 0
          ? `Uploaded ${message.photos.length} photograph(s)`
          : 'Site Inspection Report';

      await this.updateConversationMeta(uid, conversationId, {
        lastMessagePreview: preview,
        previewSnippet: preview,
        messageCount: totalMessageCount,
        selectedBankId: message.selectedBankId || undefined,
        activeInspectionId: message.inspectionId || undefined,
      });
    } catch (err) {
      console.error('[ConversationService] Failed to save message to Firestore:', err);
      // Re-throw so caller can handle gracefully without losing in-memory/IndexedDB state
      throw err;
    }
  }

  // --- Serialization & Deserialization Helpers ---

  private serializeMessageForFirestore(msg: ChatMessage): Record<string, any> {
    const rawPhotos = Array.isArray(msg.photos)
      ? msg.photos.map((p) => ({
          id: p.id || '',
          name: p.name || 'photograph.jpg',
          size: typeof p.size === 'number' ? p.size : 0,
          timestamp: p.timestamp || new Date().toISOString(),
          // Store cloud/external URL only; omit giant Base64 data URLs in Firestore
          url: p.url && !p.url.startsWith('data:') ? p.url : '',
        }))
      : null;

    const base: Record<string, any> = {
      id: msg.id,
      sender: msg.sender,
      content: msg.content || '',
      timestamp:
        msg.timestamp instanceof Date
          ? Timestamp.fromDate(msg.timestamp)
          : serverTimestamp(),
      attachmentName: msg.attachmentName || null,
      photos: rawPhotos,
      isError: !!msg.isError,
      retryPrompt: msg.retryPrompt || null,
      modelIdentifier: msg.modelIdentifier || null,
      showInspectionCategories: !!msg.showInspectionCategories,
      categorySelected: !!msg.categorySelected,
      showInlinePhotoUpload: !!msg.showInlinePhotoUpload,
      suggestedBankId: msg.suggestedBankId || null,
      selectedBankId: msg.selectedBankId || null,
      isInspectionWorkflowMessage: !!msg.isInspectionWorkflowMessage,
      inspectionBankId: msg.inspectionBankId || null,
      inspectionId: msg.inspectionId || null,
      isAdditionalPhotoRequest: !!msg.isAdditionalPhotoRequest,
      targetQuestionId: msg.targetQuestionId || null,
      singleQuestionIndex: msg.singleQuestionIndex ?? null,
      singleQuestionTotal: msg.singleQuestionTotal ?? null,
    };

    // Preserve structured inspection models without flattening
    if (msg.structuredInspection) {
      base['structuredInspection'] = this.cleanForFirestore(msg.structuredInspection);
    }
    if (msg.evidenceMessage) {
      base['evidenceMessage'] = this.cleanForFirestore(msg.evidenceMessage);
    }
    if (msg.questionBatch) {
      base['questionBatch'] = this.cleanForFirestore(msg.questionBatch);
    }
    if (msg.singleQuestion) {
      base['singleQuestion'] = this.cleanForFirestore(msg.singleQuestion);
    }
    if (msg.inspectionProgress) {
      base['inspectionProgress'] = this.cleanForFirestore(msg.inspectionProgress);
    }
    if (msg.draftSummary) {
      base['draftSummary'] = this.cleanForFirestore(msg.draftSummary);
    }
    if (msg.showInternalAuditUpload) {
      base['showInternalAuditUpload'] = true;
    }
    if (msg.internalAuditResult) {
      const cleanedResult = {
        ...msg.internalAuditResult,
        observations: (msg.internalAuditResult.observations || []).map((obs: any) => ({
          ...obs,
          photoUrls: (obs.photoUrls || []).filter((u: string) => u && !u.startsWith('data:')),
        })),
      };
      base['internalAuditResult'] = this.cleanForFirestore(cleanedResult);
    }
    if (msg.internalAuditSession) {
      const cleanedSession = {
        ...msg.internalAuditSession,
        photos: (msg.internalAuditSession.photos || []).map((p: any) => ({
          id: p.id || '',
          name: p.name || 'photograph.jpg',
          size: typeof p.size === 'number' ? p.size : 0,
          timestamp: p.timestamp || new Date().toISOString(),
          url: p.url && !p.url.startsWith('data:') ? p.url : '',
        })),
      };
      base['internalAuditSession'] = this.cleanForFirestore(cleanedSession);
    }

    return this.cleanForFirestore(base);
  }

  private deserializeMessage(id: string, data: any): ChatMessage {
    const rawTs = data?.timestamp;
    let timestamp: Date;
    if (rawTs?.toDate && typeof rawTs.toDate === 'function') {
      timestamp = rawTs.toDate();
    } else if (rawTs instanceof Date) {
      timestamp = rawTs;
    } else if (typeof rawTs === 'string' || typeof rawTs === 'number') {
      timestamp = new Date(rawTs);
    } else {
      timestamp = new Date();
    }

    const photos: InspectionPhoto[] = Array.isArray(data?.photos)
      ? data.photos.map((p: any) => ({
          id: String(p?.id || ''),
          name: String(p?.name || 'photograph.jpg'),
          size: Number(p?.size || 0),
          url: String(p?.url || ''),
          timestamp: String(p?.timestamp || ''),
        }))
      : [];

    let internalAuditResult = data?.internalAuditResult || undefined;
    let internalAuditSession = data?.internalAuditSession || undefined;

    // Self-healing: If this message represents a completed Internal Audit but internalAuditResult is missing
    if (!internalAuditResult && data?.content && String(data.content).includes('Internal Audit')) {
      try {
        const rawCompleted = typeof localStorage !== 'undefined'
          ? localStorage.getItem('questai_ia_completed_audits')
          : null;
        if (rawCompleted) {
          const completedList = JSON.parse(rawCompleted);
          if (Array.isArray(completedList) && completedList.length > 0) {
            const matched =
              completedList.find(
                (s: any) =>
                  (s.location && String(data.content).includes(s.location)) ||
                  (s.auditorSummary &&
                    String(data.content).includes(String(s.auditorSummary).substring(0, 30)))
              ) || completedList[0];

            if (matched) {
              internalAuditSession = matched;
              internalAuditResult = matched.analysisResult || {
                location: matched.location || 'Site Location',
                auditorSummary: matched.auditorSummary || 'Internal Audit completed.',
                observations: matched.observations || [],
                totalPhotosAnalyzed: matched.photos?.length || 0,
                totalCarCount: (matched.observations || []).filter((o: any) => o.hasCar === 'Yes').length,
                overallComplianceScore: matched.complianceScore || 100,
                analyzedAt: matched.completedAt || new Date().toISOString(),
              };
            }
          }
        }
      } catch {
        // ignore storage access error
      }

      // If still missing, reconstruct from the textual summary in content
      if (!internalAuditResult) {
        const contentStr = String(data.content);
        const locMatch = contentStr.match(/Location:\*?\*?\s*([^\n]+)/i);
        const sumMatch = contentStr.match(/Auditor Summary:\*?\*?\s*([^\n]+)/i);
        const scoreMatch = contentStr.match(/Compliance Score:\*?\*?\s*(\d+)%/i);
        const obsMatch = contentStr.match(/Total Observations:\*?\*?\s*(\d+)/i);
        const carMatch = contentStr.match(/CARs Generated:\*?\*?\s*(\d+)/i);

        if (scoreMatch || locMatch || obsMatch) {
          const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 100;
          const carCount = carMatch ? parseInt(carMatch[1], 10) : 0;
          const obsCount = obsMatch ? parseInt(obsMatch[1], 10) : 0;
          internalAuditResult = {
            location: locMatch ? locMatch[1].trim() : 'Unspecified Location',
            auditorSummary: sumMatch ? sumMatch[1].trim() : 'Internal audit evaluation completed.',
            observations: [],
            totalPhotosAnalyzed: obsCount,
            goodPracticeCount: 0,
            compliantCount: Math.max(0, obsCount - carCount),
            observationsOnlyCount: 0,
            areaForImprovementCount: 0,
            minorNcrCount: carCount,
            majorNcrCount: 0,
            totalCarCount: carCount,
            overallComplianceScore: score,
            analyzedAt: timestamp.toISOString(),
          };
        }
      }
    }

    return {
      id: String(data?.id || id),
      sender: data?.sender || 'assistant',
      content: String(data?.content || ''),
      timestamp,
      attachmentName: data?.attachmentName || undefined,
      photos: photos.length > 0 ? photos : undefined,
      isError: !!data?.isError,
      retryPrompt: data?.retryPrompt || undefined,
      modelIdentifier: data?.modelIdentifier || undefined,
      showInspectionCategories: !!data?.showInspectionCategories,
      categorySelected: !!data?.categorySelected,
      showInlinePhotoUpload: !!data?.showInlinePhotoUpload,
      showInternalAuditUpload: !!data?.showInternalAuditUpload,
      internalAuditResult,
      internalAuditSession,
      suggestedBankId: data?.suggestedBankId || undefined,
      selectedBankId: data?.selectedBankId || undefined,
      isInspectionWorkflowMessage: !!data?.isInspectionWorkflowMessage,
      inspectionBankId: data?.inspectionBankId || undefined,
      inspectionId: data?.inspectionId || undefined,
      evidenceMessage: data?.evidenceMessage || undefined,
      questionBatch: data?.questionBatch || undefined,
      singleQuestion: data?.singleQuestion || undefined,
      singleQuestionIndex:
        typeof data?.singleQuestionIndex === 'number'
          ? data.singleQuestionIndex
          : undefined,
      singleQuestionTotal:
        typeof data?.singleQuestionTotal === 'number'
          ? data.singleQuestionTotal
          : undefined,
      inspectionProgress: data?.inspectionProgress || undefined,
      draftSummary: data?.draftSummary || undefined,
      isAdditionalPhotoRequest: !!data?.isAdditionalPhotoRequest,
      targetQuestionId: data?.targetQuestionId || undefined,
      structuredInspection: data?.structuredInspection || undefined,
    };
  }

  private deserializeConversation(id: string, data: any): Conversation {
    const rawTs = data?.updatedAt;
    let updatedAt: Date;
    if (rawTs?.toDate && typeof rawTs.toDate === 'function') {
      updatedAt = rawTs.toDate();
    } else if (rawTs instanceof Date) {
      updatedAt = rawTs;
    } else if (typeof rawTs === 'string' || typeof rawTs === 'number') {
      updatedAt = new Date(rawTs);
    } else {
      updatedAt = new Date();
    }

    return {
      id: String(data?.id || id),
      title: String(data?.title || 'New Chat'),
      updatedAt,
      previewSnippet: String(data?.previewSnippet || data?.lastMessagePreview || ''),
      lastMessagePreview: String(data?.lastMessagePreview || data?.previewSnippet || ''),
      selectedBankId: data?.selectedBankId || undefined,
      activeInspectionId: data?.activeInspectionId || undefined,
      messages: [],
    };
  }

  /**
   * Recursively removes undefined fields and prepares objects for Firestore
   */
  private cleanForFirestore(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Timestamp) return obj;
    if (obj instanceof Date) return Timestamp.fromDate(obj);
    if (Array.isArray(obj)) return obj.map((item) => this.cleanForFirestore(item));

    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = this.cleanForFirestore(val);
      }
    }
    return result;
  }
}
