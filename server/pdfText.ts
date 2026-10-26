/**
 * Step 1 of PDF extraction: the PDF's own text layer, read locally with pdf.js.
 *
 * Text-based PDFs (typed exams, exported slides) carry their text; reading it directly is
 * instant, exact and free. Only when this yields too little text does the route fall back to
 * OCR (Gemini vision). Never throws: every failure comes back as a typed reason so the caller
 * can report exactly what happened instead of a generic "no readable text".
 */
import { createRequire } from 'node:module';
import path from 'node:path';

/** A page "has a text layer" when it yields at least this many letters/digits. */
export const MIN_PAGE_CHARS = 20;
/** The text layer is used when at least this share of pages has text; otherwise OCR runs. */
export const MIN_TEXT_PAGE_RATIO = 0.5;
export const PDF_TEXT_TIMEOUT_MS = 20_000;
/** Pages read before giving up on the rest (the remainder is reported, not silently dropped). */
export const MAX_PDF_PAGES = 300;

/** `unavailable`: the PDF reader itself failed on the server — says nothing about the file. */
export type PdfFailure = 'empty_file' | 'not_pdf' | 'encrypted' | 'corrupt' | 'timeout' | 'unavailable';

export type PdfTextResult =
  | {
      ok: true;
      /** Normalized text per page, in page order ('' for a page without a text layer). */
      pages: string[];
      pageCount: number;
      pagesWithText: number;
      /** Pages actually read (less than pageCount only when MAX_PDF_PAGES or the deadline cut it). */
      pagesRead: number;
      bytes: number;
    }
  | { ok: false; reason: PdfFailure; detail: string; bytes: number; pageCount?: number };

interface TextItem {
  str: string;
  dir?: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

let pdfjsPromise: Promise<any> | null = null;
let assetDir = '';

/** pdf.js ships as ESM only; loaded lazily (esbuild keeps this a real import() in the CJS bundle). */
function loadPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    assetDir = path.resolve(path.dirname(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')), '..', '..');
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').catch((err) => {
      pdfjsPromise = null;
      throw err;
    });
  }
  return pdfjsPromise;
}

/** pdf.js reads these as paths in Node but requires forward slashes and a trailing slash, even on Windows. */
const assetUrl = (dir: string): string => `${path.join(assetDir, dir).split(path.sep).join('/')}/`;

/** Arabic presentation forms and Latin ligatures only; NFKC on everything would turn x² into x2. */
const COMPAT_RANGES = /[ﬀ-﷿ﹰ-﻿]+/g;

/**
 * Text-layer cleanup: presentation forms → base letters, unmapped glyphs (U+FFFD, controls) →
 * spaces, tatweel removed, whitespace collapsed per line.
 */
