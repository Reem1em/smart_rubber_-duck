/**
 * Student-facing wording for an extraction that produced no text. Replaces the old generic
 * "the file was read completely and has no readable text", which was shown even when nothing
 * had actually been read (e.g. the OCR model timed out or answered in the wrong format).
 */
import type { ExtractionDiagnostic, ExtractorName, ExtractorOutcome } from '../src/types';
import type { PdfFailure } from './pdfText';

const EXTRACTOR_LABEL: Record<ExtractorName, string> = {
  pdf_text_layer: 'قراءة طبقة النص المضمّنة في PDF',
  gemini_ocr: 'التعرف الضوئي على الصفحات (Gemini)',
};

const OUTCOME_LABEL: Record<ExtractorOutcome, string> = {
  ok: 'نجحت',
  empty: 'لم تُنتج نصاً',
  failed: 'فشلت',
  timeout: 'انتهت مهلتها',
  skipped: 'لم تُشغَّل',
};

const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} م.ب` : `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;

function hint(d: ExtractionDiagnostic, pdfFailure?: PdfFailure): string {
  if (pdfFailure === 'empty_file') return 'الملف فارغ؛ ارفع النسخة الصحيحة.';
  if (pdfFailure === 'not_pdf') return 'الملف ليس PDF حقيقياً رغم امتداده؛ افتحه وصدّره PDF من جديد.';
  if (pdfFailure === 'encrypted') return 'أزل كلمة المرور من الملف ثم ارفعه.';
  if (pdfFailure === 'corrupt') return 'الملف تالف أو غير مكتمل؛ أعد تنزيله أو صدّره PDF من جديد.';
  const ocr = d.extractors.find((e) => e.name === 'gemini_ocr');
  if (ocr && (ocr.outcome === 'failed' || ocr.outcome === 'timeout')) {
    return 'خدمة التعرف الضوئي لم تكمل الآن؛ أعد المحاولة بعد قليل، أو ارفع نسخة نصية (PDF مُصدَّر أو ‎.docx).';
  }
  return 'يبدو أن الصفحات صور بلا نص واضح؛ ارفع نسخة أوضح أو ملفاً نصياً.';
}

export function formatDiagnostic(d: ExtractionDiagnostic, pdfFailure?: PdfFailure): string {
  const facts = [
    `الحجم المقروء ${formatSize(d.bytesRead)}`,
    `عدد الصفحات: ${d.pageCount ?? 'غير معروف'}`,
    ...(d.pagesWithTextLayer !== null ? [`صفحات فيها طبقة نص: ${d.pagesWithTextLayer}`] : []),
  ].join('، ');
  const tried = d.extractors
    .map((e) => `${EXTRACTOR_LABEL[e.name]}: ${OUTCOME_LABEL[e.outcome]}${e.detail ? ` (${e.detail})` : ''}`)
    .join('؛ ');
  return `تعذر استخراج نص «${d.fileName}». ${facts}. ما جُرِّب: ${tried || 'لا شيء'}. ${hint(d, pdfFailure)}`;
}
