import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { MathView } from './MathView';

interface ExplanationFeedbackProps {
  /** "أين أصبت": points the student articulated correctly. */
  correctPoints: string[];
  /** "أين أخطأت / الفجوات المفاهيمية": missing or flawed logic. */
  gaps: string[];
}

/**
 * Deep-analysis feedback for the student's own explanation (discussion mode only —
 * quizzes get the one-line verdict instead). Renders nothing when both lists are empty,
 * e.g. when the evaluator was unavailable.
 */
export const ExplanationFeedback: React.FC<ExplanationFeedbackProps> = ({ correctPoints, gaps }) => {
  if (correctPoints.length === 0 && gaps.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 pt-2">
      {correctPoints.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>أين أصبت</span>
          </p>
          <ul className="space-y-1 text-xs sm:text-sm text-slate-700">
            {correctPoints.map((point, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-100 font-medium"
              >
                <span className="text-emerald-600 font-bold">•</span>
                <MathView content={point} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>أين أخطأت / الفجوات المفاهيمية</span>
          </p>
          <ul className="space-y-1 text-xs sm:text-sm text-slate-700">
            {gaps.map((gap, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 bg-rose-50/60 p-2.5 rounded-lg border border-rose-100 font-medium"
              >
                <span className="text-rose-600 font-bold">•</span>
                <MathView content={gap} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
