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
};
