/**
 * Shared env loader for the standalone scripts (they run under plain `node`,
 * outside Next.js, so they read .env.local themselves).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// Resolve .env.local relative to THIS file (scripts/lib/ → repo root), so the
// scripts work wherever the repo lives — never hardcode an absolute path.
const ENV_PATH = fileURLToPath(new URL('../../.env.local', import.meta.url));

/** Parse .env.local into a plain object. Exits the process if unreadable. */
export function loadEnv() {
  try {
    const raw = readFileSync(ENV_PATH, 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
    return env;
  } catch {
    console.error(`Could not read ${ENV_PATH}`);
    process.exit(1);
  }
}

/** All GROQ_KEY_1..N values from the env object, in order. */
export function groqKeys(env) {
  return Object.entries(env)
    .filter(([k]) => /^GROQ_KEY_\d+$/.test(k))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
    .filter(Boolean);
}
