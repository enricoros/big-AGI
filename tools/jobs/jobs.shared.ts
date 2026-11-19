/**
 * Shared by the jobs of this folder: what a checker prints, how it fails, and where it finds a key.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { AixAPI_Access } from '~/modules/aix/server/api/aix.wiretypes';

import { lookupKey } from '../develop/aix-protocol-lab/access';


// --- Printing and failing ---

/** A titled, aligned table, with detail lines under it for the rows that need a sentence. */
export function printTable(title: string, header: string[], rows: string[][], details: string[]) {
  const widths = header.map((name, column) => Math.max(name.length, ...rows.map(row => row[column].length)));
  const line = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd();
  console.log(`\n${title}\n${line(header)}\n${rows.map(line).join('\n')}${details.length ? `\n${details.map(detail => `  ${detail}`).join('\n')}` : ''}`);
}

/**
 * Fails the test with the broken rows and nothing else: a verdict on the outside world has no use for a stack trace.
 * - 'breaks': something does not work, for a user or for the job itself. The launcher posts these, where it posts
 * - 'drift': the code is behind the vendor and wants a cleanup. It fails the run and is never posted
 */
export function failOn(broken: string[], severity: 'breaks' | 'drift' = 'breaks') {
  if (!broken.length) return;
  // the launcher asks for the findings in a file when it has somewhere to post them (jobs.sh, jobs.notify.mjs)
  if (process.env.JOBS_FINDINGS_FILE)
    fs.appendFileSync(process.env.JOBS_FINDINGS_FILE, broken.map(line => `${severity}\t${line.replace(/\s+/g, ' ')}\n`).join(''));
  const verdict = new Error(broken.join('\n'));
  verdict.stack = verdict.message;
  throw verdict;
}


// --- Keys: the environment, then .env.api-keys, then the registry scanner's key file ---

// a map of service name to a ready-made access, kept beside the scanner and never committed. With it, the machine
// that runs the scanner needs no second key file
const SCANNER_KEY_FILE = path.join(__dirname, '../data/llms/llm-services.json');
export const SCANNER_KEY_FILE_NAME = path.basename(SCANNER_KEY_FILE);

let _scannerAccesses: AixAPI_Access[] | undefined;

function scannerAccesses(): AixAPI_Access[] {
  if (_scannerAccesses) return _scannerAccesses;
  try {
    const services = JSON.parse(fs.readFileSync(SCANNER_KEY_FILE, 'utf8')) as Record<string, unknown>;
    return _scannerAccesses = Object.entries(services)
      .filter(([name, access]) => !name.startsWith('_') && !!access && typeof access === 'object' && 'dialect' in access)
      .map(([, access]) => access as AixAPI_Access);
  } catch {
    return _scannerAccesses = [];
  }
}

const _hostOf = (access: AixAPI_Access) => String(Object.entries(access).find(([field]) => field.endsWith('Host'))?.[1] ?? '');

/** The scanner's access for a vendor, on the named host. Without a host: the vendor's own, as the OpenAI dialect serves many. */
export function scannerAccess(dialect: string, host?: string): AixAPI_Access | undefined {
  return scannerAccesses().find(access => access.dialect === dialect && (
    host ? _hostOf(access).includes(host)
      : dialect !== 'openai' || !_hostOf(access) || _hostOf(access).includes('api.openai.com')
  ));
}

/**
 * A key by the name of its environment variable, and where it came from. The scanner's file is kept by vendor, so
 * FOO_API_KEY is read as the key of the 'foo' service, and BEDROCK_X_Y as the bedrockXY field of the bedrock one.
 */
export function jobKey(envVar: string): { value: string; source: string } | null {
  const own = lookupKey(envVar);
  if (own?.value?.trim()) return { value: own.value.trim(), source: own.source };
  const ofBedrock = envVar.startsWith('BEDROCK_');
  const dialect = ofBedrock ? 'bedrock' : envVar.endsWith('_API_KEY') ? envVar.slice(0, -'_API_KEY'.length).toLowerCase() : '';
  const field = ofBedrock ? envVar.toLowerCase().replace(/_(\w)/g, (_match, letter: string) => letter.toUpperCase())
    : dialect === 'anthropic' ? 'anthropicKey' : dialect === 'gemini' ? 'geminiKey' : 'oaiKey';
  const value = dialect ? (scannerAccess(dialect) as Record<string, unknown> | undefined)?.[field] : undefined;
  return typeof value === 'string' && value.trim() ? { value: value.trim(), source: SCANNER_KEY_FILE_NAME } : null;
}
