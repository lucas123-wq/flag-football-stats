// Erzeugt einfache Platzhalter-App-Icons (PNG) für die PWA-Manifest-Konfiguration,
// ganz ohne externe Abhängigkeiten (nur Node-Bordmittel: zlib für die PNG-Kompression).
// Diese Icons sind bewusst simpel gehalten und sollen später durch finale
// Design-Icons ersetzt werden (siehe PRD §46).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BACKGROUND = [0x0f, 0x17, 0x2a]; // slate-900
const ACCENT = [0xf9, 0x73, 0x16]; // orange-500 ("Phoenix")

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** Rendert ein einfarbiges Quadrat mit zentriertem Kreis als unkomprimiertes RGB-PNG. */
function generatePng(size, radiusRatio) {
  const raw = Buffer.alloc(size * (1 + size * 3));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * radiusRatio;
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // Filter-Byte: "None"
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const inside = dx * dx + dy * dy <= r * r;
      const [r8, g8, b8] = inside ? ACCENT : BACKGROUND;
      raw[offset++] = r8;
      raw[offset++] = g8;
      raw[offset++] = b8;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bit-Tiefe
  ihdr[9] = 2; // Farbtyp: Truecolor (RGB)
  ihdr[10] = 0; // Kompression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const idatData = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Für "maskable" Icons wird ein kleinerer Radius verwendet, damit der Inhalt
// sicher innerhalb der von Android verwendeten Safe-Zone liegt.
const targets = [
  { name: 'icon-192.png', size: 192, radiusRatio: 0.42 },
  { name: 'icon-512.png', size: 512, radiusRatio: 0.42 },
  { name: 'icon-maskable-512.png', size: 512, radiusRatio: 0.34 },
  { name: 'apple-touch-icon.png', size: 180, radiusRatio: 0.42 },
  { name: 'favicon-32.png', size: 32, radiusRatio: 0.42 },
];

for (const target of targets) {
  const png = generatePng(target.size, target.radiusRatio);
  writeFileSync(join(outDir, target.name), png);
  console.log(`generated ${target.name} (${target.size}x${target.size})`);
}
