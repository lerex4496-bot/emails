import { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '@mailtrace/database';
import { MessageStatus, TrackingEventType, ConfidenceLevel } from '@mailtrace/shared';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = getPrismaClient();

  fastify.get('/api/v1/dashboard/metrics', async () => {
    const [
      messagesSent,
      delivered,
      bounces,
      trackingEventsCount,
      probableOpensCount,
      confirmedViewsCount,
      totalClicks,
      repliesCount,
    ] = await Promise.all([
      prisma.message.count({ where: { status: { not: MessageStatus.DRAFT } } }),
      prisma.message.count({ where: { status: MessageStatus.DELIVERED } }),
      prisma.message.count({ where: { status: MessageStatus.BOUNCED } }),
      prisma.trackingEvent.count({ where: { type: TrackingEventType.TRACKING_RESOURCE_REQUESTED } }),
      prisma.trackingEvent.count({ where: { type: TrackingEventType.PROBABLE_EMAIL_OPEN } }),
      prisma.trackingEvent.count({ where: { type: TrackingEventType.CONFIRMED_EMAIL_VIEW } }),
      prisma.clickEvent.count({ where: { isUnique: true } }),
      prisma.replyEvent.count(),
    ]);

    return {
      metrics: {
        messagesSent,
        delivered,
        trackingEvents: trackingEventsCount,
        probableOpens: probableOpensCount,
        confirmedViews: confirmedViewsCount,
        uniqueClicks: totalClicks,
        replies: repliesCount,
        bounces,
      },
    };
  });
};
