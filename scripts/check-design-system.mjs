import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const tokens = read('styles/tokens.css');
const palette = Object.fromEntries(
  [...tokens.matchAll(/(--palette-[\w-]+):\s*(#[\da-f]{6});/gi)].map((match) => [
    match[1],
    match[2],
  ]),
);

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

const pairs = [
  ['--palette-ink', '--palette-cream', 4.5],
  ['--palette-muted', '--palette-cream', 4.5],
  ['--palette-gold-ink', '--palette-paper', 4.5],
  ['--palette-white', '--palette-forest', 4.5],
  ['--palette-pearl', '--palette-night-card', 4.5],
  ['--palette-sage', '--palette-night-card', 4.5],
  ['--palette-night', '--palette-gold', 4.5],
  ['--palette-border', '--palette-white', 3],
  ['--palette-night-border', '--palette-night-card', 3],
  ['--palette-charcoal-ink', '--palette-charcoal', 4.5],
  ['--palette-charcoal-ink', '--palette-charcoal-raised', 4.5],
  ['--palette-charcoal-muted', '--palette-charcoal-raised', 4.5],
  ['--palette-charcoal-border', '--palette-charcoal-card', 3],
  ['--palette-zentra-glow', '--palette-charcoal-raised', 4.5],
  ['--palette-charcoal', '--palette-zentra-glow', 4.5],
];

for (const [foreground, background, minimum] of pairs) {
  assert.ok(
    palette[foreground] && palette[background],
    `Missing contrast token: ${foreground} / ${background}`,
  );
  const values = [luminance(palette[foreground]), luminance(palette[background])].sort(
    (a, b) => b - a,
  );
  const contrast = (values[0] + 0.05) / (values[1] + 0.05);
  assert.ok(
    contrast >= minimum,
    `${foreground} on ${background}: ${contrast.toFixed(2)}:1; requires ${minimum}:1`,
  );
}

const declarations = (block) =>
  Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  );
const light = declarations(tokens.match(/:root\s*\{([^}]+)\}/)[1]);
const dark = { ...light, ...declarations(tokens.match(/\.dark\s*\{([^}]+)\}/)[1]) };
const roles = [
  ['--text-primary', '--surface-page', 4.5],
  ['--text-muted', '--surface-card', 4.5],
  ['--text-accent', '--surface-card', 4.5],
  ['--text-on-action', '--action-primary', 4.5],
  ['--border-control', '--surface-input', 3],
  ['--focus-ring', '--surface-page', 3],
];
function resolveColor(token, scope, seen = new Set()) {
  assert.ok(!seen.has(token), `Circular color alias: ${token}`);
  seen.add(token);
  const value = scope[token];
  assert.ok(value, `Missing color alias: ${token}`);
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  const alias = value.match(/^var\((--[\w-]+)\)$/)?.[1];
  assert.ok(alias, `Color role ${token} must resolve to an opaque approved palette color`);
  return resolveColor(alias, scope, seen);
}
for (const [theme, scope] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [foreground, background, minimum] of roles) {
    const values = [
      luminance(resolveColor(foreground, scope)),
      luminance(resolveColor(background, scope)),
    ].sort((a, b) => b - a);
    assert.ok(
      (values[0] + 0.05) / (values[1] + 0.05) >= minimum,
      `${theme}: ${foreground} on ${background} fails ${minimum}:1`,
    );
  }
}

