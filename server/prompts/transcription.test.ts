import { describe, expect, it } from 'vitest';

import { buildDiagnosePrompt } from './diagnose';
import { buildSocraticEvalPrompt } from './socraticEval';

const concept = { name: 'الاستدعاء الذاتي', summary: 'دالة تستدعي نفسها', keyPrinciples: ['شرط التوقف'] };

describe('transcription tolerance', () => {
  it('protects the diagnosis score and flaw list', () => {
    const prompt = buildDiagnosePrompt({
      concept,
      studentExplanation: 'الريكيرجن دالة تنادي نفسها',
      confidenceLevel: 70,
      courseScopeBlock: '',
    });
    expect(prompt).toContain('TRANSCRIPTION TOLERANCE MANDATE');
    expect(prompt).toContain('`understandingScore`');
    expect(prompt).toContain('`identifiedFlaws`');
  });

  it('protects the Socratic score and gap list', () => {
    const prompt = buildSocraticEvalPrompt({
      concept,
      socraticQuestion: 'وش يصير بدون شرط توقف؟',
      socraticAnswer: 'تصير لوب ما تخلص',
      courseScopeBlock: '',
    });
    expect(prompt).toContain('TRANSCRIPTION TOLERANCE MANDATE');
    expect(prompt).toContain('`reasoningQualityScore`');
    expect(prompt).toContain('`conceptualGaps`');
  });
});
