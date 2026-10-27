import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { integrationApi, pickFloor, PROMPT_MAX, RATE_PER_MINUTE, type IntegrationDeps, type IntegrationFloor } from '../src/server/integrations/api.js';
import { integrationToken, tokenFile, tokenMatches } from '../src/server/integrations/token.js';
import type { WorkerInfo } from '../src/shared/protocol.js';

const TOKEN = 'integration-token-for-tests';

function worker(id: string, more: Partial<WorkerInfo> = {}): WorkerInfo {
  return {
    id, kind: 'agent', deskId: 'desk-1', name: id[0].toUpperCase() + id.slice(1), color: '#fff', status: 'done', acked: false, createdBy: 'Ada', createdAt: 0, cols: 80, rows: 24, viewers: [],
    ...more,
  };
}

/** A floor with these workers; the ones in `running` take a prompt, the rest are asleep and get resumed. */
function floor(id: string, workers: WorkerInfo[], running: string[] = []) {
  const prompted: { id: string; text: string; by?: string }[] = [];
  const resumed: { id: string; text?: string }[] = [];
  const f = {
    id,
    def: { name: id, repo: `acme/${id}` },
    project: { branch: 'main' },
    workers: {
      list: () => workers,
      get: (wid: string) => workers.find((w) => w.id === wid),
      prompt: (wid: string, text: string, by?: string) => {
        if (!running.includes(wid)) return 'Worker is not running';
        prompted.push({ id: wid, text, by });
        return undefined;
      },
      resume: (wid: string, text?: string) => {
        resumed.push({ id: wid, text });
        return undefined;
      },
    },
    github: { pulls: { items: [] } },
    queue: { state: () => ({ tasks: [] }) },
  };
  return { floor: f as unknown as IntegrationFloor, prompted, resumed };
}

