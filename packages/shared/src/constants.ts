export enum AccountProvider {
  GMAIL = 'GMAIL',
  MICROSOFT = 'MICROSOFT',
  SMTP = 'SMTP',
}

export enum MessageStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  SENT = 'SENT',
  PROVIDER_ACCEPTED = 'PROVIDER_ACCEPTED',
  DELIVERED = 'DELIVERED',
  BOUNCED = 'BOUNCED',
  FAILED = 'FAILED',
}

export enum TokenType {
  OPEN_TRACKING = 'OPEN_TRACKING',
  LINK_TRACKING = 'LINK_TRACKING',
  REPLY_ALIAS = 'REPLY_ALIAS',
}

export enum TrackingEventType {
  TRACKING_RESOURCE_REQUESTED = 'TRACKING_RESOURCE_REQUESTED',
  POSSIBLE_EMAIL_OPEN = 'POSSIBLE_EMAIL_OPEN',
  PROBABLE_EMAIL_OPEN = 'PROBABLE_EMAIL_OPEN',
  CONFIRMED_EMAIL_VIEW = 'CONFIRMED_EMAIL_VIEW',
  LINK_CLICKED = 'LINK_CLICKED',
  REPLY_RECEIVED = 'REPLY_RECEIVED',
  DELIVERY_STATUS_UPDATED = 'DELIVERY_STATUS_UPDATED',
}

export enum ConfidenceLevel {
  LOW = 'LOW', // e.g. Single automated scanner request
  MEDIUM = 'MEDIUM', // e.g. Proxy fetch (Google Image Proxy, Apple MPP)
  HIGH = 'HIGH', // e.g. Probable interactive human open
  CONFIRMED = 'CONFIRMED', // e.g. First-party native reader direct report
}

export enum Classification {
  UNDETERMINED = 'UNDETERMINED',
  LIKELY_AUTOMATED = 'LIKELY_AUTOMATED',
  POSSIBLE_HUMAN = 'POSSIBLE_HUMAN',
  PROBABLE_HUMAN = 'PROBABLE_HUMAN',
  CONFIRMED_FIRST_PARTY = 'CONFIRMED_FIRST_PARTY',
}

/**
 * User-Agent substrings that positively identify a non-human fetcher.
 *
 * Only signatures that real clients actually emit belong here. A signature that never
 * matches is worse than no signature at all: it implies coverage that does not exist,
 * and the traffic it was meant to catch falls through to the default verdict instead.
 *
 * Deliberately absent:
 * - Apple Mail Privacy Protection. Its relay presents an ordinary Apple Mail User-Agent
 *   and is only identifiable by Apple's IP ranges, so there is no substring to match.
 *   The previous 'AppleMailProxy' entry matched nothing real -- the test that covered it
 *   fabricated a UA by appending the literal to a stock Safari string. MPP traffic now
 *   lands on the default (weakest) verdict, which is the correct fail-closed outcome.
 * - Yahoo. The previous 'YahooMailProxy' entry was never referenced by any classifier.
 */
export const KNOWN_PROXY_SIGNATURES = {
  GOOGLE_IMAGE_PROXY: 'GoogleImageProxy',
  OFFICE365_ATP: 'Microsoft Office',
} as const;
