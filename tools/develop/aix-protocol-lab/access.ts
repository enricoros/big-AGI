/**
 * AIX Protocol Lab - API access construction.
 *
 * Builds the AixAPI_Access objects the dispatch creator needs, with keys loaded from local
 * env files (never committed, never echoed). Lookup order per variable:
 *   process.env > .env.api-keys > .env.local > .env
 * The provenance (file name, never the value) is printed so runs are auditable.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { AixAPI_Access } from '~/modules/aix/server/api/aix.wiretypes';

import type { LabFlavor } from './trace';


const KEY_FILES = ['.env.api-keys', '.env.local', '.env'];

const FLAVOR_KEY_VAR: Record<LabFlavor, string> = {
  'anthropic-messages': 'ANTHROPIC_API_KEY',
  'openai-responses': 'OPENAI_API_KEY',
  'openai-chat': 'OPENAI_API_KEY',
  'gemini-generate': 'GEMINI_API_KEY',
  'gemini-interactions': 'GEMINI_API_KEY',
};


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

export function flavorKeyVar(flavor: LabFlavor): string {
  return FLAVOR_KEY_VAR[flavor];
}

/** Builds the access object for a flavor. Throws with a clear message when the key is missing. */
export function accessForFlavor(flavor: LabFlavor): { access: AixAPI_Access; keySource: string } {
  const varName = FLAVOR_KEY_VAR[flavor];
  const key = lookupKey(varName);
  if (!key)
    throw new Error(`Missing ${varName}: set it in the environment or in one of ${KEY_FILES.join(', ')} at the repo root.`);

  switch (flavor) {
    case 'anthropic-messages':
      return {
        keySource: key.source,
        access: { dialect: 'anthropic', anthropicKey: key.value, anthropicHost: null, heliconeKey: null },
      };
    case 'openai-responses':
    case 'openai-chat':
      return {
        keySource: key.source,
        access: { dialect: 'openai', oaiKey: key.value, oaiOrg: '', oaiHost: '', heliKey: '' },
      };
    case 'gemini-generate':
    case 'gemini-interactions':
      return {
        keySource: key.source,
        access: { dialect: 'gemini', geminiKey: key.value, geminiHost: '', minSafetyLevel: 'BLOCK_ONLY_HIGH' },
      };
  }
}
