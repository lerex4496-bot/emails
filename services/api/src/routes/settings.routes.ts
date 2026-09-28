import { FastifyPluginAsync } from 'fastify';
import { privacySettingsSchema } from '@mailtrace/shared';
import { getPrismaClient } from '@mailtrace/database';

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = getPrismaClient();

  fastify.put('/api/v1/settings/privacy', async (request, reply) => {
    const parseResult = privacySettingsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        issues: parseResult.error.format(),
      });
    }

    // In single-user self-hosted mode, update primary user
    const firstUser = await prisma.user.findFirst();
    if (!firstUser) {
      return reply.status(404).send({ error: 'No user configured' });
    }

    const updated = await prisma.user.update({
      where: { id: firstUser.id },
      data: {
        privacySettings: parseResult.data,
      },
      select: {
        id: true,
        email: true,
        privacySettings: true,
      },
    });

    return reply.send({ success: true, settings: updated.privacySettings });
  });

  fastify.post('/api/v1/settings/data/export', async (_, reply) => {
    const messages = await prisma.message.findMany({
      include: {
        recipients: { include: { recipient: true } },
        trackedLinks: true,
        trackingEvents: true,
      },
    });

    return reply
      .header('Content-Disposition', 'attachment; filename="mailtrace-export.json"')
      .header('Content-Type', 'application/json')
      .send({
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        messages,
      });
  });

  fastify.delete('/api/v1/settings/data/history', async (_, reply) => {
    await prisma.trackingEvent.deleteMany({});
    await prisma.clickEvent.deleteMany({});
    await prisma.replyEvent.deleteMany({});
    await prisma.deliveryEvent.deleteMany({});

    return reply.send({
      success: true,
      message: 'All tracking history permanently erased.',
    });
  });
};
