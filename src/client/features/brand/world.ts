import * as THREE from 'three';
import { BRAND } from '../../../shared/brand';
import { BOARDS, ELEVATOR, ELEVATOR_FRONT, FLOOR, MACHINE_MONITOR, MEETING_ROOM, WALL_HEIGHT, WALL_T } from '../../../shared/layout';
import type { Theme } from '../../../shared/protocol';
import { mergeByMaterial, mesh, toon } from '../../world/toon';
import type { Collider, Office } from '../../world/types';
import { banner, frostedLogo, nameSign, servicePanel, welcomeMat } from './signs';

/*
 * The company's name on the building, and its corporate look. Always up: DELTANET SERVICES across the
 * north wall over the boards, and outside on the south wall over the balcony, facing the street. Under
 * the corporate theme: what the company does on a banner along the south wall and a panel per service
 * along the west wall, a server rack under the machine's monitor, the logo frosted onto the meeting
 * room's glass and a welcome mat in front of the elevator.
 */

const FACE = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 } as const;
/** A little off the wall, so a sign doesn't flicker into it. */
const OFF = 0.07;

/** The name on the outside of the south wall, facing the street: over the balcony, clear of the loft's window. */
const FACADE = { x: -4, y: 4.9, width: 9 } as const;
/** The server rack: a half-height one against the west wall under the machine's monitor, facing into the room. */
const RACK = { x: FLOOR.minX + 0.45, z: MACHINE_MONITOR.z, width: 0.7, depth: 0.9, height: MACHINE_MONITOR.y - MACHINE_MONITOR.height / 2 - 0.15 } as const;

/** The rack's lights: two greens for the disks, a cyan for the network and an amber. */
const LEDS = ['#38e07b', '#38e07b', '#22c3e6', '#ffb020'] as const;

/** Puts `o` at (x, y, z) turned to face `rotY`, and hands it back. */
function place<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rotY: number): T {
  o.position.set(x, y, z);
  o.rotation.y = rotY;
  return o;
}

/** A rack: a dark cabinet with a smoked glass door over a stack of servers, each with its row of lights. */
function rack(leds: THREE.MeshBasicMaterial[]): THREE.Group {
  const { width: w, depth: d, height: h } = RACK;
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, h, d), toon('#1d2330'), 0, h / 2, 0));
  const units = new THREE.Group();
  const face = toon('#3a4252');
  const vent = toon('#262c38');
  const n = Math.floor((h - 0.3) / 0.13);
  for (let i = 0; i < n; i++) {
    const y = 0.18 + i * ((h - 0.3) / n);
    units.add(mesh(new THREE.BoxGeometry(w - 0.1, 0.1, 0.02), i % 4 === 3 ? vent : face, 0, y, d / 2 + 0.005, false));
    for (let k = 0; k < 3; k++) units.add(mesh(new THREE.BoxGeometry(0.022, 0.022, 0.01), leds[(i * 3 + k * 5) % leds.length], w / 2 - 0.1 - k * 0.04, y, d / 2 + 0.02, false));
  }
  g.add(mergeByMaterial(units));
  // The smoked glass door over the front, and the company's name along the top.
  const glass = new THREE.MeshBasicMaterial({ color: '#0a1a2e', transparent: true, opacity: 0.28, depthWrite: false });
  g.add(mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.1), glass, 0, h / 2, d / 2 + 0.03, false));
  const label = banner(BRAND.short, w - 0.08, 0.12);
  label.position.set(0, h - 0.09, d / 2 + 0.035);
  g.add(label);
  return g;
}

export class Brand {
  /** Everything here: put in the holiday decorations' group, so it's up wherever they are (in the office, not on the roof). */
  readonly group = new THREE.Group();
  private corporate = new THREE.Group();
  private leds: THREE.MeshBasicMaterial[];
  private rackCollider: Collider;
  private on = false;

  constructor(private office: Office) {
    this.group.add(this.corporate);
    this.corporate.visible = false;

    // ---- Always up: the name over the boards, and on the front of the building ----
    // Over the middle board, clear of the boards' names above them and of the ceiling.
    const w = 10;
    this.group.add(place(nameSign(w), BOARDS.queue.x, WALL_HEIGHT - 0.6 - w / 10, FLOOR.minZ + OFF, FACE.south));
    this.group.add(place(nameSign(FACADE.width), FACADE.x, FACADE.y, FLOOR.maxZ + WALL_T + OFF, FACE.south));

    // ---- The corporate look ----
    const c = this.corporate;
    // What the company does, along the south wall over the windows (the loft takes its east end).
    const south = { from: FLOOR.minX + 1, to: MEETING_ROOM.minX - 0.6 };
    const line = BRAND.services.map((s) => s.title).join('  ·  ');
    c.add(place(banner(line, south.to - south.from, 0.75), (south.from + south.to) / 2, 4.55, FLOOR.maxZ - OFF, FACE.north));
    // A panel per service along the west wall, over the windows, the exit door and the hoop's backboard.
    BRAND.services.forEach((_, i) => c.add(place(servicePanel(i, 2.2, 1.5), FLOOR.minX + OFF, 4.8, -9 + i * 6, FACE.east)));
    // The logo frosted on the meeting room's glass, by its door.
    c.add(place(frostedLogo(1.8), MEETING_ROOM.minX - 0.08, 1.45, (MEETING_ROOM.minZ + MEETING_ROOM.maxZ) / 2 + 0.6, FACE.west));
    // The welcome mat in front of the elevator.
    const mat = welcomeMat(2.4);
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(ELEVATOR.x, 0.012, ELEVATOR_FRONT + 0.85);
    c.add(mat);
    // The server rack, its lights blinking away (see update).
    this.leds = LEDS.map((color) => new THREE.MeshBasicMaterial({ color }));
    c.add(place(rack(this.leds), RACK.x, 0, RACK.z, FACE.east));
    const r = { x: RACK.depth / 2 + 0.03, z: RACK.width / 2 + 0.03 };
    this.rackCollider = { minX: RACK.x - r.x, maxX: RACK.x + r.x, minZ: RACK.z - r.z, maxZ: RACK.z + r.z, bottom: 0, top: RACK.height };
  }

  /** Puts the corporate look up for 'corporate', or takes it down. The name stays up either way. */
  set(theme: Theme | null) {
    const on = theme === 'corporate';
    if (on === this.on) return;
    this.on = on;
    this.corporate.visible = on;
    const colliders = this.office.colliders;
    if (on) colliders.push(this.rackCollider);
    else colliders.splice(colliders.indexOf(this.rackCollider), 1);
  }

  update(t: number) {
    if (!this.on) return;
    // Disk and network lights: each colour flickers at its own pace, now and then going dark.
    this.leds.forEach((m, i) => {
      const lit = Math.sin(t * (3 + i * 2.3) + i * 1.7) + Math.sin(t * (7.1 + i)) * 0.6 > -0.4;
      m.color.set(lit ? LEDS[i] : '#14301f');
    });
  }
}
