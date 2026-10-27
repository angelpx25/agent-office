// The integration API: a small HTTP server of its own, on loopback only (never the office's public
// listener), for automation running on the same machine (n8n, a cron job) to list workers and tell
// one something. Off unless the office is started with --integrations or --integration-port.
import http from 'node:http';
import type { Ctx } from '../office/context.js';
import { integrationApi } from './api.js';
import { integrationToken, tokenFile } from './token.js';

export interface Integrations {
  stop(): void;
}

export function startIntegrations(ctx: Ctx): Integrations {
  const { cfg } = ctx;
  const port = cfg.integrationPort;
  if (port === undefined) return { stop() {} };
  const fromEnv = !!process.env.AGENT_OFFICE_INTEGRATION_TOKEN?.trim();
  const server = http.createServer(
    integrationApi({
      floors: () => [...ctx.floors.values()],
      pullsOf: (id) => ctx.floors.get(id)?.github.pulls.items,
      toast: (f, text) => ctx.toastFloor(ctx.floors.get(f.id), text),
      token: integrationToken(cfg.dataDir),
      name: cfg.integrationName,
    }),
  );
  // A port that's taken leaves the office running without it, and says so.
  server.on('error', (err) => console.error(`agent-office: the integration API couldn't listen on 127.0.0.1:${port}: ${err.message}`));
  server.listen(port, '127.0.0.1', () => {
    console.log(`  🔗 integration API: http://127.0.0.1:${port}/integrations (token ${fromEnv ? 'from AGENT_OFFICE_INTEGRATION_TOKEN' : `in ${tokenFile(cfg.dataDir)}`})`);
  });
  return { stop: () => server.close() };
}
