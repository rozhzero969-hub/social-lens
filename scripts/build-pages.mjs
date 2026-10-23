import { cp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Pages hosts the same interactive dashboard as an authenticated client app. Server routes
// remain in the main Next.js app for a future deployment with a backend host.
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  process.loadEnvFile(path.join(root, '.env.local'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const staging = path.join(root, '.local', 'pages-build');
const basePath = process.env.PAGES_BASE_PATH || '/social-lens';
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Configure the Supabase URL and publishable key before publishing the app.');
}
if (!/^\/[a-zA-Z0-9_-]+$/.test(basePath)) throw new Error('Invalid Pages base path.');
await rm(staging, { recursive: true, force: true });
await mkdir(path.join(staging, 'app'), { recursive: true });
await mkdir(path.join(staging, 'lib'), { recursive: true });
for (const file of ['package.json', 'tsconfig.json']) {
  await cp(path.join(root, file), path.join(staging, file));
}
for (const file of ['page.tsx', 'layout.tsx', 'globals.css', 'icon.svg']) {
  await cp(path.join(root, 'app', file), path.join(staging, 'app', file));
}
await cp(path.join(root, 'components'), path.join(staging, 'components'), { recursive: true });
for (const file of [
  'types.ts',
  'embeds.ts',
  'api-config.ts',
  'platforms.ts',
  'supabase.ts',
  'client-actions.ts',
  'monitoring.ts',
]) {
  await cp(path.join(root, 'lib', file), path.join(staging, 'lib', file));
}
await cp(path.join(root, 'public'), path.join(staging, 'public'), { recursive: true });
const workerPath = path.join(staging, 'public/sw.js');
const release = process.env.GITHUB_SHA?.slice(0, 12) || Date.now().toString(36);
await writeFile(
  workerPath,
  (await readFile(workerPath, 'utf8')).replace('social-lens-v2', 'social-lens-' + release),
);
const manifest = JSON.parse(
  await readFile(path.join(staging, 'public/manifest.webmanifest'), 'utf8'),
);
manifest.id = basePath + '/';
manifest.start_url = basePath + '/';
manifest.scope = basePath + '/';
for (const icon of manifest.icons) icon.src = basePath + icon.src;
for (const shortcut of manifest.shortcuts) {
  shortcut.url = basePath + '/';
  for (const icon of shortcut.icons) icon.src = basePath + icon.src;
}
await writeFile(path.join(staging, 'public/manifest.webmanifest'), JSON.stringify(manifest));
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
      NEXT_PUBLIC_BASE_PATH: basePath,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
);
if (result.status !== 0) process.exit(result.status || 1);
// Pages cannot set response headers. Hash each exported page's Next.js inline
// bootstrap scripts instead of enabling arbitrary inline JavaScript.
async function secureHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await secureHtml(file);
      continue;
    }
    if (!entry.name.endsWith('.html')) continue;
    let html = await readFile(file, 'utf8');
    const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter((match) => !/\bsrc\s*=/.test(match[1]))
      .map((match) => `'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
    const database = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (database.protocol !== 'https:') throw new Error('Production Supabase URL must use HTTPS.');
    const connections = [database.origin, 'wss://' + database.host];
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      const api = new URL(process.env.NEXT_PUBLIC_API_BASE_URL);
      if (api.protocol !== 'https:' || api.username || api.password)
        throw new Error('API URL must use HTTPS without credentials.');
      connections.push(api.origin);
    }
    const policy = `default-src 'self'; script-src 'self' ${[...new Set(hashes)].join(' ')}; style-src 'self' 'unsafe-inline'; connect-src 'self' ${connections.join(' ')}; frame-src https://www.tiktok.com https://www.instagram.com https://www.snapchat.com; img-src 'self' data: https:; font-src 'self' data:; media-src 'self' blob: https:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'`;
    html = html.replace(
      '<head>',
      `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`,
    );
    await writeFile(file, html);
  }
}
await secureHtml(path.join(staging, 'out'));
await writeFile(path.join(staging, 'out', '.nojekyll'), '');
console.log(`GitHub Pages app built at ${path.join(staging, 'out')}`);
