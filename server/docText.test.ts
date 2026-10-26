import { describe, expect, it } from 'vitest';
// jszip is mammoth's own dependency; used here only to build a real .docx fixture in memory.
import JSZip from 'jszip';

import { MSG_DOCX_CORRUPT, MSG_DOCX_EMPTY, docxToText, isDocx, isUnreadableOffice } from './docText';

async function buildDocx(paragraphs: string[]): Promise<string> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  );
  const body = paragraphs.map((p) => `<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('');
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  );
  return (await zip.generateAsync({ type: 'nodebuffer' })).toString('base64');
}

describe('docxToText', () => {
  it('extracts Arabic (RTL) paragraphs from a real .docx', async () => {
    const result = await docxToText(await buildDocx(['السؤال الأول: ما هو بروتوكول TCP؟', 'السؤال الثاني: احسب ٢ + ٣.']));
    expect(result).toEqual({ text: 'السؤال الأول: ما هو بروتوكول TCP؟\n\nالسؤال الثاني: احسب ٢ + ٣.' });
  });

  it('reports an empty document instead of returning empty text', async () => {
    expect(await docxToText(await buildDocx([]))).toEqual({ error: MSG_DOCX_EMPTY });
  });

  it('reports a corrupt file instead of throwing', async () => {
    expect(await docxToText(Buffer.from('not a zip at all').toString('base64'))).toEqual({ error: MSG_DOCX_CORRUPT });
  });
});

describe('file type helpers', () => {
  it('recognizes .docx by name or mime', () => {
    expect(isDocx('a.DOCX', '')).toBe(true);
    expect(isDocx('a', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    expect(isDocx('a.pdf', 'application/pdf')).toBe(false);
  });

  it('flags formats the server cannot read', () => {
    expect(isUnreadableOffice('s.pptx', '')).toBe(true);
    expect(isUnreadableOffice('s.doc', '')).toBe(true);
    expect(isUnreadableOffice('s.docx', '')).toBe(false);
  });
});
