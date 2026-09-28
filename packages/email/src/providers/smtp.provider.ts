import nodemailer, { Transporter } from 'nodemailer';
import { EmailProvider, SendEmailOptions, SendEmailResult } from '../provider.interface.js';
import { MessageStatus } from '@mailtrace/shared';

export interface SMTPConfig {
  host: string;
  port: number;
  secure?: boolean; // true for 465, false for other ports
  auth?: {
    user: string;
    pass: string;
  };
  requireTLS?: boolean;
}

export class SMTPProvider implements EmailProvider {
  public readonly providerName = 'SMTP';
  private transporter: Transporter;

  constructor(private config: SMTPConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: config.auth,
      requireTLS: config.requireTLS ?? false,
    });
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const toAddresses = options.to.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email));

      const mailOptions: nodemailer.SendMailOptions = {
        from: options.from,
        to: toAddresses,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        inReplyTo: options.inReplyTo,
        references: options.references,
        headers: options.headers,
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        providerMessageId: info.messageId,
        internetMessageId: info.messageId,
        status: MessageStatus.PROVIDER_ACCEPTED,
        rawResponse: {
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: err?.message || 'SMTP dispatch failed',
      };
    }
  }
}
