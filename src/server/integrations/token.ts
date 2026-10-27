// The integration API's token: one of its own, never a worker's, so outside automation (n8n, a
// script) doesn't have to borrow a worker's hook token, which goes when the worker does.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Where the token is kept, in the office's data folder, readable by its user alone. */
export const tokenFile = (dataDir: string) => path.join(dataDir, 'integrations.json');

/**
 * The token callers send as `Authorization: Bearer <token>`: AGENT_OFFICE_INTEGRATION_TOKEN when it's
 * set, else the one in integrations.json, made the first time and kept from then on.
 */
export function integrationToken(dataDir: string, fromEnv = process.env.AGENT_OFFICE_INTEGRATION_TOKEN): string {
  if (fromEnv?.trim()) return fromEnv.trim();
  const file = tokenFile(dataDir);
  try {
    const { token } = JSON.parse(readFileSync(file, 'utf8')) as { token?: unknown };
    if (typeof token === 'string' && token.length >= 16) {
      // Kept to its owner, even if someone loosened it.
      chmodSync(file, 0o600);
      return token;
    }
  } catch {
    // first start, or unreadable: a new one
  }
  const token = randomBytes(32).toString('base64url');
  writeFileSync(file, `${JSON.stringify({ token }, null, 2)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return token;
}

/** Whether `given` is the token, in time that doesn't depend on how much of it matches. */
export function tokenMatches(given: string, token: string): boolean {
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return !!given && timingSafeEqual(digest(given), digest(token));
}
