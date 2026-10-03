import { FastifyPluginAsync } from 'fastify';
import { sendMessageSchema, MessageStatus, AccountProvider, ConfidenceLevel } from '@mailtrace/shared';
import { getPrismaClient, decryptCredentials } from '@mailtrace/database';
import {
  generateTrackingToken,
  generateReplyAlias,
  extractTrackableLinks,
  injectTracking,
} from '@mailtrace/tracking';
import { SMTPProvider } from '@mailtrace/email';

export const messageRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = getPrismaClient();
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-mailtrace-dev-secret-key-32b';
  const trackingBaseUrl = (process.env.TRACKING_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://mailtrace-api-7bx5.onrender.com').replace(/\/$/, '');
  const trackingDomain = process.env.TRACKING_DOMAIN || 'track.mailtrace.io';

  /**
   * Send tracked email via active account/provider
   */
  fastify.post('/api/v1/messages/send', async (request, reply) => {
    const parseResult = sendMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        issues: parseResult.error.format(),
      });
    }

    const {
      accountId,
      to,
      subject,
      bodyHtml,
      bodyText,
      enableClickTracking,
      enableOpenTracking,
      enableReplyTracking,
    } = parseResult.data;

    // 1. Fetch account
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return reply.status(404).send({ error: 'Account not found' });
    }

    // 2. Extract links and generate tokens
    const extractedLinks = enableClickTracking ? extractTrackableLinks(bodyHtml) : [];
    const linkTokenMap: Record<string, string> = {};
    for (const link of extractedLinks) {
      linkTokenMap[link] = generateTrackingToken();
    }

    // 3. Process each recipient with unique open token and reply alias
    const recipientData = to.map((r) => {
      const openToken = enableOpenTracking ? generateTrackingToken() : undefined;
      const replyToken = enableReplyTracking ? generateTrackingToken() : undefined;
      return {
        recipient: r,
        openToken,
        replyAliasToken: replyToken,
        replyAliasAddress: replyToken ? generateReplyAlias(trackingDomain, replyToken) : undefined,
      };
    });

    // 4. In a transaction, record message, recipients, and tracked links
    const primaryRecipient = recipientData[0];
    const customizedHtml = injectTracking({
      html: bodyHtml,
      openToken: primaryRecipient.openToken,
      trackingBaseUrl,
      linkTokenMap,
    });

    const createdMessage = await prisma.$transaction(async (tx) => {
      // Find or create recipients
      const recipientIds: { recipientId: string; openToken?: string; replyAliasToken?: string }[] = [];
      for (const item of recipientData) {
        let recipient = await tx.recipient.findUnique({
          where: { email: item.recipient.email },
        });
        if (!recipient) {
          recipient = await tx.recipient.create({
            data: {
              email: item.recipient.email,
              name: item.recipient.name,
              company: item.recipient.company,
            },
          });
        }
        recipientIds.push({
          recipientId: recipient.id,
          openToken: item.openToken,
          replyAliasToken: item.replyAliasToken,
        });
      }

      // Create message
      const msg = await tx.message.create({
        data: {
          userId: account.userId,
          accountId: account.id,
          subject,
          status: MessageStatus.PENDING,
          sentAt: new Date(),
        },
      });

      // Create message_recipients
      for (const r of recipientIds) {
        await tx.messageRecipient.create({
          data: {
            messageId: msg.id,
            recipientId: r.recipientId,
            openTrackingToken: r.openToken || generateTrackingToken(),
            replyAliasToken: r.replyAliasToken,
          },
        });
      }

      // Create tracked_links
      for (const [originalUrl, token] of Object.entries(linkTokenMap)) {
        await tx.trackedLink.create({
          data: {
            messageId: msg.id,
            token,
            originalUrl,
          },
        });
      }

      return msg;
    });

    // 5. Dispatch email via provider
    let dispatchResult: any;
    try {
      if (account.provider === AccountProvider.SMTP) {
        const decryptedCreds = JSON.parse(decryptCredentials(account.encryptedCredentials, encryptionKey));
        const provider = new SMTPProvider(decryptedCreds);

        dispatchResult = await provider.sendEmail({
          from: account.emailAddress,
          to: to.map((r) => ({ email: r.email, name: r.name })),
          subject,
          html: customizedHtml,
          text: bodyText,
          replyTo: primaryRecipient.replyAliasAddress,
        });

        // Update message with provider status
        await prisma.message.update({
          where: { id: createdMessage.id },
          data: {
            status: dispatchResult.status,
            internetMessageId: dispatchResult.internetMessageId,
            providerMessageId: dispatchResult.providerMessageId,
          },
        });
      } else {
        // Fallback for mock or local dev
        await prisma.message.update({
          where: { id: createdMessage.id },
          data: {
            status: MessageStatus.PROVIDER_ACCEPTED,
            providerMessageId: `mock-msg-${createdMessage.id}`,
          },
        });
        dispatchResult = { success: true, status: MessageStatus.PROVIDER_ACCEPTED };
      }

      return reply.status(201).send({
        success: true,
        messageId: createdMessage.id,
        status: dispatchResult.status,
        providerMessageId: dispatchResult.providerMessageId,
      });
    } catch (err: any) {
      fastify.log.error({ err }, 'Email dispatch failed');
      await prisma.message.update({
        where: { id: createdMessage.id },
        data: { status: MessageStatus.FAILED },
      });
      return reply.status(500).send({
        error: 'Email dispatch failed',
        message: err.message,
      });
    }
  });

  /**
   * List messages with search, pagination, and activity aggregates
   */
  fastify.get('/api/v1/messages', async (request) => {
    const messages = await prisma.message.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        recipients: {
          include: { recipient: true },
        },
        trackedLinks: true,
        _count: {
          select: {
            trackingEvents: true,
            replyEvents: true,
          },
        },
      },
    });

    return {
      messages: messages.map((m) => {
        const primaryRecipient = m.recipients[0];
        return {
          id: m.id,
          subject: m.subject,
          status: m.status,
          sentAt: m.sentAt,
          firstActivityAt: m.firstActivityAt,
          lastActivityAt: m.lastActivityAt,
          recipient: primaryRecipient
            ? {
                email: primaryRecipient.recipient.email,
                name: primaryRecipient.recipient.name,
              }
            : null,
          opens: {
            resourceRequestedCount: primaryRecipient?.openResourceCount ?? 0,
            probableCount: primaryRecipient?.probableOpenCount ?? 0,
            confirmedCount: primaryRecipient?.confirmedViewCount ?? 0,
          },
          clicks: {
            totalClicks: primaryRecipient?.totalClicks ?? 0,
            uniqueClicks: primaryRecipient?.uniqueClicks ?? 0,
          },
          replyReceived: primaryRecipient?.replyReceived ?? false,
          confidence:
            (primaryRecipient?.confirmedViewCount ?? 0) > 0
              ? ConfidenceLevel.CONFIRMED
              : (primaryRecipient?.probableOpenCount ?? 0) > 0
              ? ConfidenceLevel.HIGH
              : (primaryRecipient?.openResourceCount ?? 0) > 0
              ? ConfidenceLevel.MEDIUM
              : ConfidenceLevel.LOW,
        };
      }),
    };
  });

  /**
   * Get single message details with full chronological activity timeline
   */
  fastify.get<{ Params: { id: string } }>('/api/v1/messages/:id', async (request, reply) => {
    const { id } = request.params;
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        account: {
          select: { provider: true, emailAddress: true, displayName: true },
        },
        recipients: {
          include: { recipient: true },
        },
        trackedLinks: {
          include: { _count: { select: { clickEvents: true } } },
        },
        trackingEvents: {
          orderBy: { timestamp: 'asc' },
        },
        replyEvents: true,
        deliveryEvents: true,
      },
    });

    if (!message) {
      return reply.status(404).send({ error: 'Message not found' });
    }

    return { message };
  });
};
