/** Route-level tests for file types that never reach the model (Defect A). */
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../gemini', () => ({
  generateWithRetry: vi.fn(async () => {
    throw new Error('model must not be called for these file types');
  }),
  isQuotaOrRateLimitError: () => false,
}));

import { MSG_DOCX_CORRUPT, MSG_OFFICE_UNSUPPORTED } from '../docText';
import { handleExtractSlides } from './extractSlides';

function call(body: any) {
  const res: any = { statusCode: 200 };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.json = (b: any) => ((res.body = b), res);
  return Promise.resolve(handleExtractSlides({ body } as any, res)).then(() => res);
}

async function docx(text: string): Promise<string> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return (await zip.generateAsync({ type: 'nodebuffer' })).toString('base64');
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('POST /api/extract-slides — non-model file types', () => {
  it('extracts Arabic text from a .docx without a model call', async () => {
    const text = 'السؤال الأول: اشرح وظيفة بروتوكول TCP في طبقة النقل.';
    const res = await call({ sourceId: 's1', fileName: 'نموذج.docx', base64Data: await docx(text), mimeType: DOCX, concepts: [] });
    expect(res.body.status).toBe('ready');
    expect(res.body.chunks.map((c: any) => c.text).join(' ')).toContain('بروتوكول TCP');
  });

  it('reports a corrupt .docx as failed with the reason', async () => {
    const res = await call({ sourceId: 's2', fileName: 'bad.docx', base64Data: Buffer.from('nope').toString('base64'), mimeType: DOCX });
    expect(res.body).toMatchObject({ status: 'failed', error: MSG_DOCX_CORRUPT });
  });

  it('rejects .pptx as unsupported with what to do', async () => {
    const res = await call({ sourceId: 's3', fileName: 'slides.pptx', base64Data: 'AAAA', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    expect(res.body).toMatchObject({ status: 'unsupported', error: MSG_OFFICE_UNSUPPORTED });
  });

  it('names the mime type when it cannot be read', async () => {
    const res = await call({ sourceId: 's4', fileName: 'a.bin', base64Data: 'AAAA', mimeType: 'application/zip' });
    expect(res.body.status).toBe('unsupported');
    expect(res.body.error).toContain('application/zip');
  });
});
