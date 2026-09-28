import React, { useState } from 'react';
import { EventTimeline, TimelineEvent } from '../components/messages/EventTimeline.js';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge.js';
import {
  ArrowLeft,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

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

  // Demo / local state
  const [message, setMessage] = useState({
    id: messageId,
    subject: 'Quarterly Project Partnership Proposal',
    status: 'DELIVERED',
    sentAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    sender: 'alex@mycompany.com (SMTP)',
    recipient: 'alice.chen@enterprise.org',
    recipientName: 'Alice Chen',
    providerMessageId: '<01HV998X72TEST@smtp.mycompany.com>',
    threadId: 'thread_9921_abc',
    confidence: 'CONFIRMED',
    links: [
      {
        id: 'lnk-1',
        originalUrl: 'https://enterprise.org/proposal/v2',
        token: 'clk_tok_prop_v2',
        clickCount: 2,
        uniqueClicks: 1,
      },
    ] as TrackedLinkItem[],
    events: [
      {
        id: 'evt-1',
        type: 'SENT',
        confidence: 'HIGH',
        classification: 'PROBABLE_HUMAN',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        source: 'smtp_client',
      },
      {
        id: 'evt-2',
        type: 'DELIVERY_STATUS_UPDATED',
        confidence: 'CONFIRMED',
        classification: 'CONFIRMED_FIRST_PARTY',
        timestamp: new Date(Date.now() - 3600000 * 2 + 1500).toISOString(),
        source: 'postfix_dsn',
        metadata: { dsnStatus: '2.0.0 (Delivered)' },
      },
      {
        id: 'evt-3',
        type: 'TRACKING_RESOURCE_REQUESTED',
        confidence: 'MEDIUM',
        classification: 'POSSIBLE_HUMAN',
        timestamp: new Date(Date.now() - 3600000 + 45000).toISOString(),
        source: 'http_get',
        isProxy: true,
        proxyType: 'GoogleImageProxy',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GoogleImageProxy',
      },
      {
        id: 'evt-4',
        type: 'LINK_CLICKED',
        confidence: 'HIGH',
        classification: 'PROBABLE_HUMAN',
        timestamp: new Date(Date.now() - 3600000 + 120000).toISOString(),
        source: 'http_click_redirect',
        metadata: { originalUrl: 'https://enterprise.org/proposal/v2' },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36',
      },
      {
        id: 'evt-5',
        type: 'CONFIRMED_EMAIL_VIEW',
        confidence: 'CONFIRMED',
        classification: 'CONFIRMED_FIRST_PARTY',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        source: 'first_party_windows',
        metadata: { platform: 'WINDOWS', deviceIdentifier: 'lenovo-workstation-01' },
      },
      {
        id: 'evt-6',
        type: 'REPLY_RECEIVED',
        confidence: 'HIGH',
        classification: 'PROBABLE_HUMAN',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        source: 'inbound_subaddress',
        metadata: { timeToReply: '1 hour 45 minutes' },
      },
    ] as TimelineEvent[],
  });

  const handleCopyId = () => {
    navigator.clipboard.writeText(message.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateConfirmedView = async () => {
    setConfirmingView(true);
    try {
      const res = await fetch('/api/v1/events/confirm-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: message.id,
          deviceIdentifier: 'web-dashboard-manual',
          platform: 'WEB',
        }),
      });

      if (res.ok) {
        const newEvent: TimelineEvent = {
          id: `evt-${Date.now()}`,
          type: 'CONFIRMED_EMAIL_VIEW',
          confidence: 'CONFIRMED',
          classification: 'CONFIRMED_FIRST_PARTY',
          timestamp: new Date().toISOString(),
          source: 'first_party_web',
          metadata: { platform: 'WEB', deviceIdentifier: 'web-dashboard-manual' },
        };
        setMessage((prev) => ({
          ...prev,
          events: [...prev.events, newEvent],
        }));
      }
    } catch {
      // Local fallback
    } finally {
      setConfirmingView(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button and title */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to messages
        </button>
        <button
          onClick={handleSimulateConfirmedView}
          disabled={confirmingView}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          {confirmingView ? 'Recording...' : 'Emit First-Party Confirmed View'}
        </button>
      </div>

      {/* Main Metadata Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {message.subject}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span>To: {message.recipientName} &lt;{message.recipient}&gt;</span>
              <span>•</span>
              <span>From: {message.sender}</span>
            </div>
          </div>
          <ConfidenceBadge level={message.confidence} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block">Status</span>
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
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Thread ID</span>
            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
              {message.threadId}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Dispatched</span>
            <span className="text-slate-600 dark:text-slate-400">
              {new Date(message.sentAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Tracked Links & Activity Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tracked Links Card */}
        <div className="md:col-span-1 space-y-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Registered Tracked Links
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Links rewritten to /t/click/:token with strict open-redirect validation.
            </p>

            <div className="space-y-3">
              {message.links.map((link) => (
                <div
                  key={link.id}
                  className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5"
                >
                  <a
                    href={link.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate block"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{link.originalUrl}</span>
                  </a>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Unique Clicks: {link.uniqueClicks}</span>
                    <span>Total: {link.clickCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Evidence Timeline */}
        <div className="md:col-span-2">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Detailed Activity Timeline
              </h3>
              <p className="text-[11px] text-slate-400">
                Each event is tagged with its raw origin and confidence classification.
              </p>
            </div>

            <EventTimeline events={message.events} />
          </div>
        </div>
      </div>
    </div>
  );
};
