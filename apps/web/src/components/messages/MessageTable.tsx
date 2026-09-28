import React from 'react';
import { ConfidenceBadge } from '../common/ConfidenceBadge.js';
import { MessageStatus } from '@mailtrace/shared';
import { Mail, CheckCircle2, Clock, XCircle, MousePointerClick, Reply } from 'lucide-react';

export interface MessageListItem {
  id: string;
  subject: string;
  status: MessageStatus | string;
  sentAt?: string | null;
  firstActivityAt?: string | null;
  lastActivityAt?: string | null;
  recipient?: {
    email: string;
    name?: string | null;
  } | null;
  opens: {
    resourceRequestedCount: number;
    probableCount: number;
    confirmedCount: number;
  };
  clicks: {
    totalClicks: number;
    uniqueClicks: number;
  };
  replyReceived: boolean;
  confidence: string;
}

interface MessageTableProps {
  messages: MessageListItem[];
  onSelectMessage: (id: string) => void;
  selectedId?: string | null;
}

export const MessageTable: React.FC<MessageTableProps> = ({
  messages,
  onSelectMessage,
  selectedId,
}) => {
  if (messages.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
        <Mail className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          No tracked emails found
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Send your first tracked email using the &quot;Send Tracked Email&quot; button above.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-medium">
            <th className="py-3 px-4">Recipient</th>
            <th className="py-3 px-4">Subject</th>
            <th className="py-3 px-4">Sent</th>
            <th className="py-3 px-4">Delivery</th>
            <th className="py-3 px-4">Opens (Prob/Conf)</th>
            <th className="py-3 px-4">Clicks</th>
            <th className="py-3 px-4">Reply</th>
            <th className="py-3 px-4">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {messages.map((m) => {
            const isSelected = m.id === selectedId;
            return (
              <tr
                key={m.id}
                onClick={() => onSelectMessage(m.id)}
                className={`cursor-pointer transition hover:bg-blue-50/40 dark:hover:bg-blue-950/20 ${
                  isSelected ? 'bg-blue-50/80 dark:bg-blue-950/40' : ''
                }`}
              >
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {m.recipient?.name || m.recipient?.email || 'Unknown'}
                  </div>
                  {m.recipient?.name && (
                    <div className="text-[11px] text-slate-400">{m.recipient.email}</div>
                  )}
                </td>
                <td className="py-3 px-4 max-w-xs truncate font-medium text-slate-800 dark:text-slate-200">
                  {m.subject}
                </td>
                <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                  {m.sentAt ? new Date(m.sentAt).toLocaleDateString() : '-'}
                </td>
                <td className="py-3 px-4">
                  {m.status === MessageStatus.DELIVERED ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Delivered
                    </span>
                  ) : m.status === MessageStatus.BOUNCED ? (
                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                      <XCircle className="w-3.5 h-3.5" />
                      Bounced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      Accepted
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {m.opens.probableCount}
                  </span>
                  <span className="text-slate-400 mx-1">/</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {m.opens.confirmedCount}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1.5">
                    ({m.opens.resourceRequestedCount} req)
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <MousePointerClick className="w-3.5 h-3.5 text-purple-500" />
                    <span>{m.clicks.uniqueClicks} unique</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {m.replyReceived ? (
                    <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                      <Reply className="w-3.5 h-3.5" />
                      Received
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <ConfidenceBadge level={m.confidence} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