export function normalizePdfText(text: string): string {
  return text
    .replace(COMPAT_RANGES, (s) => s.normalize('NFKC'))
    .replace(/[�\u0000-\u0008\u000B-\u001F\u007F]/g, ' ')
    .replace(/ـ/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Letters and digits: what makes a page "readable" (bullets, numbers-only footers don't). */
export const meaningfulChars = (text: string): number => (text.match(/[\p{L}\p{N}]/gu) ?? []).length;

/**
 * Joins one page's text items. Some PDFs (common with Arabic) emit one item per glyph, so items
 * are joined by their horizontal gap: a space only where there is a visible gap, a newline where
 * the baseline changes. Joining with blanks would spell "ت م ن و ا" for "تمنوا".
 */
export function joinTextItems(items: TextItem[]): string {
  let out = '';
  let prev: TextItem | null = null;
  for (const it of items) {
    if (typeof it.str !== 'string') continue;
    if (!it.str) {
      if (it.hasEOL) out += '\n';
      continue;
    }
    if (prev) {
      const size = Math.max(Math.abs(prev.transform[3]) || prev.height || 10, 1);
      const sameLine = Math.abs(it.transform[5] - prev.transform[5]) < size * 0.5;
      if (!sameLine) {
        if (!out.endsWith('\n')) out += '\n';
      } else if (!/\s$/.test(out) && !/^\s/.test(it.str)) {
        const pStart = prev.transform[4];
        const pEnd = pStart + prev.width;
        const cStart = it.transform[4];
        const cEnd = cStart + it.width;
        // Works for both directions: the distance between the two horizontal extents.
        const gap = Math.max(cStart - pEnd, pStart - cEnd);
        if (!(prev.width > 0 && it.width > 0) || gap > size * 0.2) out += ' ';
      }
    }
    out += it.str;
    if (it.hasEOL) out += '\n';
    prev = it;
  }
  return out;
}

const looksLikePdf = (buf: Buffer): boolean => buf.subarray(0, 1024).includes('%PDF-');

class Timeout extends Error {}

/** Reads the text layer of a PDF. `deadlineMs` bounds the whole call, including a stuck parse. */
export async function extractPdfText(buf: Buffer, timeoutMs = PDF_TEXT_TIMEOUT_MS): Promise<PdfTextResult> {
  const bytes = buf.length;
  if (bytes === 0) return { ok: false, reason: 'empty_file', detail: 'الملف فارغ (0 بايت).', bytes };
  if (!looksLikePdf(buf)) {
    return { ok: false, reason: 'not_pdf', detail: 'محتوى الملف ليس PDF (لا يبدأ بترويسة ‎%PDF).', bytes };
  }

  let pdfjs: any;
  try {
    pdfjs = await loadPdfjs();
  } catch (err: any) {
    // A missing/broken library is a server fault, never reported as a damaged file.
    console.error('[pdf-text] pdf.js failed to load:', err?.message || err);
    return { ok: false, reason: 'unavailable', detail: 'قارئ PDF غير متاح على الخادم', bytes };
  }

  const deadline = Date.now() + timeoutMs;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Timeout()), timeoutMs);
  });
  let task: any;
  let doc: any;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice(),
      cMapUrl: assetUrl('cmaps'),
      cMapPacked: true,
      standardFontDataUrl: assetUrl('standard_fonts'),
      isEvalSupported: false,
      disableFontFace: true,
      verbosity: 0,
    });
    doc = await Promise.race([task.promise, timeout]);
    const pageCount: number = doc.numPages;
    const pages: string[] = [];
    let pagesWithText = 0;
    const limit = Math.min(pageCount, MAX_PDF_PAGES);
    for (let i = 1; i <= limit; i++) {
      if (Date.now() > deadline) break;
      const page = await Promise.race([doc.getPage(i), timeout]);
      const content = await Promise.race([page.getTextContent(), timeout]);
      const text = normalizePdfText(joinTextItems(content.items as TextItem[]));
      page.cleanup?.();
      if (meaningfulChars(text) >= MIN_PAGE_CHARS) pagesWithText++;
      pages.push(text);
    }
    if (pageCount > 0 && pages.length === 0) throw new Timeout();
    return { ok: true, pages, pageCount, pagesWithText, pagesRead: pages.length, bytes };
  } catch (err: any) {
    if (err instanceof Timeout) {
      return {
        ok: false,
        reason: 'timeout',
        detail: `انتهت مهلة قراءة طبقة النص (${Math.round(timeoutMs / 1000)} ث).`,
        bytes,
        ...(doc ? { pageCount: doc.numPages } : {}),
      };
    }
    if (err?.name === 'PasswordException') {
      return { ok: false, reason: 'encrypted', detail: 'الملف محمي بكلمة مرور.', bytes };
    }
    return {
      ok: false,
      reason: 'corrupt',
      detail: `بنية ملف PDF تالفة أو غير مكتملة (${String(err?.message || err).slice(0, 120)}).`,
      bytes,
      ...(doc ? { pageCount: doc.numPages } : {}),
    };
  } finally {
    clearTimeout(timer);
    // Frees the parser even when it is still stuck on a malformed stream.
    task?.destroy().catch(() => {});
  }
}

/** True when the text layer covers enough of the document to skip OCR. */
export function textLayerIsUsable(r: Extract<PdfTextResult, { ok: true }>): boolean {
  return r.pagesWithText > 0 && r.pagesWithText / Math.max(r.pagesRead, 1) >= MIN_TEXT_PAGE_RATIO;
}
