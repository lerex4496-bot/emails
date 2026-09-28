import { EmailProvider, SendEmailOptions, SendEmailResult } from '../provider.interface.js';
import { MessageStatus } from '@mailtrace/shared';

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  tokenExpiry?: number;
}

export class GmailProvider implements EmailProvider {
  public readonly providerName = 'GMAIL';
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(private config: GmailConfig) {
    this.accessToken = config.accessToken;
    this.tokenExpiry = config.tokenExpiry;
  }

  /**
   * Refreshes access token if missing or expiring within 60 seconds.
   */
  async getValidAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > now + 60000) {
      return this.accessToken;
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.config.refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to refresh Gmail access token: ${err}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = now + data.expires_in * 1000;
    return this.accessToken;
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      const token = await this.getValidAccessToken();
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const token = await this.getValidAccessToken();

      // Assemble raw RFC 2822 MIME message
      const toAddresses = options.to
        .map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email))
        .join(', ');

      const messageParts = [
        `From: ${options.from}`,
        `To: ${toAddresses}`,
        `Subject: =?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
      ];

      if (options.replyTo) {
        messageParts.push(`Reply-To: ${options.replyTo}`);
      }
      if (options.inReplyTo) {
        messageParts.push(`In-Reply-To: ${options.inReplyTo}`);
      }
      if (options.references) {
        messageParts.push(`References: ${options.references}`);
      }

      messageParts.push('', Buffer.from(options.html).toString('base64'));

      const rawMime = messageParts.join('\r\n');
      const base64UrlEncoded = Buffer.from(rawMime)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: base64UrlEncoded }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gmail API returned error ${res.status}: ${errorText}`);
      }

      const data = (await res.json()) as { id: string; threadId: string };

      return {
        success: true,
        providerMessageId: data.id,
        threadId: data.threadId,
        status: MessageStatus.PROVIDER_ACCEPTED,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: err?.message || 'Gmail dispatch failed',
      };
    }
  }
}
