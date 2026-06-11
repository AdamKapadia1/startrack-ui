// Generates public/icon-192.png and public/icon-512.png using pngjs
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const BG    = { r: 0x0a, g: 0x0f, b: 0x0c };
const GREEN = { r: 0x1d, g: 0x9e, b: 0x75 };
const WHITE = { r: 255,  g: 255,  b: 255  };

function setPixel(png, size, x, y, c) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  png.data[i]   = c.r;
  png.data[i+1] = c.g;
  png.data[i+2] = c.b;
  png.data[i+3] = 255;
}

function fillRect(png, size, x, y, w, h, c) {
  for (let py = y; py < y + h; py++)
    for (let px = x; px < x + w; px++)
      setPixel(png, size, px, py, c);
}

function fillCircle(png, size, cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r)
        setPixel(png, size, x, y, c);
}

function createIcon(size) {
  const png  = new PNG({ width: size, height: size });
  const data = Buffer.alloc(size * size * 4);

  // Fill background
  for (let i = 0; i < size * size; i++) {
    data[i * 4]     = BG.r;
    data[i * 4 + 1] = BG.g;
    data[i * 4 + 2] = BG.b;
    data[i * 4 + 3] = 255;
  }
  png.data = data;

  const cx = size / 2;
  const cy = size / 2;

  // Outer glow ring
  fillCircle(png, size, cx, cy, size * 0.42, { r: 0x15, g: 0x2e, b: 0x22 });
  // Main green circle
  fillCircle(png, size, cx, cy, size * 0.38, GREEN);

  // Satellite — body
  const bw = Math.round(size * 0.11);
  const bh = Math.round(size * 0.08);
  fillRect(png, size, Math.round(cx - bw / 2), Math.round(cy - bh / 2), bw, bh, WHITE);

  // Satellite — left panel
  const pw = Math.round(size * 0.19);
  const ph = Math.round(size * 0.04);
  const py = Math.round(cy - ph / 2);
  fillRect(png, size, Math.round(cx - bw / 2 - pw - Math.round(size * 0.01)), py, pw, ph, WHITE);

  // Satellite — right panel
  fillRect(png, size, Math.round(cx + bw / 2 + Math.round(size * 0.01)), py, pw, ph, WHITE);

  // Small dish nub on top of body
  const nw = Math.round(size * 0.025);
  const nh = Math.round(size * 0.03);
  fillRect(png, size, Math.round(cx - nw / 2), Math.round(cy - bh / 2 - nh), nw, nh, WHITE);

  return png;
}

const outDir = path.join(__dirname, '..', 'public');

for (const size of [192, 512]) {
  const png  = createIcon(size);
  const buf  = PNG.sync.write(png);
  const dest = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(dest, buf);
  console.log(`✓ ${dest} (${buf.length} bytes)`);
}