const adminDarkBlock = tokens.match(/\[data-admin-theme=['"]dark['"]\]\s*\{([^}]+)\}/)?.[1];
assert.ok(adminDarkBlock, 'The admin dark theme must retain explicit semantic roles');
const adminRoles = [
  ['--admin-ink', '--admin-surface-page', 4.5],
  ['--admin-muted', '--admin-surface-card', 4.5],
  ['--admin-accent-ink', '--admin-surface-highlight', 4.5],
  ['--admin-on-action', '--admin-action', 4.5],
  ['--admin-border', '--admin-surface-input', 3],
  ['--admin-focus', '--admin-surface-page', 3],
  ['--admin-ink', '--admin-surface-sidebar', 4.5],
  ['--admin-muted', '--admin-surface-sidebar', 4.5],
  ['--admin-muted', '--admin-surface-subtle', 4.5],
  ['--admin-accent-ink', '--admin-surface-selected', 4.5],
  ['--admin-danger', '--admin-danger-soft', 4.5],
  ['--admin-success', '--admin-success-soft', 4.5],
  ['--admin-on-color', '--admin-oak', 4.5],
  ['--admin-on-color', '--admin-peach', 4.5],
  ['--admin-on-color', '--admin-taupe', 4.5],
  ['--admin-on-color', '--admin-rose', 4.5],
];
for (const [theme, scope] of [
  ['admin light', light],
  ['admin dark', { ...light, ...declarations(adminDarkBlock) }],
]) {
  for (const [foreground, background, minimum] of adminRoles) {
    const values = [
      luminance(resolveColor(foreground, scope)),
      luminance(resolveColor(background, scope)),
    ].sort((a, b) => b - a);
    assert.ok(
      (values[0] + 0.05) / (values[1] + 0.05) >= minimum,
      `${theme}: ${foreground} on ${background} fails ${minimum}:1`,
    );
  }
}

for (const token of [
  '--type-body',
  '--type-small',
  '--type-section-title',
  '--type-page-title',
  '--motion-normal',
  '--layout-touch-target',
]) {
  assert.ok(tokens.includes(`${token}:`), `Missing foundation: ${token}`);
}
assert.match(
  tokens,
  /--layout-touch-target:\s*2\.75rem;/,
  'Project controls must retain the 44px default target',
);
assert.match(
  tokens,
  /--type-caption:\s*0\.75rem;/,
  'Metadata must remain at least 12px by default',
);
assert.match(tokens, /--type-body:\s*1rem;/, 'Body text must retain the shared 16px default');
assert.match(
  read('app/globals.css'),
  /prefers-reduced-motion:\s*reduce/,
  'Global reduced motion fallback is required',
);

/** Runtime literals are restricted to metadata and the standalone root-error fallback. */
export function collectDesignExceptions() {
  const findings = {};
  function walk(directory) {
    if (!existsSync(path.join(root, directory))) return;
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== '_fonts') walk(file);
        continue;
      }
      if (!/\.(css|tsx)$/.test(file) || file === 'styles/tokens.css') continue;
      const source = read(file);
      const counts = {};
      const patterns = [['literal-color', /#[\da-f]{3,8}\b|(?:rgb|rgba|hsl|hsla)\([^)]*\)/gi]];
      for (const [rule, pattern] of patterns) {
        for (const match of source.matchAll(pattern)) {
          const key = `${rule}: ${match[0].toLowerCase().replace(/\s+/g, ' ')}`;
          counts[key] = (counts[key] || 0) + 1;
        }
      }
      for (const match of source.matchAll(
        /\b(?:font-size:\s*|fontSize:\s*['"]|text-\[)(\d*\.?\d+)(px|rem)\b/g,
      )) {
        if (Number(match[1]) * (match[2] === 'rem' ? 16 : 1) >= 12) continue;
        const key = `small-type: ${match[0].toLowerCase()}`;
        counts[key] = (counts[key] || 0) + 1;
      }
      if (Object.keys(counts).length) findings[file] = counts;
    }
  }
  for (const directory of ['app', 'components', 'styles']) walk(directory);
  return findings;
}

const actual = collectDesignExceptions();
const baselineFile = 'docs/design-exceptions.json';
const runtimeLiteralFiles = new Set(['app/layout.tsx', 'app/global-error.tsx']);
for (const [file, exceptions] of Object.entries(actual)) {
  assert.ok(
    runtimeLiteralFiles.has(file),
    `${file}: literal styling is prohibited; use design tokens`,
  );
  assert.ok(
    !Object.keys(exceptions).some((value) => value.startsWith('small-type:')),
    `${file}: undersized text is prohibited`,
  );
}
if (existsSync(path.join(root, baselineFile))) {
  const approved = JSON.parse(read(baselineFile)).files;
  const failures = [];
  for (const [file, values] of Object.entries(actual)) {
    for (const [value, count] of Object.entries(values)) {
      if (count > (approved[file]?.[value] || 0))
        failures.push(`${file}: ${value} (${count}); use a shared token`);
    }
  }
  assert.equal(failures.length, 0, `New design exceptions are prohibited:\n${failures.join('\n')}`);
} else {
  assert.fail('Missing reviewed runtime color inventory');
}

console.log(
  `Design foundations verified: ${pairs.length + roles.length * 2 + adminRoles.length * 2} palette/semantic contrast checks; literal colors restricted to ${Object.keys(actual).length} runtime fallback/metadata files.`,
);
