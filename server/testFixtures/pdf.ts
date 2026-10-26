/**
 * Minimal, valid PDFs built in code for extraction tests: no binary fixtures in the repo.
 * Offsets in the xref table are computed, so pdf.js opens them without repair.
 */

function buildPdf(objects: string[]): Buffer {
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const escape = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/** A text-based PDF: one page per entry, each line drawn with Helvetica (a real text layer). */
export function textPdf(pages: string[][]): Buffer {
  const pageIds = pages.map((_, i) => 4 + i * 2);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  pages.forEach((lines, i) => {
    const ops = lines.map((l, j) => `BT /F1 12 Tf 72 ${720 - j * 18} Td (${escape(l)}) Tj ET`).join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(ops, 'latin1')} >>\nstream\n${ops}\nendstream`
    );
  });
  return buildPdf(objects);
}

/** An image-only PDF (like a scan): pages draw a raster image and carry no text layer at all. */
export function imageOnlyPdf(pageCount = 2): Buffer {
  const pageIds = Array.from({ length: pageCount }, (_, i) => 4 + i * 2);
  const pixels = 'FF00FF00FF00FF00'; // 4x4 grey image, hex-encoded
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    `<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${pixels.length + 1} >>\nstream\n${pixels}>\nendstream`,
  ];
  const ops = 'q 500 0 0 700 50 50 cm /Im1 Do Q';
  for (const id of pageIds) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 3 0 R >> >> /Contents ${id + 1} 0 R >>`,
      `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`
    );
  }
  return buildPdf(objects);
}

/** Starts like a PDF, then garbage: no catalog, no xref, no pages. */
export const corruptPdf = (): Buffer => Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<< /Type /Cat', 'latin1');

export const SAMPLE_EXAM_PAGES = [
  [
    'English Revision Exam - Model A',
    'Q1. Choose the correct form: She (go / goes) to school every day.',
    'Q2. Write the past tense of the verb "write".',
  ],
  ['Q3. Read the passage and answer: What is the main idea of paragraph two?', 'Q4. Correct the error: He have two brothers.'],
];
