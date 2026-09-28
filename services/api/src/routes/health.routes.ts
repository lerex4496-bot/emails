import { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '@mailtrace/database';
import { getRedisClient } from '../queue.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = getPrismaClient();

  fastify.get('/health', async () => {
    return {
      status: 'ok',
      service: 'mailtrace-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/ready', async (_, reply) => {
    let dbStatus = 'healthy';
    let redisStatus = 'healthy';

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'degraded';
    }

    const redis = getRedisClient();
    if (redis) {
      try {
        if (redis.status === 'wait') {
          await redis.connect();
        }
        await redis.ping();
      } catch {
        redisStatus = 'degraded';
      }
    } else {
      redisStatus = 'standalone';
    }

    const isHealthy = dbStatus === 'healthy';
    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'ready' : 'degraded',
      checks: {
        database: dbStatus,
        redis: redisStatus,
      },
    });
  });

  fastify.get('/metrics', async () => {
    return {
      processMemoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      nodeVersion: process.version,
      platform: process.platform,
    };
  });
};
