import { FastifyPluginAsync } from 'fastify';
import {
  TRANSPARENT_1X1_PNG,
  TRACKING_PIXEL_HEADERS,
  TRACKING_REDIRECT_HEADERS,
} from '@mailtrace/tracking';
import { dispatchTrackingJob } from '../queue.js';
import { getPrismaClient } from '@mailtrace/database';

export const trackingRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = getPrismaClient();

  /**
   * Remote tracking resource request endpoint.
   * Returns a 1x1 transparent PNG image with anti-caching headers.
   * Evidence: Server received HTTP request (NOT confirmed read).
   */
  fastify.get<{ Params: { token: string } }>(
    '/t/open/:token',
    async (request, reply) => {
      const token = (request.params.token || '').replace(/\.png$/i, '');
      const headers = request.headers as Record<string, string>;
      const userAgent = headers['user-agent'] || undefined;

      // Anti-caching and diagnostic response
      reply.headers(TRACKING_PIXEL_HEADERS);

      // Asynchronously queue open event for classification
      dispatchTrackingJob({
        type: 'OPEN',
        token,
        timestamp: new Date().toISOString(),
        userAgent,
        headers: {
          'user-agent': userAgent,
          'accept': headers['accept'],
          'via': headers['via'],
          'purpose': headers['purpose'],
          'sec-purpose': headers['sec-purpose'],
          'sec-fetch-dest': headers['sec-fetch-dest'],
        },
      }).catch((err) => {
        fastify.log.warn({ err }, 'Failed to dispatch open tracking job');
      });

      return reply.send(TRANSPARENT_1X1_PNG);
    }
  );

  /**
   * Link redirection endpoint with STRICT open-redirect protection.
   * Target destination is solely determined by database lookup of the registered token.
   */
  fastify.get<{ Params: { token: string } }>(
    '/t/click/:token',
    async (request, reply) => {
      const token = (request.params.token || '').replace(/\.html$/i, '');
      const headers = request.headers as Record<string, string>;
      const userAgent = headers['user-agent'] || undefined;

      try {
        const trackedLink = await prisma.trackedLink.findUnique({
          where: { token },
        });

        if (!trackedLink) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Tracked link not found or expired',
          });
        }

        // Asynchronously queue click event
        dispatchTrackingJob({
          type: 'CLICK',
          token,
          messageId: trackedLink.messageId,
          timestamp: new Date().toISOString(),
          userAgent,
          headers: {
            'user-agent': userAgent,
            'referer': headers['referer'],
          },
          metadata: {
            trackedLinkId: trackedLink.id,
            originalUrl: trackedLink.originalUrl,
          },
        }).catch((err) => {
          fastify.log.warn({ err }, 'Failed to dispatch click tracking job');
        });

        // 302 Found redirect strictly to registered destination.
        // Uncacheable: a cached redirect is served without reaching this handler, so
        // every click after the first would go unrecorded.
        reply.headers(TRACKING_REDIRECT_HEADERS);
        return reply.redirect(trackedLink.originalUrl, 302);
      } catch (err: any) {
        fastify.log.error({ err }, 'Error looking up tracked link');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );
};
