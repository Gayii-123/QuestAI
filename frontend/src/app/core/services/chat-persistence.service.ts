import { Injectable } from '@angular/core';
import { Conversation, ChatMessage } from '../models/chat.models';
import { InspectionPhoto } from '../../features/inspection/site-inspection.models';

const DB_NAME = 'questai_chat_db';
const DB_VERSION = 1;
const STORE_CONVERSATIONS = 'conversations';
const STORE_META = 'meta';
const STORE_PENDING_ATTACHMENTS = 'pending_attachments';

export interface PersistedChatState {
  conversations: Conversation[];
  activeConversationId: string;
  pendingPhotosByConv: Record<string, InspectionPhoto[]>;
}

/**
 * IndexedDB persistence service for QuestAI conversations and photograph attachments.
 * Stores sent message photographs and pending composer attachments in IndexedDB
 * (never storing large Base64 image payloads in localStorage).
 * Includes an automatic in-memory fallback for non-browser test environments.
 */
@Injectable({ providedIn: 'root' })
export class ChatPersistenceService {
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

  async saveConversations(
    conversations: Conversation[],
    activeConversationId: string
  ): Promise<void> {
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
  }

  async savePendingAttachments(convKey: string, photos: InspectionPhoto[]): Promise<void> {
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
  }

  async loadPendingAttachments(convKey: string): Promise<InspectionPhoto[]> {
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
  }

  async loadState(): Promise<PersistedChatState> {
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
          const conversations = rawConvs
            .map((c) => this.deserializeConversation(c))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          const activeConversationId =
            typeof metaReq.result?.value === 'string' ? metaReq.result.value : '';
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
  }

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
        }))
      : [];
    return {
      id: String(raw?.id || ''),
      title: String(raw?.title || 'Conversation'),
      updatedAt: new Date(raw?.updatedAt || Date.now()),
      previewSnippet: String(raw?.previewSnippet || ''),
      selectedBankId: raw?.selectedBankId,
      messages,
    };
  }
}

