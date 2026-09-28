import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SMTPProvider } from '../providers/smtp.provider.js';
import nodemailer from 'nodemailer';
import { MessageStatus } from '@mailtrace/shared';

vi.mock('nodemailer');

describe('SMTP Provider', () => {
  const mockSendMail = vi.fn();
  const mockVerify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify,
    } as any);
  });

  it('verifies credentials successfully when nodemailer transporter verifies', async () => {
    mockVerify.mockResolvedValueOnce(true);
    const provider = new SMTPProvider({ host: 'smtp.mailtrap.io', port: 2525 });
    const verified = await provider.verifyCredentials();
    expect(verified).toBe(true);
  });

  it('returns false when credentials verification throws', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Auth failed'));
    const provider = new SMTPProvider({ host: 'smtp.mailtrap.io', port: 2525 });
    const verified = await provider.verifyCredentials();
    expect(verified).toBe(false);
  });

  it('dispatches email and maps response into SendEmailResult with Message-ID', async () => {
    mockSendMail.mockResolvedValueOnce({
      messageId: '<test-msg-123@smtp.example.com>',
      accepted: ['recipient@example.com'],
      rejected: [],
      response: '250 2.0.0 OK',
    });

    const provider = new SMTPProvider({ host: 'smtp.example.com', port: 587 });
    const result = await provider.sendEmail({
      from: 'sender@example.com',
      to: [{ email: 'recipient@example.com', name: 'Recipient' }],
      subject: 'Subject test',
      html: '<p>Body</p>',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(MessageStatus.PROVIDER_ACCEPTED);
    expect(result.internetMessageId).toBe('<test-msg-123@smtp.example.com>');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'sender@example.com',
        to: ['"Recipient" <recipient@example.com>'],
        subject: 'Subject test',
      })
    );
  });

  it('handles send error gracefully without throwing', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP Connection refused'));
    const provider = new SMTPProvider({ host: 'smtp.example.com', port: 587 });
    const result = await provider.sendEmail({
      from: 'sender@example.com',
      to: [{ email: 'recipient@example.com' }],
      subject: 'Subject test',
      html: '<p>Body</p>',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(MessageStatus.FAILED);
    expect(result.error).toContain('SMTP Connection refused');
  });
});
