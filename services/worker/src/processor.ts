import { Job } from 'bullmq';
import {
  getPrismaClient,
  Prisma,
} from '@mailtrace/database';
import {
  TrackingEventType,
  ConfidenceLevel,
  Classification,
  KNOWN_PROXY_SIGNATURES,
} from '@mailtrace/shared';

export interface TrackingJobData {
  type: 'OPEN' | 'CLICK' | 'CONFIRM_VIEW';
  token?: string;
  messageId?: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  headers: Record<string, any>;
  metadata?: Record<string, any>;
}

export async function processTrackingJob(job: Job<TrackingJobData>): Promise<void> {
  const prisma = getPrismaClient();
  const data = job.data;

  if (data.type === 'OPEN' && data.token) {
    const recipient = await prisma.messageRecipient.findUnique({
      where: { openTrackingToken: data.token },
      include: {
        message: true,
      },
    });

    if (!recipient) return;

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

    const eventTimestamp = new Date(data.timestamp);

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

    // Update message last activity timestamp
    await prisma.message.update({
      where: { id: recipient.messageId },
      data: {
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

    const eventTimestamp = new Date(data.timestamp);
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
