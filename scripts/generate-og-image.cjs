#!/usr/bin/env node
// Generates public/og-image.png (1200×630) for Open Graph social preview.
// Run: node scripts/generate-og-image.js

const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

const W = 1200, H = 630;
const canvas = createCanvas(W, H);
const ctx    = canvas.getContext('2d');

// ── Helper: rounded rect path ─────────────────────────────────────────────────
function rRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h,     x, y + h - r,     r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,         x + r, y,         r);
  ctx.closePath();
}

// ── BACKGROUND ───────────────────────────────────────────────────────────────
ctx.fillStyle = '#080c14';
ctx.fillRect(0, 0, W, H);

// Radial glow on left
const bgGlow = ctx.createRadialGradient(280, 0, 0, 280, 0, 640);
bgGlow.addColorStop(0, 'rgba(13,31,60,0.75)');
bgGlow.addColorStop(1, 'rgba(8,12,20,0)');
ctx.fillStyle = bgGlow;
ctx.fillRect(0, 0, W, H);

// Subtle dot texture (sparse grid)
ctx.fillStyle = 'rgba(0,212,255,0.03)';
for (let gx = 40; gx < W; gx += 60)
  for (let gy = 40; gy < H; gy += 60)
    ctx.fillRect(gx, gy, 1, 1);

// ── LOGO ──────────────────────────────────────────────────────────────────────
ctx.fillStyle = '#e8f4fd';
ctx.font      = 'bold 52px sans-serif';
const logoW   = ctx.measureText('STARTRACK').width;
ctx.fillText('STARTRACK', 60, 80);

ctx.fillStyle = '#7b61ff';
ctx.font      = 'bold 30px sans-serif';
ctx.fillText('AI', 60 + logoW + 5, 57);

ctx.fillStyle = '#8ba3c4';
ctx.font      = '21px sans-serif';
ctx.fillText('Real-time Starlink Satellite Tracker', 60, 116);

// Accent divider
ctx.strokeStyle = 'rgba(0,212,255,0.30)';
ctx.lineWidth   = 1;
ctx.beginPath();
ctx.moveTo(60, 136);
ctx.lineTo(548, 136);
ctx.stroke();

// ── STAT CARDS (left, 60–556px) ──────────────────────────────────────────────
const CARDS = [
  { value: '400+',       color: '#00d4ff', label: 'Satellites Tracked Live'  },
  { value: '7-Day',      color: '#00ff88', label: 'Pass Predictions'         },
  { value: 'AI-Powered', color: '#7b61ff', label: 'Connectivity Analysis'    },
];

CARDS.forEach((card, i) => {
  const x = 60, y = 158 + i * 112, cw = 492, ch = 96;

  // Background
  ctx.fillStyle = '#0d1520';
  rRect(x, y, cw, ch, 10);
  ctx.fill();

  // Top border glow
  ctx.strokeStyle = `${card.color}22`;
  ctx.lineWidth   = 1;
  rRect(x, y, cw, ch, 10);
  ctx.stroke();

  // Left accent bar
  ctx.fillStyle = card.color;
  rRect(x, y, 3, ch, 2);
  ctx.fill();

  // Value
  ctx.fillStyle = card.color;
  ctx.font      = 'bold 33px monospace';
  ctx.fillText(card.value, x + 20, y + 44);

  // Label
  ctx.fillStyle = '#8ba3c4';
  ctx.font      = '17px sans-serif';
  ctx.fillText(card.label, x + 20, y + 73);
});

// ── SKY MAP (right, centred at ~910, 308) ────────────────────────────────────
const MCX = 910, MCY = 308, MR = 182;

// Sky circle
const skyGrad = ctx.createRadialGradient(MCX, MCY, 0, MCX, MCY, MR);
skyGrad.addColorStop(0, '#0d1f3c');
skyGrad.addColorStop(1, '#080c14');
ctx.fillStyle = skyGrad;
ctx.beginPath();
ctx.arc(MCX, MCY, MR, 0, Math.PI * 2);
ctx.fill();

// Border
ctx.strokeStyle = 'rgba(0,212,255,0.18)';
ctx.lineWidth   = 1;
ctx.setLineDash([]);
ctx.beginPath();
ctx.arc(MCX, MCY, MR, 0, Math.PI * 2);
ctx.stroke();

