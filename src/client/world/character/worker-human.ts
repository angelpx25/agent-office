import * as THREE from 'three';
import { HAIR_COLORS, SKIN_TONES } from '../../../shared/avatar';
import { BEAN } from '../costumes';
import { mesh, toon, toonUnique } from '../toon';

// A worker as a little person, keeping the bean's shape (so its costumes, dances and cell still fit):
// its top is a face in a human skin tone, with hair, brows, a nose and a smile, and its bottom is its
// clothes in its own color. Which skin tone, hair color and hairdo is picked from its name and color,
// so a worker looks the same every time and to everyone.

/** Where the face ends and the clothes start, up the bean. */
const NECK = 0.5;
/** Hair colors that look like hair: the dark, brown, blonde, ginger and silver of the avatars' ones. */
const HAIR = HAIR_COLORS.slice(0, 6);
type Hairdo = 'short' | 'bun' | 'spiky' | 'long' | 'curly' | 'bald';
/** Short hair the most, bald the least. */
const HAIRDOS: Hairdo[] = ['short', 'short', 'short', 'long', 'long', 'bun', 'spiky', 'curly', 'curly', 'bald'];

/** The bean's radius at height `y` (see BEAN). */
function radius(y: number): number {
  const dy = Math.max(0, BEAN.y - BEAN.half - y, y - BEAN.y - BEAN.half);
  return Math.sqrt(Math.max(0, BEAN.r * BEAN.r - dy * dy));
}

/** The bean from `y0` to `y1`, turned round its profile. */
function band(y0: number, y1: number, mat: THREE.Material): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const y = y0 + ((y1 - y0) * i) / 16;
    pts.push(new THREE.Vector2(radius(y), y));
  }
  return mesh(new THREE.LatheGeometry(pts, 32), mat);
}

/** A number from `seed` that's the same every time. */
function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Its hair: a cap over the top of the head, swept up off the forehead, and whatever the hairdo adds. */
function hair(style: Hairdo, mat: THREE.MeshToonMaterial): THREE.Group {
  const g = new THREE.Group();
  if (style === 'bald') return g;
  const top = BEAN.y + BEAN.half;
  const cap = mesh(new THREE.SphereGeometry(BEAN.r + 0.02, 24, 12, 0, Math.PI * 2, 0, 1.3), mat, 0, top, 0);
  cap.rotation.x = -0.25;
  g.add(cap);
  if (style === 'bun') g.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), mat, 0, top + 0.28, -0.14));
  if (style === 'spiky') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.05, 0.14, 6), mat, Math.sin(a) * 0.14, top + 0.25, Math.cos(a) * 0.14 - 0.03, false);
      spike.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
      g.add(spike);
    }
  }
  if (style === 'long') {
    // Down the back of the head to the shoulders.
    const back = toonUnique(mat.color);
    back.side = THREE.DoubleSide;
    g.add(mesh(new THREE.CylinderGeometry(BEAN.r + 0.02, BEAN.r + 0.03, 0.3, 20, 1, true, Math.PI / 2, Math.PI), back, 0, NECK + 0.17, 0));
  }
  if (style === 'curly') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tilt = i % 2 ? 0.7 : 1.05;
      g.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), mat, Math.sin(a) * Math.sin(tilt) * 0.29, top + Math.cos(tilt) * 0.29, Math.cos(a) * Math.sin(tilt) * 0.29 - 0.03, false));
    }
  }
  return g;
}

/**
 * Puts a person's head and clothes on a worker's body: `clothes` (its own color, which a costume or a
 * cell changes) below the neck and a face above it. Hands back the face's material, for its hands, and
 * its hair, which a hat or a coif goes on in place of.
 */
export function humanBody(body: THREE.Group, clothes: THREE.Material, seed: string): { face: THREE.MeshToonMaterial; hair: THREE.Group } {
  const h = hash(seed);
  const face = toonUnique(SKIN_TONES[h % SKIN_TONES.length]);
  const locks = toon(HAIR[(h >>> 4) % HAIR.length]);
  body.add(band(BEAN.y - BEAN.half - BEAN.r, NECK, clothes), band(NECK, BEAN.y + BEAN.half + BEAN.r, face));
  // A neckline, a nose, a smile and brows.
  const collar = mesh(new THREE.TorusGeometry(radius(NECK) + 0.004, 0.018, 6, 32), clothes, 0, NECK, 0, false);
  collar.rotation.x = Math.PI / 2;
  body.add(collar);
  const nose = toonUnique(face.color.clone().multiplyScalar(0.9));
  body.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), nose, 0, 0.635, radius(0.635) + 0.008, false));
  const smile = mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI), toon('#7a3b2e'), 0, 0.575, radius(0.575) - 0.004, false);
  smile.rotation.z = Math.PI;
  body.add(smile);
  for (const sx of [-1, 1]) {
    const brow = mesh(new THREE.BoxGeometry(0.08, 0.018, 0.02), locks, sx * 0.11, 0.79, radius(0.79) + 0.002, false);
    brow.rotation.z = sx * -0.12;
    body.add(brow);
  }
  const top = hair(HAIRDOS[(h >>> 9) % HAIRDOS.length], locks);
  body.add(top);
  return { face, hair: top };
}
