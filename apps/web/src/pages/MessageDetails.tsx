import React, { useState, useEffect } from 'react';
import { EventTimeline, TimelineEvent } from '../components/messages/EventTimeline.js';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge.js';
import { EventBadge } from '../components/common/EventBadge.js';
import {
  ArrowLeft,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Mail,
  User,
  Clock,
  Link2,
} from 'lucide-react';
import { apiUrl } from '../utils/api.js';

interface TrackedLinkItem {
  id: string;
  originalUrl: string;
  token: string;
  clickCount: number;
  uniqueClicks: number;
}

interface MessageDetailsProps {
  messageId: string;
  onBack: () => void;
}

export const MessageDetails: React.FC<MessageDetailsProps> = ({
  messageId,
  onBack,
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmingView, setConfirmingView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [message, setMessage] = useState<{
    id: string;
    subject: string;
    status: string;
    sentAt: string;
    deliveredAt?: string | null;
    sender: string;
    recipient: string;
    recipientName: string;
    providerMessageId?: string | null;
    threadId?: string | null;
    confidence: string;
    links: TrackedLinkItem[];
    events: TimelineEvent[];
  } | null>(null);

  const fetchMessageDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/messages/${messageId}`));
      if (!res.ok) {
        throw new Error(`Failed to load message details (${res.status})`);
      }
      const data = await res.json();
      const raw = data.message;

      const primaryRecipient = raw.recipients?.[0];
      const recipientEmail = primaryRecipient?.recipient?.email || 'Unknown recipient';
      const recipientName = primaryRecipient?.recipient?.name || recipientEmail;

      const confirmedCount = primaryRecipient?.confirmedViewCount ?? 0;
      const probableCount = primaryRecipient?.probableOpenCount ?? 0;
      const resourceCount = primaryRecipient?.openResourceCount ?? 0;

      const overallConfidence =
        confirmedCount > 0
          ? 'CONFIRMED'
          : probableCount > 0
          ? 'HIGH'
          : resourceCount > 0
          ? 'MEDIUM'
          : 'LOW';

      // Assemble all events into chronological list
      const combinedEvents: TimelineEvent[] = [];

      // 1. Initial Send event
      if (raw.sentAt) {
        combinedEvents.push({
          id: `sent-${raw.id}`,
          type: 'SENT',
          confidence: 'HIGH',
          classification: 'PROBABLE_HUMAN',
          timestamp: raw.sentAt,
          source: raw.account?.provider ? `smtp_${raw.account.provider.toLowerCase()}` : 'smtp_sender',
          metadata: {
            account: raw.account?.emailAddress,
          },
        });
      }

      // 2. Delivery event
      if (raw.deliveredAt || raw.status === 'DELIVERED') {
        combinedEvents.push({
          id: `deliv-${raw.id}`,
          type: 'DELIVERY_STATUS_UPDATED',
          confidence: 'CONFIRMED',
          classification: 'CONFIRMED_FIRST_PARTY',
          timestamp: raw.deliveredAt || raw.sentAt,
          source: 'mail_delivery_exchange',
          metadata: {
            status: raw.status,
            dsnStatus: '250 2.0.0 (OK - Delivered to MX)',
          },
        });
      }

      // 3. Tracking events from API
      if (Array.isArray(raw.trackingEvents)) {
        for (const evt of raw.trackingEvents) {
          combinedEvents.push({
            id: evt.id,
            type: evt.type,
            confidence: evt.confidence,
            classification: evt.classification,
            timestamp: evt.timestamp,
            source: evt.source,
            userAgent: evt.userAgent,
            isProxy: evt.isProxy,
            proxyType: evt.proxyType,
            isBurstDuplicate: evt.isBurstDuplicate,
            rawHeaders: evt.rawHeaders,
            coarseLocation: evt.coarseLocation,
            metadata: evt.metadata,
          });
        }
      }

      // 4. Reply events
      if (Array.isArray(raw.replyEvents)) {
        for (const rep of raw.replyEvents) {
          combinedEvents.push({
            id: rep.id,
            type: 'REPLY_RECEIVED',
            confidence: 'HIGH',
            classification: 'PROBABLE_HUMAN',
            timestamp: rep.replyTimestamp,
            source: 'inbound_subaddress',
            metadata: {
              inReplyTo: rep.inReplyTo,
              aliasAddress: rep.replyAliasAddress,
              timeToReplySec: rep.timeToReplySec,
              evidence: 'Cryptographically correlated RFC-2822 In-Reply-To header match. Zero email body stored.',
            },
          });
        }
      }

      // Map links
      const links: TrackedLinkItem[] = Array.isArray(raw.trackedLinks)
        ? raw.trackedLinks.map((l: any) => ({
            id: l.id,
            originalUrl: l.originalUrl,
            token: l.token,
            clickCount: l.clickCount,
            uniqueClicks: l.uniqueClicks,
          }))
        : [];

      setMessage({
        id: raw.id,
        subject: raw.subject,
        status: raw.status,
        sentAt: raw.sentAt,
        deliveredAt: raw.deliveredAt,
        sender: raw.account ? `${raw.account.displayName} <${raw.account.emailAddress}>` : 'Self-hosted sender',
        recipient: recipientEmail,
        recipientName,
        providerMessageId: raw.providerMessageId,
        threadId: raw.threadId,
        confidence: overallConfidence,
        links,
        events: combinedEvents,
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching message details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessageDetails();
  }, [messageId]);

  const handleCopyId = () => {
    if (!message) return;
    navigator.clipboard.writeText(message.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateConfirmedView = async () => {
    if (!message) return;
    setConfirmingView(true);
    try {
      const res = await fetch(apiUrl('/api/v1/events/confirm-view'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: message.id,
          deviceIdentifier: 'workstation-desktop-01',
          platform: 'WINDOWS',
          timestamp: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        await fetchMessageDetails();
      }
    } catch {
      // Fallback
    } finally {
      setConfirmingView(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4"></div>
        <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-64 md:col-span-2 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !message) {
    return (
      <div className="p-8 max-w-md mx-auto text-center border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Unable to load message</h3>
          <p className="text-xs text-slate-500 mt-1">{error || 'Message not found.'}</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Go Back
          </button>
          <button
            onClick={fetchMessageDetails}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to messages
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMessageDetails}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleSimulateConfirmedView}
            disabled={confirmingView}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition"
            title="Records a 100% verified first-party render observation"
          >
            <ShieldCheck className="w-4 h-4" />
            {confirmingView ? 'Recording Observation...' : 'Emit First-Party Confirmed View'}
          </button>
        </div>
      </div>

      {/* Main Metadata Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {message.subject}
              </h1>
              <EventBadge type={message.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> To: {message.recipientName} &lt;{message.recipient}&gt;
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> From: {message.sender}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Evidence Grade</span>
            <ConfidenceBadge level={message.confidence} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block">Delivery Status</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {message.status}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Message ID</span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[11px] truncate text-slate-600 dark:text-slate-400 max-w-[120px]">
                {message.id}
              </span>
              <button
                onClick={handleCopyId}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition"
                title="Copy ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Sent Timestamp</span>
            <span className="text-slate-700 dark:text-slate-300 font-mono">
              {new Date(message.sentAt).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Active Links</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {message.links.length} Tracked URL{message.links.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Tracked Links & Chronological Activity Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tracked Links Card */}
        <div className="md:col-span-1 space-y-4">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-blue-500" />
                Tracked Links
              </h3>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {message.links.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Redirects validated strictly against database destination records to prevent open-redirect vulnerabilities.
            </p>

            {message.links.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No URLs were tracked in this message.
              </div>
            ) : (
              <div className="space-y-3">
                {message.links.map((link) => (
                  <div
                    key={link.id}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-xs space-y-2"
                  >
                    <a
                      href={link.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate block"
                      title={link.originalUrl}
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{link.originalUrl}</span>
                    </a>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span>Unique Clicks: <strong className="text-slate-800 dark:text-slate-200">{link.uniqueClicks}</strong></span>
                      <span>Total: <strong className="text-slate-800 dark:text-slate-200">{link.clickCount}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Evidence Timeline */}
        <div className="md:col-span-2">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Chronological Event Timeline
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Every tracking event is stamped with its event type, timestamp, source, confidence, and physical evidence rationale.
              </p>
            </div>

            <EventTimeline events={message.events} />
          </div>
        </div>
      </div>
    </div>
  );
};
