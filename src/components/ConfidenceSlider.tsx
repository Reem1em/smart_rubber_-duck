import React from 'react';
import { Gauge } from 'lucide-react';

interface ConfidenceSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const ConfidenceSlider: React.FC<ConfidenceSliderProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const getConfidenceLabel = (val: number) => {
    if (val < 25) return { label: 'تخمين / تردد وتحفظ', color: 'text-slate-700 bg-slate-200' };
    if (val < 55) return { label: 'فهم مجمل وتصور عام', color: 'text-amber-800 bg-amber-100' };
    if (val < 80) return { label: 'واثق ومتمكن نسبياً', color: 'text-blue-800 bg-blue-100' };
    return { label: 'يقين تام وإتقان مطلق (100%)', color: 'text-emerald-800 bg-emerald-100' };
  };

  const status = getConfidenceLabel(value);

  return (
    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-amber-600" />
          <span className="text-sm font-semibold text-slate-800">
            ما هو مستوى ثقتك ويقينك بدقة شرحك وبيانك؟
          </span>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status.color}`}>
          {value}% • {status.label}
        </span>
      </div>

      <div className="relative pt-1">
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex justify-between text-[11px] font-medium text-slate-500 mt-1">
          <span>0% (تردد وتخمين)</span>
          <span>50% (فهم متوسط)</span>
          <span>100% (يقين مطلق)</span>
        </div>
      </div>
    </div>
  );
};
