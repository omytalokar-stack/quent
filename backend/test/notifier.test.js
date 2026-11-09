import test from 'node:test';
import assert from 'node:assert/strict';
import { sendTradeAlert } from '../src/services/notifier.js';

test('trade alerts use ntfy with title, priority, tags, and message body', async (context) => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200 };
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  await sendTradeAlert('Trade opened', 'BTCUSDT LONG');

  assert.equal(request.url, 'https://ntfy.sh/qc_node_99x_trd_8f4a2c19e7');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.body, 'BTCUSDT LONG');
  assert.deepEqual(request.options.headers, {
    Title: 'Trade opened',
    Priority: 'default',
    Tags: 'chart_with_upwards_trend',
  });
});

test('trade alerts report non-success HTTP responses without throwing', async (context) => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  let errorLog;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  console.error = (...args) => {
    errorLog = args;
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  await assert.doesNotReject(sendTradeAlert('Trade closed', 'BTCUSDT'));
  assert.deepEqual(errorLog, ['[Notifier] ntfy returned HTTP 503']);
});
