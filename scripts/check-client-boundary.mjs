import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', '.next', 'node_modules']);
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const forbiddenPathPatterns = [/^public[\\/]admin(?:[-.\\/]|$)/i];
const forbiddenSourcePatterns = [
  /@[\\/]app[\\/]admin(?:[\\/]|['"])/i,
  /@[\\/]components[\\/]admin(?:[\\/]|['"])/i,
  /["'`]\/api\/admin(?:\/|["'`?])/i,
  /@\/components\/developer(?:\/|['"])/i,
  /@\/lib\/developer(?:\/|['"])/i,
  /["'`]\/api\/developer(?:\/|["'`?])/i,
];
const frontendForbiddenPatterns = [/["'`]\/(?:admin|developer)(?:\/|["'`?])/i];
const requiredPaths = [
  'app/page.tsx',
  'app/contact/page.tsx',
  'app/api/client/inquiries/route.ts',
  'app/api/client/packages/route.ts',
  'components/client/HeroSection.tsx',
  'components/events/PackageLayout.tsx',
  'components/layout/GlobalHeader.tsx',
  'public/images/brand/logo.png',
];

function walk(directory) {
  const output = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (item.isDirectory() && ignoredDirectories.has(item.name)) continue;
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) output.push(...walk(absolute));
    else output.push(absolute);
  }
  return output;
}

const files = walk(root);
const failures = [];

for (const required of requiredPaths) {
  if (!fs.existsSync(path.join(root, required)))
    failures.push(`Missing required client file: ${required}`);
}

for (const absolute of files) {
  const relative = path.relative(root, absolute);
  if (forbiddenPathPatterns.some((pattern) => pattern.test(relative))) {
    failures.push(`Forbidden panel artifact: ${relative}`);
    continue;
  }
  if (!sourceExtensions.has(path.extname(relative))) continue;

  const source = fs.readFileSync(absolute, 'utf8');
  const clientSurface =
    /^(?:app[\\/](?!(?:admin|developer)[\\/]|api[\\/](?:admin|auth|developer)[\\/])|components[\\/](?!(?:admin|developer)[\\/]))/i.test(
      relative,
    ) && relative !== path.normalize('components/layout/PanelChrome.tsx');
  if (clientSurface) {
    for (const pattern of forbiddenSourcePatterns) {
      if (pattern.test(source))
        failures.push(`Admin import leaked into client surface: ${relative}`);
    }
    for (const pattern of frontendForbiddenPatterns) {
      if (pattern.test(source)) failures.push(`Forbidden panel navigation in: ${relative}`);
    }
  }

  for (const match of source.matchAll(
    /["'`](\/(?!\/)[^"'`?#]+\.(?:avif|gif|ico|jpe?g|mov|mp4|png|svg|webm|webp))["'`]/gi,
  )) {
    const asset = decodeURIComponent(match[1]).replace(/^\//, '');
    if (!fs.existsSync(path.join(root, 'public', asset))) {
      failures.push(`Missing static asset ${match[1]} referenced by ${relative}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Client boundary verified across ${files.length} files.`);
