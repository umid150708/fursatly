# Channel posts with premium emoji

**Date:** 2026-10-22 · **Status:** approved (posting path chosen by Umid)

## Problem

The daily `@fursatly` posts and the weekly digest use plain emoji and read as
dull. Umid has Telegram Premium and wants animated premium (custom) emoji in
the posts.

## Constraint

Bot API: custom emoji entities "can only be used by bots that purchased
additional usernames on Fragment or in the messages directly sent by the bot
to private, group and supergroup chats if the owner of the bot has a Telegram
Premium subscription." Channels are not on that list, so `@fusatlyuz_bot`
cannot post them. A Premium **user** account can.

## Decision

Post to the channel as Umid's Premium account through MTProto (GramJS,
`telegram` npm), from the same Vercel crons. Rejected: a Mac launchd poster
(posts stall while the Mac sleeps) and a Fragment username for the bot (paid).

## Design

1. **Emoji map** (`src/lib/channel-post.ts`): `PREMIUM_EMOJI` maps each plain
   emoji the builders use to a custom-emoji document id, and `emo(e)` wraps it
   as `<tg-emoji emoji-id="…">e</tg-emoji>`. The plain emoji stays inside the
   tag as the fallback glyph. Ids come from Telegram's official packs, which
   won't be deleted: **Animated Emoji** (`RestrictedEmoji`) for everything it
   has, plus **News Emoji** for 📍 and 🔴, which it lacks.
   `buildPost`/`buildDigest` emit the tags. `stripPremiumEmoji(html)` turns
   them back into plain emoji.
2. **Sender** (`src/lib/channel-sender.ts`): a `ChannelSender` class with
   `send(html)` and `close()`. When `TELEGRAM_USER_SESSION`,
   `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` are set, it connects once per cron
   run as the user and sends with GramJS's HTML parser. If the user path is
   unconfigured or fails, that message goes out through the bot with
   `stripPremiumEmoji` applied, so the channel never goes quiet. Each result
   reports `via: 'user' | 'bot'`.
3. **Crons**: `broadcast` and `digest` replace their copy-pasted `fetch` sender
   with `ChannelSender`. `dry=1` is unchanged.
4. **Session**: a dedicated authorization made for the server (QR-login
   accepted from the existing local Telethon session), so it can be revoked
   on its own in Settings → Devices. It's stored as a sensitive Vercel env var
   and never committed.

## Testing

- Unit (vitest): `buildPost` and `buildDigest` wrap the mapped emoji in
  `tg-emoji` tags; `stripPremiumEmoji` round-trips to the old plain output;
  `ChannelSender` falls back to the bot when the user path throws or is
  unconfigured (GramJS mocked).
- Live: a GramJS send to Saved Messages with the real session confirms the
  custom-emoji entities survive. Then a dry run of both crons.

## Out of scope

Bot DMs (reminders, webhook replies). The bot could use premium emoji there,
since its owner has Premium, but that's a separate change.
