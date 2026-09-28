import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

const VALID_ACCOUNT_ID = 'a0000000-0000-0000-0000-000000000001';
const UNKNOWN_ACCOUNT_ID = 'a0000000-0000-0000-0000-000000000002';

const mockMessage = {
  id: 'b0000000-0000-0000-0000-000000000001',
  subject: 'Enterprise Proposal',
  status: 'SENT',
  sentAt: new Date('2026-09-28T10:00:00Z'),
  firstActivityAt: new Date('2026-09-28T10:05:00Z'),
  lastActivityAt: new Date('2026-09-28T10:10:00Z'),
  recipients: [
    {
      id: 'mr-1',
      openTrackingToken: 'tok-open-1',
      openResourceCount: 1,
      probableOpenCount: 1,
      confirmedViewCount: 0,
      totalClicks: 2,
      uniqueClicks: 1,
      replyReceived: false,
      recipient: {
        email: 'partner@example.com',
        name: 'Partner Name',
      },
    },
  ],
  trackedLinks: [
    {
      id: 'tl-1',
      token: 'link-tok-1',
      originalUrl: 'https://example.com/proposal',
      clickCount: 2,
      uniqueClicks: 1,
      _count: { clickEvents: 2 },
    },
  ],
  trackingEvents: [
    {
      id: 'te-1',
      type: 'TRACKING_RESOURCE_REQUESTED',
      confidence: 'MEDIUM',
      classification: 'POSSIBLE_HUMAN',
      timestamp: new Date('2026-09-28T10:05:00Z'),
    },
  ],
  replyEvents: [],
  deliveryEvents: [],
  _count: {
    trackingEvents: 1,
    replyEvents: 0,
  },
};

vi.mock('@mailtrace/database', () => {
  return {
    getPrismaClient: () => ({
      account: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.id === VALID_ACCOUNT_ID) {
            return {
              id: VALID_ACCOUNT_ID,
              userId: 'user-123',
              provider: 'MOCK',
              emailAddress: 'sender@mailtrace.io',
              encryptedCredentials: 'enc-creds',
            };
          }
          return null;
        }),
      },
      message: {
        findMany: vi.fn(async () => [mockMessage]),
        findUnique: vi.fn(async ({ where }) => {
          if (where.id === mockMessage.id) {
            return mockMessage;
          }
          return null;
        }),
        update: vi.fn(async () => mockMessage),
      },
      $transaction: vi.fn(async (cb) => {
        return cb({
          recipient: {
            findUnique: vi.fn(async () => null),
            create: vi.fn(async ({ data }) => ({ id: 'rec-1', ...data })),
          },
          message: {
            create: vi.fn(async ({ data }) => ({ id: 'msg-created-999', ...data })),
          },
          messageRecipient: {
            create: vi.fn(async ({ data }) => ({ id: 'mr-created-999', ...data })),
          },
          trackedLink: {
            create: vi.fn(async ({ data }) => ({ id: 'tl-created-999', ...data })),
          },
        });
      }),
    }),
    decryptCredentials: vi.fn(() => JSON.stringify({ host: 'smtp.test' })),
  };
});

describe('Message Endpoints (/api/v1/messages/*)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/messages/send returns 400 on missing or invalid payload fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      payload: {
        subject: '', // invalid empty subject
        to: [], // invalid empty recipients
      },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.payload);
    expect(json.error).toBe('Validation Error');
  });

  it('POST /api/v1/messages/send returns 404 if account does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      payload: {
        accountId: UNKNOWN_ACCOUNT_ID,
        to: [{ email: 'recipient@example.com' }],
        subject: 'Valid Subject',
        bodyHtml: '<p>Hello <a href="https://example.com">link</a></p>',
        bodyText: 'Hello https://example.com',
      },
    });

    expect(res.statusCode).toBe(404);
    const json = JSON.parse(res.payload);
    expect(json.error).toBe('Account not found');
  });

  it('POST /api/v1/messages/send creates message, tracks links, and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      payload: {
        accountId: VALID_ACCOUNT_ID,
        to: [{ email: 'partner@example.com', name: 'Partner' }],
        subject: 'Quarterly Proposal',
        bodyHtml: '<p>Please read <a href="https://example.com/proposal">the proposal</a>.</p>',
        bodyText: 'Please read the proposal: https://example.com/proposal',
        enableClickTracking: true,
        enableOpenTracking: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.messageId).toBe('msg-created-999');
  });

  it('GET /api/v1/messages returns 200 with list of messages and telemetry summaries', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/messages',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.messages).toBeDefined();
    expect(Array.isArray(json.messages)).toBe(true);
    expect(json.messages.length).toBeGreaterThan(0);
    expect(json.messages[0].subject).toBe('Enterprise Proposal');
    expect(json.messages[0].opens).toBeDefined();
    expect(json.messages[0].clicks).toBeDefined();
  });

  it('GET /api/v1/messages/:id returns 404 for unknown message ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/messages/b0000000-0000-0000-0000-000000000002',
    });

    expect(res.statusCode).toBe(404);
    const json = JSON.parse(res.payload);
    expect(json.error).toBe('Message not found');
  });

  it('GET /api/v1/messages/:id returns 200 with complete audit trail and links', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/messages/b0000000-0000-0000-0000-000000000001',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.message).toBeDefined();
    expect(json.message.id).toBe('b0000000-0000-0000-0000-000000000001');
    expect(json.message.trackingEvents).toBeDefined();
    expect(json.message.trackedLinks).toBeDefined();
  });
});
