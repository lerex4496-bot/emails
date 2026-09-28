import React, { useState } from 'react';
import {
  Shield,
  Download,
  Trash2,
  Lock,
  CheckCircle,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [storeRawIp, setStoreRawIp] = useState(false);
  const [retainCoarseGeo, setRetainCoarseGeo] = useState(true);
  const [eventRetentionDays, setEventRetentionDays] = useState(90);
  const [saved, setSaved] = useState(false);
  const [wiping, setWiping] = useState(false);

  const handleSavePrivacy = async () => {
    try {
      await fetch('/api/v1/settings/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeRawIp,
          retainCoarseGeo,
          eventRetentionDays,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // Local demo mode
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const handleExportData = () => {
    window.open('/api/v1/settings/data/export', '_blank');
  };

  const handleWipeHistory = async () => {
    if (!confirm('Are you sure you want to permanently erase all tracking events and click history? This cannot be undone.')) {
      return;
    }
    setWiping(true);
    try {
      await fetch('/api/v1/settings/data/history', { method: 'DELETE' });
      alert('Tracking history erased successfully.');
    } catch {
      alert('Failed to erase history.');
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-xs">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Privacy & System Settings
        </h2>
        <p className="text-slate-500">
          Configure telemetry data collection, cryptographic protections, and retention rules.
        </p>
      </div>

      {/* Privacy Settings Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            Data Privacy & IP Address Policies
          </h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200 block">
                Store Raw IP Addresses
              </span>
              <span className="text-[11px] text-slate-500 block max-w-md">
                When disabled (recommended), client IP addresses are dropped immediately and never stored in the database.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={storeRawIp}
                onChange={(e) => setStoreRawIp(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200 block">
                Retain Coarse Network Diagnostics
              </span>
              <span className="text-[11px] text-slate-500 block max-w-md">
                Stores non-identifying network metadata (ASN and general country) to detect automated cloud security scanners and image proxies.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={retainCoarseGeo}
                onChange={(e) => setRetainCoarseGeo(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200 block">
                Event Retention Period
              </span>
              <span className="text-[11px] text-slate-500 block max-w-md">
                Automatically purge tracking events older than the specified duration.
              </span>
            </div>
            <select
              value={eventRetentionDays}
              onChange={(e) => setEventRetentionDays(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days (Recommended)</option>
              <option value={365}>1 Year</option>
              <option value={0}>Indefinite</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle className="w-4 h-4" /> Preferences Saved
            </span>
          )}
          <div className="ml-auto">
            <button
              onClick={handleSavePrivacy}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>

      {/* Security & Cryptography Status */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            Encryption & Security State
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4 text-slate-600 dark:text-slate-400">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
              AES-256-GCM Token Encryption
            </span>
            <span className="text-[11px] text-slate-500">
              Active. Provider secrets and OAuth credentials are authenticated and encrypted at rest.
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
              Open-Redirect Defense
            </span>
            <span className="text-[11px] text-slate-500">
              Active. Redirection destinations are strictly verified by database lookup.
            </span>
          </div>
        </div>
      </div>

      {/* Data Sovereignty & Management */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm border-b border-slate-100 dark:border-slate-800 pb-3">
          Data Ownership & Compliance
        </h3>

        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="font-medium text-slate-800 dark:text-slate-200 block">
              Export Tracking History
            </span>
            <span className="text-[11px] text-slate-500">
              Download all messages, timestamps, and evidence logs as a structured JSON file.
            </span>
          </div>
          <button
            onClick={handleExportData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="font-medium text-rose-600 dark:text-rose-400 block">
              Permanently Wipe History
            </span>
            <span className="text-[11px] text-slate-500">
              Deletes all tracking events, click records, and reply associations from the database.
            </span>
          </div>
          <button
            onClick={handleWipeHistory}
            disabled={wiping}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> {wiping ? 'Wiping...' : 'Wipe Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
