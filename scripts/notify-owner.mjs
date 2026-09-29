/**
 * Fursatly — message Umid on Telegram from @fusatlyuz_bot.
 *
 * The daily agent uses this only for what it could not fix itself (see
 * docs/superpowers/specs/2026-09-30-daily-agent-design.md). Reads
 * TELEGRAM_BOT_TOKEN and OWNER_TELEGRAM_CHAT_ID from .env.local.
 *
 *   node scripts/notify-owner.mjs "Gemini key 2 expired — reissue it in AI Studio"
 */

import { loadEnv } from './lib/env.mjs';

const text = process.argv.slice(2).join(' ').trim();
if (!text) { console.error('Usage: node scripts/notify-owner.mjs "<message>"'); process.exit(1); }

const env = loadEnv();
const token = env.TELEGRAM_BOT_TOKEN?.replace(/^["']|["']$/g, '');
const chatId = env.OWNER_TELEGRAM_CHAT_ID;
if (!token || !chatId) { console.error('TELEGRAM_BOT_TOKEN or OWNER_TELEGRAM_CHAT_ID missing in .env.local'); process.exit(1); }

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text: `🛠 Fursatly agent\n\n${text}`, disable_web_page_preview: true }),
});
const body = await res.json();
if (!body.ok) { console.error(`Telegram refused: ${body.description}`); process.exit(1); }
console.log(`Sent (message ${body.result.message_id}).`);
