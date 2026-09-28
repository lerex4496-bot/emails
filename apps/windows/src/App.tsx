import React, { useState } from 'react';
import { WindowsSyncQueue } from './sync-queue.js';
import { ShieldCheck, Mail, RefreshCw, CheckCircle2 } from 'lucide-react';

const syncQueue = new WindowsSyncQueue();

export const App: React.FC = () => {
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('Connected');
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  const messages = [
    {
      id: '01HV-MSG-WIN-1',
      subject: 'Security Review & Multi-Cloud Invariants',
      from: 'partner@enterprise.io',
      body: 'Hi, please confirm receipt of the security review findings.',
    },
    {
      id: '01HV-MSG-WIN-2',
      subject: 'Production Deployment Verification',
      from: 'devops@cluster.internal',
      body: 'Release 1.0.0 candidate is ready for testing.',
    },
  ];

  const handleOpenMessage = (msgId: string) => {
    setActiveMessageId(msgId);

    // When the user views a message inside the first-party Windows reader,
    // emit FIRST_PARTY_VIEW_CONFIRMED.
    if (!confirmedIds.has(msgId)) {
      syncQueue.enqueueConfirmView(msgId, 'win-desktop-host');
      setConfirmedIds((prev) => new Set(prev).add(msgId));

      // Attempt immediate background flush
      syncQueue.flush('http://localhost:3000').catch(() => {
        setSyncStatus('Offline (Event Queued)');
      });
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-100 text-xs font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-800 bg-slate-950 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-200">MailTrace Windows</span>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
            1st-Party
          </span>
        </div>

        <div className="p-2 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between px-3">
          <span>Inbox & Tracked</span>
          <span>{messages.length} messages</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {messages.map((m) => (
            <button
              key={m.id}
              onClick={() => handleOpenMessage(m.id)}
              className={`w-full text-left p-3 rounded-lg border transition ${
                activeMessageId === m.id
                  ? 'bg-blue-950/60 border-blue-800 text-white'
                  : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-300'
              }`}
            >
              <div className="font-medium truncate">{m.subject}</div>
              <div className="text-[11px] text-slate-400 mt-1">{m.from}</div>
              {confirmedIds.has(m.id) && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  View Confirmed
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
          <span>Status: {syncStatus}</span>
          <button
            onClick={() => syncQueue.flush('http://localhost:3000')}
            className="flex items-center gap-1 hover:text-slate-300 transition"
          >
            <RefreshCw className="w-3 h-3" /> Sync
          </button>
        </div>
      </aside>

      {/* Reader Panel */}
      <main className="flex-1 flex flex-col">
        {activeMessageId ? (
          <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950">
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-4 h-4" />
                First-Party Viewport Render Active: Dispatched CONFIRMED_EMAIL_VIEW
              </span>
              <h2 className="text-base font-bold text-white">
                {messages.find((m) => m.id === activeMessageId)?.subject}
              </h2>
              <div className="text-slate-400 text-xs mt-1">
                From: {messages.find((m) => m.id === activeMessageId)?.from}
              </div>
            </div>

            <div className="p-6 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 text-sm leading-relaxed">
              {messages.find((m) => m.id === activeMessageId)?.body}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Mail className="w-8 h-8 mb-2" />
            <p>Select a message from the left to read with confirmed view tracking.</p>
          </div>
        )}
      </main>
    </div>
  );
};
