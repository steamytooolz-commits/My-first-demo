import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

function getEffectiveDbPathBackup() {
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

const dbPath = getEffectiveDbPathBackup();
const fullDbPath = path.resolve(dbPath);
const backupBase = process.env.VERCEL ? '/tmp/data/backups' : './data/backups';
const backupDir = path.resolve(backupBase);

if (!fs.existsSync(backupDir)) {
  try {
    fs.mkdirSync(backupDir, { recursive: true });
  } catch (err) {
    // Fallback to /tmp if read-only
    const fallback = path.join('/tmp', 'data', 'backups');
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    console.warn(`[db-backup] mkdir failed for ${backupDir}, using ${fallback}`);
  }
}

if (!fs.existsSync(fullDbPath)) {
  console.error(`[db-backup] Error: Database file does not exist at ${fullDbPath}`);
  process.exit(1);
}

// Checkpoint WAL
const db = new Database(fullDbPath);
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

fs.copyFileSync(fullDbPath, backupPath);
console.log(`[db-backup] Successfully backed up database to: ${backupPath}`);
