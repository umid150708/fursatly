import { describe, it, expect, vi, beforeEach } from 'vitest';

// GramJS is mocked: these tests cover the routing (user account first, bot
// fallback), not MTProto itself.
const gram = vi.hoisted(() => ({
  connect: vi.fn(),
  sendMessage: vi.fn(),
  getInputEntity: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('telegram', () => ({
  TelegramClient: vi.fn(function (this: any) {
    Object.assign(this, gram, { setLogLevel: vi.fn() });
  }),
}));
vi.mock('telegram/sessions', () => ({ StringSession: vi.fn() }));

import { ChannelSender } from '../src/lib/channel-sender';

const PREMIUM = '<tg-emoji emoji-id="5375163339154399459">🎓</tg-emoji> <b>GRANT</b>';
const USER_ENV = {
  TELEGRAM_USER_SESSION: 'sess', TELEGRAM_API_ID: '123', TELEGRAM_API_HASH: 'hash',
  TELEGRAM_BOT_TOKEN: 'bot-token',
};
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  gram.connect.mockResolvedValue(true);
  gram.getInputEntity.mockResolvedValue({ peer: 'fursatly' });
  gram.sendMessage.mockResolvedValue({ id: 1 });
  fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

const botText = () => JSON.parse(fetchMock.mock.calls[0][1].body).text;

describe('ChannelSender', () => {
  it('posts as the user account, premium emoji intact, when a session is configured', async () => {
    const s = new ChannelSender('@fursatly', USER_ENV);
    expect(await s.send(PREMIUM)).toEqual({ ok: true, via: 'user' });
    expect(gram.sendMessage).toHaveBeenCalledWith(
      { peer: 'fursatly' },
      expect.objectContaining({ message: PREMIUM, parseMode: 'html', linkPreview: false }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('connects and resolves the channel once across several posts', async () => {
    const s = new ChannelSender('@fursatly', USER_ENV);
    await s.send(PREMIUM);
    await s.send(PREMIUM);
    expect(gram.connect).toHaveBeenCalledTimes(1);
    expect(gram.getInputEntity).toHaveBeenCalledTimes(1);
    expect(gram.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('uses the bot with plain emoji when no user session is configured', async () => {
    const s = new ChannelSender('@fursatly', { TELEGRAM_BOT_TOKEN: 'bot-token' });
    expect(await s.send(PREMIUM)).toEqual({ ok: true, via: 'bot' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.telegram.org/botbot-token/sendMessage');
    expect(botText()).toBe('🎓 <b>GRANT</b>');
    expect(gram.connect).not.toHaveBeenCalled();
  });

  it('falls back to the bot when the user send fails', async () => {
    gram.sendMessage.mockRejectedValueOnce(new Error('CHAT_WRITE_FORBIDDEN'));
    const s = new ChannelSender('@fursatly', USER_ENV);
    expect(await s.send(PREMIUM)).toEqual({ ok: true, via: 'bot' });
    expect(botText()).toBe('🎓 <b>GRANT</b>');
  });

  it('stops retrying the user account after it fails to connect', async () => {
    gram.connect.mockRejectedValue(new Error('AUTH_KEY_UNREGISTERED'));
    const s = new ChannelSender('@fursatly', USER_ENV);
    await s.send(PREMIUM);
    await s.send(PREMIUM);
    expect(gram.connect).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports the bot error when both paths fail', async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":false,"description":"Forbidden"}', { status: 403 }));
    const s = new ChannelSender('@fursatly', { TELEGRAM_BOT_TOKEN: 'bot-token' });
    expect(await s.send(PREMIUM)).toEqual({ ok: false, via: 'bot', error: 'Forbidden' });
  });

  it('reports a clear error when neither path is configured', async () => {
    const s = new ChannelSender('@fursatly', {});
    expect(await s.send(PREMIUM)).toEqual({ ok: false, via: 'bot', error: 'TELEGRAM_BOT_TOKEN not configured' });
  });

  it('close() tears down the user client', async () => {
    const s = new ChannelSender('@fursatly', USER_ENV);
    await s.send(PREMIUM);
    await s.close();
    expect(gram.destroy).toHaveBeenCalledTimes(1);
  });
});
