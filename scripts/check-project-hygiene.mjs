import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'app/layout.tsx',
  'app/page.tsx',
  'app/api/client',
  'components',
  'config',
  'lib',
  'services',
  'public',
  'prisma/schema.prisma',
  'docs/architecture.md',
];

for (const relativePath of requiredPaths) {
  if (!existsSync(path.join(root, relativePath))) {
    failures.push(`Missing required architecture path: ${relativePath}`);
  }
}

const stalePaths = [
  '.next-codex-smoke',
  '.next-local',
  '.codex-logs',
  'backups',
  'outputs',
  'tmp',
];

for (const relativePath of stalePaths) {
  if (existsSync(path.join(root, relativePath))) {
    failures.push(`Stale project artifact: ${relativePath}`);
  }
}

const starterAssets = ['file.svg', 'globe.svg', 'next.svg', 'vercel.svg', 'window.svg'];
for (const asset of starterAssets) {
  if (existsSync(path.join(root, 'public', asset))) {
    failures.push(`Unused starter asset: public/${asset}`);
  }
}

const routeFileNames = new Set([
  'default.tsx',
  'error.tsx',
  'global-error.tsx',
  'layout.tsx',
  'loading.tsx',
  'not-found.tsx',
  'page.tsx',
  'route.ts',
  'template.tsx',
]);
const rootAppFiles = new Set(['favicon.ico', 'globals.css']);

function inspectAppDirectory(directory, relativeParts = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    const parts = [...relativeParts, entry.name];

    if (entry.isDirectory()) {
      inspectAppDirectory(entryPath, parts);
      continue;
    }

    if (relativeParts.some((part) => part.startsWith('_'))) {
      continue;
    }

    const isRootAsset = relativeParts.length === 0 && rootAppFiles.has(entry.name);
    if (!isRootAsset && !routeFileNames.has(entry.name)) {
      failures.push(`Route implementation file must be private: app/${parts.join('/')}`);
    }
  }
}

inspectAppDirectory(path.join(root, 'app'));

const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageSections = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
  ...packageJson.overrides,
};
for (const legacyPackage of ['@auth/core', 'bcryptjs', 'next-auth']) {
  if (legacyPackage in packageSections) {
    failures.push(`Legacy administrator dependency: ${legacyPackage}`);
  }
}

const tsconfig = readFileSync(path.join(root, 'tsconfig.json'), 'utf8');
for (const staleTypePath of ['.next-codex-smoke', '.next-local']) {
  if (tsconfig.includes(staleTypePath)) {
    failures.push(`Stale TypeScript build path: ${staleTypePath}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log('Project architecture and filesystem hygiene verified.');
