import fs from 'fs';
import path from 'path';
import { execSync, spawn, type ChildProcess } from 'child_process';

const PROFILE_DIR = path.resolve(__dirname, '..', 'data', 'session', 'chrome-profile');
const EXTENSION_DIR = path.resolve(__dirname, 'extension');

export function getProfileDir(): string {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  return PROFILE_DIR;
}

function findChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  try {
    return execSync('which google-chrome || which chromium', { encoding: 'utf-8' }).trim();
  } catch {
    throw new Error('Could not find Chrome. Set CHROME_PATH env variable.');
  }
}

/**
 * Launches a real Chrome process with our extension loaded.
 * No --remote-debugging-port, no --enable-automation — completely normal Chrome.
 */
export function launchChrome(url: string): ChildProcess {
  const chromePath = findChromePath();
  const profileDir = getProfileDir();

  const chromeArgs = [
    `--user-data-dir=${profileDir}`,
    `--load-extension=${EXTENSION_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    url,
  ];

  console.log(`Launching Chrome: ${path.basename(chromePath)}`);
  console.log(`  Profile: ${profileDir}`);
  console.log(`  Extension: ${EXTENSION_DIR}`);

  const child = spawn(chromePath, chromeArgs, {
    detached: false,
    stdio: 'ignore',
  });

  child.on('error', (err) => {
    console.error('Failed to launch Chrome:', err.message);
    process.exit(1);
  });

  return child;
}
