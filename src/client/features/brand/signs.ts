import * as THREE from 'three';
import { BRAND } from '../../../shared/brand';

// The company's signs, drawn on canvases: the name sign with its logo, the banner of what it does,
// a panel per service, the welcome mat and the frosted logo on the meeting room's glass. Each is a
// flat plane facing +z, unlit (MeshBasicMaterial), so it reads the same by day and by night.

/** The signs' lettering: a plain, sharp sans that every computer has, rather than the office's rounded one. */
const SANS = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
/** How many canvas pixels make a metre. */
const PX = 200;

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/** A `w` by `h` metre plane facing +z, painted by `draw` on a canvas of the same shape. */
function sign(w: number, h: number, draw: Draw, transparent = false): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * PX);
  canvas.height = Math.round(h * PX);
  draw(canvas.getContext('2d')!, canvas.width, canvas.height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map, transparent, depthWrite: !transparent });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

/** Text with its letters spread `spacing` px apart, centered on x when `align` is 'center'. */
function spaced(g: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'left' | 'center' = 'left'): number {
  const widths = [...text].map((c) => g.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let at = align === 'center' ? x - total / 2 : x;
  g.textAlign = 'left';
  [...text].forEach((c, i) => {
    g.fillText(c, at, y);
    at += widths[i];
  });
  return total;
}

/**
 * The logo: a delta, blue to cyan, hollow in the middle, with a network's three nodes at its corners.
 * The hollow is painted `hole`, or cut out to see through when that's null.
 */
export function drawLogo(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, hole: string | null = BRAND.navy) {
  const r = size / 2;
  const pts = [0, 1, 2].map((i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    return [cx + Math.cos(a) * r, cy + r * 0.18 + Math.sin(a) * r] as const;
  });
  const grad = g.createLinearGradient(cx - r, cy + r, cx + r, cy - r);
  grad.addColorStop(0, BRAND.blue);
  grad.addColorStop(1, BRAND.cyan);
  g.fillStyle = grad;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
  g.save();
  if (hole) g.fillStyle = hole;
  else g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const ix = cx + (x - cx) * 0.42;
    const iy = cy + r * 0.18 + (y - cy - r * 0.18) * 0.42;
    if (i) g.lineTo(ix, iy);
    else g.moveTo(ix, iy);
  });
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = '#ffffff';
  for (const [x, y] of pts) {
    g.beginPath();
    g.arc(x, y, size * 0.07, 0, Math.PI * 2);
    g.fill();
  }
}

