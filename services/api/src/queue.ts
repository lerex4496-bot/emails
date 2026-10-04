import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { getPrismaClient, Prisma } from '@mailtrace/database';
import {
  TrackingEventType,
  ConfidenceLevel,
  Classification,
  KNOWN_PROXY_SIGNATURES,
  MessageStatus,
} from '@mailtrace/shared';

let trackingQueue: Queue | null = null;
let redisClient: Redis | null = null;

export const TRACKING_QUEUE_NAME = 'email-tracking-events';

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL;
  // If Redis is not configured or explicitly disabled, run in standalone mode
  if (!redisUrl || redisUrl === 'none' || redisUrl === 'disabled') {
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 100, 2000);
      },
    });
    redisClient.on('error', () => {
      // Quiet redis error in standalone or test mode
    });
    return redisClient;
  } catch {
    return null;
  }
}

export function getTrackingQueue(): Queue | null {
  if (trackingQueue) return trackingQueue;

  const client = getRedisClient();
  if (!client) return null;

  try {
    trackingQueue = new Queue(TRACKING_QUEUE_NAME, {
      connection: client,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
    return trackingQueue;
  } catch {
    return null;
  }
}

export interface TrackingJobPayload {
  type: 'OPEN' | 'CLICK' | 'CONFIRM_VIEW';
  token?: string;
  messageId?: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  headers: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Direct processing fallback for standalone mode (e.g. Render free tier without Redis)
 * or when Redis queue is temporarily unreachable.
 */
export async function processTrackingPayload(data: TrackingJobPayload): Promise<void> {
  const prisma = getPrismaClient();

  if (data.type === 'OPEN' && data.token) {
    const recipient = await prisma.messageRecipient.findUnique({
      where: { openTrackingToken: data.token },
      include: {
        message: true,
      },
    });

    if (!recipient) return;

    // Sender self-open & outbound transit filter:
    // If the tracking pixel is requested within 15 seconds of message creation/dispatch,
    // it was fetched by the sender's own compose window (when appending the <img> to DOM)
    // or by Gmail's outbound pre-send scanner. Drop it to prevent false opens!
    const eventTimestamp = new Date(data.timestamp || Date.now());
    const sendTime = recipient.message?.sentAt || recipient.message?.createdAt;
    let elapsedSinceSend = 999999;
    if (sendTime) {
      elapsedSinceSend = eventTimestamp.getTime() - new Date(sendTime).getTime();
      if (elapsedSinceSend < 15000) {
        return;
      }
    }

    const ua = data.userAgent || '';
    const headers = data.headers || {};
    let isProxy = false;
    let proxyType: string | null = null;
    let confidence = ConfidenceLevel.HIGH;
    let classification = Classification.PROBABLE_HUMAN;
    let eventType = TrackingEventType.PROBABLE_EMAIL_OPEN;

    // Detect known proxy signatures
    if (ua.includes(KNOWN_PROXY_SIGNATURES.GOOGLE_IMAGE_PROXY)) {
      isProxy = true;
      proxyType = 'GOOGLE_IMAGE_PROXY';
      confidence = ConfidenceLevel.MEDIUM;
      classification = Classification.POSSIBLE_HUMAN;
      eventType = TrackingEventType.POSSIBLE_EMAIL_OPEN;
    } else if (ua.includes(KNOWN_PROXY_SIGNATURES.APPLE_MPP)) {
      isProxy = true;
      proxyType = 'APPLE_MPP';
      confidence = ConfidenceLevel.MEDIUM;
      classification = Classification.POSSIBLE_HUMAN;
      eventType = TrackingEventType.POSSIBLE_EMAIL_OPEN;
    } else if (ua.includes(KNOWN_PROXY_SIGNATURES.OFFICE365_ATP)) {
      isProxy = true;
      proxyType = 'OFFICE365';
      confidence = ConfidenceLevel.LOW;
      classification = Classification.LIKELY_AUTOMATED;
      eventType = TrackingEventType.TRACKING_RESOURCE_REQUESTED;
    }

    // Detect prefetching headers
    const purpose = headers['purpose'] || headers['sec-purpose'];
    if (purpose && typeof purpose === 'string' && purpose.toLowerCase().includes('prefetch')) {
      confidence = ConfidenceLevel.LOW;
      classification = Classification.LIKELY_AUTOMATED;
      eventType = TrackingEventType.TRACKING_RESOURCE_REQUESTED;
    }

    // Burst deduplication: Check if an event for this recipient occurred within 3 seconds
    const threeSecondsAgo = new Date(eventTimestamp.getTime() - 3000);
    const existingRecentEvent = await prisma.trackingEvent.findFirst({
      where: {
        messageRecipientId: recipient.id,
        timestamp: { gte: threeSecondsAgo, lte: eventTimestamp },
      },
    });
    const isBurstDuplicate = !!existingRecentEvent;

    // Store raw immutable event
    await prisma.trackingEvent.create({
      data: {
        messageId: recipient.messageId,
        messageRecipientId: recipient.id,
        type: eventType,
        confidence,
        classification,
        source: 'http_get',
        userAgent: ua || null,
        isProxy,
        proxyType,
        isBurstDuplicate,
        rawHeaders: headers as Prisma.InputJsonValue,
        timestamp: eventTimestamp,
      },
    });

    // Update aggregations
    await prisma.messageRecipient.update({
      where: { id: recipient.id },
      data: {
        openResourceCount: { increment: 1 },
        probableOpenCount:
          classification === Classification.PROBABLE_HUMAN && !isBurstDuplicate
            ? { increment: 1 }
            : undefined,
      },
    });

    // Update message status and timestamps
    if (recipient.message.status === MessageStatus.SENT || recipient.message.status === MessageStatus.PENDING) {
      await prisma.message.update({
        where: { id: recipient.messageId },
        data: {
          status: MessageStatus.DELIVERED,
          firstActivityAt: recipient.message.firstActivityAt || eventTimestamp,
          lastActivityAt: eventTimestamp,
        },
      });
    } else {
      await prisma.message.update({
        where: { id: recipient.messageId },
        data: {
          firstActivityAt: recipient.message.firstActivityAt || eventTimestamp,
          lastActivityAt: eventTimestamp,
        },
      });
    }
  } else if (data.type === 'CLICK' && data.token) {
    const trackedLink = await prisma.trackedLink.findUnique({
      where: { token: data.token },
      include: {
        message: {
          include: { recipients: true },
        },
      },
    });

    if (!trackedLink) return;

    const eventTimestamp = new Date(data.timestamp || Date.now());
    const primaryRecipient = trackedLink.message.recipients[0];

    // Create tracking event for link click
    const trackingEvent = await prisma.trackingEvent.create({
      data: {
        messageId: trackedLink.messageId,
        messageRecipientId: primaryRecipient?.id || null,
        type: TrackingEventType.LINK_CLICKED,
        confidence: ConfidenceLevel.HIGH,
        classification: Classification.PROBABLE_HUMAN,
        source: 'http_click_redirect',
        userAgent: data.userAgent || null,
        timestamp: eventTimestamp,
      },
    });

    // Create specific click event
    await prisma.clickEvent.create({
      data: {
        trackingEventId: trackingEvent.id,
        trackedLinkId: trackedLink.id,
        isUnique: trackedLink.clickCount === 0,
        timestamp: eventTimestamp,
      },
    });

    // Increment click counts
    await prisma.trackedLink.update({
      where: { id: trackedLink.id },
      data: {
        clickCount: { increment: 1 },
        uniqueClicks: trackedLink.clickCount === 0 ? { increment: 1 } : undefined,
      },
    });

    if (primaryRecipient) {
      await prisma.messageRecipient.update({
        where: { id: primaryRecipient.id },
        data: {
          totalClicks: { increment: 1 },
          uniqueClicks: trackedLink.clickCount === 0 ? { increment: 1 } : undefined,
        },
      });
    }

    await prisma.message.update({
      where: { id: trackedLink.messageId },
      data: {
        lastActivityAt: eventTimestamp,
      },
    });
  }
}

export async function dispatchTrackingJob(payload: TrackingJobPayload): Promise<void> {
  const queue = getTrackingQueue();
  if (queue) {
    try {
      await queue.add(payload.type, payload);
      return;
    } catch {
      // If redis is down, fallback to direct processing
    }
  }

  // Direct processing fallback (standalone / zero-Redis mode)
  try {
    await processTrackingPayload(payload);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Tracking Direct Fallback Error]:', err);
    }
  }
}
