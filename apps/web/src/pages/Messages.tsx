import React, { useState } from 'react';
import { MessageTable, MessageListItem } from '../components/messages/MessageTable.js';
import { Search, Filter } from 'lucide-react';

interface MessagesPageProps {
  onSelectMessage: (id: string) => void;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({ onSelectMessage }) => {
  const [search, setSearch] = useState('');
  const [filterConfidence, setFilterConfidence] = useState('ALL');

  const [messages] = useState<MessageListItem[]>([
    {
      id: 'msg-demo-1',
      subject: 'Quarterly Project Partnership Proposal',
      status: 'DELIVERED',
      sentAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      recipient: { email: 'alice.chen@enterprise.org', name: 'Alice Chen' },
      opens: { resourceRequestedCount: 3, probableCount: 1, confirmedCount: 1 },
      clicks: { totalClicks: 2, uniqueClicks: 1 },
      replyReceived: true,
      confidence: 'CONFIRMED',
    },
    {
      id: 'msg-demo-2',
      subject: 'Updated Architectural Blueprint',
      status: 'DELIVERED',
      sentAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      recipient: { email: 'robert@techcorp.io', name: 'Robert Miller' },
      opens: { resourceRequestedCount: 2, probableCount: 1, confirmedCount: 0 },
      clicks: { totalClicks: 1, uniqueClicks: 1 },
      replyReceived: false,
      confidence: 'HIGH',
    },
    {
      id: 'msg-demo-3',
      subject: 'Welcome to the Developer Beta Program',
      status: 'DELIVERED',
      sentAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      recipient: { email: 'subscriber@gmail.com', name: 'Dev Community' },
      opens: { resourceRequestedCount: 5, probableCount: 0, confirmedCount: 0 },
      clicks: { totalClicks: 0, uniqueClicks: 0 },
      replyReceived: false,
      confidence: 'MEDIUM',
    },
    {
      id: 'msg-demo-4',
      subject: 'Security Audit & Invariant Checks',
      status: 'SENT',
      sentAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      recipient: { email: 'security@infosec.com', name: 'Security Office' },
      opens: { resourceRequestedCount: 1, probableCount: 0, confirmedCount: 0 },
      clicks: { totalClicks: 0, uniqueClicks: 0 },
      replyReceived: false,
      confidence: 'LOW',
    },
  ]);

  const filtered = messages.filter((m) => {
    const matchesSearch =
      m.subject.toLowerCase().includes(search.toLowerCase()) ||
      (m.recipient?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.recipient?.name || '').toLowerCase().includes(search.toLowerCase());

    const matchesConfidence =
      filterConfidence === 'ALL' || m.confidence === filterConfidence;

    return matchesSearch && matchesConfidence;
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Tracked Messages
          </h2>
          <p className="text-xs text-slate-500">
            Monitor real-time telemetry, click rates, and delivery statuses.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipient or subject..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterConfidence}
              onChange={(e) => setFilterConfidence(e.target.value)}
              className="bg-transparent focus:outline-none text-xs"
            >
              <option value="ALL">All Confidence</option>
              <option value="CONFIRMED">Confirmed View</option>
              <option value="HIGH">Probable Open</option>
              <option value="MEDIUM">Possible Open</option>
              <option value="LOW">Resource Requested</option>
            </select>
          </div>
        </div>
      </div>

      <MessageTable
        messages={filtered}
        onSelectMessage={onSelectMessage}
      />
    </div>
  );
};
