import React, { useState, useEffect } from 'react';
import { MessageTable, MessageListItem } from '../components/messages/MessageTable.js';
import { Search, Filter, RefreshCw, AlertCircle, Mail, Plus } from 'lucide-react';

interface MessagesPageProps {
  onSelectMessage: (id: string) => void;
  onOpenComposer?: () => void;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({
  onSelectMessage,
  onOpenComposer,
}) => {
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterConfidence, setFilterConfidence] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/messages');
      if (!res.ok) {
        throw new Error(`Failed to load messages (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else {
        setMessages([]);
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const filtered = messages.filter((m) => {
    const matchesSearch =
      m.subject.toLowerCase().includes(search.toLowerCase()) ||
      (m.recipient?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.recipient?.name || '').toLowerCase().includes(search.toLowerCase());

    const matchesConfidence =
      filterConfidence === 'ALL' || m.confidence === filterConfidence;

    const matchesStatus =
      filterStatus === 'ALL' || m.status === filterStatus;

    return matchesSearch && matchesConfidence && matchesStatus;
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Tracked Messages
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Truth-in-evidence tracking records. Displays probable opens, confirmed views, clicks, and RFC replies.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipient or subject..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-60 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterConfidence}
              onChange={(e) => setFilterConfidence(e.target.value)}
              className="bg-transparent focus:outline-none text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Confidence</option>
              <option value="CONFIRMED">Confirmed View (100%)</option>
              <option value="HIGH">Probable Open</option>
              <option value="MEDIUM">Possible Open (Proxy)</option>
              <option value="LOW">Resource Requested</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 shadow-sm">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent focus:outline-none text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="DELIVERED">Delivered</option>
              <option value="SENT">Sent / Dispatched</option>
              <option value="PENDING">Pending</option>
              <option value="BOUNCED">Bounced</option>
            </select>
          </div>

          <button
            onClick={fetchMessages}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition shadow-sm"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && messages.length === 0 && (
        <div className="space-y-2 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
          <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
          <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
          <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchMessages}
            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table or Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <Mail className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {messages.length === 0 ? 'No tracked emails yet' : 'No messages match your filters'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {messages.length === 0
              ? 'Send an email with tracking enabled to start collecting evidence-based telemetry.'
              : 'Try clearing your search query or adjusting your confidence filter.'}
          </p>
          {messages.length === 0 && onOpenComposer && (
            <button
              onClick={onOpenComposer}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Send Tracked Email
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => {
                setSearch('');
                setFilterConfidence('ALL');
                setFilterStatus('ALL');
              }}
              className="mt-4 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <MessageTable
          messages={filtered}
          onSelectMessage={onSelectMessage}
        />
      )}
    </div>
  );
};
