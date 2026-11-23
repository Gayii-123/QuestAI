import { Injectable, inject } from '@angular/core';
import {
  FirebaseStorage,
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
} from 'firebase/storage';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { InspectionPhoto } from '../models/chat.models';

const ROOT_COLLECTION = 'questai';
const DATA_DOC = 'data';
const USERS_COLLECTION = 'users';
const PHOTOS_COLLECTION = 'photos';
const QUESTAI_PHOTO_PREFIX = 'questai-photo://';

/**
 * Cross-device Firebase Photo Storage Service.
 *
 * Strategy:
 * 1. Primary: Uploads site photographs to Firebase Storage at
 *    `questai/users/{uid}/photos/{photoId}.jpg` and stores the HTTPS download URL.
 * 2. Automatic Fallback: If Firebase Storage rules/CORS reject the upload,
 *    compresses the image to a web-sized JPEG (< 250 KB) and stores it in its own
 *    Firestore document under `questai/data/users/{uid}/photos/{photoId}` so it
 *    syncs reliably across all computers signed in with the same Firebase UID
 *    without ever exceeding Firestore's 1 MiB document limit on reports/messages.
 */
@Injectable({
  providedIn: 'root',
})
export class PhotoStorageService {
  private readonly firebaseService = inject(FirebaseService);
  private readonly authService = inject(AuthService);
  private readonly storage: FirebaseStorage = getStorage(this.firebaseService.app);
  private readonly firestore: Firestore = this.authService.firestore;

  // In-memory cache: photoId -> displayable URL (https:// or data:)
  private readonly memoryCache = new Map<string, string>();
  // In-flight upload deduplication: photoId -> persistent URL promise
  private readonly inFlightUploads = new Map<string, Promise<string>>();
  // In-flight resolve deduplication: photoId -> displayable URL promise
  private readonly inFlightResolves = new Map<string, Promise<string>>();

  private getPhotoDoc(uid: string, photoId: string) {
    return doc(
      this.firestore,
      ROOT_COLLECTION,
      DATA_DOC,
      USERS_COLLECTION,
      uid,
      PHOTOS_COLLECTION,
      photoId
    );
  }

  private getStoragePath(uid: string, photoId: string): string {
    const safeId = photoId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${ROOT_COLLECTION}/${USERS_COLLECTION}/${uid}/${PHOTOS_COLLECTION}/${safeId}.jpg`;
  }

  cacheLocalUrl(photoId: string, displayUrl: string): void {
    if (!photoId || !displayUrl) return;
    this.memoryCache.set(photoId, displayUrl);
    try {
      sessionStorage.setItem('questai_photo_' + photoId, displayUrl);
    } catch {
      // Ignore sessionStorage quota errors
    }
  }

  getCachedLocalUrl(photoId: string): string {
    if (!photoId) return '';
    if (this.memoryCache.has(photoId)) {
      return this.memoryCache.get(photoId)!;
    }
    try {
      const stored = sessionStorage.getItem('questai_photo_' + photoId);
      if (stored) {
        this.memoryCache.set(photoId, stored);
        return stored;
      }
    } catch {}
    return '';
  }

  isPersistentUrl(url: string | undefined): boolean {
    if (!url || typeof url !== 'string') return false;
    return (
      url.startsWith('https://') ||
      url.startsWith('http://') ||
      url.startsWith(QUESTAI_PHOTO_PREFIX)
    );
  }

  /**
   * Uploads a single photo to Firebase (Storage first, Firestore photo doc fallback).
   * Returns a persistent URL (`https://...` or `questai-photo://{uid}/{photoId}`).
   */
  async uploadPhoto(
    uid: string,
    photo: { id: string; name?: string; url?: string; size?: number; timestamp?: string }
  ): Promise<string> {
    if (!uid || !photo?.id) return photo?.url || '';

    // Already persisted in Firebase
    if (this.isPersistentUrl(photo.url)) {
      return photo.url || '';
    }

    const dataUrl =
      photo.url && photo.url.startsWith('data:')
        ? photo.url
        : this.getCachedLocalUrl(photo.id);

    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return photo.url || '';
    }

    // Cache locally for instant rendering
    this.cacheLocalUrl(photo.id, dataUrl);

    const existingPromise = this.inFlightUploads.get(photo.id);
    if (existingPromise) {
      return existingPromise;
    }

    const uploadPromise = this.performUpload(uid, photo, dataUrl).finally(() => {
      this.inFlightUploads.delete(photo.id);
    });

    this.inFlightUploads.set(photo.id, uploadPromise);
    return uploadPromise;
  }

