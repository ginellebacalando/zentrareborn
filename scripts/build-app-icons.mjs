// Builds the site's app icons (Next.js icon file conventions) from the "Z" on Zeni's chat button:
// a white Z on a deep green circle. The Z is the outline of Cinzel Decorative Bold (SIL Open Font
// License, app/_fonts/), the brand face every build ships; Zenitha Classic is a personal-use font
// that never enters Git, so its outlines are not used.
//
//   npm run icons:build
//
// Writes app/icon.svg (browser tabs), app/favicon.ico (16, 32 and 48 px, for browsers without SVG
// icons) and app/apple-icon.png (180 px, iPhone home screens; a full square that iOS rounds).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require('sharp');
// The font reader Next.js itself uses for local fonts (@next/font/dist/local/loader.js).
const fontkit = require('next/dist/compiled/@next/font/dist/fontkit/index.js').default;
const openFont = fontkit.default || fontkit;

const GREEN = '#03422E'; // --palette-zentra-green
const WHITE = '#FFFFFF'; // --palette-white, the Z on Zeni's button
const CANVAS = 512;
/** How much of the icon's radius the Z's own enclosing circle fills: large for 16 px tabs. */
const TAB_FILL = 0.88;
/** A little more room on home screens, where the icon is large. */
const HOME_FILL = 0.8;

const font = openFont(readFileSync(path.join(root, 'app/_fonts/cinzel-decorative-bold.woff2')));
const glyph = font.layout('Z').glyphs[0];

/** The outline as absolute commands in font units (y up), as fontkit writes it. */
const commands = [];
const tokens = glyph.path.toSVG().match(/[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
for (let index = 0; index < tokens.length;) {
  const command = tokens[index++].toUpperCase();
  const count = { M: 2, L: 2, Q: 4, C: 6, Z: 0 }[command];
  if (count === undefined) throw new Error(`Unexpected outline command ${command}`);
  commands.push({ command, numbers: tokens.slice(index, index + count).map(Number) });
  index += count;
}
const points = commands.flatMap(({ numbers }) =>
  numbers.flatMap((value, index) => (index % 2 ? [] : [[value, numbers[index + 1]]])),
);

/**
 * The Z's smallest enclosing circle (exact, over its outline and control points). Centring that
 * circle on the icon keeps the swash tail inside the round badge, as on Zeni's button.
 */
function enclosingCircle(list) {
  const holds = (circle) =>
    list.every(([x, y]) => Math.hypot(x - circle.x, y - circle.y) <= circle.r + 1e-7);
  const pair = (a, b) => ({
    x: (a[0] + b[0]) / 2,
    y: (a[1] + b[1]) / 2,
    r: Math.hypot(a[0] - b[0], a[1] - b[1]) / 2,
  });
  const triple = (a, b, c) => {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-9) return null;
    const square = (p) => p[0] * p[0] + p[1] * p[1];
    const x =
      (square(a) * (b[1] - c[1]) + square(b) * (c[1] - a[1]) + square(c) * (a[1] - b[1])) / d;
    const y =
      (square(a) * (c[0] - b[0]) + square(b) * (a[0] - c[0]) + square(c) * (b[0] - a[0])) / d;
    return { x, y, r: Math.hypot(a[0] - x, a[1] - y) };
  };
  let best = null;
  const consider = (circle) => {
    if (circle && (!best || circle.r < best.r) && holds(circle)) best = circle;
  };
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      consider(pair(list[i], list[j]));
      for (let k = j + 1; k < list.length; k++) consider(triple(list[i], list[j], list[k]));
    }
  return best;
}
const circle = enclosingCircle(points);

/** The Z as an SVG path on the canvas (y down), its enclosing circle filling `fill` of the radius. */
function zPath(fill) {
  const scale = ((CANVAS / 2) * fill) / circle.r;
  const x = (value) => (CANVAS / 2 + (value - circle.x) * scale).toFixed(2);
  const y = (value) => (CANVAS / 2 - (value - circle.y) * scale).toFixed(2);
  return commands
    .map(({ command, numbers }) => {
      const pairs = [];
      for (let index = 0; index < numbers.length; index += 2)
        pairs.push(`${x(numbers[index])} ${y(numbers[index + 1])}`);
      return `${command}${pairs.join(' ')}`;
    })
    .join('');
}

const svg = (background, fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">${background}<path fill="${WHITE}" d="${zPath(fill)}"/></svg>\n`;
const badge = svg(`<circle cx="256" cy="256" r="256" fill="${GREEN}"/>`, TAB_FILL);
const tile = svg(`<rect width="${CANVAS}" height="${CANVAS}" fill="${GREEN}"/>`, HOME_FILL);

const png = (source, size, { opaque = false } = {}) => {
  const image = sharp(Buffer.from(source), { density: (72 * size * 4) / CANVAS }).resize(
    size,
    size,
  );
  // iOS fills transparency with black, so the home screen tile has no alpha channel at all.
  return (opaque ? image.removeAlpha() : image).png({ compressionLevel: 9 }).toBuffer();
};

/** An .ico holding PNG images, which every current browser and Windows read. */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

const favicon = [];
for (const size of [16, 32, 48]) favicon.push({ size, data: await png(badge, size) });
writeFileSync(path.join(root, 'app/icon.svg'), badge);
writeFileSync(path.join(root, 'app/favicon.ico'), ico(favicon));
writeFileSync(path.join(root, 'app/apple-icon.png'), await png(tile, 180, { opaque: true }));
console.log('Wrote app/icon.svg, app/favicon.ico (16, 32, 48) and app/apple-icon.png (180).');
