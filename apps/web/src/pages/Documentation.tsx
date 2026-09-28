import React from 'react';
import { BookOpen, ShieldAlert, Cpu, Eye, ShieldCheck, Lock } from 'lucide-react';

export const DocumentationPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto text-xs leading-relaxed text-slate-700 dark:text-slate-300">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          MailTrace Architecture & Telemetry Principles
        </h2>
        <p className="text-slate-500 mt-1">
          Technical specifications, evidence thresholds, and the reality of email tracking physics.
        </p>
      </div>

      {/* Crucial Notice */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 space-y-2">
        <div className="flex items-center gap-2 font-bold text-xs">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          The Fundamental Limit of Passive Email Tracking
        </div>
        <p className="text-[11px] leading-normal">
          Passive email tracking relies on the recipient mail client requesting remote resources (a 1x1 invisible image).
          Because recipient mail clients and intermediate security networks can proxy, cache, preload, or block remote images,
          <strong> universal 100% accuracy is mathematically and technically impossible</strong> in third-party environments.
          MailTrace will never claim an email was &quot;read&quot; when the underlying signal only proves an HTTP resource was requested.
        </p>
      </div>

      {/* 4 Levels of Observation */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
          Evidence Classification Matrix
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <Cpu className="w-4 h-4 text-slate-500" />
              <span>1. Resource Requested (Low)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              An HTTP GET hit `/t/open/:token`. The request matches an automated security crawler, cloud datacenter IP, or contains prefetch headers (`Sec-Purpose: prefetch`).
            </p>
          </div>

          <div className="p-4 rounded-xl border border-amber-200/60 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
              <Eye className="w-4 h-4 text-amber-600" />
              <span>2. Possible Open (Medium)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              The request was routed through a known caching proxy (such as Google Image Proxy or Apple Mail Privacy Protection). The recipient mail server preloaded the image upon delivery; it is indeterminate whether human eyes opened the email.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-blue-200/60 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>3. Probable Open (High)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Request arrived &gt;5 seconds after delivery, comes from an interactive residential/mobile client with human user-agent patterns, or was quickly followed by an intentional link click.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>4. Confirmed View (Authoritative)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Directly reported by an authorized first-party MailTrace application (Windows desktop client, Android app, or webmail extension) when the message enters the active viewport.
            </p>
          </div>
        </div>
      </div>

      {/* Security Guarantees */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-600" />
          Security & Privacy Invariants
        </h3>
        <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400 text-[11px]">
          <li>
            <strong>Open-Redirect Prevention:</strong> Link tracking endpoint <code>/t/click/:token</code> resolves the destination solely from internal database records. No query parameter URL redirects are ever accepted.
          </li>
          <li>
            <strong>Zero JavaScript in Emails:</strong> All tracking uses standard RFC 2822 HTML structures (<code>&lt;img&gt;</code> and <code>&lt;a href&gt;</code>). No scripting or browser exploit is used.
          </li>
          <li>
            <strong>No Injected UI or Warnings:</strong> Tracking pixels are 1x1 transparent PNGs (68 bytes) styled with zero border and opacity, preventing visual alterations of the email layout.
          </li>
          <li>
            <strong>AES-256-GCM Key Management:</strong> Stored SMTP passwords, OAuth refresh tokens, and credentials are encrypted using authenticated Galois/Counter Mode.
          </li>
          <li>
            <strong>No Raw IP Storage:</strong> By default, MailTrace drops IP addresses at the gateway, computing only coarse network indicators for proxy classification.
          </li>
        </ul>
      </div>
    </div>
  );
};
