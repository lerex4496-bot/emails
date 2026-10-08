import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TrackingEventType,
  ConfidenceLevel,
  Classification,
  MessageStatus,
} from '@mailtrace/shared';

/**
 * Tests for the open-event classifier in services/api/src/queue.ts.
 *
 * This is the only classifier that runs in the deployed configuration (render.yaml sets
 * REDIS_URL=none, so dispatchTrackingJob falls through to processTrackingPayload directly),
 * and it had no test coverage at all.
 *
 * The invariant these lock down: the default verdict is the WEAKEST one. Only a positive
 * signature may raise an event to a human open. Previously the verdict was initialised to
 * PROBABLE_EMAIL_OPEN/HIGH and the signature chain had no `else`, so any unrecognised
 * User-Agent past the transit buffer was reported as "Opened by recipient".
 */

const SENT_AT = new Date('2026-10-08T12:00:00.000Z');

const createdEvents: any[] = [];
const recipientUpdates: any[] = [];
const messageUpdates: any[] = [];
let burstPredecessor: any = null;
/** Pre-existing latch on the recipient row, to test that it is never overwritten. */
let existingOpenedAt: Date | null = null;
let messageStatus: MessageStatus = MessageStatus.SENT;

vi.mock('@mailtrace/database', () => ({
  Prisma: { InputJsonValue: {} },
  getPrismaClient: () => ({
    messageRecipient: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.openTrackingToken !== 'tok-known') return null;
        return {
          id: 'mr-1',
          messageId: 'msg-1',
          openTrackingToken: 'tok-known',
          openedAt: existingOpenedAt,
          message: {
            id: 'msg-1',
            status: messageStatus,
            sentAt: SENT_AT,
            createdAt: SENT_AT,
            deliveredAt: null,
            firstActivityAt: null,
          },
        };
      }),
      update: vi.fn(async (args: any) => {
        recipientUpdates.push(args);
        return {};
      }),
    },
    trackingEvent: {
      findFirst: vi.fn(async () => burstPredecessor),
      create: vi.fn(async (args: any) => {
        createdEvents.push(args.data);
        return args.data;
      }),
    },
    message: {
      update: vi.fn(async (args: any) => {
        messageUpdates.push(args);
        return {};
      }),
    },
  }),
  decryptCredentials: vi.fn(),
}));

const { processTrackingPayload } = await import('../queue.js');

/** Seconds after the recorded send time. */
function at(seconds: number): string {
  return new Date(SENT_AT.getTime() + seconds * 1000).toISOString();
}

async function classify(userAgent: string, seconds: number, headers?: Record<string, any>) {
  createdEvents.length = 0;
  recipientUpdates.length = 0;
  messageUpdates.length = 0;
  await processTrackingPayload({
    type: 'OPEN',
    token: 'tok-known',
    timestamp: at(seconds),
    userAgent,
    headers: headers ?? { 'user-agent': userAgent },
  } as any);
  return createdEvents[0];
}

const GOOGLE_PROXY_UA =
  'Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)';

// A real Apple Mail Privacy Protection fetch presents an ordinary Apple UA. It carries no
// 'AppleMailProxy' token -- that signature never matched anything, which is why it is gone.
const APPLE_MPP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('open classifier: default verdict is the weakest', () => {
  beforeEach(() => {
    burstPredecessor = null;
  });

  it('does not count an unrecognised User-Agent as an open, at any elapsed time', async () => {
    for (const seconds of [90, 600, 86_400]) {
      const ev = await classify('curl/8.4.0', seconds);
      expect(ev.type, `elapsed ${seconds}s`).toBe(TrackingEventType.TRACKING_RESOURCE_REQUESTED);
      expect(ev.classification).toBe(Classification.LIKELY_AUTOMATED);
      expect(ev.confidence).toBe(ConfidenceLevel.LOW);
    }
  });

  it('does not count an Apple MPP fetch as a human open', async () => {
    const ev = await classify(APPLE_MPP_UA, 300);
    expect(ev.type).toBe(TrackingEventType.TRACKING_RESOURCE_REQUESTED);
    expect(ev.classification).toBe(Classification.LIKELY_AUTOMATED);
  });

  it('does not count an empty User-Agent as an open', async () => {
    const ev = await classify('', 300);
    expect(ev.type).toBe(TrackingEventType.TRACKING_RESOURCE_REQUESTED);
    expect(ev.userAgent).toBeNull();
  });

  it('still reports a Google Image Proxy fetch past the transit buffer as a probable open', async () => {
    const ev = await classify(GOOGLE_PROXY_UA, 300);
    expect(ev.type).toBe(TrackingEventType.PROBABLE_EMAIL_OPEN);
    expect(ev.classification).toBe(Classification.PROBABLE_HUMAN);
    expect(ev.confidence).toBe(ConfidenceLevel.HIGH);
    expect(ev.isProxy).toBe(true);
    expect(ev.proxyType).toBe('GOOGLE_IMAGE_PROXY');
  });

  it('classifies an Office 365 scanner fetch as automated, not an open', async () => {
    const ev = await classify('Mozilla/5.0 Microsoft Office Outlook 16.0', 300);
    expect(ev.type).toBe(TrackingEventType.TRACKING_RESOURCE_REQUESTED);
    expect(ev.isProxy).toBe(true);
    expect(ev.proxyType).toBe('OFFICE365');
  });

  it('downgrades a prefetch-header request even when the UA looks human', async () => {
    const ev = await classify('Mozilla/5.0 Chrome/140.0.0.0', 300, {
      'user-agent': 'Mozilla/5.0 Chrome/140.0.0.0',
      'sec-purpose': 'prefetch;anonymous-client-ip',
    });
    expect(ev.type).toBe(TrackingEventType.TRACKING_RESOURCE_REQUESTED);
    expect(ev.classification).toBe(Classification.LIKELY_AUTOMATED);
  });
});

