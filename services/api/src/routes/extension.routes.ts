import { FastifyPluginAsync } from 'fastify';
import { MessageStatus, TrackingEventType } from '@mailtrace/shared';
import { getPrismaClient } from '@mailtrace/database';
import { generateTrackingToken, generateReplyAlias } from '@mailtrace/tracking';

/**
 * How long to wait after send before treating silence as delivery.
 *
 * A rejected message produces a Mail Delivery Subsystem notice within seconds, so silence
 * past this window means the recipient's server accepted it. Three minutes leaves room for
 * Gmail's Undo Send (up to 30s, during which nothing has been transmitted) plus ordinary
 * queueing, without leaving the badge stuck on "Sent" long enough to look broken.
 *
 * This yields an inference, not an observation, and is surfaced with LOW confidence and a
 * label that says what it rests on. It becomes real evidence once the extension reports
 * bounces it sees in the sender's own inbox.
 */
const BOUNCE_GRACE_MS = 3 * 60 * 1000;

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
   * Extension endpoint: report a delivery failure the extension observed.
   *
   * Gmail delivers a bounce as a Mail Delivery Subsystem message into the SENDER's own
   * inbox, which is where the extension already runs -- so a bounce is observable without
   * any mailbox API access or OAuth scope. Recording it turns the grace-period inference
   * in tracking-status into real evidence: silence then genuinely means "no rejection was
   * reported", rather than "we were not looking".
   *
   * Note this only ever makes the verdict more negative, never more positive, so it cannot
   * manufacture a delivery or an open.
   */
  fastify.post('/api/v1/extension/delivery-failure', async (request, reply) => {
    const body = (request.body || {}) as {
      messageId?: string;
      openToken?: string;
      reason?: string;
      hardBounce?: boolean;
    };

    let messageId = body.messageId;
    if (!messageId && body.openToken) {
      const recipient = await prisma.messageRecipient.findUnique({
        where: { openTrackingToken: body.openToken },
        select: { messageId: true },
      });
      messageId = recipient?.messageId;
    }

    if (!messageId) {
      return reply.status(400).send({
        success: false,
        error: 'Bad Request',
        message: 'messageId or openToken is required',
      });
    }

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      return reply.status(404).send({ success: false, error: 'Not Found' });
    }

    const status = body.hardBounce === false ? MessageStatus.FAILED : MessageStatus.BOUNCED;
    const reason = (body.reason || '').slice(0, 500) || null;

    // Idempotent: the extension re-scans the inbox on a timer and will see the same
    // bounce notice repeatedly.
    const existing = await prisma.deliveryEvent.findFirst({
      where: { messageId, status },
    });

    if (!existing) {
      await prisma.deliveryEvent.create({
        data: { messageId, status, reason },
      });
      await prisma.message.update({
        where: { id: messageId },
        data: { status, lastActivityAt: new Date() },
      });
    }

    return reply.send({ success: true, messageId, status });
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
        deliveryEvents: {
          orderBy: { timestamp: 'desc' },
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

      // Filter events occurring at least 60 seconds after sentAt (exclude compose DOM insertions, sender preview, and Google delivery prefetch scanning)
      const validOpenEvents = m.trackingEvents.filter((e) => {
        const sendTime = m.sentAt || m.createdAt;
        if (!sendTime) return false;
        const diff = new Date(e.timestamp).getTime() - new Date(sendTime).getTime();
        return diff >= 60000;
      });

      // 1. Confirmed first-party open (client explicitly viewed message)
      const hasConfirmedOpen = validOpenEvents.some(
        (e) => e.type === TrackingEventType.CONFIRMED_EMAIL_VIEW
      );

      // 2. Open events. Only states that positively assert a human read count here.
      // POSSIBLE_EMAIL_OPEN is deliberately excluded: "possible" is not enough for a green
      // badge under a never-show-a-false-open policy, and the only producer of
      // POSSIBLE/MEDIUM was the Apple MPP signature that never actually matched. Historical
      // rows carrying it (Google proxy was graded POSSIBLE/MEDIUM before 8f62e62) stop
      // counting as opens, which is the intended correction.
      const openEvents = validOpenEvents.filter(
        (e) =>
          e.type === TrackingEventType.CONFIRMED_EMAIL_VIEW ||
          e.type === TrackingEventType.PROBABLE_EMAIL_OPEN
      );

      // The latched column is authoritative, because m.trackingEvents is capped at the 10
      // most recent rows: once an open is evicted from that window the event-derived check
      // goes false and the badge would regress from opened to delivered. The event list is
      // still consulted so historical rows written before the column existed keep working.
      const latchedOpenAt = m.recipients.find((r) => r.openedAt)?.openedAt ?? null;
      const hasOpen = !!latchedOpenAt || openEvents.length > 0;

      // 3. Delivery means RECIPIENT-SIDE evidence, not merely "a request arrived".
      // A bare tracking event is not enough -- the sender's own browser can produce one,
      // and a self-view must not read as "delivered to recipient inbox".
      //
      // Three sources, strongest first:
      //  a. A recorded bounce/DSN, which settles it negatively.
      //  b. A proxy-signed fetch. Google proxies images only for a message its servers
      //     accepted into a mailbox, so this is positive receipt evidence. It is not
      //     reliable on its own: there is no universal pre-delivery image scan, so for
      //     most messages the first proxy fetch IS the open.
      //  c. Absence of a bounce after a grace period. Weaker, and an INFERENCE rather
      //     than an observation -- labelled as such below. A rejected message produces a
      //     Mail Delivery Subsystem notice within seconds; silence past the grace period
      //     means the recipient's server accepted it. It does NOT mean the inbox: spam
      //     placement is silent.
      const bounced =
        m.status === MessageStatus.BOUNCED ||
        m.status === MessageStatus.FAILED ||
        (m.deliveryEvents || []).some(
          (e) => e.status === MessageStatus.BOUNCED || e.status === MessageStatus.FAILED
        );

      const hasProxyFetch = m.trackingEvents.some((e) => e.isProxy);
      const confirmedDelivery =
        m.status === MessageStatus.DELIVERED ||
        m.status === MessageStatus.PROVIDER_ACCEPTED ||
        (m.deliveryEvents || []).some((e) => e.status === MessageStatus.DELIVERED) ||
        hasProxyFetch ||
        hasOpen;

      const sendTimeForGrace = m.sentAt || m.createdAt;
      const graceElapsed = sendTimeForGrace
        ? Date.now() - new Date(sendTimeForGrace).getTime() >= BOUNCE_GRACE_MS
        : false;
      const inferredDelivery = !bounced && graceElapsed;

      const hasDelivery = !bounced && (confirmedDelivery || inferredDelivery);

      let status = hasDelivery ? 'DELIVERED' : 'SENT';
      let confidence = hasDelivery ? (confirmedDelivery ? 'MEDIUM' : 'LOW') : 'LOW';
      let eventLabel = hasDelivery
        ? confirmedDelivery
          ? 'Delivered to recipient inbox'
          : 'Delivered • no bounce received'
        : 'Sent • Waiting for recipient';

      if (bounced) {
        status = 'BOUNCED';
        confidence = 'CONFIRMED';
        eventLabel = 'Bounced • not delivered';
      } else if (replyReceived) {
        status = 'REPLIED';
        confidence = 'CONFIRMED';
        eventLabel = 'Reply received';
      } else if (totalClicks > 0) {
        status = 'CLICKED';
        confidence = 'CONFIRMED';
        eventLabel = `${uniqueClicks} unique click${uniqueClicks > 1 ? 's' : ''}`;
      } else if (hasOpen) {
        status = 'OPENED';
        confidence = hasConfirmedOpen ? 'CONFIRMED' : 'HIGH';
        eventLabel = hasConfirmedOpen ? 'Confirmed view' : 'Opened by recipient';
      }

      const totalOpensCount = openEvents.length;
      const latestEvent = m.trackingEvents[0];

      return {
        messageId: m.id,
        openTrackingToken: m.recipients[0]?.openTrackingToken || null,
        subject: m.subject,
        recipientEmail: primaryRecipient,
        sentAt: m.sentAt,
        status,
        confidence,
        eventLabel,
        totalOpens: totalOpensCount,
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
