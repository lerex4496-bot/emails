import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { MessageStatus, TrackingEventType, ConfidenceLevel } from '@mailtrace/shared';
import type { FastifyInstance } from 'fastify';

/**
 * Tests for the status derivation in GET /api/v1/extension/tracking-status.
 *
 * This endpoint decides the Gmail badge, and it had no coverage. The behaviour it locks
 * down: "delivered" requires recipient-side evidence or an unbounced grace period, never
 * merely "a tracking event exists" -- which previously made the sender's own compose-time
 * pixel fetch report as "Delivered to recipient inbox" within a second of every send.
 */

const MINUTE = 60 * 1000;
let messages: any[] = [];

vi.mock('@mailtrace/database', () => ({
  Prisma: { InputJsonValue: {} },
  getPrismaClient: () => ({
    message: { findMany: vi.fn(async () => messages) },
    trackedLink: { findUnique: vi.fn(async () => null) },
    $queryRaw: vi.fn(async () => [{ 1: 1 }]),
  }),
  decryptCredentials: vi.fn(),
}));

const { buildApp } = await import('../app.js');

/** Minutes before now. */
function ago(minutes: number): Date {
  return new Date(Date.now() - minutes * MINUTE);
}

function makeMessage(overrides: Partial<any> = {}): any {
  return {
    id: 'msg-1',
    subject: 'Test',
    status: MessageStatus.SENT,
    sentAt: ago(10),
    createdAt: ago(10),
    recipients: [{ recipient: { email: 'r@example.com' }, openTrackingToken: 'tok', openedAt: null }],
    trackedLinks: [],
    trackingEvents: [],
    replyEvents: [],
    deliveryEvents: [],
    ...overrides,
  };
}

function trackingEvent(overrides: Partial<any> = {}): any {
  return {
    type: TrackingEventType.TRACKING_RESOURCE_REQUESTED,
    confidence: ConfidenceLevel.LOW,
    isProxy: false,
    timestamp: ago(5),
    ...overrides,
  };
}

let app: FastifyInstance;

async function statusOf(message: any) {
  messages = [message];
  const res = await app.inject({ method: 'GET', url: '/api/v1/extension/tracking-status' });
  return JSON.parse(res.payload).statuses[0];
}

describe('tracking-status delivery derivation', () => {
  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not report delivered from an unproxied tracking event inside the grace period', async () => {
    // The regression this guards: the sender's own compose-time fetch used to satisfy
    // "m.trackingEvents.length > 0" and report delivery on every send.
    const s = await statusOf(
      makeMessage({
        sentAt: ago(1),
        createdAt: ago(1),
        trackingEvents: [trackingEvent({ isProxy: false, timestamp: ago(1) })],
      })
    );
    expect(s.status).toBe('SENT');
  });

  it('reports delivered on a proxy-signed fetch, even inside the grace period', async () => {
    const s = await statusOf(
      makeMessage({
        sentAt: ago(1),
        createdAt: ago(1),
        trackingEvents: [trackingEvent({ isProxy: true, timestamp: ago(1) })],
      })
    );
    expect(s.status).toBe('DELIVERED');
    expect(s.confidence).toBe('MEDIUM');
    expect(s.eventLabel).toBe('Delivered to recipient inbox');
  });

  it('infers delivery once the bounce grace period passes with no bounce', async () => {
    const s = await statusOf(makeMessage({ sentAt: ago(10), createdAt: ago(10) }));
    expect(s.status).toBe('DELIVERED');
    // Lower confidence and a label that says what it rests on: this is an inference.
    expect(s.confidence).toBe('LOW');
    expect(s.eventLabel).toBe('Delivered • no bounce received');
  });

  it('still reports sent inside the grace period with no evidence at all', async () => {
    const s = await statusOf(makeMessage({ sentAt: ago(1), createdAt: ago(1) }));
    expect(s.status).toBe('SENT');
  });

  it('reports bounced, and a bounce overrides the grace-period inference', async () => {
    const s = await statusOf(
      makeMessage({
        sentAt: ago(10),
        createdAt: ago(10),
        status: MessageStatus.BOUNCED,
        deliveryEvents: [{ status: MessageStatus.BOUNCED, reason: 'User unknown', timestamp: ago(9) }],
      })
    );
    expect(s.status).toBe('BOUNCED');
    expect(s.confidence).toBe('CONFIRMED');
  });

  it('never reports delivered for a bounced message, even with a proxy fetch', async () => {
    // A scanner can fetch a pixel from a message that later hard-bounces.
    const s = await statusOf(
      makeMessage({
        sentAt: ago(10),
        createdAt: ago(10),
        status: MessageStatus.BOUNCED,
        trackingEvents: [trackingEvent({ isProxy: true })],
      })
    );
    expect(s.status).toBe('BOUNCED');
  });

  it('reports opened from the latched column even when no open event is in the window', async () => {
    const s = await statusOf(
      makeMessage({
        recipients: [
          { recipient: { email: 'r@example.com' }, openTrackingToken: 'tok', openedAt: ago(2) },
        ],
        // Ten later non-open rows, which is what used to evict the open and revert the badge.
        trackingEvents: Array.from({ length: 10 }, () => trackingEvent({ isProxy: true })),
      })
    );
    expect(s.status).toBe('OPENED');
  });

  it('does not report opened from a resource request alone', async () => {
    const s = await statusOf(
      makeMessage({
        trackingEvents: [
          trackingEvent({ type: TrackingEventType.TRACKING_RESOURCE_REQUESTED, isProxy: true }),
        ],
      })
    );
    expect(s.status).toBe('DELIVERED');
  });
});
