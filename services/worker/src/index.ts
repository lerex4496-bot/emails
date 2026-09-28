import 'dotenv/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { processTrackingJob } from './processor.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

const QUEUE_NAME = 'email-tracking-events';

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    logger.info({ jobId: job.id, type: job.data.type }, 'Processing tracking event job');
    await processTrackingJob(job);
  },
  {
    connection,
    concurrency: 10,
  }
);

worker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'Tracking event job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Tracking event job failed');
});

logger.info(`MailTrace Worker started, listening to queue: ${QUEUE_NAME}`);

async function shutdown() {
  logger.info('Shutting down MailTrace worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
