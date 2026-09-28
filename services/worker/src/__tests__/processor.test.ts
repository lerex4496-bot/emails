import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processTrackingJob } from '../processor.js';
import { TrackingEventType, ConfidenceLevel, Classification } from '@mailtrace/shared';
import { getPrismaClient } from '@mailtrace/database';

vi.mock('@mailtrace/database', () => {
  const mockTrackingEventCreate = vi.fn(async ({ data }) => ({
    id: 'evt-123',
    ...data,
  }));
  const mockClickEventCreate = vi.fn(async ({ data }) => ({
    id: 'click-123',
    ...data,
  }));
  const mockMessageRecipientUpdate = vi.fn(async () => ({}));
  const mockMessageUpdate = vi.fn(async () => ({}));
  const mockTrackedLinkUpdate = vi.fn(async () => ({}));

  return {
    getPrismaClient: () => ({
      messageRecipient: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.openTrackingToken === 'open-tok-google') {
            return {
              id: 'rcpt-123',
              messageId: 'msg-123',
              openResourceCount: 0,
              probableOpenCount: 0,
              message: { firstActivityAt: null },
            };
          }
          if (where.openTrackingToken === 'open-tok-human') {
            return {
              id: 'rcpt-456',
              messageId: 'msg-456',
              openResourceCount: 0,
              probableOpenCount: 0,
              message: { firstActivityAt: null },
            };
          }
          return null;
        }),
        update: mockMessageRecipientUpdate,
      },
      trackingEvent: {
        create: mockTrackingEventCreate,
        findFirst: vi.fn(async () => null),
      },
      trackedLink: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.token === 'click-tok-123') {
            return {
              id: 'link-123',
              messageId: 'msg-123',
              clickCount: 0,
              message: { recipients: [{ id: 'rcpt-123' }] },
            };
          }
          return null;
        }),
        update: mockTrackedLinkUpdate,
      },
      clickEvent: {
        create: mockClickEventCreate,
      },
      message: {
        update: mockMessageUpdate,
      },
    }),
  };
});

describe('Worker Tracking Event Processor', () => {
  const prisma = getPrismaClient();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifies GoogleImageProxy as POSSIBLE_EMAIL_OPEN with MEDIUM confidence', async () => {
    const job: any = {
      data: {
        type: 'OPEN',
        token: 'open-tok-google',
        timestamp: new Date().toISOString(),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GoogleImageProxy',
        headers: {},
      },
    };

    await processTrackingJob(job);

    expect(prisma.trackingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TrackingEventType.POSSIBLE_EMAIL_OPEN,
          confidence: ConfidenceLevel.MEDIUM,
          classification: Classification.POSSIBLE_HUMAN,
          isProxy: true,
          proxyType: 'GOOGLE_IMAGE_PROXY',
        }),
      })
    );
  });

  it('classifies normal human browser request as PROBABLE_EMAIL_OPEN with HIGH confidence', async () => {
    const job: any = {
      data: {
        type: 'OPEN',
        token: 'open-tok-human',
        timestamp: new Date().toISOString(),
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        headers: {},
      },
    };

    await processTrackingJob(job);

    expect(prisma.trackingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TrackingEventType.PROBABLE_EMAIL_OPEN,
          confidence: ConfidenceLevel.HIGH,
          classification: Classification.PROBABLE_HUMAN,
          isProxy: false,
        }),
      })
    );
  });

  it('classifies prefetch headers as LIKELY_AUTOMATED with LOW confidence', async () => {
    const job: any = {
      data: {
        type: 'OPEN',
        token: 'open-tok-human',
        timestamp: new Date().toISOString(),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        headers: { 'sec-purpose': 'prefetch' },
      },
    };

    await processTrackingJob(job);

    expect(prisma.trackingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TrackingEventType.TRACKING_RESOURCE_REQUESTED,
          confidence: ConfidenceLevel.LOW,
          classification: Classification.LIKELY_AUTOMATED,
        }),
      })
    );
  });

  it('processes click event, logs ClickEvent and increments link clicks', async () => {
    const job: any = {
      data: {
        type: 'CLICK',
        token: 'click-tok-123',
        timestamp: new Date().toISOString(),
        userAgent: 'Mozilla/5.0 Chrome',
        headers: {},
      },
    };

    await processTrackingJob(job);

    expect(prisma.trackingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TrackingEventType.LINK_CLICKED,
          confidence: ConfidenceLevel.HIGH,
          classification: Classification.PROBABLE_HUMAN,
        }),
      })
    );
    expect(prisma.clickEvent.create).toHaveBeenCalled();
  });
});
