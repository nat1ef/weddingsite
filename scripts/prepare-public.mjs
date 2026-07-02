import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const files = [
  'index.html',
  'styles.css',
  'app.js',
  'config.js',
  'gift-registry-data.js',
];

rmSync(publicDir, { recursive: true, force: true });
mkdirSync(join(publicDir, 'assets', 'icons'), { recursive: true });

for (const file of files) {
  cpSync(join(root, file), join(publicDir, file));
}

cpSync(join(root, 'assets', 'icons', 'monogram.svg'), join(publicDir, 'assets', 'icons', 'monogram.svg'));

console.log('Prepared public/ for Cloudflare Workers deploy.');
