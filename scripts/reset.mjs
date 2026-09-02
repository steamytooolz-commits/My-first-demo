import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function getEffectiveDbPathReset() {
  const raw = process.env.DATABASE_FILE || './data/app.db';
  const isVercel = !!process.env.VERCEL;
  if (isVercel) {
    if (raw.startsWith('/var/task/')) return raw.replace('/var/task', '/tmp');
    if (raw.startsWith('/tmp/')) return raw;
    const cleaned = raw.replace(/^\.\//, '').replace(/^\//, '');
    return path.join('/tmp', cleaned);
  }
  return raw;
}

const dbPath = getEffectiveDbPathReset();
const fullPath = path.resolve(dbPath);

console.log(`[reset] Resetting database at: ${fullPath}`);
if (fs.existsSync(fullPath)) {
  fs.unlinkSync(fullPath);
}
// Also remove WAL and SHM files if present
if (fs.existsSync(`${fullPath}-wal`)) {
  fs.unlinkSync(`${fullPath}-wal`);
}
if (fs.existsSync(`${fullPath}-shm`)) {
  fs.unlinkSync(`${fullPath}-shm`);
}

console.log('[reset] Running migrations...');
execSync('node scripts/migrate.mjs', { stdio: 'inherit' });
console.log('[reset] Database reset complete.');
