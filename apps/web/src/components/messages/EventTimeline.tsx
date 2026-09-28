import React, { useState } from 'react';
import { ConfidenceBadge } from '../common/ConfidenceBadge.js';
import { EventBadge } from '../common/EventBadge.js';
import { formatEvidence } from '../../utils/evidence.js';
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';

export interface TimelineEvent {
  id: string;
  type: string;
  confidence: string;
  classification: string;
  timestamp: string;
  source: string;
  userAgent?: string | null;
  isProxy?: boolean | null;
  proxyType?: string | null;
  isBurstDuplicate?: boolean | null;
  rawHeaders?: Record<string, any> | null;
  coarseLocation?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

interface EventTimelineProps {
  events: TimelineEvent[];
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
        <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
        <p className="font-medium text-slate-600 dark:text-slate-300">No activity observed yet</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Telemetry events will appear here in chronological order once the recipient or intermediate mail server interacts with this message.
        </p>
      </div>
    );
  }

  // Ensure chronological order (oldest to newest or newest to oldest; chronological usually means ascending order, let's sort by timestamp ascending)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
      {sortedEvents.map((evt, idx) => {
        const timeFormatted = new Date(evt.timestamp).toLocaleString();
        const evidenceText = formatEvidence(evt);
        const isExpanded = expandedEventId === evt.id;

        return (
          <div key={evt.id || idx} className="relative group">
            {/* Dot marker */}
            <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center group-hover:border-blue-500 transition shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition"></span>
            </div>

            {/* Event Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-xs space-y-3 transition hover:border-slate-300 dark:hover:border-slate-700">
              {/* Header: Event Type & Confidence */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <EventBadge type={evt.type} />
                  {evt.isBurstDuplicate && (
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Burst Duplicate
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Confidence:</span>
                  <ConfidenceBadge level={evt.confidence} />
                </div>
              </div>

              {/* Source & Timestamp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Source:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                    {evt.source || 'unspecified'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:justify-end">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Timestamp:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{timeFormatted}</span>
                </div>
              </div>

              {/* Evidence Panel (REQUIRED) */}
              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 text-blue-950 dark:text-blue-200 text-xs border border-blue-100 dark:border-blue-900/40 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-blue-800 dark:text-blue-300">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Physical Evidence & Rationale:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  {evidenceText}
                </p>
              </div>

              {/* Proxy Identification if Present */}
              {evt.isProxy && (
                <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-[11px] border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Proxy Signature: </span>
                    <span className="font-mono font-medium">{evt.proxyType || 'Generic Proxy'}</span>.
                    <span className="block text-slate-600 dark:text-slate-300 mt-0.5">
                      The mail service or security filter fetched remote assets through intermediate servers. Human recipient activity cannot be proven.
                    </span>
                  </div>
                </div>
              )}

              {/* Destination URL if Click Event */}
              {evt.metadata?.destinationUrl && (
                <div className="p-2.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 text-purple-900 dark:text-purple-300 text-[11px] border border-purple-200/60 dark:border-purple-900/40 flex items-center gap-2 break-all">
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 text-purple-500" />
                  <div>
                    <span className="font-semibold">Destination: </span>
                    <a
                      href={evt.metadata.destinationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-purple-700 dark:hover:text-purple-200 font-mono"
                    >
                      {evt.metadata.destinationUrl}
                    </a>
                  </div>
                </div>
              )}

              {/* Collapsible Technical Metadata & User Agent */}
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                  className="flex items-center justify-between w-full text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1 transition"
                >
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {isExpanded ? 'Hide Raw Telemetry' : 'View Raw Telemetry & Headers'}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isExpanded && (
                  <div className="mt-2 space-y-2 text-[10px] font-mono bg-slate-900 text-slate-200 p-3 rounded-lg border border-slate-800 overflow-x-auto">
                    {evt.userAgent && (
                      <div>
                        <span className="text-slate-500 block">User-Agent:</span>
                        <span className="text-slate-300 break-all">{evt.userAgent}</span>
                      </div>
                    )}
                    {evt.classification && (
                      <div>
                        <span className="text-slate-500 block">Classification:</span>
                        <span className="text-emerald-400">{evt.classification}</span>
                      </div>
                    )}
                    {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                      <div>
                        <span className="text-slate-500 block">Metadata:</span>
                        <pre className="text-slate-300 mt-0.5">
                          {JSON.stringify(evt.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                    {evt.rawHeaders && Object.keys(evt.rawHeaders).length > 0 && (
                      <div>
                        <span className="text-slate-500 block">Raw Headers:</span>
                        <pre className="text-slate-300 mt-0.5">
                          {JSON.stringify(evt.rawHeaders, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
