import { describe, it, expect } from 'vitest';
import { classifyDeliveryNotification } from '../delivery/classifier.js';
import { MessageStatus } from '@mailtrace/shared';

describe('Delivery Notification Classifier', () => {
  it('identifies successful delivery events', () => {
    const event = classifyDeliveryNotification({
      provider: 'sendgrid',
      eventType: 'delivered',
      statusCode: '250',
    });
    expect(event.status).toBe(MessageStatus.DELIVERED);
    expect(event.isHardBounce).toBe(false);
  });

  it('identifies hard bounce events (5xx)', () => {
    const event = classifyDeliveryNotification({
      provider: 'ses',
      eventType: 'bounce_hard',
      statusCode: '550 5.1.1 User unknown',
    });
    expect(event.status).toBe(MessageStatus.BOUNCED);
    expect(event.isHardBounce).toBe(true);
  });

  it('identifies soft bounce events (4xx)', () => {
    const event = classifyDeliveryNotification({
      provider: 'mailgun',
      eventType: 'bounce_soft',
      statusCode: '452 Mailbox full',
    });
    expect(event.status).toBe(MessageStatus.BOUNCED);
    expect(event.isHardBounce).toBe(false);
  });
});
