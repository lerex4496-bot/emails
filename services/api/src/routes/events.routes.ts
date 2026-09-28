import { FastifyPluginAsync } from 'fastify';
import { confirmViewSchema, TrackingEventType, ConfidenceLevel, Classification } from '@mailtrace/shared';
import { getPrismaClient } from '@mailtrace/database';

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = getPrismaClient();

  /**
   * First-Party Client Confirmed View Endpoint.
   * Emitted when the MailTrace-controlled native client (Windows, Android)
   * directly observes message viewport rendering.
   * This is materially stronger evidence (Confidence: CONFIRMED, 1.0).
   */
  fastify.post('/api/v1/events/confirm-view', async (request, reply) => {
    const parseResult = confirmViewSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        issues: parseResult.error.format(),
      });
    }

    const { messageId, deviceIdentifier, platform, timestamp } = parseResult.data;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { recipients: true },
    });

    if (!message) {
      return reply.status(404).send({ error: 'Message not found' });
    }

    const eventTime = timestamp ? new Date(timestamp) : new Date();

    // Insert high-confidence immutable event
    const event = await prisma.trackingEvent.create({
      data: {
        messageId,
        type: TrackingEventType.CONFIRMED_EMAIL_VIEW,
        confidence: ConfidenceLevel.CONFIRMED,
        classification: Classification.CONFIRMED_FIRST_PARTY,
        source: `first_party_${platform.toLowerCase()}`,
        timestamp: eventTime,
        metadata: {
          deviceIdentifier,
          platform,
        },
      },
    });

    // Increment confirmed count on primary recipient
    if (message.recipients.length > 0) {
      await prisma.messageRecipient.update({
        where: { id: message.recipients[0].id },
        data: {
          confirmedViewCount: { increment: 1 },
        },
      });
    }

    return reply.status(200).send({
      success: true,
      event: {
        id: event.id,
        type: event.type,
        confidence: event.confidence,
        timestamp: event.timestamp,
      },
    });
  });

  /**
   * Global Activity stream of all tracking events across all messages
   */
  fastify.get('/api/v1/events', async () => {
    const events = await prisma.trackingEvent.findMany({
      take: 100,
      orderBy: { timestamp: 'desc' },
      include: {
        message: {
          select: {
            id: true,
            subject: true,
            sentAt: true,
          },
        },
        messageRecipient: {
          include: {
            recipient: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return { events };
  });

  /**
   * Tracked Links index with click aggregates and message association
   */
  fastify.get('/api/v1/links', async () => {
    const links = await prisma.trackedLink.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        message: {
          select: {
            id: true,
            subject: true,
            sentAt: true,
          },
        },
        clickEvents: {
          orderBy: { timestamp: 'desc' },
          take: 5,
        },
      },
    });

    return { links };
  });

  /**
   * Inbound Replies stream with RFC correlation and time-to-reply
   */
  fastify.get('/api/v1/replies', async () => {
    const replies = await prisma.replyEvent.findMany({
      take: 100,
      orderBy: { replyTimestamp: 'desc' },
      include: {
        message: {
          select: {
            id: true,
            subject: true,
            sentAt: true,
            recipients: {
              include: { recipient: true },
            },
          },
        },
      },
    });

    return { replies };
  });

  /**
   * Connected Accounts list
   */
  fastify.get('/api/v1/accounts', async () => {
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        provider: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return { accounts };
  });
};
