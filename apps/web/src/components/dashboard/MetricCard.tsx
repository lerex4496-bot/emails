import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: number | string;
  subtext?: string;
  icon: LucideIcon;
  badge?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'slate' | 'indigo' | 'rose';
}

const colorMap = {
  blue: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400 border-blue-100 dark:border-blue-900',
  emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900',
  amber: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 border-amber-100 dark:border-amber-900',
  slate: 'text-slate-600 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400 border-slate-200 dark:border-slate-800',
  indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900',
  rose: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400 border-rose-100 dark:border-rose-900',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  badge,
  color = 'blue',
}) => {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <div className={`p-2 rounded-lg border ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {value}
          </span>
          {badge && (
            <span className="text-[10px] font-medium text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
              {badge}
            </span>
          )}
        </div>
        {subtext && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
};
