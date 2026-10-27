import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
mkdirSync(publicDir, { recursive: true });

const TEAL_DARK = [13, 54, 51, 255];
const CREAM = [255, 248, 235, 255];
const GOLD = [223, 168, 61, 255];
const TEAL = [47, 130, 121, 255];
const CORAL = [223, 106, 80, 255];

function makeCanvas(size, background) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    pixels[i * 4] = background[0];
    pixels[i * 4 + 1] = background[1];
    pixels[i * 4 + 2] = background[2];
    pixels[i * 4 + 3] = background[3];
  }
  return { size, pixels };
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function fillPolygon(canvas, points, color) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(canvas.size - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(canvas.size - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!pointInPolygon(x + 0.5, y + 0.5, points)) continue;
      const index = (y * canvas.size + x) * 4;
      canvas.pixels[index] = color[0];
      canvas.pixels[index + 1] = color[1];
      canvas.pixels[index + 2] = color[2];
      canvas.pixels[index + 3] = color[3];
    }
  }
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const x = ax + dx * t;
  const y = ay + dy * t;
  return Math.hypot(px - x, py - y);
}

function strokePolyline(canvas, points, color, width, closed = false) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) segments.push([points[i], points[i + 1]]);
  if (closed) segments.push([points[points.length - 1], points[0]]);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs) - width));
  const maxX = Math.min(canvas.size - 1, Math.ceil(Math.max(...xs) + width));
  const minY = Math.max(0, Math.floor(Math.min(...ys) - width));
  const maxY = Math.min(canvas.size - 1, Math.ceil(Math.max(...ys) + width));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let near = false;
      for (const [a, b] of segments) {
        if (distanceToSegment(x + 0.5, y + 0.5, a[0], a[1], b[0], b[1]) <= width / 2) {
          near = true;
          break;
        }
      }
      if (!near) continue;
      const index = (y * canvas.size + x) * 4;
      canvas.pixels[index] = color[0];
      canvas.pixels[index + 1] = color[1];
      canvas.pixels[index + 2] = color[2];
      canvas.pixels[index + 3] = color[3];
    }
  }
}

function drawIcon(size, { scale = 1 } = {}) {
  const supersample = 3;
  const canvas = makeCanvas(size * supersample, TEAL_DARK);
  const s = canvas.size;
  const center = s / 2;
  const k = scale * (s / 512);

  for (let y = 0; y < s; y += 1) {
    for (let x = 0; x < s; x += 1) {
      const index = (y * s + x) * 4;
      const dx = (x - center) / s;
      const dy = (y - center) / s;
      const glow = Math.max(0, 1 - Math.hypot(dx * 1.1, dy * 1.4) * 1.8);
      canvas.pixels[index] = Math.min(
        255,
        TEAL_DARK[0] + Math.round(26 * glow) + Math.round(10 * Math.max(0, -dy)),
      );
      canvas.pixels[index + 1] = Math.min(
        255,
        TEAL_DARK[1] + Math.round(40 * glow) + Math.round(16 * Math.max(0, -dy)),
      );
      canvas.pixels[index + 2] = Math.min(
        255,
        TEAL_DARK[2] + Math.round(34 * glow) + Math.round(8 * Math.max(0, -dy)),
      );
    }
  }

  const top = [center, center - 136 * k];
  const upperRight = [center + 136 * k, center - 68 * k];
  const lowerRight = [center + 136 * k, center + 68 * k];
  const bottom = [center, center + 136 * k];
  const lowerLeft = [center - 136 * k, center + 68 * k];
  const upperLeft = [center - 136 * k, center - 68 * k];
  const middle = [center, center];

  fillPolygon(canvas, [top, upperRight, middle, upperLeft], GOLD);
  fillPolygon(canvas, [upperLeft, middle, bottom, lowerLeft], TEAL);
  fillPolygon(canvas, [upperRight, lowerRight, bottom, middle], CORAL);
  strokePolyline(
    canvas,
    [top, upperRight, lowerRight, bottom, lowerLeft, upperLeft],
    CREAM,
    7 * k,
    true,
  );
  strokePolyline(canvas, [middle, top], [255, 248, 235, 200], 4 * k);
  strokePolyline(canvas, [middle, lowerLeft], [255, 248, 235, 200], 4 * k);
  strokePolyline(canvas, [middle, lowerRight], [255, 248, 235, 200], 4 * k);

  const ringRadius = 210 * k;
  const ringWidth = 3 * k;
  for (let y = 0; y < s; y += 1) {
    for (let x = 0; x < s; x += 1) {
      const distance = Math.hypot(x - center, y - center);
      if (Math.abs(distance - ringRadius) > ringWidth) continue;
      const index = (y * s + x) * 4;
      canvas.pixels[index] = 223;
      canvas.pixels[index + 1] = 168;
      canvas.pixels[index + 2] = 61;
      canvas.pixels[index + 3] = 150;
    }
  }

  const output = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const total = [0, 0, 0, 0];
      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const sourceIndex = ((y * supersample + sy) * s + (x * supersample + sx)) * 4;
          total[0] += canvas.pixels[sourceIndex];
          total[1] += canvas.pixels[sourceIndex + 1];
          total[2] += canvas.pixels[sourceIndex + 2];
          total[3] += canvas.pixels[sourceIndex + 3];
        }
      }
      const count = supersample * supersample;
      const index = (y * size + x) * 4;
      output[index] = total[0] / count;
      output[index + 1] = total[1] / count;
      output[index + 2] = total[2] / count;
      output[index + 3] = total[3] / count;
    }
  }
  return output;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writeIcon(name, size, options) {
  const pixels = drawIcon(size, options);
  writeFileSync(resolve(publicDir, name), encodePng(size, pixels));
  console.log(`wrote public/${name} (${size}x${size})`);
}

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16494a"/>
      <stop offset="1" stop-color="#0b2b28"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <circle cx="32" cy="32" r="25" fill="none" stroke="#dfa83d" stroke-opacity=".4" stroke-width="1"/>
  <path d="M32 10 49 18.5 32 27 15 18.5 32 10Z" fill="#dfa83d"/>
  <path d="M15 18.5 32 27v19L15 37.5v-19Z" fill="#2f8279"/>
  <path d="M49 18.5 32 27v19l17-8.5v-19Z" fill="#df6a50"/>
  <path d="M32 10 49 18.5 32 27 15 18.5 32 10Zm0 17v19M15 18.5v19L32 46l17-8.5v-19" fill="none" stroke="#fff8eb" stroke-width="1.4" stroke-linejoin="round"/>
</svg>
`;
writeFileSync(resolve(publicDir, 'favicon.svg'), faviconSvg);
console.log('wrote public/favicon.svg');

writeIcon('pwa-192x192.png', 192, { scale: 0.92 });
writeIcon('pwa-512x512.png', 512, { scale: 0.92 });
writeIcon('pwa-maskable-512x512.png', 512, { scale: 0.72 });
writeIcon('apple-touch-icon.png', 180, { scale: 0.9 });
