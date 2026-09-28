import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';

import { trackingRoutes } from './routes/tracking.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { messageRoutes } from './routes/messages.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { eventRoutes } from './routes/events.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';

export interface AppOptions {
  logger?: boolean | object;
}

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: opts.logger ?? {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
  });

  // Security plugins
  await app.register(helmet, {
    crossOriginResourcePolicy: false, // Allows cross-origin pixel fetching in email clients
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(cookie);

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'mailtrace-dev-jwt-secret-key-at-least-32-chars',
  });

  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
  });

  // Register route groups
  await app.register(healthRoutes);
  await app.register(trackingRoutes);
  await app.register(authRoutes);
  await app.register(messageRoutes);
  await app.register(dashboardRoutes);
  await app.register(eventRoutes);
  await app.register(settingsRoutes);

  return app;
}
