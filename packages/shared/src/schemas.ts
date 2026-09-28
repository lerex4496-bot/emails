import { z } from 'zod';
import { AccountProvider, ConfidenceLevel, Classification, TrackingEventType } from './constants.js';

export const privacySettingsSchema = z.object({
  storeRawIp: z.boolean().default(false),
  retainCoarseGeo: z.boolean().default(true),
  eventRetentionDays: z.number().int().positive().default(90),
});

export const recipientInputSchema = z.object({
  email: z.string().email('Invalid recipient email address'),
  name: z.string().optional(),
  company: z.string().optional(),
});

export const sendMessageSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  to: z.array(recipientInputSchema).min(1, 'At least one recipient is required'),
  subject: z.string().min(1, 'Subject is required'),
  bodyHtml: z.string().min(1, 'HTML body is required'),
  bodyText: z.string().optional(),
  enableClickTracking: z.boolean().default(true),
  enableOpenTracking: z.boolean().default(true),
  enableReplyTracking: z.boolean().default(true),
});

export const confirmViewSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  recipientEmail: z.string().email().optional(),
  deviceIdentifier: z.string().min(1, 'Device identifier is required'),
  platform: z.enum(['WINDOWS', 'ANDROID', 'WEB', 'EXTENSION']),
  timestamp: z.string().datetime().optional(),
  signature: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).optional(),
});
