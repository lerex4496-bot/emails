import React from 'react';
import { ConfidenceLevel } from '@mailtrace/shared';
import { ShieldCheck, UserCheck, Globe, Cpu } from 'lucide-react';

interface ConfidenceBadgeProps {
  level: ConfidenceLevel | string;
  showIcon?: boolean;
  className?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  level,
  showIcon = true,
  className = '',
}) => {
  switch (level) {
    case ConfidenceLevel.CONFIRMED:
    case 'CONFIRMED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ${className}`}
          title="Directly verified by MailTrace client viewport render"
        >
          {showIcon && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          Confirmed View
        </span>
      );

    case ConfidenceLevel.HIGH:
    case 'HIGH':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 ${className}`}
          title="Likely human recipient based on timing and interactive browser characteristics"
        >
          {showIcon && <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
          Probable Open
        </span>
      );

    case ConfidenceLevel.MEDIUM:
    case 'MEDIUM':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800 ${className}`}
          title="Proxy or cache request (Google Image Proxy, Apple MPP). Indeterminate whether human read."
        >
          {showIcon && <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
          Possible Open (Proxy)
        </span>
      );

    case ConfidenceLevel.LOW:
    case 'LOW':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 ${className}`}
          title="Remote resource requested. Insufficient evidence of human open."
        >
          {showIcon && <Cpu className="w-3.5 h-3.5 text-slate-500" />}
          Resource Requested
        </span>
      );
  }
};
