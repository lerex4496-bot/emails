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

export const KNOWN_PROXY_SIGNATURES = {
  GOOGLE_IMAGE_PROXY: 'GoogleImageProxy',
  APPLE_MPP: 'AppleMailProxy',
  OFFICE365_ATP: 'Microsoft Office',
  YAHOO_CACHE: 'YahooMailProxy',
} as const;
