/*
 * gen-android-icon.cjs — индивидуальная Android-иконка ScanForge:
 *  иконка лупы с gear-зубцами на синем Material градиенте.
 *  Чистый node.js (zlib), без npm-зависимостей.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const W = 512; const H = 512;
const CX = 256; const CY = 240;
const BLUE = [25, 118, 210, 255];
const BLUE_DARK = [13, 71, 161, 255];
const WHITE = [255, 255, 255, 255];

function blank() { return Buffer.alloc(W * H * 4, 0); }

function setPix(px, x, y, c) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
}

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx; const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function nearSeg(x, y, ax, ay, bx, by, hw) {
  const vx = bx - ax; const vy = by - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2));
  const pxv = ax + t * vx; const pyv = ay + t * vy;
  const dx = x - pxv; const dy = y - pyv;
  return dx * dx + dy * dy <= hw * hw;
}

function ring(px, cx, cy, rOut, rIn, c) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (inCircle(x, y, cx, cy, rOut) && !inCircle(x, y, cx, cy, rIn)) setPix(px, x, y, c);
}

function fillCircle(px, cx, cy, r, c) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (inCircle(x, y, cx, cy, r)) setPix(px, x, y, c);
}

function seg(px, ax, ay, bx, by, hw, c) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (nearSeg(x, y, ax, ay, bx, by, hw)) setPix(px, x, y, c);
}

function gear(px, cx, cy, r, n, c) {
  const step = (2 * Math.PI) / n;
  const inner = r - 8;
  for (let t = 0; t < n; t++) {
    const a1 = t * step; const a2 = a1 + step * 0.55; const a3 = a1 + step * 0.9;
    const ix1 = cx + inner * Math.cos(a1); const iy1 = cy + inner * Math.sin(a1);
    const ix2 = cx + r * Math.cos(a2); const iy2 = cy + r * Math.sin(a2);
    seg(px, ix1, iy1, ix2, iy2, 9, c);
    const ix3 = cx + (r - 22) * Math.cos(a3); const iy3 = cy + (r - 22) * Math.sin(a3);
    seg(px, ix2, iy2, ix3, iy3, 9, c);
  }
}

function gradBg(px, transparent) {
  for (let y = 0; y < H; y++) {
    const frac = y / H;
    const r = Math.round(BLUE[0] + (BLUE_DARK[0] - BLUE[0]) * frac);
    const g = Math.round(BLUE[1] + (BLUE_DARK[1] - BLUE[1]) * frac);
    const b = Math.round(BLUE[2] + (BLUE_DARK[2] - BLUE[2]) * frac);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = transparent ? 0 : 255;
    }
  }
}

function drawGlass(px, transparentBg) {
  gradBg(px, transparentBg);
  const cx = CX; const cy = CY;
  gear(px, cx, cy, 156, 16, WHITE);
  ring(px, cx, cy, 150, 126, WHITE);
  const p0x = cx - 130; const p0y = cy - 60;
  const p1x = 130; const p1y = 330;
  seg(px, p0x, p0y, p1x, p1y, 12, WHITE);
  fillCircle(px, cx, cy, 16, WHITE);
}
// ---- CRC32 ----
function makeCrc() {
  const t = [];
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c; }
  return (b) => { let crc = 0xffffffff; for (let i = 0; i < b.length; i++) crc = t[(crc ^ b[i]) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
}
const crc32 = makeCrc();

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const c = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(c) >>> 0, 0);
  return Buffer.concat([len, c, crc]);
}

// Кодирует RGBA-буфер размера SxS в PNG.
function png(px, S) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = S * 4 + 1;
  const raw = Buffer.alloc(stride * S);
  for (let y = 0; y < S; y++) {
    raw[y * stride] = 0;
    px.copy(raw, y * stride + 1, y * S * 4, (y + 1) * S * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Билинейный даунскейл 512x512 → SxS
function scale(src, S) {
  const out = Buffer.alloc(S * S * 4, 0);
  const ratio = W / S;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const sx = x * ratio; const sy = y * ratio;
    const x0 = Math.floor(sx); const y0 = Math.floor(sy);
    const x1 = Math.min(x0 + 1, W - 1); const y1 = Math.min(y0 + 1, W - 1);
    const fx = sx - x0; const fy = sy - y0;
    for (let c = 0; c < 4; c++) {
      const a = src[(y0 * W + x0) * 4 + c];
      const b = src[(y0 * W + x1) * 4 + c];
      const d = src[(y1 * W + x0) * 4 + c];
      const e = src[(y1 * W + x1) * 4 + c];
      out[(y * S + x) * 4 + c] = Math.round(a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + d * (1 - fx) * fy + e * fx * fy);
    }
  }
  return out;
}

function main() {
  const dir = path.join(__dirname, '..', 'src-tauri', 'icons', 'android');
  fs.mkdirSync(dir, { recursive: true });
  const full = blank();
  drawGlass(full, false);
  fs.writeFileSync(path.join(dir, 'icon-512.png'), png(full, W));
  fs.writeFileSync(path.join(dir, 'icon-192.png'), png(scale(full, 192), 192));
  const fg = blank();
  drawGlass(fg, true);
  fs.writeFileSync(path.join(dir, 'foreground.png'), png(fg, W));
  fs.writeFileSync(path.join(dir, 'foreground-192.png'), png(scale(fg, 192), 192));
  const bg = blank();
  gradBg(bg, false);
  fs.writeFileSync(path.join(dir, 'background.png'), png(bg, W));
  fs.writeFileSync(path.join(dir, 'background-192.png'), png(scale(bg, 192), 192));
  console.log('icons generated in', dir);
}

main();

