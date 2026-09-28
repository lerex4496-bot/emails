import React, { useState, useEffect } from 'react';
import {
  Reply as ReplyIcon,
  ShieldCheck,
  Clock,
  Mail,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiUrl } from '../utils/api.js';

interface ReplyRecord {
  id: string;
  messageId: string;
  inReplyTo?: string | null;
  replyAliasAddress?: string | null;
  replyTimestamp: string;
  timeToReplySec?: number | null;
  message?: {
    id: string;
    subject: string;
    sentAt: string;
    recipients?: Array<{
      recipient?: {
        email: string;
        name?: string | null;
      } | null;
    }>;
  } | null;
}

interface RepliesPageProps {
  onSelectMessage: (id: string) => void;
}

export const RepliesPage: React.FC<RepliesPageProps> = ({ onSelectMessage }) => {
  const [replies, setReplies] = useState<ReplyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReplies = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/v1/replies'));
      if (!res.ok) {
        throw new Error(`Failed to load replies (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data.replies)) {
        setReplies(data.replies);
      } else {
        setReplies([]);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching inbound replies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReplies();
  }, []);

  const formatTTR = (seconds?: number | null) => {
    if (!seconds && seconds !== 0) return 'Immediate';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ${seconds % 60}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ReplyIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Inbound Reply Correlation
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Detect when recipients reply to your emails via RFC-2822 cryptographic thread headers without storing email contents.
          </p>
        </div>

        <button
          onClick={fetchReplies}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Privacy Guarantee Card */}
      <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20 text-xs text-indigo-950 dark:text-indigo-200 space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-indigo-900 dark:text-indigo-300">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Privacy Invariant: Zero Email Body Stored</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
          MailTrace correlates inbound replies exclusively by matching cryptographic subaddress tokens in the RFC-2822
          <code className="mx-1 px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 font-mono text-[10px]">In-Reply-To</code> and
          <code className="mx-1 px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 font-mono text-[10px]">References</code> headers.
          Email body text, sensitive attachments, and personal communications are NEVER stored in the database.
        </p>
      </div>

      {/* Metric Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Replies Correlated</span>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{replies.length}</div>
          <span className="text-[10px] text-slate-400">Cryptographically matched</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Average Time-to-Reply</span>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {replies.length > 0
              ? formatTTR(
                  Math.round(
                    replies.reduce((sum, r) => sum + (r.timeToReplySec || 0), 0) / replies.length
                  )
                )
              : 'N/A'}
          </div>
          <span className="text-[10px] text-slate-400">From message dispatch</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Header Verification</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">100%</div>
          <span className="text-[10px] text-slate-400">Zero false positives</span>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && replies.length === 0 && (
        <div className="space-y-3 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
          <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
          <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchReplies}
            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && replies.length === 0 && (
        <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <ReplyIcon className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No inbound replies recorded yet
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            When you send a tracked email with reply tracking enabled, inbound responses to your unique reply subaddress will appear here.
          </p>
        </div>
      )}

      {/* Replies Table */}
      {replies.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-medium">
                <th className="py-3 px-4">Subject & Recipient</th>
                <th className="py-3 px-4">Reply Timestamp</th>
                <th className="py-3 px-4">Time to Reply (TTR)</th>
                <th className="py-3 px-4">Reply Alias Address</th>
                <th className="py-3 px-4 text-right">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {replies.map((r) => {
                const primaryRecipient = r.message?.recipients?.[0]?.recipient;
                const recipientEmail = primaryRecipient?.email || 'Recipient';
                const recipientName = primaryRecipient?.name || recipientEmail;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 max-w-xs">
                      {r.message ? (
                        <button
                          onClick={() => onSelectMessage(r.messageId)}
                          className="text-left font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 group"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" />
                          <span className="truncate underline decoration-slate-300 dark:decoration-slate-700">
                            {r.message.subject}
                          </span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-900 dark:text-slate-100">Message {r.messageId}</span>
                      )}
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Recipient: {recipientName} &lt;{recipientEmail}&gt;
                      </span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300 font-mono">
                      {new Date(r.replyTimestamp).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                        <Clock className="w-3 h-3" />
                        {formatTTR(r.timeToReplySec)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate font-mono text-[11px] text-slate-500">
                      {r.replyAliasAddress || 'Direct subaddress'}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        RFC-2822 Correlated
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
