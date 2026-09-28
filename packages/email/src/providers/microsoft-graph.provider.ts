import { EmailProvider, SendEmailOptions, SendEmailResult } from '../provider.interface.js';
import { MessageStatus } from '@mailtrace/shared';

export interface MicrosoftConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tenantId?: string;
  accessToken?: string;
  tokenExpiry?: number;
}

export class MicrosoftGraphProvider implements EmailProvider {
  public readonly providerName = 'MICROSOFT';
  private accessToken?: string;
  private tokenExpiry?: number;
  private tenantId: string;

  constructor(private config: MicrosoftConfig) {
    this.accessToken = config.accessToken;
    this.tokenExpiry = config.tokenExpiry;
    this.tenantId = config.tenantId || 'common';
  }

  async getValidAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > now + 60000) {
      return this.accessToken;
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.config.refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadBasic offline_access',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to refresh Microsoft Graph token: ${err}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = now + data.expires_in * 1000;
    return this.accessToken;
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      const token = await this.getValidAccessToken();
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
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

      const payload = {
        message: {
          subject: options.subject,
          body: {
            contentType: 'HTML',
            content: options.html,
          },
          toRecipients: options.to.map((r) => ({
            emailAddress: {
              address: r.email,
              name: r.name,
            },
          })),
          replyTo: options.replyTo
            ? [
                {
                  emailAddress: {
                    address: options.replyTo,
                  },
                },
              ]
            : undefined,
        },
        saveToSentItems: true,
      };

      const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok && res.status !== 202) {
        const errorText = await res.text();
        throw new Error(`Microsoft Graph returned error ${res.status}: ${errorText}`);
      }

      return {
        success: true,
        status: MessageStatus.PROVIDER_ACCEPTED,
        rawResponse: { status: res.status },
      };
    } catch (err: any) {
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: err?.message || 'Microsoft Graph dispatch failed',
      };
    }
  }
}
