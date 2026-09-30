import React from 'react';
import katex from 'katex';

interface MathViewProps {
  content: string;
  className?: string;
  asInline?: boolean;
}

/**
 * Normalizes developer-syntax mathematical expressions into standard
 * visual university-grade mathematical representations:
 * 1. [[a, b], [c, d]] -> visual matrix lines | a  b | / | c  d |
 * 2. inv(A), A^-1 -> A⁻¹
 * 3. f^-1(x) -> f⁻¹(x)
 * 4. x^2, x^3, x^-1 -> x², x³, x⁻¹
 * 5. sqrt(...) -> √( ... )
 */
export function sanitizeMathSyntax(raw: string): string {
  if (!raw) return '';

  // LaTeX segments ($$ ... $$ / $ ... $) are already canonical: normalizing them
  // would corrupt commands such as \sqrt{x}, A^{-1} or \begin{bmatrix}.
  // Sanitize only the plain-text segments between them.
  return raw
    .split(/(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g)
    .map((segment) => (segment.startsWith('$') ? segment : sanitizePlainSegment(segment)))
    .join('');
}

function sanitizePlainSegment(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // 1. Convert developer nested arrays like [[1, 4], [2, 3]] or [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
  text = text.replace(
    /\[\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\](?:\s*,\s*\[([^\]]+)\])?\s*\]/g,
    (match, r1, r2, r3) => {
      const formatRow = (r: string) => {
        const cells = r
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
        return `| ${cells.join('   ')} |`;
      };
      if (r3) {
        return `\n${formatRow(r1)}\n${formatRow(r2)}\n${formatRow(r3)}\n`;
      }
      return `\n${formatRow(r1)}\n${formatRow(r2)}\n`;
    }
  );

  // 2. Inverses: inv(A), inv(B), A^-1, f^-1(x)
  text = text.replace(/\binv\(([A-Z])\)/g, '$1⁻¹');
  text = text.replace(/\b([A-Z])\^\{-?1\}/g, '$1⁻¹');
  text = text.replace(/\b([A-Z])\^-1\b/g, '$1⁻¹');
  text = text.replace(/\bf\^\{-?1\}\s*\(([a-z])\)/g, 'f⁻¹($1)');
  text = text.replace(/\bf\^-1\s*\(([a-z])\)/g, 'f⁻¹($1)');
  text = text.replace(/\bf\^-1\b/g, 'f⁻¹');

  // 3. Exponents: x^2, x^3, x^-1, y^2, y^3
  text = text.replace(/\b([a-zA-Z])\^2\b/g, '$1²');
  text = text.replace(/\b([a-zA-Z])\^3\b/g, '$1³');
  text = text.replace(/\b([a-zA-Z])\^-1\b/g, '$1⁻¹');
  text = text.replace(/\b([a-zA-Z])\^4\b/g, '$1⁴');
  text = text.replace(/\b([a-zA-Z])\^n\b/g, '$1ⁿ');

  // 4. Roots: sqrt(...) -> √( ... )
  text = text.replace(/\bsqrt\(([^)]+)\)/g, '√($1)');

  return text;
}

interface BlockToken {
  type: 'text' | 'latex-block' | 'matrix' | 'fraction';
  content: string;
  matrixRows?: string[][];
  numerator?: string;
  denominator?: string;
}

