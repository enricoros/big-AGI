/**
 * NVIDIA Catalog Harvest - API key access.
 *
 * Loads NVIDIANIM_API_KEY from local env files (never committed, never echoed). Lookup order:
 *   process.env > .env.api-keys > .env.local > .env
 * Only the provenance (file name, never the value) is printed, so runs stay auditable.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';


const KEY_FILES = ['.env.api-keys', '.env.local', '.env'];

export const NVIDIA_KEY_VAR = 'NVIDIANIM_API_KEY';


function _parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\'')))
      value = value.slice(1, -1);
    if (value) out[match[1]] = value;
  }
  return out;
}

/** Returns the value and where it came from, or null. Never log the value. */
export function lookupKey(varName: string, repoRoot: string = process.cwd()): { value: string; source: string } | null {
  if (process.env[varName])
    return { value: process.env[varName]!, source: 'process.env' };
  for (const file of KEY_FILES) {
    const vars = _parseEnvFile(path.join(repoRoot, file));
    if (vars[varName])
      return { value: vars[varName], source: file };
  }
  return null;
}

/** The NVIDIA hosted-API key, or null when unavailable (the harvest then runs unauthenticated). */
export function lookupNvidiaKey(): { value: string; source: string } | null {
  return lookupKey(NVIDIA_KEY_VAR);
}

export const KEY_FILE_NAMES = KEY_FILES.join(', ');
