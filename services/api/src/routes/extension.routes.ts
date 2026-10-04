import { FastifyPluginAsync } from 'fastify';
import { MessageStatus, ConfidenceLevel, TrackingEventType } from '@mailtrace/shared';
import { getPrismaClient } from '@mailtrace/database';
import { generateTrackingToken, generateReplyAlias } from '@mailtrace/tracking';

export const extensionRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = getPrismaClient();
  const defaultTrackingBaseUrl = (process.env.TRACKING_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://mailtrace-api-7bx5.onrender.com').replace(/\/$/, '');
  const trackingDomain = process.env.TRACKING_DOMAIN || 'track.mailtrace.io';

  /**
   * Extension endpoint: Prepare tracking tokens and pixel for an email
   * composed directly inside Gmail / Outlook webmail.
   */
  fastify.post('/api/v1/extension/prepare-tracking', async (request, reply) => {
    const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'https';
    const host = (request.headers['x-forwarded-host'] as string) || request.headers.host;
    const requestBase = host && !host.includes('localhost') && !host.includes('127.0.0.1') ? `${proto}://${host}` : null;
    const trackingBaseUrl = (requestBase || process.env.TRACKING_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://mailtrace-api-7bx5.onrender.com').replace(/\/$/, '');

    const body = (request.body || {}) as {
      to?: Array<{ email: string; name?: string }>;
      subject?: string;
      links?: string[];
      senderEmail?: string;
      enableOpenTracking?: boolean;
      enableClickTracking?: boolean;
      enableReplyTracking?: boolean;
    };

    const recipientList = Array.isArray(body.to) && body.to.length > 0
      ? body.to
      : [{ email: 'recipient@example.com', name: 'Recipient' }];

    const subject = body.subject || '(No Subject)';
    const links = Array.isArray(body.links) ? body.links : [];
    const enableOpenTracking = body.enableOpenTracking !== false;
    const enableClickTracking = body.enableClickTracking !== false;
    const enableReplyTracking = body.enableReplyTracking !== false;

    // 1. Resolve or create account / user for the sender
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: body.senderEmail || 'owner@mailtrace.io',
          passwordHash: '$2b$10$demo_hash_not_used_for_extension',
        },
      });
    }

    let account = await prisma.account.findFirst({
      where: { userId: user.id },
    });

    if (!account) {
      account = await prisma.account.create({
        data: {
          userId: user.id,
          provider: 'SMTP',
          emailAddress: body.senderEmail || user.email,
          displayName: 'Gmail Extension Sender',
          encryptedCredentials: 'extension_direct_send',
          isDefault: true,
        },
      });
    }

    // 2. Prepare tokens
    const openToken = enableOpenTracking ? generateTrackingToken() : undefined;
    const replyToken = enableReplyTracking ? generateTrackingToken() : undefined;
    const replyAlias = replyToken ? generateReplyAlias(trackingDomain, replyToken) : undefined;

    const linkTokenMap: Record<string, string> = {};
    if (enableClickTracking) {
      for (const link of links) {
        if (typeof link === 'string' && link.startsWith('http')) {
          linkTokenMap[link] = generateTrackingToken();
        }
      }
    }

    // 3. Persist Message, Recipients, and TrackedLinks
    const createdMessage = await prisma.$transaction(async (tx) => {
      const recipientIds: { recipientId: string; openToken?: string; replyAliasToken?: string }[] = [];

      for (const item of recipientList) {
        let recipient = await tx.recipient.findUnique({
          where: { email: item.email },
        });

        if (!recipient) {
          recipient = await tx.recipient.create({
            data: {
              email: item.email,
              name: item.name || item.email.split('@')[0],
            },
          });
        }

        recipientIds.push({
          recipientId: recipient.id,
          openToken,
          replyAliasToken: replyToken,
        });
      }

      // Create message in SENT status (sent natively via Gmail)
      const msg = await tx.message.create({
        data: {
          userId: user!.id,
          accountId: account!.id,
          subject,
          status: MessageStatus.SENT,
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

    const pixelUrl = openToken ? `${trackingBaseUrl}/t/open/${openToken}.png` : null;
    const pixelHtml = pixelUrl
      ? `<img src="${pixelUrl}" width="1" height="1" alt="" style="width:1px!important;height:1px!important;border:0!important;padding:0!important;margin:0!important;outline:none!important;opacity:0.01!important;" data-mailtrace-pixel="true" />`
      : '';

    const trackedLinks = Object.entries(linkTokenMap).map(([originalUrl, token]) => ({
      originalUrl,
      token,
      trackedUrl: `${trackingBaseUrl}/t/click/${token}`,
    }));

    return reply.status(201).send({
      success: true,
      messageId: createdMessage.id,
      openToken,
      pixelUrl,
      pixelHtml,
      replyAlias,
      trackedLinks,
    });
  });

  /**
   * Extension endpoint: Fetch lightweight tracking status map for Gmail Sent / Inbox rows.
   */
  fastify.get('/api/v1/extension/tracking-status', async (_request, reply) => {
    const messages = await prisma.message.findMany({
      take: 100,
      orderBy: { sentAt: 'desc' },
      include: {
        recipients: {
          include: {
            recipient: true,
            trackingEvents: {
              orderBy: { timestamp: 'desc' },
              take: 5,
            },
          },
        },
        trackedLinks: {
          include: {
            clickEvents: {
              orderBy: { timestamp: 'desc' },
              take: 5,
            },
          },
        },
        trackingEvents: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        replyEvents: {
          orderBy: { replyTimestamp: 'desc' },
          take: 1,
        },
      },
    });

    const statusList = messages.map((m) => {
      const primaryRecipient = m.recipients[0]?.recipient?.email || '';
      const replyReceived = (m.replyEvents && m.replyEvents.length > 0) || m.recipients.some((r) => r.replyReceived);

      let totalClicks = 0;
      let uniqueClicks = 0;
      m.trackedLinks.forEach((link) => {
        totalClicks += link.clickCount;
        uniqueClicks += link.uniqueClicks;
      });

      // Exclude events that occurred within 15 seconds of sentAt (sender self-triggers during compose)
      const validOpenEvents = m.trackingEvents.filter((e) => {
        const sendTime = m.sentAt || m.createdAt;
        if (!sendTime) return false;
        const diff = new Date(e.timestamp).getTime() - new Date(sendTime).getTime();
        return diff >= 15000;
      });

      // 1. Confirmed first-party open (client explicitly viewed message)
      const hasConfirmedOpen = validOpenEvents.some(
        (e) => e.type === TrackingEventType.CONFIRMED_EMAIL_VIEW
      );

      // 2. Probable human open (direct human browser request without proxy prefetch signature, >15s after send)
      const hasHumanOpen = validOpenEvents.some(
        (e) => e.type === TrackingEventType.PROBABLE_EMAIL_OPEN && !e.isProxy && e.confidence === ConfidenceLevel.HIGH
      );

      // 3. Repeated reading over time (non-proxy events separated in time, >15s after send)
      const nonProxyEvents = validOpenEvents.filter((e) => !e.isProxy);
      const isRepeatedReading = nonProxyEvents.length >= 2;

      // 4. Proxy prefetch / security scanner scan (GoogleImageProxy, Apple MPP, ATP)
      // This is proof of DELIVERY to the recipient's mail provider, NOT proof of reading!
      const hasProxyPrefetch = m.trackingEvents.some(
        (e) => e.isProxy || e.type === TrackingEventType.POSSIBLE_EMAIL_OPEN || e.type === TrackingEventType.TRACKING_RESOURCE_REQUESTED
      );

      // 5. Distinct proxy re-read:
      // A single proxy request (GoogleImageProxy / Apple MPP) is strictly an inbox arrival/delivery scan.
      // Only subsequent proxy requests occurring at least 3 minutes after the initial scan indicate an open.
      const proxyEvents = validOpenEvents.filter((e) => e.isProxy);
      const proxyTimestamps = proxyEvents.map((e) => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
      const hasDistinctProxyRead =
        proxyTimestamps.length >= 2 &&
        (proxyTimestamps[proxyTimestamps.length - 1] - proxyTimestamps[0]) >= 180000;

      // Determine delivery state:
      const isDelivered =
        m.status === MessageStatus.DELIVERED ||
        m.status === MessageStatus.PROVIDER_ACCEPTED ||
        hasProxyPrefetch;

      let status = isDelivered ? 'DELIVERED' : 'SENT';
      let confidence = isDelivered ? 'MEDIUM' : 'LOW';
      let eventLabel = isDelivered
        ? (hasProxyPrefetch ? 'Delivered (Verified by recipient mail server)' : 'Delivered to recipient inbox')
        : 'Sent • Waiting for recipient';

      if (replyReceived) {
        status = 'REPLIED';
        confidence = 'CONFIRMED';
        eventLabel = 'Reply received';
      } else if (totalClicks > 0) {
        status = 'CLICKED';
        confidence = 'CONFIRMED';
        eventLabel = `${uniqueClicks} unique click${uniqueClicks > 1 ? 's' : ''}`;
      } else if (hasConfirmedOpen || hasHumanOpen || isRepeatedReading || hasDistinctProxyRead) {
        status = 'OPENED';
        confidence = hasConfirmedOpen ? 'CONFIRMED' : 'HIGH';
        eventLabel = hasConfirmedOpen ? 'Confirmed view' : 'Opened by recipient';
      }

      const openEvents = validOpenEvents.filter(
        (e) =>
          e.type === TrackingEventType.CONFIRMED_EMAIL_VIEW ||
          (!e.isProxy && e.type === TrackingEventType.PROBABLE_EMAIL_OPEN) ||
          (hasDistinctProxyRead && e.isProxy)
      );
      const latestEvent = m.trackingEvents[0];

      return {
        messageId: m.id,
        subject: m.subject,
        recipientEmail: primaryRecipient,
        sentAt: m.sentAt,
        status,
        confidence,
        eventLabel,
        totalOpens: openEvents.length,
        totalClicks,
        uniqueClicks,
        replyReceived,
        lastActivity: latestEvent ? latestEvent.timestamp : m.sentAt,
      };
    });

    return reply.send({
      success: true,
      statuses: statusList,
    });
  });
};
