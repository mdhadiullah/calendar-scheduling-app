import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ApiHttpError } from '../middleware/errorHandler';
import { generateConnectToken, telegramDeepLink, sendTelegramMessage } from '../services/telegramService';
import { supabaseAdmin } from '../lib/supabaseAdmin';

export const telegramRouter = Router();

// Settings -> Notifications -> Telegram -> Connect Telegram
// Generates a short-lived token embedded in a t.me deep link. The user
// taps it, Telegram opens a chat with the bot and sends "/start <token>",
// which the webhook below uses to complete the link. We never ask for or
// store the user's Telegram password/credentials.
telegramRouter.get(
  '/telegram/connect',
  authenticate,
  asyncHandler(async (req, res) => {
    const token = generateConnectToken();
    const expires = new Date(Date.now() + 15 * 60_000).toISOString();

    const { error } = await supabaseAdmin
      .from('telegram_connections')
      .upsert({ user_id: req.user!.id, connect_token: token, connect_token_expires_at: expires, is_active: false }, { onConflict: 'user_id' });
    if (error) throw error;

    const link = telegramDeepLink(token);
    if (!link) throw new ApiHttpError(503, 'TELEGRAM_NOT_CONFIGURED', 'Telegram bot is not configured on this server');

    res.json({ link, expiresAt: expires });
  })
);

telegramRouter.get(
  '/telegram/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const { data } = await req.user!.supabase.from('telegram_connections').select('is_active, telegram_username, connected_at').eq('user_id', req.user!.id).maybeSingle();
    res.json({ connection: data });
  })
);

telegramRouter.post(
  '/telegram/disconnect',
  authenticate,
  asyncHandler(async (req, res) => {
    const { error } = await req.user!.supabase
      .from('telegram_connections')
      .update({ is_active: false, telegram_chat_id: null, telegram_username: null })
      .eq('user_id', req.user!.id);
    if (error) throw error;
    res.status(204).end();
  })
);

// Telegram webhook — invoked by Telegram's servers, not by our own
// frontend, so it cannot carry a Supabase JWT. It is instead protected by
// keeping the URL itself secret (registered once via setTelegramWebhook)
// and, optionally, Telegram's `secret_token` header if configured.
telegramRouter.post(
  '/telegram/webhook',
  asyncHandler(async (req, res) => {
    const message = req.body?.message;
    const text: string | undefined = message?.text;
    const chatId: number | undefined = message?.chat?.id;
    const username: string | undefined = message?.chat?.username;

    if (text?.startsWith('/start') && chatId) {
      const token = text.split(' ')[1]?.trim();
      if (token) {
        const { data: connection } = await supabaseAdmin
          .from('telegram_connections')
          .select('user_id, connect_token_expires_at')
          .eq('connect_token', token)
          .maybeSingle();

        if (connection && new Date(connection.connect_token_expires_at) > new Date()) {
          await supabaseAdmin
            .from('telegram_connections')
            .update({
              telegram_chat_id: String(chatId),
              telegram_username: username ?? null,
              is_active: true,
              connected_at: new Date().toISOString(),
              connect_token: null,
              connect_token_expires_at: null,
            })
            .eq('user_id', connection.user_id);

          await sendTelegramMessage(String(chatId), 'Your Telegram account is now connected to Calendar & Scheduling. You will receive meeting and task reminders here.');
        } else {
          await sendTelegramMessage(String(chatId), 'This connection link is invalid or has expired. Please generate a new one from Settings.');
        }
      }
    }

    // Always 200 OK so Telegram does not retry the update.
    res.status(200).json({ ok: true });
  })
);