// Elevation rings (30° and 60°)
[30, 60].forEach(el => {
  const r = ((90 - el) / 90) * MR;
  ctx.strokeStyle = 'rgba(0,212,255,0.10)';
  ctx.lineWidth   = 0.75;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(MCX, MCY, r, 0, Math.PI * 2);
  ctx.stroke();
});
ctx.setLineDash([]);

// Cross lines
ctx.strokeStyle = 'rgba(26,45,69,0.7)';
ctx.lineWidth   = 0.75;
ctx.beginPath();
ctx.moveTo(MCX, MCY - MR); ctx.lineTo(MCX, MCY + MR);
ctx.moveTo(MCX - MR, MCY); ctx.lineTo(MCX + MR, MCY);
ctx.stroke();

// Compass labels
ctx.fillStyle   = '#4a6080';
ctx.font        = '11px monospace';
ctx.textAlign   = 'center';
ctx.fillText('N', MCX, MCY - MR - 8);
ctx.fillText('S', MCX, MCY + MR + 18);
ctx.fillText('E', MCX + MR + 14, MCY + 4);
ctx.fillText('W', MCX - MR - 14, MCY + 4);

function toXY(az, el) {
  const r   = ((90 - el) / 90) * MR;
  const rad = (az * Math.PI) / 180;
  return { x: MCX + r * Math.sin(rad), y: MCY - r * Math.cos(rad) };
}

// Satellite dots (15 distributed around the map)
const DOTS = [
  { az:  30, el: 45, color: '#00ff88' }, { az:  80, el: 65, color: '#00d4ff' },
  { az: 130, el: 35, color: '#00ff88' }, { az: 180, el: 55, color: '#00d4ff' },
  { az: 230, el: 70, color: '#00ff88' }, { az: 270, el: 40, color: '#00d4ff' },
  { az: 310, el: 60, color: '#00ff88' }, { az: 350, el: 50, color: '#00d4ff' },
  { az:  50, el: 35, color: '#00d4ff' }, { az: 100, el: 50, color: '#00ff88' },
  { az: 150, el: 65, color: '#00d4ff' }, { az: 200, el: 40, color: '#00ff88' },
  { az: 250, el: 55, color: '#00d4ff' }, { az: 300, el: 45, color: '#00ff88' },
  { az:  20, el: 72, color: '#00d4ff' },
];

DOTS.forEach(dot => {
  const { x, y } = toXY(dot.az, dot.el);

  // Glow halo
  const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
  g.addColorStop(0, dot.color + 'aa');
  g.addColorStop(1, dot.color + '00');
  ctx.fillStyle    = g;
  ctx.globalAlpha  = 1;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();

  // Core dot
  ctx.fillStyle   = dot.color;
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
});

// Observer dot (purple, centre)
ctx.fillStyle   = '#7b61ff';
ctx.globalAlpha = 0.95;
ctx.beginPath();
ctx.arc(MCX, MCY, 6, 0, Math.PI * 2);
ctx.fill();
ctx.globalAlpha = 1;

// Observer ring
ctx.strokeStyle = 'rgba(123,97,255,0.35)';
ctx.lineWidth   = 1;
ctx.beginPath();
ctx.arc(MCX, MCY, 13, 0, Math.PI * 2);
ctx.stroke();

// "YOU" label
ctx.fillStyle = '#7b61ff';
ctx.font      = '10px monospace';
ctx.textAlign = 'center';
ctx.fillText('YOU', MCX, MCY + 26);

// URL below sky map
ctx.fillStyle = '#4a6080';
ctx.font      = '14px monospace';
ctx.fillText('startrackv1-ui.vercel.app', MCX, MCY + MR + 34);

// ── BOTTOM BAR ────────────────────────────────────────────────────────────────
ctx.fillStyle = '#0d1520';
ctx.fillRect(0, 558, W, 72);

ctx.strokeStyle = 'rgba(0,212,255,0.12)';
ctx.lineWidth   = 1;
ctx.beginPath();
ctx.moveTo(0, 558);
ctx.lineTo(W, 558);
ctx.stroke();

ctx.fillStyle = '#4a6080';
ctx.font      = '14px sans-serif';
ctx.textAlign = 'left';
ctx.fillText('Powered by CelesTrak · satellite.js · Claude AI', 60, 602);

ctx.textAlign = 'right';
ctx.fillText('Free · No account needed · Works everywhere', W - 60, 602);

// ── OUTPUT ────────────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, '..', 'public', 'og-image.png');
fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
console.log('✓ og-image.png generated:', outPath);