export const MathView: React.FC<MathViewProps> = ({ content, className = '', asInline = false }) => {
  if (!content) return null;

  const sanitized = sanitizeMathSyntax(content);

  // First pass: extract LaTeX blocks $$ ... $$
  const blocks: BlockToken[] = [];
  const latexBlockRegex = /\$\$([\s\S]+?)\$\$/g;
  let lastIdx = 0;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = latexBlockRegex.exec(sanitized)) !== null) {
    if (blockMatch.index > lastIdx) {
      parseTextForVisualBlocks(sanitized.substring(lastIdx, blockMatch.index), blocks);
    }
    blocks.push({
      type: 'latex-block',
      content: blockMatch[1].trim(),
    });
    lastIdx = blockMatch.index + blockMatch[0].length;
  }

  if (lastIdx < sanitized.length) {
    parseTextForVisualBlocks(sanitized.substring(lastIdx), blocks);
  }

  // In inline contexts (headings, pills, sentences) a `<div>` is invalid markup and a
  // centered display block breaks the layout, so render everything as inline phrasing content.
  const Root = asInline ? 'span' : 'div';

  return (
    <Root dir="ltr" style={{ unicodeBidi: 'isolate' }} className={`leading-relaxed ${className} ${asInline ? 'inline' : ''}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'matrix' && block.matrixRows) {
          return (
            <div key={`matrix-${idx}`} className="my-3 flex justify-center overflow-x-auto select-all">
              <div
                dir="ltr"
                className="inline-flex flex-col items-center px-4 py-2 border-l-2 border-r-2 border-slate-700 dark:border-amber-400 font-mono text-base sm:text-lg font-bold tracking-wider bg-slate-50/90 dark:bg-slate-900/90 rounded-xs shadow-xs"
              >
                {block.matrixRows.map((row, rIdx) => (
                  <div key={rIdx} className="flex items-center justify-center gap-4 sm:gap-6 py-0.5">
                    {row.map((cell, cIdx) => (
                      <span key={cIdx} className="math-matrix-cell w-8 sm:w-10 text-center font-bold text-slate-900 dark:text-slate-100">
                        {cell}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (block.type === 'fraction') {
          return (
            <div key={`frac-${idx}`} className="my-3 flex justify-center overflow-x-auto">
              <div className="inline-flex flex-col items-center text-center font-bold px-3 py-1 bg-slate-50/80 dark:bg-slate-900/80 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-sm sm:text-base px-2 text-slate-900 dark:text-slate-100">
                  <InlineMathParser text={block.numerator || ''} />
                </span>
                <span className="w-full border-t-2 border-slate-700 dark:border-amber-400 my-1 min-w-[3.5rem]" />
                <span className="text-sm sm:text-base px-2 text-slate-900 dark:text-slate-100">
                  <InlineMathParser text={block.denominator || ''} />
                </span>
              </div>
            </div>
          );
        }

        if (block.type === 'latex-block') {
          try {
            const html = katex.renderToString(block.content, {
              displayMode: !asInline,
              throwOnError: false,
            });
            return (
              <span
                key={`latex-${idx}`}
                dir="ltr"
                style={{ unicodeBidi: 'isolate' }}
                className={
                  asInline
                    ? 'math-inline px-1 align-baseline'
                    : 'my-3 block text-center overflow-x-auto py-1'
                }
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return (
              <pre key={`latex-raw-${idx}`} className="font-mono text-center my-2 p-2 overflow-x-auto max-w-full bg-slate-100 dark:bg-slate-800 rounded-lg text-sm">
                {block.content}
              </pre>
            );
          }
        }

        // Regular text with potential inline math ($...$ or unicode)
        return <InlineTextSegment key={`text-${idx}`} text={block.content} />;
      })}
    </Root>
  );
};

/**
 * Parses consecutive lines looking for:
 * 1. Visual matrix: lines with `| a  b |`
 * 2. Visual fraction: line 1 numerator, line 2 divider (──── or ----), line 3 denominator
 */
function parseTextForVisualBlocks(chunk: string, output: BlockToken[]): void {
  const lines = chunk.split(/\r?\n/);
  let i = 0;

  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length > 0) {
      output.push({
        type: 'text',
        content: buffer.join('\n'),
      });
      buffer = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for Visual Fraction: Line 1, Line 2 is divider (────── or ------), Line 3
    const isDivider = /^([─—\-=_]){3,}$/.test(trimmed);
    if (isDivider && i > 0 && i + 1 < lines.length) {
      const prevLine = lines[i - 1].trim();
      const nextLine = lines[i + 1].trim();

      if (prevLine && nextLine && !prevLine.startsWith('|') && !nextLine.startsWith('|')) {
        // Pop previous line from buffer if present
        if (buffer.length > 0) {
          buffer.pop();
        }
        flushBuffer();

        output.push({
          type: 'fraction',
          content: `${prevLine} / ${nextLine}`,
          numerator: prevLine,
          denominator: nextLine,
        });

        i += 2; // skip divider and denominator
        continue;
      }
    }

    // Check for Visual Matrix: consecutive lines enclosed in | ... | or bracket [ ... ] with numbers/variables
    const isPipeMatrixRow = /^\|[^|]+\|$/.test(trimmed);
    const isBracketMatrixRow = /^\[(?!\s*\(?[0-9a-zA-Z\s×\+\-\*]+\)?\s*\])[^\]]+\]$/.test(trimmed) || 
      (/^\[\s*(-?\d+|[a-zA-Z])(?:\s+(-?\d+|[a-zA-Z]))+\s*\]$/.test(trimmed));

    if (isPipeMatrixRow || isBracketMatrixRow) {
      const isMatchingRow = (l: string) => {
        const t = l.trim();
        if (isPipeMatrixRow) return /^\|[^|]+\|$/.test(t);
        return /^\[\s*(-?\d+|[a-zA-Z])(?:\s+(-?\d+|[a-zA-Z]))+\s*\]$/.test(t) || /^\[[^\]]+\]$/.test(t);
      };

      const matrixLines: string[] = [trimmed];
      let j = i + 1;
      while (j < lines.length && isMatchingRow(lines[j])) {
        matrixLines.push(lines[j].trim());
        j++;
      }

      // If bracket matrix with numbers or pipe matrix
      if (matrixLines.length >= 1 && (isPipeMatrixRow || (matrixLines.length >= 2 || /^\[\s*(-?\d+|[a-zA-Z])(?:\s+(-?\d+|[a-zA-Z]))+\s*\]$/.test(trimmed)))) {
        flushBuffer();

        const matrixRows = matrixLines.map((rowStr) => {
          // Strip outer pipes or brackets: | 1  4 | -> "1  4", [ 1   2 ] -> "1   2"
          const inner = rowStr.replace(/^[|\[]\s*/, '').replace(/\s*[|\]]$/, '').trim();
          // Split by whitespace or commas
          return inner.split(/[\s,]+/).filter(Boolean);
        });

        output.push({
          type: 'matrix',
          content: matrixLines.join('\n'),
          matrixRows,
        });

        i = j;
        continue;
      }
    }

    buffer.push(line);
    i++;
  }

  flushBuffer();
}

/**
 * Handles inline math like $...$, dy/dx, ∫, superscripts
 */
const InlineTextSegment: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Split by newlines so line breaks are visually respected
  const paragraphs = text.split('\n');

  return (
    <>
      {paragraphs.map((para, pIdx) => (
        <React.Fragment key={pIdx}>
          {pIdx > 0 && <br />}
          <InlineMathParser text={para} />
        </React.Fragment>
      ))}
    </>
  );
};

/**
 * Renders text containing inline LaTeX `$ ... $`
 */
const InlineMathParser: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  const inlineRegex = /\$([^\$]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const math = match[1].trim();
    try {
      const html = katex.renderToString(math, {
        displayMode: false,
        throwOnError: false,
      });
      parts.push(
        <span
          key={`inline-katex-${match.index}`}
          dir="ltr"
          style={{ unicodeBidi: 'isolate' }}
          className="math-inline px-1 align-baseline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch {
      parts.push(`$${math}$`);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{parts}</span>;
};
