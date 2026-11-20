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
 * Detects the actual image format by inspecting leading magic bytes.
 */
export async function getActualImageFormat(
  blob: Blob
): Promise<'jpeg' | 'png' | 'gif' | 'webp' | 'heic' | 'unknown'> {
  try {
    const slice = blob.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 4) return 'unknown';

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'jpeg';
    }

    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'png';
    }

    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'gif';
    }

    // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return 'webp';
    }

    // HEIF/HEIC: bytes 4-8 are 'ftyp' followed by major brands
    if (bytes.length >= 12) {
      const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
      if (ftyp === 'ftyp') {
        const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
        if (
          [
            'heic',
            'heix',
            'hevc',
            'hevx',
            'mif1',
            'msf1',
            'heim',
            'heis',
            'hevm',
            'hevs',
          ].includes(brand)
        ) {
          return 'heic';
        }
      }
    }
  } catch {
    // ignore
  }
  return 'unknown';
}

/**
 * Attempts to render an image onto an HTML canvas and export as JPEG.
 * Useful as a fallback when browser can natively decode the image or image is already browser-readable.
 */
async function convertViaBrowserCanvas(file: File): Promise<File | null> {
  // 1. Try createImageBitmap if available
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, 'image/jpeg', 0.85)
        );
        if (blob) {
          const baseName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '');
          return new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: file.lastModified || Date.now(),
          });
        }
      }
    }
  } catch {
    // createImageBitmap failed, try Image element next
  }

  // 2. Try Image element with Object URL
  return new Promise<File | null>((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
              (blob) => {
                URL.revokeObjectURL(url);
                if (blob) {
                  const baseName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '');
                  resolve(
                    new File([blob], `${baseName}.jpg`, {
                      type: 'image/jpeg',
                      lastModified: file.lastModified || Date.now(),
                    })
                  );
                } else {
                  resolve(null);
                }
              },
              'image/jpeg',
              0.85
            );
            return;
          }
        } catch {
          // ignore canvas draw error
        }
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Converts a HEIC/HEIF file or Blob into a standard JPEG File.
 * If the file is not HEIC, returns the original file untouched.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  if (!isHeicFile(file)) {
    return file;
  }

  // Step 1: Detect actual format via magic bytes
  const actualFormat = await getActualImageFormat(file);
  if (
    actualFormat === 'jpeg' ||
    actualFormat === 'png' ||
    actualFormat === 'webp' ||
    actualFormat === 'gif'
  ) {
    // Image was named .heic/.heif, but its byte content is already a browser-native image format!
    const baseName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '');
    const ext = actualFormat === 'jpeg' ? '.jpg' : `.${actualFormat}`;
    const mime = actualFormat === 'jpeg' ? 'image/jpeg' : `image/${actualFormat}`;
    return new File([file], `${baseName}${ext}`, {
      type: mime,
      lastModified: file.lastModified || Date.now(),
    });
  }

  // Step 2: Attempt conversion using heic2any
  try {
    const heic2anyModule = await import('heic2any');
    let heic2anyFn = (heic2anyModule as any).default || heic2anyModule;
    if (typeof heic2anyFn !== 'function' && typeof heic2anyFn?.default === 'function') {
      heic2anyFn = heic2anyFn.default;
    }

    // Ensure we pass a clean Blob with type 'image/heic'
    const inputBlob =
      file.type === 'image/heic' ? file : file.slice(0, file.size, 'image/heic');

    const result = await heic2anyFn({
      blob: inputBlob,
      toType: 'image/jpeg',
      quality: 0.85,
      multiple: false,
    });

    const blob = Array.isArray(result) ? result[0] : result;
    const baseName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '');
    const newFileName = `${baseName}.jpg`;

    return new File([blob], newFileName, {
      type: 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    });
  } catch (error: any) {
    console.warn('HEIC conversion via heic2any warning/error:', file.name, error);

    // If heic2any rejected because the image is already browser readable
    const errMsg = (error?.message || (typeof error === 'string' ? error : '')).toLowerCase();
    if (errMsg.includes('already browser readable') || errMsg.includes('err_user')) {
      const baseName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '');
      return new File([file], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: file.lastModified || Date.now(),
      });
    }

    // Attempt browser native decoding / canvas conversion fallback
    try {
      const fallbackFile = await convertViaBrowserCanvas(file);
      if (fallbackFile) {
        return fallbackFile;
      }
    } catch {
      // fallback failed
    }

    throw new Error(
      `Failed to convert HEIC photograph "${file.name}". Please ensure it is a valid HEIC/HEIF image.`
    );
  }
}
