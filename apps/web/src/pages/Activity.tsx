import React, { useState, useEffect } from 'react';
import { EventBadge } from '../components/common/EventBadge.js';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge.js';
import { formatEvidence } from '../utils/evidence.js';
import {
  Activity as ActivityIcon,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Cpu,
  Mail,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface GlobalEventItem {
  id: string;
  messageId: string;
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
  message?: {
    id: string;
    subject: string;
    sentAt: string;
  } | null;
  messageRecipient?: {
    recipient?: {
      email: string;
      name?: string | null;
    } | null;
  } | null;
}

interface ActivityPageProps {
  onSelectMessage: (id: string) => void;
}

export const ActivityPage: React.FC<ActivityPageProps> = ({ onSelectMessage }) => {
  const [events, setEvents] = useState<GlobalEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterConfidence, setFilterConfidence] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/events');
      if (!res.ok) {
        throw new Error(`Failed to load activity stream (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data.events)) {
        setEvents(data.events);
      } else {
        setEvents([]);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching activity events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Optional auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filtered = events.filter((evt) => {
    const subject = evt.message?.subject || '';
    const email = evt.messageRecipient?.recipient?.email || '';
    const name = evt.messageRecipient?.recipient?.name || '';
    const source = evt.source || '';

    const matchesSearch =
      subject.toLowerCase().includes(search.toLowerCase()) ||
      email.toLowerCase().includes(search.toLowerCase()) ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      source.toLowerCase().includes(search.toLowerCase());

    const matchesType = filterType === 'ALL' || evt.type === filterType;
    const matchesConfidence = filterConfidence === 'ALL' || evt.confidence === filterConfidence;

    return matchesSearch && matchesType && matchesConfidence;
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Global Activity Stream
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time feed of all telemetry requests, proxy cache hits, link redirections, and verified views.
          </p>
        </div>

        {/* Action & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject, recipient, source..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 sm:w-64 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent focus:outline-none text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Event Types</option>
              <option value="TRACKING_RESOURCE_REQUESTED">Tracking Request</option>
              <option value="PROBABLE_EMAIL_OPEN">Probable Open</option>
              <option value="CONFIRMED_EMAIL_VIEW">Confirmed View</option>
              <option value="LINK_CLICKED">Click</option>
              <option value="REPLY_RECEIVED">Reply</option>
              <option value="DELIVERY_STATUS_UPDATED">Delivered</option>
              <option value="BOUNCED">Bounce</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 shadow-sm">
            <select
              value={filterConfidence}
              onChange={(e) => setFilterConfidence(e.target.value)}
              className="bg-transparent focus:outline-none text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Confidence</option>
              <option value="CONFIRMED">Confirmed View</option>
              <option value="HIGH">High (Probable)</option>
              <option value="MEDIUM">Medium (Proxy / Cache)</option>
              <option value="LOW">Low (Automated)</option>
            </select>
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition shadow-sm flex items-center gap-1.5 ${
              autoRefresh
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
            }`}
            title="Auto-refresh every 10 seconds"
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            Live Feed
          </button>

          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition shadow-sm"
            title="Refresh events"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && events.length === 0 && (
        <div className="space-y-3 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
          <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
          <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
          <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-xs flex items-center justify-between">
          <span className="text-rose-700 dark:text-rose-300">{error}</span>
          <button
            onClick={fetchEvents}
            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <ActivityIcon className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {events.length === 0 ? 'No activity events recorded' : 'No events match your active filters'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {events.length === 0
              ? 'Telemetry events will appear here in real-time as recipients interact with your tracked emails.'
              : 'Try clearing your search query or adjusting your event type and confidence filters.'}
          </p>
          {events.length > 0 && (
            <button
              onClick={() => {
                setSearch('');
                setFilterType('ALL');
                setFilterConfidence('ALL');
              }}
              className="mt-4 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Events List */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((evt) => {
            const timeFormatted = new Date(evt.timestamp).toLocaleString();
            const evidence = formatEvidence(evt);
            const isExpanded = expandedId === evt.id;

            return (
              <div
                key={evt.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-xs space-y-3 transition hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* Top Row: Event Badge, Subject / Recipient, Confidence */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <EventBadge type={evt.type} />
                    {evt.isBurstDuplicate && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3 h-3" /> Burst Duplicate
                      </span>
                    )}
                    {evt.message && (
                      <button
                        onClick={() => onSelectMessage(evt.messageId)}
                        className="font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                        title="View message details"
                      >
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="underline decoration-slate-300 dark:decoration-slate-700">{evt.message.subject}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Confidence:</span>
                    <ConfidenceBadge level={evt.confidence} />
                  </div>
                </div>

                {/* Sub row: Recipient, Source, Timestamp */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="truncate">
                    <span>Recipient: </span>
                    <strong className="text-slate-700 dark:text-slate-300">
                      {evt.messageRecipient?.recipient?.name || evt.messageRecipient?.recipient?.email || 'General Recipient'}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    <span>Source: </span>
                    <strong className="text-slate-700 dark:text-slate-300 font-mono">{evt.source}</strong>
                  </div>
                  <div className="flex items-center gap-1 sm:justify-end">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-slate-700 dark:text-slate-300">{timeFormatted}</span>
                  </div>
                </div>

                {/* Evidence Panel */}
                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 text-blue-950 dark:text-blue-200 text-xs border border-blue-100 dark:border-blue-900/40">
                  <span className="font-semibold text-[11px] text-blue-800 dark:text-blue-300 block mb-0.5">
                    Physical Evidence & Rationale:
                  </span>
                  <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                    {evidence}
                  </p>
                </div>

                {/* Proxy Notification */}
                {evt.isProxy && (
                  <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-[11px] border border-amber-200/80 dark:border-amber-900/50 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      <strong className="font-mono">{evt.proxyType || 'Proxy'}</strong>: Request routed through an intermediate caching server; does not guarantee human viewing.
                    </span>
                  </div>
                )}

                {/* Expandable Technical Details */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                    className="flex items-center justify-between w-full text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-0.5 transition"
                  >
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {isExpanded ? 'Hide Raw Telemetry' : 'View Raw Telemetry'}
                    </span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1.5 text-[10px] font-mono bg-slate-900 text-slate-200 p-3 rounded-lg border border-slate-800 overflow-x-auto">
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
                      {evt.metadata && (
                        <div>
                          <span className="text-slate-500 block">Metadata:</span>
                          <pre className="text-slate-300">{JSON.stringify(evt.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
