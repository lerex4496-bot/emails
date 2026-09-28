import React, { useState, useEffect } from 'react';
import {
  Link2,
  ExternalLink,
  Search,
  RefreshCw,
  Copy,
  Check,
  MousePointerClick,
  ShieldCheck,
  Mail,
  AlertCircle,
} from 'lucide-react';

interface ClickEventSummary {
  id: string;
  timestamp: string;
  source: string;
  isUnique: boolean;
}

interface TrackedLinkRecord {
  id: string;
  messageId: string;
  token: string;
  originalUrl: string;
  clickCount: number;
  uniqueClicks: number;
  createdAt: string;
  updatedAt: string;
  message?: {
    id: string;
    subject: string;
    sentAt: string;
  } | null;
  clickEvents?: ClickEventSummary[];
}

interface LinksPageProps {
  onSelectMessage: (id: string) => void;
}

export const LinksPage: React.FC<LinksPageProps> = ({ onSelectMessage }) => {
  const [links, setLinks] = useState<TrackedLinkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/links');
      if (!res.ok) {
        throw new Error(`Failed to load tracked links (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data.links)) {
        setLinks(data.links);
      } else {
        setLinks([]);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching tracked links.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleCopyLink = (token: string) => {
    const trackingUrl = `${window.location.origin}/t/click/${token}`;
    navigator.clipboard.writeText(trackingUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const filtered = links.filter((l) => {
    const url = l.originalUrl.toLowerCase();
    const subject = (l.message?.subject || '').toLowerCase();
    const token = l.token.toLowerCase();
    const query = search.toLowerCase();
    return url.includes(query) || subject.includes(query) || token.includes(query);
  });

  const totalClicks = links.reduce((sum, l) => sum + (l.clickCount || 0), 0);
  const uniqueClicks = links.reduce((sum, l) => sum + (l.uniqueClicks || 0), 0);
  const activeLinksCount = links.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Tracked Links Intelligence
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Complete inventory of rewritten outbound links with strict open-redirect protection and CTR metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search destination URL or subject..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 sm:w-72 shadow-sm"
            />
          </div>

          <button
            onClick={fetchLinks}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition shadow-sm"
            title="Refresh links"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Tracked Links</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{activeLinksCount}</div>
          <span className="text-[10px] text-slate-400">Rewritten via /t/click/:token</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Unique Clicks</span>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{uniqueClicks}</div>
          <span className="text-[10px] text-slate-400">Deduplicated per recipient</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Click Redirects</span>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalClicks}</div>
          <span className="text-[10px] text-slate-400">Total physical link navigations</span>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && links.length === 0 && (
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
            onClick={fetchLinks}
            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <Link2 className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {links.length === 0 ? 'No tracked links yet' : 'No links match your search'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {links.length === 0
              ? 'When you send tracked emails containing hyperlinks with click tracking enabled, they are indexed here.'
              : 'Try clearing your search keyword.'}
          </p>
          {links.length > 0 && (
            <button
              onClick={() => setSearch('')}
              className="mt-4 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium"
            >
              Clear Search
            </button>
          )}
        </div>
      )}

      {/* Tracked Links Table */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-medium">
                <th className="py-3 px-4">Destination URL</th>
                <th className="py-3 px-4">Associated Email</th>
                <th className="py-3 px-4">Clicks (Unique / Total)</th>
                <th className="py-3 px-4">Safety Verification</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.map((link) => {
                const isCopied = copiedToken === link.token;
                return (
                  <tr key={link.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={link.originalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
                          title={link.originalUrl}
                        >
                          <span className="truncate">{link.originalUrl}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                        Token: {link.token}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {link.message ? (
                        <button
                          onClick={() => onSelectMessage(link.messageId)}
                          className="text-left font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 group"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
                          <span className="truncate max-w-[200px] underline decoration-slate-300 dark:decoration-slate-700">
                            {link.message.subject}
                          </span>
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">No message associated</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium">
                        <MousePointerClick className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-slate-900 dark:text-slate-100 font-semibold">{link.uniqueClicks}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-600 dark:text-slate-400">{link.clickCount} total</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        Verified Safe Target
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleCopyLink(link.token)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        title="Copy tracking redirect URL"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span className="text-[11px]">Copy URL</span>
                          </>
                        )}
                      </button>
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
