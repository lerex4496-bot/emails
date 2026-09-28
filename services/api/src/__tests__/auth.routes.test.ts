import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';

vi.mock('@mailtrace/database', () => {
  const users: any[] = [];

  return {
    getPrismaClient: () => ({
      user: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.email === 'alice@example.com' || where.id === 'user-alice-123') {
            return {
              id: 'user-alice-123',
              email: 'alice@example.com',
              displayName: 'Alice Sender',
              passwordHash: await bcrypt.hash('Password123!', 10),
              privacySettings: { storeRawIp: false },
              createdAt: new Date(),
            };
          }
          return users.find((u) => u.email === where.email) || null;
        }),
        create: vi.fn(async ({ data }) => {
          const newUser = {
            id: 'user-new-456',
            email: data.email,
            displayName: data.displayName,
            privacySettings: { storeRawIp: false },
            createdAt: new Date(),
          };
          users.push(newUser);
          return newUser;
        }),
      },
    }),
  };
});

describe('Authentication Endpoints (/api/v1/auth/*)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/register fails with 400 on invalid payload (invalid email or short password)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'not-an-email',
        password: 'short',
      },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.payload);
    expect(json.error).toBe('Validation Error');
  });

  it('POST /api/v1/auth/register fails with 409 if user already exists', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'alice@example.com',
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(409);
    const json = JSON.parse(res.payload);
    expect(json.error).toContain('User already exists');
  });

  it('POST /api/v1/auth/register creates user and returns 201 with JWT token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'bob.new@example.com',
        password: 'Password123!',
        displayName: 'Bob New',
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.payload);
    expect(json.user.email).toBe('bob.new@example.com');
    expect(json.token).toBeDefined();
    expect(typeof json.token).toBe('string');
  });

  it('POST /api/v1/auth/login returns 401 on wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'alice@example.com',
        password: 'IncorrectPassword!',
      },
    });

    expect(res.statusCode).toBe(401);
    const json = JSON.parse(res.payload);
    expect(json.error).toBe('Invalid email or password');
  });

  it('POST /api/v1/auth/login returns 200 and token on valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'alice@example.com',
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.token).toBeDefined();
    expect(json.user.email).toBe('alice@example.com');
  });

  it('GET /api/v1/auth/me returns 401 when no token is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/auth/me returns 200 with user profile when valid Bearer JWT is passed', async () => {
    // Generate valid token
    const token = app.jwt.sign({ userId: 'user-alice-123', email: 'alice@example.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.user).toBeDefined();
  });
});
