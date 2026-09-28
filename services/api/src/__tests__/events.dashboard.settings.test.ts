import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

const VALID_MSG_ID = 'c0000000-0000-0000-0000-000000000001';
const UNKNOWN_MSG_ID = 'c0000000-0000-0000-0000-000000000002';

vi.mock('@mailtrace/database', () => {
  return {
    getPrismaClient: () => ({
      message: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.id === VALID_MSG_ID) {
            return {
              id: VALID_MSG_ID,
              recipients: [{ id: 'mr-confirm-1' }],
            };
          }
          return null;
        }),
        count: vi.fn(async () => 42),
        findMany: vi.fn(async () => []),
      },
      messageRecipient: {
        update: vi.fn(async () => ({})),
      },
      trackingEvent: {
        create: vi.fn(async ({ data }) => ({
          id: 'event-created-123',
          type: data.type,
          confidence: data.confidence,
          timestamp: data.timestamp,
        })),
        count: vi.fn(async () => 18),
        deleteMany: vi.fn(async () => ({ count: 5 })),
      },
      clickEvent: {
        count: vi.fn(async () => 7),
        deleteMany: vi.fn(async () => ({ count: 2 })),
      },
      replyEvent: {
        count: vi.fn(async () => 3),
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
      deliveryEvent: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      user: {
        findFirst: vi.fn(async () => ({
          id: 'user-primary-1',
          email: 'owner@mailtrace.io',
          privacySettings: { storeRawIp: false },
        })),
        update: vi.fn(async ({ data }) => ({
          id: 'user-primary-1',
          email: 'owner@mailtrace.io',
          privacySettings: data.privacySettings,
        })),
      },
    }),
  };
});

describe('Events, Dashboard, and Settings Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/events/confirm-view returns 400 on invalid payload (missing platform or messageId)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/confirm-view',
      payload: {
        messageId: '',
      },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.payload);
    expect(json.error).toBe('Validation Error');
  });

  it('POST /api/v1/events/confirm-view returns 404 for unknown message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/confirm-view',
      payload: {
        messageId: UNKNOWN_MSG_ID,
        deviceIdentifier: 'win32-pc-1',
        platform: 'WINDOWS',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/events/confirm-view records first-party observation with CONFIRMED confidence', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/confirm-view',
      payload: {
        messageId: VALID_MSG_ID,
        deviceIdentifier: 'win32-pc-1',
        platform: 'WINDOWS',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.event.confidence).toBe('CONFIRMED');
    expect(json.event.type).toBe('CONFIRMED_EMAIL_VIEW');
  });

  it('GET /api/v1/dashboard/metrics returns 200 with aggregated telemetry metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/metrics',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.metrics).toBeDefined();
    expect(json.metrics.messagesSent).toBe(42);
    expect(json.metrics.uniqueClicks).toBe(7);
    expect(json.metrics.replies).toBe(3);
  });

  it('PUT /api/v1/settings/privacy updates privacy configuration and returns 200', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/privacy',
      payload: {
        storeRawIp: false,
        retainCoarseGeo: true,
        eventRetentionDays: 60,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.settings.eventRetentionDays).toBe(60);
  });

  it('POST /api/v1/settings/data/export returns 200 and triggers attachment JSON download', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/data/export',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toContain('mailtrace-export.json');
    const json = JSON.parse(res.payload);
    expect(json.version).toBe('1.0.0');
    expect(Array.isArray(json.messages)).toBe(true);
  });

  it('DELETE /api/v1/settings/data/history purges historical telemetry events and returns 200', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/settings/data/history',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.success).toBe(true);
    expect(json.message).toContain('permanently erased');
  });
});
