/**
 * SendGrid v3 mail/send client.
 *
 * Sends transactional email via Twilio SendGrid's v3 API.
 *
 * Env:
 *   SENDGRID_API_KEY — SendGrid API key (starts with 'SG.')
 *
 * Docs: https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */

import { logger } from '@/lib/infra/logger';

const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';

export interface SendGridMail {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: { filename: string; content: string; type?: string }[];
  headers?: Record<string, string>;
  category?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

export interface SendGridResult {
  ok: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export async function sendSendGridMail(mail: SendGridMail): Promise<SendGridResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { ok: false, errorCode: 'not_configured', errorMessage: 'SENDGRID_API_KEY not set' };
  }

  const body: Record<string, unknown> = {
    personalizations: [
      {
        to: mail.to.map((email) => ({ email })),
        ...(mail.cc?.length ? { cc: mail.cc.map((email) => ({ email })) } : {}),
        ...(mail.bcc?.length ? { bcc: mail.bcc.map((email) => ({ email })) } : {}),
        ...(mail.templateData ? { dynamic_template_data: mail.templateData } : {}),
      },
    ],
    from: { email: mail.from },
    subject: mail.subject,
    content: [
      ...(mail.html ? [{ type: 'text/html', value: mail.html }] : []),
      ...(mail.text ? [{ type: 'text/plain', value: mail.text }] : []),
    ],
    ...(mail.replyTo ? { reply_to: { email: mail.replyTo } } : {}),
    ...(mail.headers ? { headers: mail.headers } : {}),
    ...(mail.category ? { categories: [mail.category] } : {}),
    ...(mail.templateId ? { template_id: mail.templateId } : {}),
    ...(mail.attachments?.length ? {
      attachments: mail.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        type: a.type ?? 'application/octet-stream',
        disposition: 'attachment',
      })),
    } : {}),
  };

  try {
    const res = await fetch(SENDGRID_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.status >= 200 && res.status < 300) {
      // SendGrid returns 202 with no body. The message ID is in X-Message-Id.
      const messageId = res.headers.get('x-message-id') ?? undefined;
      return { ok: true, messageId };
    }
    const text = await res.text();
    let errorCode = 'sendgrid_error';
    let errorMessage = text;
    try {
      const json = JSON.parse(text);
      errorCode = json.errors?.[0]?.message ?? errorCode;
      errorMessage = json.errors?.[0]?.message ?? text;
    } catch {}
    logger.warn('sendgrid.send_failed', { status: res.status, error: errorMessage });
    return { ok: false, errorCode, errorMessage };
  } catch (e) {
    logger.error('sendgrid.network_error', { error: (e as Error).message });
    return { ok: false, errorCode: 'network_error', errorMessage: (e as Error).message };
  }
}

export function isSendGridConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY;
}
