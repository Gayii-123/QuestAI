/**
 * Image Utilities: HEIC conversion, MIME type validation, and normalization
 */

export const ALLOWED_IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];

export const ALLOWED_IMAGE_EXTENSIONS: readonly string[] = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
];

/**
 * Checks whether a file or blob is in HEIC / HEIF format.
 * Inspects MIME type and file extension (case-insensitive).
 */
export function isHeicFile(file: File | Blob, customFileName?: string): boolean {
  if (!file) return false;
  const name = (file instanceof File ? file.name : customFileName || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (
    type === 'image/heic' ||
    type === 'image/heif' ||
    type === 'image/heic-sequence' ||
    type === 'image/heif-sequence'
  ) {
    return true;
  }

  if (name.endsWith('.heic') || name.endsWith('.heif')) {
    return true;
  }

  return false;
}

/**
 * Validates if the file is one of the supported image formats (JPG, PNG, WebP, HEIC/HEIF).
 * Robust against empty MIME types that occur when browsers (e.g. Chrome on Windows) do not have registered .heic MIME type.
 */
export function isSupportedImageFile(file: File): boolean {
  if (!file) return false;
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (ALLOWED_IMAGE_MIME_TYPES.includes(type)) {
    return true;
  }

  return ALLOWED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Converts a HEIC/HEIF file or Blob into a standard JPEG File.
 * If the file is not HEIC, returns the original file untouched.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  if (!isHeicFile(file)) {
    return file;
  }

  try {
    // Dynamic import allows lazy-loading the HEIC decoder bundle only when needed
    const heic2anyModule = await import('heic2any');
    const heic2any = ((heic2anyModule as any).default || heic2anyModule) as (options: {
      blob: Blob;
      toType?: string;
      quality?: number;
    }) => Promise<Blob | Blob[]>;

    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    });

    const blob = Array.isArray(result) ? result[0] : result;
    const baseName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '');
    const newFileName = `${baseName}.jpg`;

    return new File([blob], newFileName, {
      type: 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    });
  } catch (error: any) {
    console.error('HEIC conversion error for:', file.name, error);
    throw new Error(
      `Failed to convert HEIC photograph "${file.name}". Please ensure it is a valid HEIC/HEIF image.`
    );
  }
}
