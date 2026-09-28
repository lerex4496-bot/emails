import {
  AccountProvider,
  MessageStatus,
  TokenType,
  TrackingEventType,
  ConfidenceLevel,
  Classification,
} from './constants.js';

export interface PrivacySettings {
  storeRawIp: boolean;
  retainCoarseGeo: boolean;
  eventRetentionDays: number;
}

export interface UserDTO {
  id: string;
  email: string;
  displayName: string | null;
  privacySettings: PrivacySettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountDTO {
  id: string;
  userId: string;
  provider: AccountProvider;
  emailAddress: string;
  displayName: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipientDTO {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
}

export interface MessageRecipientDTO {
  id: string;
  messageId: string;
  recipientId: string;
  recipient: RecipientDTO;
  openTrackingToken: string;
  replyAliasToken: string | null;
  openResourceCount: number;
  probableOpenCount: number;
  confirmedViewCount: number;
  totalClicks: number;
  uniqueClicks: number;
  replyReceived: boolean;
  deliveryStatus: MessageStatus;
}

export interface TrackedLinkDTO {
  id: string;
  messageId: string;
  token: string;
  originalUrl: string;
  clickCount: number;
  uniqueClicks: number;
}

export interface TrackingEventDTO {
  id: string;
  messageId: string;
  messageRecipientId?: string | null;
  type: TrackingEventType;
  confidence: ConfidenceLevel;
  classification: Classification;
  timestamp: Date;
  source: string;
  userAgent?: string | null;
  isProxy: boolean;
  proxyType?: string | null;
  isBurstDuplicate: boolean;
  rawHeaders?: Record<string, any> | null;
  coarseLocation?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface MessageDTO {
  id: string;
  userId: string;
  accountId: string;
  subject: string;
  threadId?: string | null;
  providerMessageId?: string | null;
  internetMessageId?: string | null;
  status: MessageStatus;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  firstActivityAt?: Date | null;
  lastActivityAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  recipients?: MessageRecipientDTO[];
  trackedLinks?: TrackedLinkDTO[];
  trackingEvents?: TrackingEventDTO[];
}

export interface DashboardMetricsDTO {
  messagesSent: number;
  delivered: number;
  trackingEvents: number;
  probableOpens: number;
  confirmedViews: number;
  uniqueClicks: number;
  replies: number;
  bounces: number;
}
