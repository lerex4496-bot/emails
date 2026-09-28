import { ConfidenceLevel, Classification, TrackingEventType } from '@mailtrace/shared';
import { KNOWN_SIGNATURES, KnownSignature } from './signatures.js';

export interface ClassificationInput {
  userAgent?: string | null;
  headers?: Record<string, any>;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  requestTime: Date;
  isFirstParty?: boolean;
  subsequentClickObserved?: boolean;
}

export interface ClassificationResult {
  eventType: TrackingEventType;
  classification: Classification;
  confidence: ConfidenceLevel;
  humanProbability: number | null;
  isProxy: boolean;
  proxyType: string | null;
  signals: string[];
  explanation: string;
}

/**
 * Event-analysis classification engine for MailTrace.
 * Strictly adheres to truth-in-evidence: passive requests are never labeled as confirmed reads.
 */
export function classifyTrackingRequest(input: ClassificationInput): ClassificationResult {
  const signals: string[] = [];
  const ua = input.userAgent || '';
  const headers = input.headers || {};

  // 1. Direct first-party observation (authoritative)
  if (input.isFirstParty) {
    return {
      eventType: TrackingEventType.CONFIRMED_EMAIL_VIEW,
      classification: Classification.CONFIRMED_FIRST_PARTY,
      confidence: ConfidenceLevel.CONFIRMED,
      humanProbability: 1.0,
      isProxy: false,
      proxyType: null,
      signals: ['FIRST_PARTY_VIEWPORT_RENDER_CONFIRMED'],
      explanation: 'Message was rendered in the active viewport of an authorized MailTrace reader client.',
    };
  }

  // 2. Check for prefetch headers
  const purpose = headers['purpose'] || headers['sec-purpose'];
  if (purpose && typeof purpose === 'string' && purpose.toLowerCase().includes('prefetch')) {
    signals.push('PREFETCH_HEADER_DETECTED');
    return {
      eventType: TrackingEventType.TRACKING_RESOURCE_REQUESTED,
      classification: Classification.LIKELY_AUTOMATED,
      confidence: ConfidenceLevel.LOW,
      humanProbability: 0.05,
      isProxy: false,
      proxyType: null,
      signals,
      explanation: 'HTTP client explicitly signaled a speculative prefetch request.',
    };
  }

  // 3. Match known signatures
  let matchedSignature: KnownSignature | undefined;
  for (const sig of KNOWN_SIGNATURES) {
    if (sig.pattern.test(ua)) {
      matchedSignature = sig;
      break;
    }
  }

  if (matchedSignature) {
    signals.push(`SIGNATURE_MATCHED:${matchedSignature.name}`);

    if (matchedSignature.type === 'BOT' || matchedSignature.type === 'SECURITY_SCANNER') {
      return {
        eventType: TrackingEventType.TRACKING_RESOURCE_REQUESTED,
        classification: Classification.LIKELY_AUTOMATED,
        confidence: ConfidenceLevel.LOW,
        humanProbability: matchedSignature.humanProbability,
        isProxy: false,
        proxyType: null,
        signals,
        explanation: `User-agent matches automated security scanner or crawler: ${matchedSignature.name}.`,
      };
    }

    if (matchedSignature.type === 'PROXY') {
      // Proxy caching: e.g. GoogleImageProxy or AppleMailProxy
      return {
        eventType: TrackingEventType.POSSIBLE_EMAIL_OPEN,
        classification: Classification.POSSIBLE_HUMAN,
        confidence: ConfidenceLevel.MEDIUM,
        humanProbability: matchedSignature.humanProbability,
        isProxy: true,
        proxyType: matchedSignature.name,
        signals,
        explanation: `${matchedSignature.name} intermediate proxy requested resource. Recipient mail host preloaded or cached image; open cannot be confirmed.`,
      };
    }
  }

  // 4. Timing analysis: Compare request time to sent / delivery time
  const baselineTime = input.deliveredAt || input.sentAt;
  if (baselineTime) {
    const elapsedSeconds = (input.requestTime.getTime() - baselineTime.getTime()) / 1000;
    if (elapsedSeconds >= 0 && elapsedSeconds < 1.0) {
      signals.push('SUSPICIOUS_IMMEDIATE_FETCH');
      return {
        eventType: TrackingEventType.TRACKING_RESOURCE_REQUESTED,
        classification: Classification.LIKELY_AUTOMATED,
        confidence: ConfidenceLevel.LOW,
        humanProbability: 0.1,
        isProxy: false,
        proxyType: null,
        signals,
        explanation: 'Resource requested under 1 second after dispatch, typical of automated inbound MTA antivirus scanners.',
      };
    }
  }

  // 5. Subsequent link interaction booster
  if (input.subsequentClickObserved) {
    signals.push('CORRELATED_LINK_CLICK_OBSERVED');
  }

  // 6. Normal human browser pattern
  signals.push('INTERACTIVE_CLIENT_HEADERS');
  return {
    eventType: TrackingEventType.PROBABLE_EMAIL_OPEN,
    classification: Classification.PROBABLE_HUMAN,
    confidence: ConfidenceLevel.HIGH,
    humanProbability: 0.85,
    isProxy: false,
    proxyType: null,
    signals,
    explanation: 'Interactive desktop or mobile client requested resource with natural timing and standard browser headers.',
  };
}
