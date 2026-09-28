import { describe, it, expect } from 'vitest';
import { sendMessageSchema, privacySettingsSchema, confirmViewSchema } from '../schemas.js';

describe('Shared Schemas Validation', () => {
  it('validates privacy settings defaults', () => {
    const parsed = privacySettingsSchema.parse({});
    expect(parsed.storeRawIp).toBe(false);
    expect(parsed.retainCoarseGeo).toBe(true);
    expect(parsed.eventRetentionDays).toBe(90);
  });

  it('validates send message input requirements', () => {
    const valid = {
      accountId: '11111111-1111-4111-8111-111111111111',
      to: [{ email: 'recipient@example.com', name: 'John Doe' }],
      subject: 'Hello World',
      bodyHtml: '<p>Test body with <a href="https://example.com">link</a></p>',
    };
    const parsed = sendMessageSchema.parse(valid);
    expect(parsed.to[0].email).toBe('recipient@example.com');
    expect(parsed.enableClickTracking).toBe(true);
    expect(parsed.enableOpenTracking).toBe(true);
  });

  it('rejects invalid recipient email', () => {
    const invalid = {
      accountId: '11111111-1111-4111-8111-111111111111',
      to: [{ email: 'not-an-email' }],
      subject: 'Hello',
      bodyHtml: '<p>Hello</p>',
    };
    expect(() => sendMessageSchema.parse(invalid)).toThrow();
  });

  it('validates first-party confirm-view payload', () => {
    const validConfirmation = {
      messageId: '11111111-1111-4111-8111-111111111111',
      deviceIdentifier: 'win-client-xyz-123',
      platform: 'WINDOWS' as const,
    };
    const parsed = confirmViewSchema.parse(validConfirmation);
    expect(parsed.platform).toBe('WINDOWS');
  });
});
