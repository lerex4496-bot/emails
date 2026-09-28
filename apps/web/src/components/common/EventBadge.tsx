import React from 'react';
import {
  ShieldCheck,
  Eye,
  Globe,
  MousePointerClick,
  Reply,
  CheckCircle2,
  AlertOctagon,
  Send,
  HelpCircle,
} from 'lucide-react';
import { getTruthfulEventLabel } from '../../utils/evidence.js';

interface EventBadgeProps {
  type: string;
  showIcon?: boolean;
  className?: string;
}

export const EventBadge: React.FC<EventBadgeProps> = ({
  type,
  showIcon = true,
  className = '',
}) => {
  const label = getTruthfulEventLabel(type);

  switch (type) {
    case 'CONFIRMED_EMAIL_VIEW':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ${className}`}
          title="Direct viewport render verified by MailTrace native client"
        >
          {showIcon && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          {label}
        </span>
      );

    case 'PROBABLE_EMAIL_OPEN':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 ${className}`}
          title="Browser interaction pattern consistent with human reading"
        >
          {showIcon && <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
          {label}
        </span>
      );

    case 'POSSIBLE_EMAIL_OPEN':
    case 'TRACKING_RESOURCE_REQUESTED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800 ${className}`}
          title="Remote resource requested. Indeterminate whether recipient viewed content."
        >
          {showIcon && <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
          {label}
        </span>
      );

    case 'LINK_CLICKED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800 ${className}`}
          title="Direct link navigation verified by redirect endpoint"
        >
          {showIcon && <MousePointerClick className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
          {label}
        </span>
      );

    case 'REPLY_RECEIVED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 ${className}`}
          title="Inbound RFC-2822 reply matched with cryptographic alias"
        >
          {showIcon && <Reply className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
          {label}
        </span>
      );

    case 'DELIVERY_STATUS_UPDATED':
    case 'DELIVERED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ${className}`}
          title="Accepted by recipient mail server"
        >
          {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          {label}
        </span>
      );

    case 'BOUNCED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800 ${className}`}
          title="Delivery bounced by receiving server"
        >
          {showIcon && <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
          {label}
        </span>
      );

    case 'SENT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 ${className}`}
          title="Dispatched to mail transport provider"
        >
          {showIcon && <Send className="w-3.5 h-3.5 text-slate-500" />}
          {label}
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 ${className}`}
        >
          {showIcon && <HelpCircle className="w-3.5 h-3.5 text-slate-500" />}
          {label}
        </span>
      );
  }
};
