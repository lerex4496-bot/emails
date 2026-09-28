import { MessageStatus } from '@mailtrace/shared';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  from: string;
  to: EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  providerMessageId?: string;
  internetMessageId?: string;
  threadId?: string;
  status: MessageStatus;
  rawResponse?: any;
  error?: string;
}

export interface EmailProvider {
  readonly providerName: string;
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  verifyCredentials(): Promise<boolean>;
}