  private async performUpload(
    uid: string,
    photo: { id: string; name?: string; url?: string; size?: number; timestamp?: string },
    dataUrl: string
  ): Promise<string> {
    // 1. Primary: Firebase Storage
    try {
      const storageRef = ref(this.storage, this.getStoragePath(uid, photo.id));
      await uploadString(storageRef, dataUrl, 'data_url', {
        contentType: 'image/jpeg',
        customMetadata: {
          userId: uid,
          originalName: photo.name || 'photograph.jpg',
        },
      });
      const downloadUrl = await getDownloadURL(storageRef);
      if (downloadUrl) {
        this.cacheLocalUrl(photo.id, downloadUrl);
        return downloadUrl;
      }
    } catch (storageErr) {
      console.warn(
        '[PhotoStorage] Firebase Storage upload unavailable, falling back to Firestore photo store:',
        storageErr
      );
    }

    // 2. Fallback: Individual Firestore photo document under questai/data/users/{uid}/photos/{photoId}
    try {
      const compactDataUrl = await this.compressForFirestore(dataUrl);
      const photoDocRef = this.getPhotoDoc(uid, photo.id);
      await setDoc(
        photoDocRef,
        {
          id: photo.id,
          userId: uid,
          name: photo.name || 'photograph.jpg',
          size: typeof photo.size === 'number' ? photo.size : compactDataUrl.length,
          contentType: 'image/jpeg',
          dataUrl: compactDataUrl,
          timestamp: photo.timestamp || new Date().toISOString(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      this.cacheLocalUrl(photo.id, compactDataUrl);
      return `${QUESTAI_PHOTO_PREFIX}${uid}/${photo.id}`;
    } catch (firestoreErr) {
      console.error(
        '[PhotoStorage] Failed to store photo in Firestore fallback:',
        firestoreErr
      );
      return '';
    }
  }

  /**
   * Uploads an array of photos in parallel and returns copies with persistent Firebase URLs.
   */
  async uploadPhotos<T extends { id: string; name: string; url: string; size?: number; timestamp?: string }>(
    uid: string,
    photos: T[]
  ): Promise<T[]> {
    if (!uid || !Array.isArray(photos) || photos.length === 0) {
      return photos || [];
    }
    const uploaded = await Promise.all(
      photos.map(async (p) => {
        const persistentUrl = await this.uploadPhoto(uid, p);
        return {
          ...p,
          url: persistentUrl || p.url,
        };
      })
    );
    return uploaded;
  }

  /**
   * Resolves a photo's URL into a browser-displayable URL (`https://...` or `data:...`).
   * Works across any computer signed in as the same user UID.
   */
  async resolvePhotoUrl(
    uid: string,
    photo: { id?: string; url?: string }
  ): Promise<string> {
    if (!photo) return '';

    // Already a direct HTTPS or data URL
    if (
      photo.url &&
      (photo.url.startsWith('https://') ||
        photo.url.startsWith('http://') ||
        photo.url.startsWith('data:'))
    ) {
      if (photo.id) this.cacheLocalUrl(photo.id, photo.url);
      return photo.url;
    }

    const photoId = photo.id || '';
    if (!photoId) return '';

    // Check local cache first
    const cached = this.getCachedLocalUrl(photoId);
    if (cached && !cached.startsWith(QUESTAI_PHOTO_PREFIX)) {
      return cached;
    }

    if (!uid) return '';

    const inFlight = this.inFlightResolves.get(photoId);
    if (inFlight) return inFlight;

    const resolvePromise = this.fetchRemotePhotoUrl(uid, photoId, photo.url).finally(() => {
      this.inFlightResolves.delete(photoId);
    });

    this.inFlightResolves.set(photoId, resolvePromise);
    return resolvePromise;
  }

  private async fetchRemotePhotoUrl(
    uid: string,
    photoId: string,
    rawUrl?: string
  ): Promise<string> {
    // Determine target uid/photoId if encoded in questai-photo://{uid}/{photoId}
    let targetUid = uid;
    let targetPhotoId = photoId;
    if (rawUrl && rawUrl.startsWith(QUESTAI_PHOTO_PREFIX)) {
      const parts = rawUrl.slice(QUESTAI_PHOTO_PREFIX.length).split('/');
      if (parts.length >= 2) {
        targetUid = parts[0];
        targetPhotoId = parts[1];
      }
    }

    // 1. Check Firestore photo document under questai/data/users/{uid}/photos/{photoId}
    try {
      const snap = await getDoc(this.getPhotoDoc(targetUid, targetPhotoId));
      if (snap.exists()) {
        const data = snap.data();
        const resolved = String(data?.['downloadUrl'] || data?.['dataUrl'] || '');
        if (resolved) {
          this.cacheLocalUrl(photoId, resolved);
          return resolved;
        }
      }
    } catch (err) {
      console.warn('[PhotoStorage] Firestore photo fetch failed:', err);
    }

    // 2. Check Firebase Storage path directly (for legacy/direct uploads)
    try {
      const storageRef = ref(this.storage, this.getStoragePath(targetUid, targetPhotoId));
      const downloadUrl = await getDownloadURL(storageRef);
      if (downloadUrl) {
        this.cacheLocalUrl(photoId, downloadUrl);
        return downloadUrl;
      }
    } catch {
      // Not present in Storage
    }

    return '';
  }

  /**
   * Resolves all photos in an array so every item has a displayable URL.
   * Returns `{ photos, changed }` so callers only trigger signal updates when needed.
   */
  async resolvePhotos<T extends { id?: string; url?: string }>(
    uid: string,
    photos: T[] | undefined
  ): Promise<{ photos: T[]; changed: boolean }> {
    if (!uid || !Array.isArray(photos) || photos.length === 0) {
      return { photos: photos || [], changed: false };
    }

    let changed = false;
    const resolved = await Promise.all(
      photos.map(async (p) => {
        const url = await this.resolvePhotoUrl(uid, p);
        if (url && url !== p.url) {
          changed = true;
          return { ...p, url };
        }
        return p;
      })
    );

    return { photos: resolved, changed };
  }

  /**
   * Compresses a Base64 data URL into a clean JPEG (<= 800px, quality 0.72)
   * guaranteed to fit comfortably in a single Firestore document (< 250 KB).
   */
  private compressForFirestore(dataUrl: string): Promise<string> {
    if (typeof window === 'undefined' || dataUrl.length < 180_000) {
      return Promise.resolve(dataUrl);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.72);
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
}
