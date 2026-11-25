/**
 * QuestAI — SSRA Evidence Processing Service
 *
 * Client-side image scaling (max 1920x1080 JPEG), HEIC conversion,
 * and unique evidence identifier generation.
 */

import { Injectable } from '@angular/core';
import { SsraEvidencePhoto } from '../models/ssra.models';
import { isHeicFile, convertHeicToJpeg } from '../../../core/utils/image-utils';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const JPEG_QUALITY = 0.85;

@Injectable({
  providedIn: 'root',
})
export class SsraEvidenceService {
  /**
   * Generates a standard UUID v4.
   */
  generateUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async compressImage(file: File, category: 'pre-work' | 'closing' | 'question' = 'pre-work'): Promise<SsraEvidencePhoto> {
    return this.processPhoto(file, category);
  }

  /**
   * Processes an uploaded File (including HEIC), compresses to max 1920x1080 JPEG,
   * and returns an SsraEvidencePhoto object.
   */
  async processPhoto(file: File, category: 'pre-work' | 'closing' | 'question' = 'pre-work'): Promise<SsraEvidencePhoto> {
    let targetBlob: Blob = file;
    let fileName = file.name;

    if (isHeicFile(file)) {
      try {
        targetBlob = await convertHeicToJpeg(file);
        fileName = fileName.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
      } catch (err) {
        console.warn('[SsraEvidence] HEIC conversion fallback, using original file', err);
      }
    }

    const compressedDataUrl = await this.scaleCanvasToJpeg(targetBlob);
    const id = `ev-${this.generateUuid()}`;

    return {
      id,
      name: fileName,
      url: compressedDataUrl,
      category,
      size: Math.round((compressedDataUrl.length * 3) / 4),
      mimeType: 'image/jpeg',
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Scales down image on an HTML Canvas to fit within 1920x1080 while preserving aspect ratio.
   */
  private scaleCanvasToJpeg(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve(compressed);
        };
        img.onerror = (err) => reject(err);
        img.src = reader.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  }
}
