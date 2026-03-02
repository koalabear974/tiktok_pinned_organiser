import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve(__dirname, '..', '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.sqlite');
const WAL_PATH = DB_PATH + '-wal';
const SHM_PATH = DB_PATH + '-shm';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let currentDb: DatabaseType = openDb();

function openDb(): DatabaseType {
  const instance = new Database(DB_PATH);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  return instance;
}

/**
 * Create a safe backup using SQLite's Online Backup API.
 * Handles WAL mode correctly — all committed data is captured.
 */
export async function backupDatabase(destPath: string): Promise<void> {
  await currentDb.backup(destPath);
}

/**
 * Close the current connection, replace the DB file with the source,
 * remove stale WAL/SHM files, and reopen a fresh connection.
 */
export function restoreDatabase(srcPath: string): void {
  currentDb.close();

  // Remove stale WAL/SHM so old data doesn't get replayed over the restored file
  if (fs.existsSync(WAL_PATH)) fs.unlinkSync(WAL_PATH);
  if (fs.existsSync(SHM_PATH)) fs.unlinkSync(SHM_PATH);

  fs.copyFileSync(srcPath, DB_PATH);
  currentDb = openDb();
}

/**
 * Close the current database connection and open a fresh one.
 */
export function reopenDatabase(): void {
  currentDb.close();
  currentDb = openDb();
}

// Proxy so that all existing `import db from './connection'` references
// automatically follow the latest `currentDb` even after reopenDatabase().
const dbProxy: DatabaseType = new Proxy({} as DatabaseType, {
  get(_target, prop) {
    const value = (currentDb as any)[prop];
    if (typeof value === 'function') {
      return value.bind(currentDb);
    }
    return value;
  },
  set(_target, prop, value) {
    (currentDb as any)[prop] = value;
    return true;
  },
});

export default dbProxy;
