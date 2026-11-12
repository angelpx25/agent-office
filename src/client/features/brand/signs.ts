import * as THREE from 'three';
import { BRAND } from '../../../shared/brand';
import wordmarkUrl from './deltanet-logo.png';
import markUrl from './deltanet-mark.png';

// The company's signs, drawn on canvases: the name sign with its logo, the banner of what it does,
// a panel per service, the welcome mat and the logo on the meeting room's glass. Each is a flat
// plane facing +z, unlit (MeshBasicMaterial), so it reads the same by day and by night.

/**
 * The company's own logo, as deltanetservices.com shows it: the DeltaNet wordmark (a blue D with its
 * wifi waves, an orange-red N), and the DN mark for the small spots. Both on transparent backgrounds.
 */
const LOGO = { wordmark: picture(wordmarkUrl), mark: picture(markUrl) };
/** When both pictures are in, for the signs painted before then to paint themselves again. */
const logoLoaded = Promise.all(Object.values(LOGO).map((img) => img.decode().catch(() => undefined)));

function picture(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

/** The signs' lettering: a plain, sharp sans that every computer has, rather than the office's rounded one. */
const SANS = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
/** How many canvas pixels make a metre. */
const PX = 200;

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/**
 * A `w` by `h` metre plane facing +z, painted by `draw` on a canvas of the same shape: straight away,
 * and again once the logo has loaded.
 */
function sign(w: number, h: number, draw: Draw, transparent = false): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * PX);
  canvas.height = Math.round(h * PX);
  const g = canvas.getContext('2d')!;
  const paint = () => {
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.save();
    draw(g, canvas.width, canvas.height);
    g.restore();
  };
  paint();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  void logoLoaded.then(() => {
    paint();
    map.needsUpdate = true;
  });
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

/** A rounded rectangle path. */
function rounded(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** The width a picture of height `h` takes, or `fallback` times `h` before it has loaded. */
function widthAt(img: HTMLImageElement, h: number, fallback: number): number {
  return img.naturalWidth ? (h * img.naturalWidth) / img.naturalHeight : h * fallback;
}

/** `img` as big as fits in the box at (x, y), `w` by `h`, centered in it; nothing while it's loading. */
function fit(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  if (!img.complete || !img.naturalWidth) return;
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** The DN mark on a white rounded tile, `s` px square, centered on (cx, cy): it reads on the navy signs. */
function markTile(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  rounded(g, cx - s / 2, cy - s / 2, s, s, s * 0.16);
  g.fillStyle = '#ffffff';
  g.fill();
  fit(g, LOGO.mark, cx - s / 2, cy - s / 2, s, s);
}

/** How wide the wordmark is for its height, until the picture says so itself. */
const WORDMARK_ASPECT = 986 / 231;

/**
 * The name sign: the DeltaNet wordmark with SERVICES beside it, the tagline under them and a rule in
 * the logo's orange-red, on white with a navy edge. `w` by `w`/5 metres.
 */
export function nameSign(w: number): THREE.Mesh {
  return sign(w, w / 5, (g, cw, ch) => {
    rounded(g, 0, 0, cw, ch, ch * 0.08);
    g.fillStyle = '#ffffff';
    g.fill();
    g.strokeStyle = BRAND.navy;
    g.lineWidth = ch * 0.04;
    rounded(g, ch * 0.02, ch * 0.02, cw - ch * 0.04, ch - ch * 0.04, ch * 0.07);
    g.stroke();
    const margin = ch * 0.3;
    const top = ch * 0.13;
    const logoH = ch * 0.5;
    const logoW = widthAt(LOGO.wordmark, logoH, WORDMARK_ASPECT);
    const gap = ch * 0.12;
    // The rest of the name in the wordmark's blue and slant, as big as fits, on the same baseline;
    // the two of them centered together.
    const word = BRAND.name.split(' ').slice(1).join(' ');
    g.font = `italic 800 ${ch}px ${SANS}`;
    const size = Math.min(ch * 0.34, ((cw - margin * 2 - logoW - gap) / g.measureText(word).width) * ch);
    g.font = `italic 800 ${size}px ${SANS}`;
    const left = (cw - (logoW + gap + g.measureText(word).width)) / 2;
    fit(g, LOGO.wordmark, left, top, logoW, logoH);
    g.fillStyle = BRAND.logoBlue;
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillText(word, left + logoW + gap, top + logoH * 0.97);
    g.font = `600 ${ch * 0.11}px ${SANS}`;
    g.fillStyle = BRAND.navy;
    spaced(g, BRAND.tagline.toUpperCase(), cw / 2, ch * 0.8, ch * 0.025, 'center');
    g.fillStyle = BRAND.logoRed;
    g.fillRect(margin, ch * 0.86, cw - margin * 2, ch * 0.025);
  });
}

/** One line of what the company does, spread across a navy band `w` by `h` metres. */
export function banner(text: string, w: number, h: number): THREE.Mesh {
  return sign(w, h, (g, cw, ch) => {
    g.fillStyle = BRAND.navy;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = BRAND.cyan;
    g.fillRect(0, ch * 0.9, cw, ch * 0.1);
    markTile(g, ch * 0.6, ch * 0.45, ch * 0.66);
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

/** The mat in front of the elevator: the wordmark on a white plate, and a welcome. `w` by `w`/2 metres. */
export function welcomeMat(w: number): THREE.Mesh {
  return sign(w, w / 2, (g, cw, ch) => {
    rounded(g, 0, 0, cw, ch, ch * 0.08);
    g.fillStyle = '#26334d';
    g.fill();
    g.strokeStyle = '#3d4f70';
    g.lineWidth = ch * 0.03;
    rounded(g, ch * 0.06, ch * 0.06, cw - ch * 0.12, ch - ch * 0.12, ch * 0.05);
    g.stroke();
    rounded(g, cw * 0.2, ch * 0.15, cw * 0.6, ch * 0.36, ch * 0.05);
    g.fillStyle = '#ffffff';
    g.fill();
    fit(g, LOGO.wordmark, cw * 0.24, ch * 0.19, cw * 0.52, ch * 0.28);
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

/** The wordmark on glass: see-through round it. `w` by `w`/3 metres. */
export function frostedLogo(w: number): THREE.Mesh {
  const m = sign(
    w,
    w / 3,
    (g, cw, ch) => {
      g.globalAlpha = 0.9;
      fit(g, LOGO.wordmark, ch * 0.1, ch * 0.1, cw - ch * 0.2, ch * 0.8);
    },
    true,
  );
  m.material.side = THREE.DoubleSide;
  return m;
}
