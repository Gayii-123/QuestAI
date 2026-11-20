import { isHeicFile, isSupportedImageFile, convertHeicToJpeg } from './image-utils';

export function runImageUtilsTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err?.message || String(err) });
    }
  }

  test('isHeicFile recognizes MIME types', () => {
    assert(isHeicFile({ type: 'image/heic' } as Blob), 'image/heic');
    assert(isHeicFile({ type: 'IMAGE/HEIC' } as Blob), 'IMAGE/HEIC');
    assert(isHeicFile({ type: 'image/heif' } as Blob), 'image/heif');
    assert(isHeicFile({ type: 'image/heic-sequence' } as Blob), 'image/heic-sequence');
    assert(isHeicFile({ type: 'image/heif-sequence' } as Blob), 'image/heif-sequence');
  });

  test('isHeicFile recognizes file extensions even with empty or missing MIME (Windows behavior)', () => {
    const file1 = { name: 'photo.heic', type: '' } as File;
    const file2 = { name: 'IMG_4021.HEIC', type: '' } as File;
    const file3 = { name: 'site.heif', type: 'application/octet-stream' } as File;
    const file4 = { name: 'capture.HEIF', type: '' } as File;

    assert(isHeicFile(file1), 'photo.heic');
    assert(isHeicFile(file2), 'IMG_4021.HEIC');
    assert(isHeicFile(file3), 'site.heif');
    assert(isHeicFile(file4), 'capture.HEIF');
  });

  test('isHeicFile returns false for standard formats', () => {
    assert(!isHeicFile({ name: 'photo.jpg', type: 'image/jpeg' } as File), 'jpg');
    assert(!isHeicFile({ name: 'photo.png', type: 'image/png' } as File), 'png');
    assert(!isHeicFile({ name: 'photo.webp', type: 'image/webp' } as File), 'webp');
    assert(!isHeicFile({ name: 'doc.pdf', type: 'application/pdf' } as File), 'pdf');
  });

  test('isSupportedImageFile accepts JPG, PNG, WebP, HEIC, HEIF with proper or empty MIME', () => {
    assert(isSupportedImageFile({ name: 'a.jpg', type: 'image/jpeg' } as File), 'jpg');
    assert(isSupportedImageFile({ name: 'b.PNG', type: 'image/png' } as File), 'png');
    assert(isSupportedImageFile({ name: 'c.webp', type: 'image/webp' } as File), 'webp');
    assert(isSupportedImageFile({ name: 'd.heic', type: 'image/heic' } as File), 'heic with mime');
    assert(isSupportedImageFile({ name: 'e.HEIC', type: '' } as File), 'heic with empty mime');
    assert(isSupportedImageFile({ name: 'f.heif', type: 'image/heif' } as File), 'heif with mime');
    assert(isSupportedImageFile({ name: 'g.HEIF', type: '' } as File), 'heif with empty mime');
  });

  test('isSupportedImageFile rejects unsupported files', () => {
    assert(!isSupportedImageFile({ name: 'doc.pdf', type: 'application/pdf' } as File), 'pdf');
    assert(!isSupportedImageFile({ name: 'program.exe', type: 'application/x-msdownload' } as File), 'exe');
    assert(!isSupportedImageFile({ name: 'video.mp4', type: 'video/mp4' } as File), 'mp4');
    assert(!isSupportedImageFile({ name: 'archive.zip', type: 'application/zip' } as File), 'zip');
  });

  test('convertHeicToJpeg returns non-HEIC file untouched', async () => {
    const originalFile = { name: 'photo.jpg', type: 'image/jpeg', size: 100 } as File;
    const result = await convertHeicToJpeg(originalFile);
    assert(result === originalFile, 'Non-heic file should be returned as-is');
  });

  return {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results,
  };
}
