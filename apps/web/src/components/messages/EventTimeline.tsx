import React from 'react';
import { ConfidenceBadge } from '../common/ConfidenceBadge.js';
import {
  Send,
  CheckCircle,
  Eye,
  ShieldCheck,
  MousePointerClick,
  Reply,
  Globe,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export interface TimelineEvent {
  id: string;
  type: string;
  confidence: string;
  classification: string;
  timestamp: string;
  source: string;
  userAgent?: string | null;
  isProxy?: boolean;
  proxyType?: string | null;
  isBurstDuplicate?: boolean;
  rawHeaders?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

interface EventTimelineProps {
  events: TimelineEvent[];
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
        <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
        No activity observed yet for this message.
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'CONFIRMED_EMAIL_VIEW':
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      case 'PROBABLE_EMAIL_OPEN':
        return <Eye className="w-4 h-4 text-blue-500" />;
      case 'POSSIBLE_EMAIL_OPEN':
      case 'TRACKING_RESOURCE_REQUESTED':
        return <Globe className="w-4 h-4 text-amber-500" />;
      case 'LINK_CLICKED':
        return <MousePointerClick className="w-4 h-4 text-purple-500" />;
      case 'REPLY_RECEIVED':
        return <Reply className="w-4 h-4 text-blue-600" />;
      case 'DELIVERY_STATUS_UPDATED':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default:
        return <Send className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
      {events.map((evt) => {
        const timeFormatted = new Date(evt.timestamp).toLocaleString();

        return (
          <div key={evt.id} className="relative group">
            {/* Dot marker */}
            <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center group-hover:border-blue-500 transition">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition"></span>
            </div>

            {/* Event Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                  {getEventIcon(evt.type)}
                  <span>{evt.type.replace(/_/g, ' ')}</span>
                  {evt.isBurstDuplicate && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Burst Duplicate
                    </span>
                  )}
                </div>
                <ConfidenceBadge level={evt.confidence} />
              </div>

              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Source: {evt.source}</span>
                <span className="font-mono">{timeFormatted}</span>
              </div>

              {evt.isProxy && evt.proxyType && (
                <div className="p-2 rounded bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 text-[11px] border border-amber-200/60 dark:border-amber-900/40">
                  <span className="font-semibold">Proxy Signature:</span> {evt.proxyType}.
                  The recipient mail service (e.g. Gmail or Apple Mail) fetched remote resources through an intermediate cache.
                </div>
              )}

              {evt.metadata?.originalUrl && (
                <div className="p-2 rounded bg-purple-50/60 dark:bg-purple-950/30 text-purple-900 dark:text-purple-300 text-[11px] border border-purple-200/60 dark:border-purple-900/40 break-all">
                  <span className="font-semibold">Destination:</span> {evt.metadata.originalUrl}
                </div>
              )}

              {evt.userAgent && (
                <div className="text-[10px] text-slate-400 font-mono truncate" title={evt.userAgent}>
                  UA: {evt.userAgent}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
