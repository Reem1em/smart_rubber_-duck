import { describe, expect, it } from 'vitest';

import { isExecutionSuccess, isPythonLanguage, outputsMatch, parseSample, sampleMatches } from './compare';

describe('outputsMatch', () => {
  it('ignores the trailing newline print() adds and CRLF line endings', () => {
    expect(outputsMatch('5\n', '5')).toBe(true);
    expect(outputsMatch('a\r\nb\r\n', 'a\nb')).toBe(true);
  });

  it('is literal otherwise', () => {
    expect(outputsMatch('5 \n', '5')).toBe(false);
    expect(outputsMatch('3.0\n', '3')).toBe(false);
    expect(outputsMatch('True\n', 'true')).toBe(false);
  });
});

describe('samples', () => {
  it('splits "expr => expected"', () => {
    expect(parseSample('average_score([80, 90, 100]) => 90.0')).toEqual({
      expression: 'average_score([80, 90, 100])',
      expected: '90.0',
    });
    expect(parseSample('no arrow here')).toBeNull();
    expect(parseSample('=> 5')).toBeNull();
  });

  it('accepts str() or repr() of the real value', () => {
    expect(sampleMatches('abc', "'abc'", "'abc'")).toBe(true);
    expect(sampleMatches('abc', "'abc'", 'abc')).toBe(true);
    expect(sampleMatches('90.0', '90.0', '90')).toBe(false);
  });
});

describe('isExecutionSuccess', () => {
  const ok = { expression: 'f()', expected: '1', actual: '1', passed: true };
  it('requires no error, no timeout and every sample passing', () => {
    expect(isExecutionSuccess({ consoleErrors: '', timedOut: false }, [ok])).toBe(true);
    expect(isExecutionSuccess({ consoleErrors: 'Line 1: SyntaxError', timedOut: false }, [ok])).toBe(false);
    expect(isExecutionSuccess({ consoleErrors: '', timedOut: true }, [])).toBe(false);
    expect(isExecutionSuccess({ consoleErrors: '' }, [{ ...ok, passed: false }])).toBe(false);
  });
});

describe('isPythonLanguage', () => {
  it('matches only Python', () => {
    expect(isPythonLanguage('Python')).toBe(true);
    expect(isPythonLanguage('python 3')).toBe(true);
    expect(isPythonLanguage('TypeScript / JavaScript')).toBe(false);
    expect(isPythonLanguage('C++')).toBe(false);
  });
});
