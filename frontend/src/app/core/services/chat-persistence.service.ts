import { Injectable } from '@angular/core';
import { Conversation, ChatMessage } from '../models/chat.models';
import { InspectionPhoto } from '../../features/inspection/site-inspection.models';

/*
// ============================================================================
// DISABLED: INDEXEDDB CHAT PERSISTENCE
// The constants and stores below are commented out as Firestore is now the
// single source of truth for conversations and messages.
// ============================================================================
const DB_NAME = 'questai_chat_db';
const DB_VERSION = 1;
const STORE_CONVERSATIONS = 'conversations';
const STORE_META = 'meta';
const STORE_PENDING_ATTACHMENTS = 'pending_attachments';
*/

export interface PersistedChatState {
  conversations: Conversation[];
  activeConversationId: string;
  pendingPhotosByConv: Record<string, InspectionPhoto[]>;
}

/**
 * ChatPersistenceService
 * 
 * NOTE: IndexedDB chat persistence is DISABLED in favor of Firestore as the single
 * source of truth under questai/data/users/{uid}/conversations.
 * The original IndexedDB implementation has been commented out below for future reference.
 */
@Injectable({ providedIn: 'root' })
export class ChatPersistenceService {
  /*
  // Original IndexedDB connection promise
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  // In-memory fallback store used in headless/Node test environments where indexedDB is unavailable
  private memoryConversations = new Map<string, Conversation>();
  private memoryMeta = new Map<string, any>();
  private memoryPending = new Map<string, InspectionPhoto[]>();

  private getDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
              db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_META)) {
              db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(STORE_PENDING_ATTACHMENTS)) {
              db.createObjectStore(STORE_PENDING_ATTACHMENTS, { keyPath: 'convKey' });
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  }
  */

  async saveConversations(
    _conversations: Conversation[],
    _activeConversationId: string
  ): Promise<void> {
    /*
    // DISABLED: IndexedDB conversation saving commented out.
    // Firestore now handles all conversation persistence.
    const serialized = conversations.map((c) => this.serializeConversation(c));

    // Always keep memory store synced for synchronous/test access
    this.memoryConversations.clear();
    for (const c of serialized) {
      this.memoryConversations.set(c.id, c);
    }
    this.memoryMeta.set('activeConversationId', activeConversationId);

    const db = await this.getDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_CONVERSATIONS, STORE_META], 'readwrite');
        const convStore = tx.objectStore(STORE_CONVERSATIONS);
        const metaStore = tx.objectStore(STORE_META);

        convStore.clear();
        for (const c of serialized) {
          convStore.put(c);
        }
        metaStore.put({ key: 'activeConversationId', value: activeConversationId });

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    */
    return Promise.resolve();
  }

  async deleteConversation(_id: string): Promise<void> {
    /*
    // DISABLED: IndexedDB conversation deletion commented out.
    // Firestore now handles all conversation deletion.
    this.memoryConversations.delete(id);
    this.memoryPending.delete(id);
    const db = await this.getDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_CONVERSATIONS, STORE_PENDING_ATTACHMENTS], 'readwrite');
        const convStore = tx.objectStore(STORE_CONVERSATIONS);
        const pendingStore = tx.objectStore(STORE_PENDING_ATTACHMENTS);
        convStore.delete(id);
        pendingStore.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    */
    return Promise.resolve();
  }

  async savePendingAttachments(_convKey: string, _photos: InspectionPhoto[]): Promise<void> {
    /*
    // DISABLED: IndexedDB pending attachments saving commented out.
    const key = convKey || '__draft__';
    const copy = photos.map((p) => ({ ...p }));
    this.memoryPending.set(key, copy);

    const db = await this.getDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_PENDING_ATTACHMENTS], 'readwrite');
        const store = tx.objectStore(STORE_PENDING_ATTACHMENTS);
        if (copy.length === 0) {
          store.delete(key);
        } else {
          store.put({ convKey: key, photos: copy, updatedAt: new Date().toISOString() });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    */
    return Promise.resolve();
  }

  async loadPendingAttachments(_convKey: string): Promise<InspectionPhoto[]> {
    /*
    // DISABLED: IndexedDB pending attachments load commented out.
    const key = convKey || '__draft__';
    const db = await this.getDb();
    if (!db) {
      return (this.memoryPending.get(key) || []).map((p) => ({ ...p }));
    }

    return new Promise<InspectionPhoto[]>((resolve) => {
      try {
        const tx = db.transaction([STORE_PENDING_ATTACHMENTS], 'readonly');
        const store = tx.objectStore(STORE_PENDING_ATTACHMENTS);
        const req = store.get(key);
        req.onsuccess = () => {
          const photos = Array.isArray(req.result?.photos) ? req.result.photos : [];
          resolve(photos);
        };
        req.onerror = () => resolve(this.memoryPending.get(key) || []);
      } catch {
        resolve(this.memoryPending.get(key) || []);
      }
    });
    */
    return Promise.resolve([]);
  }

