import { randomBytes } from 'node:crypto';
import { env, telegramEnabled } from '../lib/env';
import { logger } from '../lib/logger';

const TELEGRAM_API = 'https://api.telegram.org';

export function generateConnectToken(): string {
  return randomBytes(16).toString('hex');
}

export function telegramDeepLink(token: string): string | null {
  if (!env.TELEGRAM_BOT_USERNAME) return null;
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${token}`;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!telegramEnabled) {
    logger.warn('Telegram not sent: TELEGRAM_BOT_TOKEN not configured');
    return { ok: false, error: 'Telegram service not configured' };
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const body = (await res.json()) as { ok?: boolean; description?: string };
    if (!res.ok || body.ok === false) {
      const error = body?.description ?? `Telegram API returned ${res.status}`;
      logger.error({ error, chatId }, 'Failed to send Telegram message');
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    logger.error({ err, chatId }, 'Telegram send threw');
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown Telegram error' };
  }
}

/**
 * Registers (or re-registers) the webhook Telegram will call for incoming
 * updates, e.g. when a user sends /start <token> to link their account.
 * Call this once during deployment (see docs/deployment.md), not on every
 * server start, to avoid unnecessary Telegram API calls.
 */
export async function setTelegramWebhook(webhookUrl: string) {
  if (!telegramEnabled) return { ok: false, error: 'Telegram service not configured' };
  const res = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });
  return res.json();
}