async function serve(t: { after(fn: () => void): void }, deps: Partial<IntegrationDeps> & Pick<IntegrationDeps, 'floors'>) {
  const toasts: string[] = [];
  const server = http.createServer(integrationApi({ pullsOf: () => undefined, toast: (_f, text) => toasts.push(text), token: TOKEN, name: 'n8n', ...deps }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, route: string, body?: unknown, token: string | null = TOKEN) => {
    const res = await fetch(base + route, {
      method,
      headers: { ...(token === null ? {} : { authorization: `Bearer ${token}` }), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  return { call, toasts };
}

test('the token is made once, kept to its owner, and an env token wins', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'integrations-'));
  const first = integrationToken(dir, '');
  assert.ok(first.length >= 32);
  assert.equal(statSync(tokenFile(dir)).mode & 0o777, 0o600);
  assert.equal(integrationToken(dir, ''), first, 'the same token after a restart');
  assert.deepEqual(JSON.parse(readFileSync(tokenFile(dir), 'utf8')), { token: first });
  assert.equal(integrationToken(dir, '  from-the-env  '), 'from-the-env');
  writeFileSync(tokenFile(dir), 'not json');
  assert.notEqual(integrationToken(dir, ''), first, 'an unreadable file gets a new one');
  assert.ok(tokenMatches(first, first));
  assert.ok(!tokenMatches('', first) && !tokenMatches(first.slice(1), first) && !tokenMatches(`${first}x`, first));
});

test('401 without the token or with a wrong one, and nothing is told', async (t) => {
  const a = floor('app', [worker('mochi')], ['mochi']);
  const { call } = await serve(t, { floors: () => [a.floor] });
  assert.equal((await call('GET', '/integrations/workers', undefined, null)).status, 401);
  assert.equal((await call('GET', '/integrations/workers', undefined, 'wrong')).status, 401);
  const tell = await call('POST', '/integrations/tell', { worker: 'Mochi', prompt: 'hi' }, 'wrong');
  assert.equal(tell.status, 401);
  assert.doesNotMatch(JSON.stringify(tell.body), new RegExp(TOKEN), 'the token is never in a response');
  assert.equal(a.prompted.length + a.resumed.length, 0);
});

test('lists the first floor by default, another by name, id or repo, and names the floors', async (t) => {
  const a = floor('app', [worker('mochi'), worker('shell', { kind: 'shell' })]);
  const b = floor('site', [worker('biscuit')]);
  const { call } = await serve(t, { floors: () => [a.floor, b.floor] });
  const first = await call('GET', '/integrations/workers');
  assert.equal(first.status, 200);
  assert.equal(first.body.floor.id, 'app');
  assert.deepEqual(first.body.floors.map((f: { id: string }) => f.id), ['app', 'site']);
  assert.deepEqual(first.body.workers.map((w: { name: string }) => w.name), ['Mochi', 'Shell']);
  for (const key of ['site', 'SITE', 'acme/site']) {
    const other = await call('GET', `/integrations/workers?floor=${encodeURIComponent(key)}`);
    assert.deepEqual(other.body.workers.map((w: { name: string }) => w.name), ['Biscuit'], key);
  }
  const none = await call('GET', '/integrations/workers?floor=nowhere');
  assert.equal(none.status, 404);
  assert.equal(none.body.floors.length, 2, 'says which floors there are');
  assert.equal(pickFloor([], ''), 'The office has no floors open');
});

test('tells a running agent as the integration, wakes a stopped one with the prompt, and normalizes it', async (t) => {
  const a = floor('app', [worker('mochi'), worker('pancake')], ['mochi']);
  const b = floor('site', [worker('biscuit')], ['biscuit']);
  const { call, toasts } = await serve(t, { floors: () => [a.floor, b.floor] });
  const told = await call('POST', '/integrations/tell', { worker: 'mochi', prompt: '  line one\r\nline two\r  ' });
  assert.equal(told.status, 200);
  assert.equal(told.body.resumed, false);
  assert.equal(told.body.worker.name, 'Mochi');
  assert.deepEqual(a.prompted, [{ id: 'mochi', text: 'line one\nline two', by: 'n8n' }]);
  const woke = await call('POST', '/integrations/tell', { worker: 'Pancake', prompt: 'get going' });
  assert.equal(woke.body.resumed, true);
  assert.deepEqual(a.resumed, [{ id: 'pancake', text: 'get going' }]);
  assert.ok(toasts.every((s) => s.includes('n8n')) && toasts.length === 2, 'the floor hears it was the integration');
  const there = await call('POST', '/integrations/tell', { floor: 'site', worker: 'Biscuit', prompt: 'hello' });
  assert.equal(there.status, 200);
  assert.equal(b.prompted[0].id, 'biscuit');
  assert.equal((await call('POST', '/integrations/tell', { floor: 'nowhere', worker: 'Biscuit', prompt: 'x' })).status, 404);
});

test('refuses a shell, an unknown worker, an empty or too long prompt, bad JSON and anything else', async (t) => {
  const a = floor('app', [worker('mochi'), worker('shell', { kind: 'shell', name: 'Shell 🐚' })], ['mochi', 'shell']);
  const { call } = await serve(t, { floors: () => [a.floor] });
  const shell = await call('POST', '/integrations/tell', { worker: 'Shell', prompt: 'rm -rf /' });
  assert.equal(shell.status, 400);
  assert.match(shell.body.error, /is a shell, not an agent/);
  assert.equal((await call('POST', '/integrations/tell', { worker: 'nobody', prompt: 'x' })).status, 404);
  assert.equal((await call('POST', '/integrations/tell', { worker: 'mochi', prompt: '   ' })).status, 400);
  assert.equal((await call('POST', '/integrations/tell', { worker: 'mochi', prompt: 'x'.repeat(PROMPT_MAX + 1) })).status, 400);
  assert.equal((await call('POST', '/integrations/tell', '{nope')).status, 400);
  assert.equal((await call('GET', '/integrations/tell')).status, 405);
  // No hiring or sending home through it.
  assert.equal((await call('POST', '/integrations/workers', { prompt: 'x' })).status, 405);
  assert.equal((await call('POST', '/integrations/home', { workers: ['mochi'] })).status, 404);
  assert.deepEqual(a.prompted, []);
});

test('caps requests a minute, and answers only loopback', async (t) => {
  let now = 1_000_000;
  const a = floor('app', [worker('mochi')]);
  const { call } = await serve(t, { floors: () => [a.floor], now: () => now });
  for (let i = 0; i < RATE_PER_MINUTE; i++) assert.equal((await call('GET', '/integrations/workers', undefined, i % 2 ? 'wrong' : TOKEN)).status, i % 2 ? 401 : 200);
  const over = await call('GET', '/integrations/workers');
  assert.equal(over.status, 429);
  now += 60_000;
  assert.equal((await call('GET', '/integrations/workers')).status, 200, 'a minute later it answers again');

  let status = 0;
  const handler = integrationApi({ floors: () => [a.floor], pullsOf: () => undefined, toast: () => {}, token: TOKEN, name: 'n8n' });
  const res = { writeHead: (s: number) => (status = s), end: () => {} } as unknown as http.ServerResponse;
  await handler({ socket: { remoteAddress: '203.0.113.9' }, headers: { authorization: `Bearer ${TOKEN}` }, url: '/integrations/workers', method: 'GET' } as unknown as http.IncomingMessage, res);
  assert.equal(status, 403);
});
