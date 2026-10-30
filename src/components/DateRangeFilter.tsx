import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';

export type DatePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'custom';

export interface DateRange {
  from: string; // ISO string or YYYY-MM-DD
  to: string;
  preset: DatePreset;
}

interface DateRangeFilterProps {
  initialPreset?: DatePreset;
  onRangeChange: (range: { from: string; to: string; preset: DatePreset }) => void;
  className?: string;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  initialPreset = 'today',
  onRangeChange,
  className = ''
}) => {
  const [preset, setPreset] = useState<DatePreset>(initialPreset);
  const [customStart, setCustomStart] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const getRangeForPreset = (selectedPreset: DatePreset): { from: string; to: string } => {
    const now = new Date();

    if (selectedPreset === 'yesterday') {
      const yStart = new Date(now);
      yStart.setDate(yStart.getDate() - 1);
      yStart.setHours(0, 0, 0, 0);

      const yEnd = new Date(now);
      yEnd.setDate(yEnd.getDate() - 1);
      yEnd.setHours(23, 59, 59, 999);

      return { from: yStart.toISOString(), to: yEnd.toISOString() };
    }

    if (selectedPreset === 'thisWeek') {
      // Monday as week start
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(now);
      weekEnd.setHours(23, 59, 59, 999);

      return { from: weekStart.toISOString(), to: weekEnd.toISOString() };
    }

    if (selectedPreset === 'thisMonth') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now);
      monthEnd.setHours(23, 59, 59, 999);

      return { from: monthStart.toISOString(), to: monthEnd.toISOString() };
    }

    if (selectedPreset === 'custom') {
      const cStart = new Date(customStart);
      cStart.setHours(0, 0, 0, 0);

      const cEnd = new Date(customEnd);
      cEnd.setHours(23, 59, 59, 999);

      return { from: cStart.toISOString(), to: cEnd.toISOString() };
    }

    // Default: 'today'
    const tStart = new Date(now);
    tStart.setHours(0, 0, 0, 0);

    const tEnd = new Date(now);
    tEnd.setHours(23, 59, 59, 999);

    return { from: tStart.toISOString(), to: tEnd.toISOString() };
  };

  const handleSelectPreset = (newPreset: DatePreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const range = getRangeForPreset(newPreset);
      onRangeChange({ ...range, preset: newPreset });
    } else {
      const range = getRangeForPreset('custom');
      onRangeChange({ ...range, preset: 'custom' });
    }
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;
    const range = getRangeForPreset('custom');
    onRangeChange({ ...range, preset: 'custom' });
  };

  const presets: { id: DatePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'thisWeek', label: 'This Week' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'custom', label: 'Custom' }
  ];

  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-full ${className}`}>
      {/* Preset Pill Buttons */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-2xs overflow-x-auto max-w-full">
        {presets.map((p) => {
          const isActive = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Pickers (Shown when 'custom' is selected) */}
      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200/80 shadow-2xs animate-fadeIn text-xs w-full sm:w-auto">
          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-slate-400 font-medium">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleCustomApply}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-2xs ml-auto sm:ml-0"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
};
