import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

let trackingQueue: Queue | null = null;
let redisClient: Redis | null = null;

export const TRACKING_QUEUE_NAME = 'email-tracking-events';

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    });
    redisClient.on('error', () => {
      // Quiet redis error in standalone or test mode
    });
    return redisClient;
  } catch {
    return null;
  }
}

export function getTrackingQueue(): Queue | null {
  if (trackingQueue) return trackingQueue;

  const client = getRedisClient();
  if (!client) return null;

  try {
    trackingQueue = new Queue(TRACKING_QUEUE_NAME, {
      connection: client,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
    return trackingQueue;
  } catch {
    return null;
  }
}

export interface TrackingJobPayload {
  type: 'OPEN' | 'CLICK' | 'CONFIRM_VIEW';
  token?: string;
  messageId?: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  headers: Record<string, any>;
  metadata?: Record<string, any>;
}

export async function dispatchTrackingJob(payload: TrackingJobPayload): Promise<void> {
  const queue = getTrackingQueue();
  if (queue) {
    try {
      await queue.add(payload.type, payload);
      return;
    } catch {
      // If redis is down, fallback
    }
  }
  // If queue is unavailable (e.g. testing without redis), log
  if (process.env.NODE_ENV === 'development') {
    console.log(`[TrackingQueue Fallback] Dispatched ${payload.type} job directly:`, payload.token || payload.messageId);
  }
}
