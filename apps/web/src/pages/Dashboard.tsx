import React, { useState, useEffect } from 'react';
import { MetricCard } from '../components/dashboard/MetricCard.js';
import { ActivityChart } from '../components/dashboard/ActivityChart.js';
import { MessageTable, MessageListItem } from '../components/messages/MessageTable.js';
import {
  Send,
  CheckCircle,
  Activity,
  Eye,
  ShieldCheck,
  MousePointerClick,
  Reply,
  AlertOctagon,
  RefreshCw,
} from 'lucide-react';

interface DashboardMetrics {
  messagesSent: number;
  delivered: number;
  trackingEvents: number;
  probableOpens: number;
  confirmedViews: number;
  uniqueClicks: number;
  replies: number;
  bounces: number;
}

interface DashboardProps {
  onSelectMessage: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectMessage }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    messagesSent: 12,
    delivered: 11,
    trackingEvents: 34,
    probableOpens: 9,
    confirmedViews: 4,
    uniqueClicks: 6,
    replies: 3,
    bounces: 1,
  });

  const [recentMessages, setRecentMessages] = useState<MessageListItem[]>([
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
  ]);

  const [chartData] = useState([
    { time: '08:00', requests: 1, probableOpens: 0, confirmedViews: 0, clicks: 0 },
    { time: '10:00', requests: 4, probableOpens: 2, confirmedViews: 1, clicks: 1 },
    { time: '12:00', requests: 9, probableOpens: 3, confirmedViews: 1, clicks: 2 },
    { time: '14:00', requests: 14, probableOpens: 5, confirmedViews: 2, clicks: 4 },
    { time: '16:00', requests: 22, probableOpens: 7, confirmedViews: 3, clicks: 5 },
    { time: '18:00', requests: 34, probableOpens: 9, confirmedViews: 4, clicks: 6 },
  ]);

  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/dashboard/metrics');
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) setMetrics(data.metrics);
      }
      const msgRes = await fetch('/api/v1/messages');
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        if (msgData.messages && msgData.messages.length > 0) {
          setRecentMessages(msgData.messages.slice(0, 5));
        }
      }
    } catch {
      // Use demo data if offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Email Tracking Overview
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Evidence-based telemetry for owner-sent messages. Passive requests are never falsely reported as &quot;read&quot;.
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* 8 Essential Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Messages Sent"
          value={metrics.messagesSent}
          subtext="Owner-dispatched emails"
          icon={Send}
          color="blue"
        />
        <MetricCard
          label="Delivered"
          value={metrics.delivered}
          subtext="Confirmed by provider/DSN"
          icon={CheckCircle}
          color="emerald"
        />
        <MetricCard
          label="Tracking Events"
          value={metrics.trackingEvents}
          subtext="Total HTTP resource fetches"
          icon={Activity}
          color="slate"
        />
        <MetricCard
          label="Probable Opens"
          value={metrics.probableOpens}
          subtext="Heuristic human activity"
          icon={Eye}
          color="indigo"
        />
        <MetricCard
          label="Confirmed Views"
          value={metrics.confirmedViews}
          subtext="1st-party reader verified"
          icon={ShieldCheck}
          badge="Strongest"
          color="emerald"
        />
        <MetricCard
          label="Unique Clicks"
          value={metrics.uniqueClicks}
          subtext="Redirects via /t/click"
          icon={MousePointerClick}
          color="indigo"
        />
        <MetricCard
          label="Replies Received"
          value={metrics.replies}
          subtext="Correlated threads"
          icon={Reply}
          color="blue"
        />
        <MetricCard
          label="Bounces / Failed"
          value={metrics.bounces}
          subtext="Hard or soft bounces"
          icon={AlertOctagon}
          color="rose"
        />
      </div>

      {/* Activity Timeline Chart */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Interaction & Telemetry Timeline
            </h3>
            <span className="text-[11px] text-slate-500">
              Distinct curves for resource requests, probable human opens, first-party views, and clicks.
            </span>
          </div>
        </div>
        <ActivityChart data={chartData} />
      </div>

      {/* Recent Messages Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Recent Tracked Messages
          </h3>
          <span className="text-[11px] text-slate-400">Showing recent dispatches</span>
        </div>
        <MessageTable
          messages={recentMessages}
          onSelectMessage={onSelectMessage}
        />
      </div>
    </div>
  );
};
