/**
 * The company's own: DELTANET SERVICES on the north wall and on the front of the building, and the
 * corporate theme (⚙️ Settings → Theme), which puts its services, a server rack and its logo round the
 * office, paints every floor in its colors (see paintFloor in core/maps.ts), suits everyone up
 * (world/suits.ts) and gives every window a calmer, sharper look (ui.css).
 */
import type * as THREE from 'three';
import type { Ctx } from '../../core/context';
import { noOutline } from '../../core/outline';
import { store } from '../../state';
import { Brand } from './world';
import './ui.css';

export interface BrandDeps {
  /** The holiday decorations' group: up in the office, down on the roof and on other maps (see core/maps.ts). */
  decorations: THREE.Group;
}

export function installBrand(ctx: Ctx, deps: BrandDeps) {
  const brand = new Brand(ctx.office);
  noOutline(brand.group);
  deps.decorations.add(brand.group);
  ctx.ticks.add('env', ({ t }) => brand.update(t));

  const dress = () => {
    const theme = store.theme.active;
    brand.set(theme);
    if (theme === 'corporate') document.documentElement.dataset.theme = 'corporate';
    else delete document.documentElement.dataset.theme;
  };
  store.on('theme', dress);
  dress();
  return brand;
}
