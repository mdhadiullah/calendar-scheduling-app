import nodemailer, { type Transporter } from 'nodemailer';
import { env, emailEnabled } from '../lib/env';
import { logger } from '../lib/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!emailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT ?? 587,
      secure: env.EMAIL_SECURE ?? false,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
    });
  }
  return transporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = getTransporter();
  if (!t) {
    logger.warn({ to: input.to }, 'Email not sent: EMAIL_* environment variables not configured');
    return { ok: false, error: 'Email service not configured' };
  }
  try {
    await t.sendMail({
      from: env.EMAIL_FROM ?? env.EMAIL_USER,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true };
  } catch (err) {
    logger.error({ err, to: input.to }, 'Failed to send email');
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown email error' };
  }
}
