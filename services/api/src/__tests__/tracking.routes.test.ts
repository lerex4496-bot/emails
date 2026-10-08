import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

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

describe('Tracking & Health Endpoints', () => {
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
    expect(typeof json.uptime).toBe('number');
  });

  it('GET /ready returns readiness checks for database and redis', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.status).toBe('ready');
    expect(json.checks).toBeDefined();
    expect(json.checks.database).toBe('healthy');
  });

  it('GET /metrics returns system memory and platform telemetry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(typeof json.processMemoryMb).toBe('number');
    expect(json.nodeVersion).toBeDefined();
    expect(json.platform).toBeDefined();
  });

  it('GET /t/open/:token returns 200 OK, 68-byte 1x1 image/png and strict no-cache headers', async () => {
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
    expect(res.headers['cache-control']).toContain('must-revalidate');
    expect(res.headers['expires']).toBe('0');
    // Vary: * forbids a conforming cache from reusing a stored response (RFC 9111 4.1).
    expect(res.headers['vary']).toBe('*');
    // 68-byte transparent PNG
    expect(res.rawPayload.length).toBe(68);
  });

  it('GET /t/open/:token sends no validators, so no conditional request can bypass counting', async () => {
    // Not because a 304 would skip counting -- it would still reach the handler. Because
    // RFC 9111 4.3.2 lets a cache generate a 200 from its stored body on the strength of a
    // 304, which is exactly the reuse these headers exist to prevent. Frameworks also add
    // ETags unprompted, so this guards against a static-file middleware creeping in.
    const res = await app.inject({
      method: 'GET',
      url: '/t/open/sample-open-token-xyz',
    });

    expect(res.headers['etag']).toBeUndefined();
    expect(res.headers['last-modified']).toBeUndefined();
  });

  it('GET /t/click/:token with registered token redirects 302 strictly to original URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/t/click/valid-click-token-123',
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://example.com/target-page');
  });

  it('GET /t/click/:token redirect is uncacheable, so repeat clicks are still recorded', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/t/click/valid-click-token-123',
    });

    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['vary']).toBe('*');
  });

  it('GET /t/click/:token with unregistered token returns 404 (open redirect prevented)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/t/click/malicious-or-unknown-token',
    });

    expect(res.statusCode).toBe(404);
    const json = JSON.parse(res.payload);
    expect(json.error).toBe('Not Found');
  });
});
