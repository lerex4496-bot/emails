import { MessageStatus } from '@mailtrace/shared';

export interface DeliveryNotification {
  provider: string;
  eventType: string; // e.g. "delivered", "bounce", "dropped", "deferred"
  recipientEmail?: string;
  statusCode?: string;
  reason?: string;
  timestamp?: string;
}

export interface StandardDeliveryEvent {
  status: MessageStatus;
  isHardBounce: boolean;
  reason?: string;
  provider: string;
}

/**
 * Standardizes vendor-specific delivery and bounce webhook events.
 */
export function classifyDeliveryNotification(notif: DeliveryNotification): StandardDeliveryEvent {
  const event = notif.eventType.toLowerCase();

  if (event.includes('deliver') || event === 'sent_ok' || event === '2.0.0') {
    return {
      status: MessageStatus.DELIVERED,
      isHardBounce: false,
      reason: notif.reason || 'Delivered to destination MTA',
      provider: notif.provider,
    };
  }

  if (event.includes('bounce') || event.includes('dropped') || event.includes('fail')) {
    const isHard =
      event.includes('hard') ||
      (notif.statusCode && notif.statusCode.startsWith('5')) ||
      false;

    return {
      status: MessageStatus.BOUNCED,
      isHardBounce: isHard,
      reason: notif.reason || (isHard ? 'Permanent Hard Bounce (5xx)' : 'Temporary Soft Bounce (4xx)'),
      provider: notif.provider,
    };
  }

  return {
    status: MessageStatus.PROVIDER_ACCEPTED,
    isHardBounce: false,
    reason: notif.reason || 'Provider queued or deferred',
    provider: notif.provider,
  };
}
