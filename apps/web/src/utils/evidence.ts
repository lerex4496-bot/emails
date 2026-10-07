export interface EventEvidenceInput {
  type: string;
  source?: string | null;
  confidence?: string | null;
  classification?: string | null;
  isProxy?: boolean | null;
  proxyType?: string | null;
  userAgent?: string | null;
  timestamp?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Returns truth-in-evidence human labels.
 * Invariant: NEVER returns "READ" for pixel requests or remote image fetches.
 */
export function getTruthfulEventLabel(type: string): string {
  switch (type) {
    case 'TRACKING_RESOURCE_REQUESTED':
      return 'Tracking request';
    case 'PROBABLE_EMAIL_OPEN':
      return 'Probable open';
    case 'POSSIBLE_EMAIL_OPEN':
      return 'Possible open';
    case 'CONFIRMED_EMAIL_VIEW':
      return 'Confirmed view';
    case 'LINK_CLICKED':
      return 'Click';
    case 'REPLY_RECEIVED':
      return 'Reply';
    case 'DELIVERY_STATUS_UPDATED':
    case 'DELIVERED':
      return 'Delivered';
    case 'BOUNCED':
      return 'Bounce';
    case 'SENT':
      return 'Dispatched';
    default:
      return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/**
 * Derives comprehensive, evidence-based physical rationale for any telemetry event.
 */
export function formatEvidence(event: EventEvidenceInput): string {
  if (event.metadata?.evidence && typeof event.metadata.evidence === 'string') {
    return event.metadata.evidence;
  }

  // 1. First-Party Native Viewport Render
  if (event.type === 'CONFIRMED_EMAIL_VIEW') {
    const platform = event.metadata?.platform || (event.source?.includes('windows') ? 'Windows' : event.source?.includes('android') ? 'Android' : 'Client');
    const deviceId = event.metadata?.deviceIdentifier || 'verified-device';
    return `First-party client observation verified by MailTrace native client (${platform}, Device ID: ${deviceId}). Direct render in recipient viewport confirmed.`;
  }

  // 2. Interactive Link Navigation
  if (event.type === 'LINK_CLICKED') {
    const dest = event.metadata?.destinationUrl ? ` to ${event.metadata.destinationUrl}` : '';
    return `Physical link navigation through redirect endpoint${dest}. User actively clicked/tapped hyperlinked anchor.`;
  }

  // 3. Inbound RFC Reply Correlation
  if (event.type === 'REPLY_RECEIVED') {
    const ttr = event.metadata?.timeToReply ? ` (${event.metadata.timeToReply} after dispatch)` : '';
    return `Cryptographically validated RFC-2822 In-Reply-To/References header correlation${ttr}. Zero email body stored in MailTrace database.`;
  }

  // 4. Delivery status
  if (event.type === 'DELIVERY_STATUS_UPDATED' || event.type === 'DELIVERED') {
    const dsn = event.metadata?.dsnStatus ? ` (DSN: ${event.metadata.dsnStatus})` : '';
    return `SMTP 250 OK or mail provider receipt acknowledgment confirmed by destination mail exchange${dsn}.`;
  }

  if (event.type === 'BOUNCED') {
    const reason = event.metadata?.reason ? `: ${event.metadata.reason}` : '';
    return `Message rejected or bounced by remote mail exchange${reason}. Delivery permanently or transiently halted.`;
  }

  // 5. Proxy and automated scanner classifications
  if (event.isProxy || (event.proxyType && event.proxyType !== 'NONE')) {
    const proxy = event.proxyType || 'Intermediate Proxy';

    if (proxy.toUpperCase().includes('SECURITY') || event.source === 'security_filter') {
      const note = event.metadata?.scannerNote ? ` (${event.metadata.scannerNote})` : '';
      return `Automated security scanner pre-fetch by corporate mail gateway${note}. Remote tracking pixel loaded by automated filter, not a recipient.`;
    }

    if (proxy.toUpperCase().includes('GOOGLE')) {
      return `Remote image requested via GoogleImageProxy cache servers (via: 1.1 google). Note: GoogleImageProxy uses a synthetic User-Agent (Windows NT 5.1 / Firefox 11) for all requests worldwide to protect recipient privacy; actual device OS (e.g. Android phone, iPhone) is masked.`;
    }

    if (proxy.toUpperCase().includes('APPLE')) {
      return `Apple Mail Privacy Protection (MPP) proxy fetch. iOS/macOS loaded remote assets through Apple relay cache without human viewport observation.`;
    }

    return `Remote resource fetched through ${proxy} caching proxy. Indeterminate whether recipient viewed content.`;
  }

  // 6. Direct HTTP requests (Probable open vs Tracking request)
  if (event.type === 'PROBABLE_EMAIL_OPEN') {
    const timing = event.metadata?.timeToFirstRequestSec
      ? ` ${event.metadata.timeToFirstRequestSec}s post-dispatch`
      : '';
    return `Interactive desktop/mobile browser loaded content${timing} without proxy signatures. Client interaction pattern strongly consistent with human reading.`;
  }

  // 7. General Remote Resource Requested
  return 'Remote 1x1 image resource requested via HTTP GET. Remote pixel loaded by mail client; does not constitute proof that human recipient read email body.';
}
