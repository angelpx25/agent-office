// The integration API's requests (see index.ts for where it listens): outside automation lists a
// floor's workers and tells one of them something, as the office-workers command does for a worker,
// on a token of its own. It can't hire anyone or send anyone home.
import type http from 'node:http';
import type { Floor } from '../floor.js';
import { findWorker, workerRow, type PullsView } from '../office-workers.js';
import { str } from '../office/input.js';
import { readBody, send } from '../http/util.js';
import type { GhPull } from '../../shared/protocol.js';
import { tokenMatches } from './token.js';

/** What the API needs of a floor. */
export type IntegrationFloor = Pick<Floor, 'id' | 'def' | 'project' | 'workers' | 'github' | 'queue'>;

export interface IntegrationDeps {
  /** The open floors, the first of them the one a request that names none is about. */
  floors(): IntegrationFloor[];
  /** Another floor's pull requests, for a worker across repositories. */
  pullsOf(floorId: string): GhPull[] | undefined;
  /** Tells everyone on the floor what was done there. */
  toast(floor: IntegrationFloor, text: string): void;
  token: string;
  /** Who the prompts are from, as the office shows it ("n8n"). */
  name: string;
  now?: () => number;
}

/** The longest prompt it takes, as the office-workers command does. */
export const PROMPT_MAX = 20_000;
/** The most a request body may be: a prompt of PROMPT_MAX characters, escaped, and room to spare. */
export const BODY_MAX = 256 * 1024;
/** How many requests it answers a minute, all callers together, bad tokens included. */
export const RATE_PER_MINUTE = 60;

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** The floor `key` names (its id, name or owner/repo), the first floor when it names none, or why there's none. */
export function pickFloor(floors: IntegrationFloor[], key: string): IntegrationFloor | string {
  if (!floors.length) return 'The office has no floors open';
  const k = key.trim().toLowerCase();
  if (!k) return floors[0];
  return floors.find((f) => [f.id, f.def.name, f.def.repo].some((n) => n?.toLowerCase() === k)) ?? `No floor called ${key.trim()}`;
}

export function integrationApi(deps: IntegrationDeps): http.RequestListener {
  const now = deps.now ?? Date.now;
  let window = 0;
  let used = 0;
  const floorList = () => deps.floors().map((f) => ({ id: f.id, name: f.def.name, repo: f.def.repo }));
  const rows = (floor: IntegrationFloor) => {
    const view: PullsView = { pulls: floor.github.pulls.items, tasks: floor.queue.state().tasks, pullsOf: deps.pullsOf };
    return (id: string) => {
      const w = floor.workers.get(id);
      return w && workerRow(w, view);
    };
  };
  const noFloor = (res: http.ServerResponse, why: string) => send(res, 404, { error: why, floors: floorList() });

  return async (req, res) => {
    // It listens on loopback alone; this is so it stays that way if it's ever put behind something else.
    if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) return send(res, 403, { error: 'Only from this machine' });
    const t = now();
    if (t - window >= 60_000) {
      window = t;
      used = 0;
    }
    if (++used > RATE_PER_MINUTE) return send(res, 429, { error: 'Too many requests: try again in a minute' }, { 'retry-after': String(Math.ceil((window + 60_000 - t) / 1000)) });
    const given = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!tokenMatches(given, deps.token)) return send(res, 401, { error: 'Send the integration token as Authorization: Bearer <token>' });
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://127.0.0.1');
    } catch {
      return send(res, 400, { error: 'Bad address' });
    }

    if (url.pathname === '/integrations/workers') {
      if (req.method !== 'GET') return send(res, 405, { error: 'GET /integrations/workers' });
      const floor = pickFloor(deps.floors(), url.searchParams.get('floor') ?? '');
      if (typeof floor === 'string') return noFloor(res, floor);
      const row = rows(floor);
      return send(res, 200, {
        floor: { id: floor.id, name: floor.def.name, repo: floor.def.repo, branch: floor.project.branch },
        floors: floorList(),
        workers: floor.workers.list().map((w) => row(w.id)),
      });
    }

    if (url.pathname !== '/integrations/tell') return send(res, 404, { error: 'GET /integrations/workers, or POST /integrations/tell' });
    if (req.method !== 'POST') return send(res, 405, { error: 'POST /integrations/tell' });
    let body: unknown;
    try {
      body = JSON.parse((await readBody(req, BODY_MAX)) || '{}');
    } catch (err) {
      return (err as Error).message === 'too large' ? send(res, 413, { error: `Keep it under ${BODY_MAX} bytes` }) : send(res, 400, { error: 'Send JSON' });
    }
    const b = (body ?? {}) as { floor?: unknown; worker?: unknown; prompt?: unknown };
    const floor = pickFloor(deps.floors(), str(b.floor, 200));
    if (typeof floor === 'string') return noFloor(res, floor);
    const w = findWorker(floor.workers.list(), str(b.worker, 64));
    if (typeof w === 'string') return send(res, 404, { error: w });
    // A shell would run it as a command, in someone's terminal.
    if (w.kind !== 'agent') return send(res, 400, { error: `${w.name} is a shell, not an agent` });
    const text = (typeof b.prompt === 'string' ? b.prompt : '').replace(/\r\n?/g, '\n').trim();
    if (!text) return send(res, 400, { error: 'Say what to tell it: prompt' });
    if (text.length > PROMPT_MAX) return send(res, 400, { error: `Keep the prompt under ${PROMPT_MAX} characters` });
    let err = floor.workers.prompt(w.id, text, deps.name);
    // Stopped or asleep: it wakes up with this as its next message.
    const resumed = err === 'Worker is not running';
    if (resumed) err = floor.workers.resume(w.id, text);
    if (err) return send(res, 400, { error: err });
    deps.toast(floor, `🔗 ${deps.name} ${resumed ? 'woke' : 'told'} ${w.name} ${resumed ? 'up with a prompt' : 'something'}`);
    return send(res, 200, { ok: true, resumed, floor: { id: floor.id, name: floor.def.name }, worker: rows(floor)(w.id) });
  };
}