  async loadState(): Promise<PersistedChatState> {
    /*
    // DISABLED: IndexedDB loadState commented out.
    // Conversations and messages now load exclusively from Firestore.
    const db = await this.getDb();
    if (!db) {
      const conversations = Array.from(this.memoryConversations.values()).map((c) =>
        this.deserializeConversation(c)
      );
      const activeConversationId = this.memoryMeta.get('activeConversationId') || '';
      const pendingPhotosByConv: Record<string, InspectionPhoto[]> = {};
      for (const [k, v] of this.memoryPending.entries()) {
        pendingPhotosByConv[k] = v.map((p) => ({ ...p }));
      }
      return { conversations, activeConversationId, pendingPhotosByConv };
    }

    return new Promise<PersistedChatState>((resolve) => {
      try {
        const tx = db.transaction(
          [STORE_CONVERSATIONS, STORE_META, STORE_PENDING_ATTACHMENTS],
          'readonly'
        );
        const convStore = tx.objectStore(STORE_CONVERSATIONS);
        const metaStore = tx.objectStore(STORE_META);
        const pendingStore = tx.objectStore(STORE_PENDING_ATTACHMENTS);

        const convReq = convStore.getAll();
        const metaReq = metaStore.get('activeConversationId');
        const pendingReq = pendingStore.getAll();

        tx.oncomplete = () => {
          const rawConvs = Array.isArray(convReq.result) ? convReq.result : [];
          const activeConversationId =
            typeof metaReq.result?.value === 'string' ? metaReq.result.value : '';
          const conversations = rawConvs
            .map((c) => this.deserializeConversation(c))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          const pendingPhotosByConv: Record<string, InspectionPhoto[]> = {};
          if (Array.isArray(pendingReq.result)) {
            for (const entry of pendingReq.result) {
              if (entry?.convKey && Array.isArray(entry.photos)) {
                pendingPhotosByConv[entry.convKey] = entry.photos;
              }
            }
          }
          resolve({ conversations, activeConversationId, pendingPhotosByConv });
        };
        tx.onerror = () =>
          resolve({ conversations: [], activeConversationId: '', pendingPhotosByConv: {} });
      } catch {
        resolve({ conversations: [], activeConversationId: '', pendingPhotosByConv: {} });
      }
    });
    */
    return Promise.resolve({
      conversations: [],
      activeConversationId: '',
      pendingPhotosByConv: {},
    });
  }

  /*
  // Helper serialization methods preserved in comments
  private serializeConversation(conv: Conversation): Conversation {
    return {
      ...conv,
      updatedAt:
        conv.updatedAt instanceof Date ? conv.updatedAt : new Date(conv.updatedAt || Date.now()),
      messages: (conv.messages || []).map((m) => ({
        ...m,
        timestamp:
          m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp || Date.now()),
        photos: Array.isArray(m.photos) ? m.photos.map((p) => ({ ...p })) : undefined,
      })),
    };
  }

  private deserializeConversation(raw: any): Conversation {
    const messages: ChatMessage[] = Array.isArray(raw?.messages)
      ? raw.messages.map((m: any) => ({
        ...m,
        timestamp: new Date(m?.timestamp || Date.now()),
        photos: Array.isArray(m?.photos) ? m.photos : undefined,
        evidenceMessage: m?.evidenceMessage ? { ...m.evidenceMessage } : undefined,
        questionBatch: m?.questionBatch ? { ...m.questionBatch } : undefined,
        inspectionProgress: m?.inspectionProgress ? { ...m.inspectionProgress } : undefined,
        draftSummary: m?.draftSummary ? { ...m.draftSummary } : undefined,
      }))
      : [];
    return {
      id: String(raw?.id || ''),
      title: String(raw?.title || 'New Chat'),
      updatedAt: new Date(raw?.updatedAt || Date.now()),
      previewSnippet: String(raw?.previewSnippet || ''),
      lastMessagePreview: String(raw?.lastMessagePreview || raw?.previewSnippet || ''),
      selectedBankId: raw?.selectedBankId,
      activeInspectionId: raw?.activeInspectionId,
      messages,
    };
  }
  */
}
