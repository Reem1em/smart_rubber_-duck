import { describe, expect, it } from 'vitest';

import { parseModelJson, QuacklyParseError } from './modelJson';

describe('parseModelJson', () => {
  it('parses clean structured output', () => {
    expect(parseModelJson('{"score": 80}')).toEqual({ score: 80 });
  });

  it('returns an empty object for an empty body', () => {
    expect(parseModelJson(undefined)).toEqual({});
    expect(parseModelJson('   ')).toEqual({});
  });

  it('strips markdown fences', () => {
    expect(parseModelJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('drops conversational text around the JSON', () => {
    expect(parseModelJson('تفضل يا بطل:\n```json\n{"reply": "تمام"}\n```\nبالتوفيق!')).toEqual({ reply: 'تمام' });
  });

  it('extracts a top-level array of objects', () => {
    expect(parseModelJson('Here you go: [{"a": 1}, {"b": 2}] done')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('keeps braces that live inside string values', () => {
    expect(parseModelJson('Result: {"code": "if (x) { return [1]; }"}')).toEqual({ code: 'if (x) { return [1]; }' });
  });

  it('keeps markdown fences that live inside string values', () => {
    const body = '{"improvedCode": "```python\\nprint(1)\\n```"}';
    expect(parseModelJson(`Here:\n\`\`\`json\n${body}\n\`\`\``)).toEqual({ improvedCode: '```python\nprint(1)\n```' });
  });

  it('throws QuacklyParseError carrying the raw text', () => {
    const raw = 'Sorry, I cannot help with that.';
    try {
      parseModelJson(raw);
      throw new Error('expected a parse error');
    } catch (err) {
      expect(err).toBeInstanceOf(QuacklyParseError);
      expect((err as QuacklyParseError).rawText).toBe(raw);
      expect((err as Error).message).toContain(raw);
    }
  });
});
