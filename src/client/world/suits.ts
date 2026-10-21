import * as THREE from 'three';
import { BRAND } from '../../shared/brand';
import { BEAN, stick } from './costumes';
import { mesh, toon } from './toon';

// The corporate theme's office wear (see shared/brand.ts): a worker's navy suit jacket over the bottom
// of its bean, with a white shirt and a tie in the company blue showing at the front. A person's suit
// is in character/person-outfit.ts, with the holidays' outfits.

/** The suit's navy, and the shirt's white. */
export const SUIT = '#1c2b45';
export const SHIRT = '#f4f6f9';

/** The bean's radius at height `y` (see BEAN). */
function beanRadius(y: number): number {
  const dy = Math.max(0, BEAN.y - BEAN.half - y, y - BEAN.y - BEAN.half);
  return Math.sqrt(Math.max(0, BEAN.r * BEAN.r - dy * dy));
}

/** A worker's suit: a jacket hugging the bottom of the bean up to its middle, its shirt and tie at the front. */
export function workerSuit(): THREE.Group {
  const g = new THREE.Group();
  // Turned round the bean's profile, a little out from it, from just above the feet to below the mouth.
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const y = 0.15 + (i / 12) * 0.31;
    profile.push(new THREE.Vector2(beanRadius(y) + 0.012, y));
  }
  g.add(mesh(new THREE.LatheGeometry(profile, 32), toon(SUIT)));
  // The shirt's V at the collar, then the tie down over it: a knot and a blade.
  const shirt = new THREE.Shape([new THREE.Vector2(-0.085, 0.06), new THREE.Vector2(0.085, 0.06), new THREE.Vector2(0, -0.12)]);
  g.add(stick(mesh(new THREE.ShapeGeometry(shirt), toon(SHIRT), 0, 0, 0, false), 0.4, 0, 0.016));
  g.add(stick(mesh(new THREE.BoxGeometry(0.04, 0.035, 0.02), toon(BRAND.blue), 0, 0, 0, false), 0.445, 0, 0.022));
  const blade = new THREE.Shape([new THREE.Vector2(-0.018, 0), new THREE.Vector2(0.018, 0), new THREE.Vector2(0.028, -0.12), new THREE.Vector2(0, -0.15), new THREE.Vector2(-0.028, -0.12)]);
  g.add(stick(mesh(new THREE.ShapeGeometry(blade), toon(BRAND.blue), 0, 0, 0, false), 0.43, 0, 0.022));
  return g;
}
