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

    const eventTimestamp = new Date(data.timestamp || Date.now());
    const sendTime = recipient.message?.sentAt || recipient.message?.createdAt;
    let elapsedSinceSend = 999999;
    if (sendTime) {
      // Clamped at zero. An event timestamped before the send (clock skew between this
      // process and whatever produced the timestamp) used to yield a negative value, which
      // is < the buffer and so was treated as early transit -- a wrong reason to reach a
      // conservative verdict, and misleading in the stored event.
      elapsedSinceSend = Math.max(0, eventTimestamp.getTime() - new Date(sendTime).getTime());
    }

    const ua = data.userAgent || '';
    const headers = data.headers || {};
    // The default verdict is the WEAKEST one. Only positive evidence may raise it, so an
    // unrecognised User-Agent is never reported as a human open. Before this was inverted,
    // the chain below had no `else` and the initial value was PROBABLE_EMAIL_OPEN/HIGH, so
    // every unrecognised fetcher past the transit buffer surfaced as "Opened by recipient".
    let isProxy = false;
    let proxyType: string | null = null;
    let confidence = ConfidenceLevel.LOW;
    let classification = Classification.LIKELY_AUTOMATED;
    let eventType = TrackingEventType.TRACKING_RESOURCE_REQUESTED;

    // Identify the fetcher BEFORE deciding the verdict, so proxy identity survives on
    // early-transit hits -- exactly the events where knowing the fetcher matters most.
    if (ua.includes(KNOWN_PROXY_SIGNATURES.GOOGLE_IMAGE_PROXY)) {
      // Google's proxy fetches on render, and also scans around delivery. Timing, not the
      // User-Agent, is what separates those two; see the transit buffer below.
      isProxy = true;
      proxyType = 'GOOGLE_IMAGE_PROXY';
      confidence = ConfidenceLevel.HIGH;
      classification = Classification.PROBABLE_HUMAN;
      eventType = TrackingEventType.PROBABLE_EMAIL_OPEN;
    } else if (ua.includes(KNOWN_PROXY_SIGNATURES.OFFICE365_ATP)) {
      isProxy = true;
      proxyType = 'OFFICE365';
    }

    // Transit / delivery-scan buffer: a request this soon after send is the compose-time
    // self-fetch, a sender preview, or Google's delivery scan -- never a recipient open.
    const isEarlyTransit = elapsedSinceSend < 60000;
    if (isEarlyTransit) {
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

    const isCountedOpen = classification === Classification.PROBABLE_HUMAN && !isBurstDuplicate;

    // Update aggregations. openedAt latches on the first counted open and is never
    // cleared, so OPENED can be derived from a single column instead of recomputed from a
    // truncated slice of recent events.
    await prisma.messageRecipient.update({
      where: { id: recipient.id },
      data: {
        openResourceCount: { increment: 1 },
        probableOpenCount: isCountedOpen ? { increment: 1 } : undefined,
        openedAt: recipient.openedAt ?? (isCountedOpen ? eventTimestamp : undefined),
      },
    });

    // Delivery requires RECIPIENT-SIDE evidence. A bare pixel request is not enough: the
    // sender's own browser can produce one (compose insertion, draft restore), and a
    // self-view must not report "delivered to recipient inbox".
    //
    // A proxy signature is what makes a fetch recipient-side: Google only scans and
    // proxies images for a message its servers accepted and stored in a mailbox. A direct,
    // unproxied fetch carries no such signature and no longer advances status.
    //
    // This is still not airtight -- the sender viewing their OWN sent mail is proxied too,
    // and is indistinguishable at this layer. That residual case is addressed by turning
    // off remote-image loading on the sender's account (see docs) rather than here.
    const hasRecipientSideEvidence = isProxy || isCountedOpen;
    const advanceToDelivered =
      hasRecipientSideEvidence &&
      (recipient.message.status === MessageStatus.SENT ||
        recipient.message.status === MessageStatus.PENDING);

    await prisma.message.update({
      where: { id: recipient.messageId },
      data: {
        status: advanceToDelivered ? MessageStatus.DELIVERED : undefined,
        deliveredAt: advanceToDelivered
          ? recipient.message.deliveredAt ?? eventTimestamp
          : undefined,
        firstActivityAt: recipient.message.firstActivityAt || eventTimestamp,
        lastActivityAt: eventTimestamp,
      },
    });
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

  // Direct processing fallback (standalone / zero-Redis mode).
  // This is the ONLY classification path in the deployed configuration (REDIS_URL=none),
  // so failures here are silent data loss. Always log: a swallowed TypeError in the
  // classifier is indistinguishable from "suppression working as intended".
  try {
    await processTrackingPayload(payload);
  } catch (err) {
    console.error('[Tracking Direct Fallback Error]:', err);
  }
}
