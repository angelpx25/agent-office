import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Themes } from '../src/server/theme.js';
import { THEME_PICKS, activeTheme, isThemePick } from '../src/shared/theme.js';

const OCT = Date.UTC(2026, 9, 21);
const JUNE = Date.UTC(2026, 5, 21);

test('the corporate look is a pick, and the calendar only ever puts up a holiday', () => {
  assert.ok(isThemePick('corporate'));
  assert.equal(THEME_PICKS[0], 'corporate');
  assert.equal(activeTheme('corporate', OCT, 0), 'corporate');
  assert.equal(activeTheme('auto', OCT, 0), 'halloween');
  assert.equal(activeTheme('auto', JUNE, 0), null);
  assert.equal(activeTheme('off', JUNE, 0), null);
});

test('a building nobody has picked a theme for wears the corporate look, and a saved pick still wins', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'office-theme-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.deepEqual(new Themes(dir, () => 0, () => {}).state(), { pick: 'corporate', active: 'corporate' });
  writeFileSync(path.join(dir, 'theme.json'), JSON.stringify({ pick: 'christmas', by: 'Eve', at: 1 }));
  assert.equal(new Themes(dir, () => 0, () => {}).state().pick, 'christmas');
});