/** A rounded rectangle path. */
function rounded(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** The name sign: the logo, DELTANET SERVICES and the tagline, white on navy with a cyan rule. `w` by `w`/5 metres. */
export function nameSign(w: number): THREE.Mesh {
  return sign(w, w / 5, (g, cw, ch) => {
    rounded(g, 0, 0, cw, ch, ch * 0.08);
    g.fillStyle = BRAND.navy;
    g.fill();
    g.fillStyle = BRAND.cyan;
    g.fillRect(ch * 0.12, ch * 0.88, cw - ch * 0.24, ch * 0.025);
    drawLogo(g, ch * 0.55, ch * 0.44, ch * 0.62);
    // The first word bold and the rest light, as big as fits between the logo and the right edge.
    const [first, ...rest] = BRAND.name.split(' ');
    const words = [first, ` ${rest.join(' ')}`];
    const weights = [800, 300];
    const left = ch * 1.05;
    const room = cw - left - ch * 0.2;
    const widthAt = (size: number) =>
      words.reduce((sum, word, i) => {
        g.font = `${weights[i]} ${size}px ${SANS}`;
        return sum + [...word].reduce((a, c) => a + g.measureText(c).width + size * 0.07, 0);
      }, 0);
    const size = Math.min(ch * 0.42, (ch * 0.42 * room) / widthAt(ch * 0.42));
    g.textBaseline = 'alphabetic';
    let at = left;
    words.forEach((word, i) => {
      g.font = `${weights[i]} ${size}px ${SANS}`;
      g.fillStyle = i ? '#cfe8ff' : '#ffffff';
      at += spaced(g, word, at, ch * 0.6, size * 0.07) + size * 0.07;
    });
    g.font = `600 ${ch * 0.12}px ${SANS}`;
    g.fillStyle = BRAND.cyan;
    spaced(g, BRAND.tagline.toUpperCase(), left + ch * 0.02, ch * 0.79, ch * 0.025);
  });
}

/** One line of what the company does, spread across a navy band `w` by `h` metres. */
export function banner(text: string, w: number, h: number): THREE.Mesh {
  return sign(w, h, (g, cw, ch) => {
    g.fillStyle = BRAND.navy;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = BRAND.cyan;
    g.fillRect(0, ch * 0.9, cw, ch * 0.1);
    drawLogo(g, ch * 0.6, ch * 0.47, ch * 0.62);
    g.font = `600 ${ch * 0.36}px ${SANS}`;
    g.fillStyle = '#ffffff';
    g.textBaseline = 'middle';
    spaced(g, text.toUpperCase(), cw / 2 + ch * 0.4, ch * 0.47, ch * 0.06, 'center');
  });
}

/** The little line drawings on the service panels, in a `s` px box centered on (x, y). */
const ICONS: ((g: CanvasRenderingContext2D, x: number, y: number, s: number) => void)[] = [
  // Managed IT: a monitor on its stand.
  (g, x, y, s) => {
    g.strokeRect(x - s * 0.45, y - s * 0.38, s * 0.9, s * 0.58);
    g.beginPath();
    g.moveTo(x, y + s * 0.2);
    g.lineTo(x, y + s * 0.38);
    g.moveTo(x - s * 0.25, y + s * 0.4);
    g.lineTo(x + s * 0.25, y + s * 0.4);
    g.stroke();
  },
  // Software development: </>.
  (g, x, y, s) => {
    g.beginPath();
    g.moveTo(x - s * 0.2, y - s * 0.3);
    g.lineTo(x - s * 0.45, y);
    g.lineTo(x - s * 0.2, y + s * 0.3);
    g.moveTo(x + s * 0.2, y - s * 0.3);
    g.lineTo(x + s * 0.45, y);
    g.lineTo(x + s * 0.2, y + s * 0.3);
    g.moveTo(x + s * 0.08, y - s * 0.38);
    g.lineTo(x - s * 0.08, y + s * 0.38);
    g.stroke();
  },
  // Cloud & DevOps: a cloud.
  (g, x, y, s) => {
    g.beginPath();
    g.moveTo(x - s * 0.3, y + s * 0.25);
    g.arc(x - s * 0.28, y + s * 0.05, s * 0.2, Math.PI / 2, Math.PI * 1.5);
    g.arc(x, y - s * 0.12, s * 0.25, Math.PI, 0);
    g.arc(x + s * 0.28, y + s * 0.05, s * 0.2, -Math.PI / 2, Math.PI / 2);
    g.closePath();
    g.stroke();
  },
  // Cybersecurity: a shield with a tick.
  (g, x, y, s) => {
    g.beginPath();
    g.moveTo(x, y - s * 0.42);
    g.lineTo(x + s * 0.36, y - s * 0.28);
    g.quadraticCurveTo(x + s * 0.36, y + s * 0.25, x, y + s * 0.44);
    g.quadraticCurveTo(x - s * 0.36, y + s * 0.25, x - s * 0.36, y - s * 0.28);
    g.closePath();
    g.moveTo(x - s * 0.14, y);
    g.lineTo(x - s * 0.03, y + s * 0.12);
    g.lineTo(x + s * 0.17, y - s * 0.12);
    g.stroke();
  },
];

/** A panel for one of the company's services: its icon, its title and a line under it, `w` by `h` metres. */
export function servicePanel(i: number, w: number, h: number): THREE.Mesh {
  const { title, body } = BRAND.services[i];
  return sign(w, h, (g, cw, ch) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = BRAND.navy;
    g.fillRect(0, 0, ch * 0.06, ch);
    g.strokeStyle = BRAND.blue;
    g.lineWidth = ch * 0.035;
    g.lineCap = g.lineJoin = 'round';
    ICONS[i % ICONS.length](g, cw / 2, ch * 0.3, ch * 0.32);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = BRAND.navy;
    g.font = `700 ${ch * 0.12}px ${SANS}`;
    g.fillText(title, cw / 2, ch * 0.62, cw * 0.9);
    g.fillStyle = '#5b6b80';
    g.font = `500 ${ch * 0.075}px ${SANS}`;
    g.fillText(body, cw / 2, ch * 0.78, cw * 0.9);
    g.fillStyle = BRAND.cyan;
    g.fillRect(cw * 0.4, ch * 0.88, cw * 0.2, ch * 0.015);
  });
}

/** The mat in front of the elevator: the logo and a welcome. `w` by `w`/2 metres. */
export function welcomeMat(w: number): THREE.Mesh {
  return sign(w, w / 2, (g, cw, ch) => {
    rounded(g, 0, 0, cw, ch, ch * 0.08);
    g.fillStyle = '#26334d';
    g.fill();
    g.strokeStyle = '#3d4f70';
    g.lineWidth = ch * 0.03;
    rounded(g, ch * 0.06, ch * 0.06, cw - ch * 0.12, ch - ch * 0.12, ch * 0.05);
    g.stroke();
    drawLogo(g, cw / 2, ch * 0.33, ch * 0.34, '#26334d');
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.font = `700 ${ch * 0.13}px ${SANS}`;
    g.textBaseline = 'middle';
    spaced(g, 'WELCOME', cw / 2, ch * 0.66, ch * 0.03, 'center');
    g.fillStyle = BRAND.cyan;
    g.font = `500 ${ch * 0.07}px ${SANS}`;
    spaced(g, BRAND.name, cw / 2, ch * 0.8, ch * 0.02, 'center');
  });
}

/** The logo and the company's short name in navy on glass: see-through round it. `w` by `w`/3 metres. */
export function frostedLogo(w: number): THREE.Mesh {
  const m = sign(
    w,
    w / 3,
    (g, cw, ch) => {
      g.globalAlpha = 0.85;
      drawLogo(g, ch * 0.5, ch * 0.5, ch * 0.6, null);
      g.fillStyle = BRAND.navy;
      g.font = `700 ${ch * 0.36}px ${SANS}`;
      g.textBaseline = 'middle';
      spaced(g, BRAND.short, ch * 0.95, ch * 0.52, ch * 0.01);
    },
    true,
  );
  m.material.side = THREE.DoubleSide;
  return m;
}
