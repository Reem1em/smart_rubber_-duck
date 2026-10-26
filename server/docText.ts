/**
 * Plain text from Word (.docx) uploads. The model can't read Office files directly, so a .docx
 * is converted here and then handled exactly like an uploaded text file.
 */
import mammoth from 'mammoth';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const isDocx = (fileName: unknown, mimeType: unknown): boolean =>
  mimeType === DOCX_MIME || (typeof fileName === 'string' && /\.docx$/i.test(fileName));

/** Legacy Office formats the server cannot read at all. */
export const isUnreadableOffice = (fileName: unknown, mimeType: unknown): boolean =>
  (typeof fileName === 'string' && /\.(doc|ppt|pptx|xls|xlsx)$/i.test(fileName)) ||
  (typeof mimeType === 'string' && /(msword|powerpoint|presentationml|ms-excel|spreadsheetml)/i.test(mimeType));

export const MSG_DOCX_CORRUPT =
  'تعذرت قراءة ملف Word: الملف تالف أو محمي بكلمة مرور أو ليس ملف .docx حقيقياً. افتحه واحفظه من جديد بصيغة .docx أو صدّره PDF ثم ارفعه.';
export const MSG_DOCX_EMPTY =
  'تمت قراءة ملف Word بنجاح لكنه لا يحتوي نصاً قابلاً للاستخراج (قد يكون محتواه صوراً فقط). صدّره PDF ثم ارفعه ليُقرأ بالتعرف الضوئي.';
export const MSG_OFFICE_UNSUPPORTED =
  'صيغة الملف غير مدعومة (‎.doc / .ppt / .pptx). احفظه بصيغة PDF أو ‎.docx ثم ارفعه من جديد.';

export type DocxResult = { text: string } | { error: string };

/** Never throws: a corrupt or empty document becomes a student-facing reason. */
export async function docxToText(base64Data: string): Promise<DocxResult> {
  let text: string;
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(base64Data, 'base64') });
    text = String(result.value ?? '');
  } catch {
    return { error: MSG_DOCX_CORRUPT };
  }
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return normalized ? { text: normalized } : { error: MSG_DOCX_EMPTY };
}
