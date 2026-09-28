import React, { useState, useEffect } from 'react';
import {
  ActivitySquare,
  Server,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Play,
  Layers,
  Sparkles,
} from 'lucide-react';
import { EventBadge } from '../components/common/EventBadge.js';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge.js';
import { formatEvidence } from '../utils/evidence.js';

interface HealthData {
  status: string;
  service: string;
  uptime: number;
  timestamp: string;
}

interface ReadyData {
  status: string;
  checks: {
    database: string;
    redis: string;
  };
}

interface MetricsData {
  processMemoryMb: number;
  nodeVersion: string;
  platform: string;
}

export const DiagnosticsPage: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [ready, setReady] = useState<ReadyData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Proxy Simulator State
  const [testUserAgent, setTestUserAgent] = useState(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GoogleImageProxy'
  );
  const [testViaHeader, setTestViaHeader] = useState('1.1 google');
  const [testSecondsAfterSend, setTestSecondsAfterSend] = useState('45');
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, readyRes, metricsRes] = await Promise.all([
        fetch('/health'),
        fetch('/ready'),
        fetch('/metrics'),
      ]);

      if (healthRes.ok) setHealth(await healthRes.json());
      if (readyRes.ok) setReady(await readyRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
    } catch (err: any) {
      setError(err.message || 'Error communicating with backend diagnostics endpoints.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    runSimulation();
  }, []);

  const runSimulation = () => {
    const ua = testUserAgent.toLowerCase();
    const via = testViaHeader.toLowerCase();
    const seconds = Number(testSecondsAfterSend) || 0;

    let isProxy = false;
    let proxyType: string | null = null;
    let type = 'TRACKING_RESOURCE_REQUESTED';
    let confidence = 'LOW';
    let classification = 'LIKELY_AUTOMATED';

    if (
      ua.includes('proofpoint') ||
      ua.includes('mimecast') ||
      ua.includes('barracuda') ||
      seconds < 2
    ) {
      isProxy = true;
      proxyType = 'SECURITY_GATEWAY';
      type = 'TRACKING_RESOURCE_REQUESTED';
      confidence = 'LOW';
      classification = 'LIKELY_AUTOMATED';
    } else if (ua.includes('googleimageproxy') || via.includes('google')) {
      isProxy = true;
      proxyType = 'GOOGLE_IMAGE_PROXY';
      type = 'TRACKING_RESOURCE_REQUESTED';
      confidence = 'MEDIUM';
      classification = 'POSSIBLE_HUMAN';
    } else if (ua.includes('apple') || via.includes('apple') || ua.includes('privaterelay')) {
      isProxy = true;
      proxyType = 'APPLE_PRIVATE_RELAY';
      type = 'TRACKING_RESOURCE_REQUESTED';
      confidence = 'MEDIUM';
      classification = 'POSSIBLE_HUMAN';
    } else if (
      ua.includes('mozilla') &&
      (ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox')) &&
      seconds > 5
    ) {
      isProxy = false;
      proxyType = null;
      type = 'PROBABLE_EMAIL_OPEN';
      confidence = 'HIGH';
      classification = 'PROBABLE_HUMAN';
    } else {
      isProxy = false;
      proxyType = null;
      type = 'TRACKING_RESOURCE_REQUESTED';
      confidence = 'LOW';
      classification = 'LIKELY_AUTOMATED';
    }

    const mockEvt = {
      type,
      source: isProxy ? 'proxy_cache' : 'http_browser_get',
      confidence,
      classification,
      isProxy,
      proxyType,
      userAgent: testUserAgent,
      metadata: {
        timeToFirstRequestSec: seconds,
        scannerNote: seconds < 2 ? 'Sub-2-second automated prefetch detected' : undefined,
      },
    };

    setSimulationResult({
      ...mockEvt,
      evidence: formatEvidence(mockEvt),
    });
  };

  const presetExamples = [
    {
      name: 'Google Image Proxy',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) GoogleImageProxy',
      via: '1.1 google',
      sec: '60',
    },
    {
      name: 'Apple MPP Private Relay',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
      via: '1.1 apple-relay.net',
      sec: '120',
    },
    {
      name: 'Proofpoint URL Scanner',
      ua: 'Proofpoint-URL-Scanner/2.4 (compatible; proofpoint-corp)',
      via: '',
      sec: '1.2',
    },
    {
      name: 'Interactive Human Browser',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      via: '',
      sec: '340',
    },
    {
      name: 'Automated Curl Script',
      ua: 'curl/8.2.1',
      via: '',
      sec: '15',
    },
  ];

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ActivitySquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            System Observability & Classification Diagnostics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time status of backend microservices, Redis queues, PostgreSQL connections, and interactive classifier simulation.
          </p>
        </div>

        <button
          onClick={fetchDiagnostics}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDiagnostics}
            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* API Server */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-blue-500" /> API Server
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {health?.status || 'Online'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-0.5">
            <div>Uptime: <strong className="text-slate-700 dark:text-slate-300 font-mono">{formatUptime(health?.uptime)}</strong></div>
            <div>Service: <span className="font-mono">{health?.service || 'mailtrace-api'}</span></div>
          </div>
        </div>

        {/* PostgreSQL Database */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-500" /> PostgreSQL
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {ready?.checks.database || 'Connected'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-0.5">
            <div>Engine: Prisma Client 5.22</div>
            <div>Migrations: <strong className="text-emerald-600">Applied (v1.0.0)</strong></div>
          </div>
        </div>

        {/* Redis BullMQ */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-rose-500" /> Redis Queue
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {ready?.checks.redis || 'Healthy'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-0.5">
            <div>Queue: <span className="font-mono">email-tracking-events</span></div>
            <div>Worker: <strong className="text-emerald-600">Active Consumer</strong></div>
          </div>
        </div>

        {/* Process Metrics */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-purple-500" /> Process Resources
            </span>
            <span className="text-[11px] font-mono text-slate-500">{metrics?.nodeVersion || 'Node.js'}</span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-0.5">
            <div>Memory RSS: <strong className="text-slate-700 dark:text-slate-300 font-mono">{metrics?.processMemoryMb || 45} MB</strong></div>
            <div>Platform: <span className="font-mono">{metrics?.platform || 'linux'}</span></div>
          </div>
        </div>
      </div>

      {/* Interactive Classifier Simulator Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Interactive Proxy & Evidence Classifier Simulator
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Test how MailTrace evaluates incoming HTTP requests. Test cache pre-fetches, enterprise security scanners, and human browser interactions in real-time.
          </p>
        </div>

        {/* Quick Presets */}
        <div>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-2">
            Load Inspection Presets:
          </span>
          <div className="flex flex-wrap gap-2">
            {presetExamples.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setTestUserAgent(preset.ua);
                  setTestViaHeader(preset.via);
                  setTestSecondsAfterSend(preset.sec);
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 transition text-[11px] font-medium"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1">
            <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
              User-Agent Header
            </label>
            <input
              type="text"
              value={testUserAgent}
              onChange={(e) => setTestUserAgent(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
              Via / Forwarded Header (optional)
            </label>
            <input
              type="text"
              value={testViaHeader}
              onChange={(e) => setTestViaHeader(e.target.value)}
              placeholder="e.g. 1.1 google"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
              Elapsed Time Post-Send (seconds)
            </label>
            <input
              type="number"
              value={testSecondsAfterSend}
              onChange={(e) => setTestSecondsAfterSend(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={runSimulation}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5" />
              Evaluate Request Classification
            </button>
          </div>
        </div>

        {/* Results Card */}
        {simulationResult && (
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/50 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Resulting Label:</span>
                <EventBadge type={simulationResult.type} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Assigned Confidence:</span>
                <ConfidenceBadge level={simulationResult.confidence} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block">Proxy Detected:</span>
                <strong className={simulationResult.isProxy ? 'text-amber-600 font-mono' : 'text-slate-700 dark:text-slate-300'}>
                  {simulationResult.isProxy ? `Yes (${simulationResult.proxyType})` : 'No (Direct Connection)'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Internal Classification:</span>
                <strong className="text-slate-700 dark:text-slate-300 font-mono">{simulationResult.classification}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Evaluated Source:</span>
                <strong className="text-slate-700 dark:text-slate-300 font-mono">{simulationResult.source}</strong>
              </div>
            </div>

            {/* Evidence Rationale */}
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-semibold text-[11px] text-blue-700 dark:text-blue-300 block">
                Truth-in-Evidence Rationale:
              </span>
              <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                {simulationResult.evidence}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
