import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { LogLevel } from 'telegram/extensions/Logger';
import { stripPremiumEmoji, buttonsAsLinks, type PostButton } from './channel-post';

/**
 * Sends HTML posts to the public channel, shared by the broadcast and digest
 * crons.
 *
 * Bots can't post premium (custom) emoji to channels (Bot API allows them only
 * in private/group chats, or for bots with a paid Fragment username), so posts
 * go out as Umid's Premium user account over MTProto (GramJS) when a session
 * is configured. If that path is missing or fails, the post still goes out
 * through the bot with the premium emoji turned back into plain ones, so the
 * channel never goes quiet.
 *
 * User accounts can't attach inline buttons, so after the user posts, the bot
 * (a channel admin allowed to edit others' posts) adds them. If it can't, the
 * links are written into the post instead, so it never loses its links.
 *
 * Config:
 *   TELEGRAM_USER_SESSION  GramJS StringSession of a server-only login (revoke it
 *                          in Telegram → Settings → Devices). Never commit it.
 *   TELEGRAM_API_ID / TELEGRAM_API_HASH  the my.telegram.org app it was made with
 *   TELEGRAM_BOT_TOKEN     fallback bot, an admin of the channel
 */

export type SendResult = { ok: boolean; via: 'user' | 'bot'; error?: string };

type Env = Record<string, string | undefined>;

export class ChannelSender {
  private client: TelegramClient | null = null;
  private peer: unknown = null;
  private userDown = false; // a failed connect isn't retried within one run

  constructor(private channel: string, private env: Env = process.env) {}

  async send(html: string, buttons: PostButton[] = []): Promise<SendResult> {
    if (await this.connectUser()) {
      let id: number | null = null;
      try {
        id = (await this.client!.sendMessage(this.peer as any, { message: html, parseMode: 'html', linkPreview: false })).id;
      } catch (e: any) {
        console.warn(`[ChannelSender] user send failed, using bot: ${e?.message || e}`);
      }
      if (id !== null) {
        if (buttons.length) await this.attachButtons(id, html, buttons);
        return { ok: true, via: 'user' };
      }
    }
    const res = await this.callBot('sendMessage', {
      text: stripPremiumEmoji(html),
      parse_mode: 'HTML',
      // No link preview — the post carries its own formatting; the big OG card
      // was redundant with the text and pushed the CTA off-screen.
      link_preview_options: { is_disabled: true },
      ...(buttons.length ? { reply_markup: keyboard(buttons) } : {}),
    });
    return { ...res, via: 'bot' };
  }

  async close(): Promise<void> {
    try { await this.client?.destroy(); } catch { /* already gone */ }
    this.client = null;
  }

  private async attachButtons(id: number, html: string, buttons: PostButton[]): Promise<void> {
    const res = await this.callBot('editMessageReplyMarkup', { message_id: id, reply_markup: keyboard(buttons) });
    if (res.ok) return;
    console.warn(`[ChannelSender] bot couldn't attach buttons, writing links into the post: ${res.error}`);
    try {
      await this.client!.editMessage(this.peer as any, {
        message: id, text: `${html}\n\n${buttonsAsLinks(buttons)}`, parseMode: 'html', linkPreview: false,
      });
    } catch (e: any) {
      console.warn(`[ChannelSender] couldn't add links to post ${id}: ${e?.message || e}`);
    }
  }

  /** Connects once per run and resolves the channel once; false → use the bot. */
  private async connectUser(): Promise<boolean> {
    if (this.peer) return true;
    const { TELEGRAM_USER_SESSION: session, TELEGRAM_API_ID: apiId, TELEGRAM_API_HASH: apiHash } = this.env;
    if (this.userDown || !session || !apiId || !apiHash) return false;
    try {
      this.client = new TelegramClient(new StringSession(session), Number(apiId), apiHash, { connectionRetries: 2 });
      this.client.setLogLevel(LogLevel.ERROR);
      await this.client.connect();
      this.peer = await this.client.getInputEntity(this.channel);
      return true;
    } catch (e: any) {
      console.warn(`[ChannelSender] user account unavailable, using bot: ${e?.message || e}`);
      this.userDown = true;
      await this.close();
      return false;
    }
  }

  private async callBot(method: string, body: object): Promise<{ ok: boolean; error?: string }> {
    const token = this.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: this.channel, ...body }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.description || `HTTP ${res.status}` };
  }
}

const keyboard = (buttons: PostButton[]) => ({ inline_keyboard: [buttons.map(({ text, url }) => ({ text, url }))] });