describe('open classifier: transit buffer and proxy identity', () => {
  beforeEach(() => {
    burstPredecessor = null;
  });

  it('treats a Google proxy fetch inside the transit buffer as a resource request', async () => {
    const ev = await classify(GOOGLE_PROXY_UA, 8);
    expect(ev.type).toBe(TrackingEventType.TRACKING_RESOURCE_REQUESTED);
    expect(ev.classification).toBe(Classification.LIKELY_AUTOMATED);
  });

  it('preserves proxy identity on an early-transit hit', async () => {
    // Regression: the buffer check used to be an `if` with the signature checks as
    // `else if`, so isProxy/proxyType were destroyed on exactly these events.
    const ev = await classify(GOOGLE_PROXY_UA, 8);
    expect(ev.isProxy).toBe(true);
    expect(ev.proxyType).toBe('GOOGLE_IMAGE_PROXY');
  });

  it('does not increment probableOpenCount for a non-open event', async () => {
    await classify('curl/8.4.0', 300);
    expect(recipientUpdates[0].data.probableOpenCount).toBeUndefined();
    expect(recipientUpdates[0].data.openResourceCount).toEqual({ increment: 1 });
  });

  it('increments probableOpenCount for a counted open', async () => {
    await classify(GOOGLE_PROXY_UA, 300);
    expect(recipientUpdates[0].data.probableOpenCount).toEqual({ increment: 1 });
  });

  it('does not increment probableOpenCount for a burst duplicate', async () => {
    burstPredecessor = { id: 'prior-event' };
    await classify(GOOGLE_PROXY_UA, 300);
    expect(recipientUpdates[0].data.probableOpenCount).toBeUndefined();
  });

  it('ignores an unknown token without writing anything', async () => {
    createdEvents.length = 0;
    await processTrackingPayload({
      type: 'OPEN',
      token: 'tok-unknown',
      timestamp: at(300),
      userAgent: GOOGLE_PROXY_UA,
    } as any);
    expect(createdEvents).toHaveLength(0);
  });

  it('clamps a clock-skewed timestamp from before the send', async () => {
    // Previously a negative elapsed value compared as < the buffer, so the event reached a
    // conservative verdict for the wrong reason.
    const ev = await classify(GOOGLE_PROXY_UA, -120);
    expect(ev.type).toBe(TrackingEventType.TRACKING_RESOURCE_REQUESTED);
    expect(ev.proxyType).toBe('GOOGLE_IMAGE_PROXY');
  });
});

describe('open classifier: openedAt latch', () => {
  beforeEach(() => {
    burstPredecessor = null;
    existingOpenedAt = null;
    messageStatus = MessageStatus.SENT;
  });

  it('latches openedAt on the first counted open', async () => {
    await classify(GOOGLE_PROXY_UA, 300);
    expect(recipientUpdates[0].data.openedAt).toEqual(new Date(at(300)));
  });

  it('does not latch openedAt for a non-open event', async () => {
    await classify('curl/8.4.0', 300);
    expect(recipientUpdates[0].data.openedAt).toBeUndefined();
  });

  it('does not latch openedAt for a burst duplicate', async () => {
    burstPredecessor = { id: 'prior-event' };
    await classify(GOOGLE_PROXY_UA, 300);
    expect(recipientUpdates[0].data.openedAt).toBeUndefined();
  });

  it('never overwrites an existing openedAt', async () => {
    const first = new Date(at(100));
    existingOpenedAt = first;
    await classify(GOOGLE_PROXY_UA, 900);
    expect(recipientUpdates[0].data.openedAt).toEqual(first);
  });
});

describe('open classifier: delivery requires recipient-side evidence', () => {
  beforeEach(() => {
    burstPredecessor = null;
    existingOpenedAt = null;
    messageStatus = MessageStatus.SENT;
  });

  it('does not mark a message delivered on an unproxied request', async () => {
    // The sender's own browser can produce one of these (compose insertion, draft
    // restore). A self-view must not read as "delivered to recipient inbox".
    await classify('curl/8.4.0', 300);
    expect(messageUpdates[0].data.status).toBeUndefined();
    expect(messageUpdates[0].data.deliveredAt).toBeUndefined();
    // Activity timestamps are still recorded.
    expect(messageUpdates[0].data.lastActivityAt).toEqual(new Date(at(300)));
  });

  it('marks a message delivered on a proxy fetch inside the transit buffer', async () => {
    // Google proxies images only for a message its servers accepted into a mailbox, so
    // this is genuine receipt evidence even though it is not an open.
    await classify(GOOGLE_PROXY_UA, 8);
    expect(messageUpdates[0].data.status).toBe(MessageStatus.DELIVERED);
    expect(messageUpdates[0].data.deliveredAt).toEqual(new Date(at(8)));
  });

  it('does not regress status once the message is past SENT', async () => {
    messageStatus = MessageStatus.DELIVERED;
    await classify(GOOGLE_PROXY_UA, 300);
    expect(messageUpdates[0].data.status).toBeUndefined();
  });
});
