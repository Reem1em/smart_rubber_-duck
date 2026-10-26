/**
 * One reader for every study-file upload (course chapters, exam models).
 *
 * Classifies the file up front so an unsupported type is rejected with a reason instead of
 * being accepted and failing later, and encodes binaries in chunks: spreading a whole file
 * into `String.fromCharCode(...)` overflows the call stack on ordinary-sized PDFs.
 */
import type { MaterialInput } from '../types';

export type UploadKind = 'pdf' | 'image' | 'docx' | 'text';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** The `accept` attribute matching what the server can actually read. */
export const SUPPORTED_UPLOAD_ACCEPT = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp';
export const SUPPORTED_UPLOAD_LABEL = 'PDF، Word ‎(.docx)، صور (PNG/JPG)، أو ملف نصي (TXT/MD)';

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

const ext = (name: string) => (name.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();

export function classifyUpload(file: Pick<File, 'name' | 'type'>): { kind: UploadKind; mimeType: string } {
  const e = ext(file.name);
  const type = file.type || '';
  if (e === 'pdf' || type === 'application/pdf') return { kind: 'pdf', mimeType: 'application/pdf' };
  if (e === 'docx' || type === DOCX_MIME) return { kind: 'docx', mimeType: DOCX_MIME };
  if (['png', 'jpg', 'jpeg', 'webp'].includes(e) || type.startsWith('image/')) {
    return { kind: 'image', mimeType: type.startsWith('image/') ? type : e === 'png' ? 'image/png' : e === 'webp' ? 'image/webp' : 'image/jpeg' };
  }
  if (['txt', 'md', 'markdown'].includes(e) || type.startsWith('text/')) return { kind: 'text', mimeType: 'text/plain' };
  if (['doc', 'ppt', 'pptx', 'xls', 'xlsx'].includes(e)) {
    throw new UploadError(`ملفات ‎.${e} غير مدعومة. احفظ الملف بصيغة PDF أو ‎.docx ثم ارفعه من جديد.`);
  }
  throw new UploadError(`صيغة الملف "${file.name}" غير مدعومة. الصيغ المدعومة: ${SUPPORTED_UPLOAD_LABEL}.`);
}

const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Text files are decoded as UTF-8 (Arabic-safe); a UTF-16 file with a byte-order mark is
 * honoured. A file that is not valid UTF-8 is reported with how to fix it, not passed on.
 */
async function decodeText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
  else text = new TextDecoder('utf-8').decode(bytes);
  text = text.replace(/^﻿/, '');
  // A legacy-encoded file (e.g. Windows-1256 Arabic) decodes to mostly U+FFFD: report it, don't pass garbage on.
  const visible = text.replace(/\s/g, '');
  const replaced = (visible.match(/�/g) ?? []).length;
  if (replaced > 0 && replaced / visible.length > 0.1) {
    throw new UploadError(
      `تعذر فك ترميز الملف النصي "${file.name}" كـ UTF-8. احفظه بترميز UTF-8 (في المفكرة: حفظ باسم ← الترميز UTF-8) ثم ارفعه.`
    );
  }
  return text;
}

/** Reads an upload into the MaterialInput the analysis/extraction endpoints accept. */
export async function readUpload(file: File): Promise<MaterialInput & { kind: UploadKind }> {
  const { kind, mimeType } = classifyUpload(file);
  if (file.size === 0) throw new UploadError(`الملف "${file.name}" فارغ (0 بايت).`);
  const base = { fileName: file.name, fileSize: file.size, fileType: kind, kind };
  if (kind === 'text') {
    const rawText = await decodeText(file);
    if (!rawText.trim()) throw new UploadError(`الملف النصي "${file.name}" لا يحتوي أي نص.`);
    return { ...base, rawText };
  }
  return { ...base, base64Data: bytesToBase64(new Uint8Array(await file.arrayBuffer())), mimeType };
}
