import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@mailtrace/database';

vi.mock('@mailtrace/database', () => {
  const mockTrackedLink = {
    id: 'link-123',
    token: 'valid-click-token-123',
    originalUrl: 'https://example.com/target-page',
    messageId: 'msg-123',
  };

  return {
    getPrismaClient: () => ({
      trackedLink: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.token === 'valid-click-token-123') {
            return mockTrackedLink;
          }
          return null;
        }),
      },
      message: {
        findUnique: vi.fn(async () => null),
      },
      $queryRaw: vi.fn(async () => [{ 1: 1 }]),
    }),
    decryptCredentials: vi.fn(),
  };
});

describe('Fastify Tracking & Health Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 OK and service metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.status).toBe('ok');
    expect(json.service).toBe('mailtrace-api');
  });

  it('GET /t/open/:token returns 200 OK, 1x1 image/png and strict no-cache headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/t/open/sample-open-token-xyz',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['cache-control']).toContain('no-cache');
    expect(res.headers['expires']).toBe('0');
    // Transparent PNG byte size
    expect(res.rawPayload.length).toBe(68);
  });

  it('GET /t/click/:token with registered token redirects 302 to original URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/t/click/valid-click-token-123',
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://example.com/target-page');
  });

  it('GET /t/click/:token with unregistered token returns 404 (open redirect prevented)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/t/click/malicious-or-unknown-token',
    });

    expect(res.statusCode).toBe(404);
  });
});
