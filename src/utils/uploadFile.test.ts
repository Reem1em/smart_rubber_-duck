import { describe, expect, it } from 'vitest';

import { UploadError, bytesToBase64, classifyUpload, readUpload } from './uploadFile';

const ARABIC = 'السؤال الأول: احسب قيمة س إذا كانت ٢س + ٣ = ١١.\nالسؤال الثاني: عرّف البروتوكول TCP.';

describe('readUpload — valid files', () => {
  it('reads an Arabic UTF-8 text file exactly', async () => {
    const file = new File([ARABIC], 'نموذج.txt', { type: 'text/plain' });
    const m = await readUpload(file);
    expect(m.kind).toBe('text');
    expect(m.rawText).toBe(ARABIC);
    expect(m.base64Data).toBeUndefined();
  });

  it('strips a UTF-8 BOM and decodes UTF-16LE files with a BOM', async () => {
    const bom = new File([new Uint8Array([0xef, 0xbb, 0xbf]), ARABIC], 'a.md', { type: '' });
    expect((await readUpload(bom)).rawText).toBe(ARABIC);

    const utf16 = new Uint8Array(2 + ARABIC.length * 2);
    utf16.set([0xff, 0xfe]);
    for (let i = 0; i < ARABIC.length; i++) {
      const c = ARABIC.charCodeAt(i);
      utf16[2 + i * 2] = c & 0xff;
      utf16[3 + i * 2] = c >> 8;
    }
    expect((await readUpload(new File([utf16], 'b.txt'))).rawText).toBe(ARABIC);
  });

  it('encodes a multi-megabyte PDF without overflowing the call stack', async () => {
    const bytes = new Uint8Array(3 * 1024 * 1024).map((_, i) => i % 251);
    const m = await readUpload(new File([bytes], 'big.pdf', { type: 'application/pdf' }));
    expect(m.kind).toBe('pdf');
    expect(m.mimeType).toBe('application/pdf');
    expect(Buffer.from(m.base64Data!, 'base64').equals(Buffer.from(bytes))).toBe(true);
  });

  it('sends .docx as base64 with the Word mime type (converted to text on the server)', async () => {
    const m = await readUpload(new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'exam.docx'));
    expect(m.kind).toBe('docx');
    expect(m.mimeType).toContain('wordprocessingml');
  });
});

describe('readUpload — failures are explicit errors, never a silent empty result', () => {
  it('rejects an empty file', async () => {
    await expect(readUpload(new File([], 'empty.pdf', { type: 'application/pdf' }))).rejects.toThrow(/فارغ/);
  });

  it('rejects a whitespace-only text file', async () => {
    await expect(readUpload(new File(['  \n\t '], 'blank.txt'))).rejects.toThrow(/لا يحتوي أي نص/);
  });

  it('rejects a Windows-1256 Arabic text file (not UTF-8), saying how to fix it', async () => {
    // "السؤال 1: ما هو TCP" in Windows-1256: Arabic letters are single bytes >= 0xC1.
    const cp1256 = new Uint8Array([0xc7, 0xe1, 0xd3, 0xc4, 0xc7, 0xe1, 0x20, 0x31, 0x3a, 0x20, 0xe3, 0xc7, 0x20, 0xe5, 0xe6, 0x20, 0x54, 0x43, 0x50]);
    await expect(readUpload(new File([cp1256], 'x.txt'))).rejects.toThrow(/UTF-8/);
  });
});

describe('classifyUpload — wrong types are rejected with a reason', () => {
  it.each([
    ['slides.pptx', /\.pptx/],
    ['old.doc', /\.doc/],
    ['virus.exe', /غير مدعومة/],
  ])('%s', (name, message) => {
    expect(() => classifyUpload({ name, type: '' })).toThrow(UploadError);
    expect(() => classifyUpload({ name, type: '' })).toThrow(message);
  });

  it('accepts by mime type when the extension is missing', () => {
    expect(classifyUpload({ name: 'scan', type: 'image/png' }).kind).toBe('image');
  });
});

describe('bytesToBase64', () => {
  it('matches Node base64 for arbitrary bytes', () => {
    const bytes = new Uint8Array(100_003).map((_, i) => (i * 7) % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});
