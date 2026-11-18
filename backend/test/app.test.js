import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';

function request(server, method, path, headers = {}) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

test('health endpoint supports GET and HEAD', async (context) => {
  const server = http.createServer(app);
  await listen(server);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const getResponse = await request(server, 'GET', '/api/health');
  assert.equal(getResponse.statusCode, 200);
  assert.equal(JSON.parse(getResponse.body.toString()).status, 'ok');

  const headResponse = await request(server, 'HEAD', '/api/health');
  assert.equal(headResponse.statusCode, 200);
  assert.equal(headResponse.body.length, 0);
});

test('large JSON API responses are gzip-compressed when requested', async (context) => {
  const server = http.createServer(app);
  await listen(server);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await request(server, 'GET', '/api/screener/status', {
    'Accept-Encoding': 'gzip',
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-encoding'], 'gzip');
});
