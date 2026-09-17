import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { sendTelegramMessage, setTelegramSender } from './client';

describe('sendTelegramMessage', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;

  afterEach(() => {
    setTelegramSender(null);
    if (originalToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    }
  });

  it('does not call fetch when token is missing (CI stub)', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendTelegramMessage(1, 'hola');

    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  it('uses the injected sender instead of the network', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'should-not-be-used';
    const received: string[] = [];
    setTelegramSender(async (_chatId, text) => {
      received.push(text);
    });
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendTelegramMessage(9, 'stubbed');

    expect(received).toEqual(['stubbed']);
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
