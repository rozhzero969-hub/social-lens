import { cp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Pages hosts the same interactive dashboard in preview mode. Server routes
// remain in the main Next.js app for a future deployment with a backend host.
const root = fileURLToPath(new URL('../', import.meta.url));
const staging = path.join(root, '.local', 'pages-build');
const basePath = process.env.PAGES_BASE_PATH || '/social-lens';
if (!/^\/[a-zA-Z0-9_-]+$/.test(basePath)) throw new Error('Invalid Pages base path.');
await rm(staging, { recursive: true, force: true });
await mkdir(path.join(staging, 'app'), { recursive: true });
await mkdir(path.join(staging, 'lib'), { recursive: true });
for (const file of ['package.json', 'tsconfig.json']) {
  await cp(path.join(root, file), path.join(staging, file));
}
for (const file of ['page.tsx', 'layout.tsx', 'globals.css']) {
  await cp(path.join(root, 'app', file), path.join(staging, 'app', file));
}
await cp(path.join(root, 'components'), path.join(staging, 'components'), { recursive: true });
for (const file of ['types.ts', 'demo.ts', 'platforms.ts', 'supabase.ts']) {
  await cp(path.join(root, 'lib', file), path.join(staging, 'lib', file));
}
await symlink(path.join(root, 'node_modules'), path.join(staging, 'node_modules'), 'dir');
await writeFile(
  path.join(staging, 'next.config.mjs'),
  `export default ${JSON.stringify({
    output: 'export',
    basePath,
    trailingSlash: true,
    poweredByHeader: false,
    images: { unoptimized: true },
  })};\n`,
);
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'build', staging, '--webpack'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
);
if (result.status !== 0) process.exit(result.status || 1);
await writeFile(path.join(staging, 'out', '.nojekyll'), '');
console.log(`GitHub Pages preview built at ${path.join(staging, 'out')}`);
