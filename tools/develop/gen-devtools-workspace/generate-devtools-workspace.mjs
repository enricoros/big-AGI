#!/usr/bin/env node
/**
 * Generates the Chrome DevTools "automatic workspace folder" descriptor for THIS worktree.
 *
 * Worktrees: the uuid is derived from the worktree's absolute path, so every worktree advertises a distinct (root, uuid) pair.
 * * Chrome keys its folder grant on that uuid, so two worktrees taking turns on the same port can never inherit each other's binding,
 * and each grant is remembered across dev-server restarts instead of re-prompting.
 *
 * Usage: node tools/develop/gen-devtools-workspace/generate-devtools-workspace.mjs [--clean]
 */
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

// resolved from this file's location rather than cwd, so it is always THIS worktree
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_FILE = join(REPO_ROOT, 'public', '.well-known', 'appspecific', 'com.chrome.devtools.json');

// fixed namespace: keeps the uuid a pure function of the worktree path
const UUID_NAMESPACE = 'a3d4f1c2-5e6b-4a7f-9c81-0b2d3e4f5a6b';


/** RFC 4122 v5 (sha1, name-based) - stable for a given name */
function _uuidV5(name, namespaceUuid) {
  const namespaceBytes = Buffer.from(namespaceUuid.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(Buffer.concat([namespaceBytes, Buffer.from(name, 'utf8')])).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}


// never break `npm run dev` / `npm run build` over a developer convenience
try {
  const cleanOnly = process.argv.includes('--clean');
  const productionLike = process.env.NODE_ENV === 'production' || !!process.env.VERCEL || !!process.env.CI;

  if (cleanOnly || productionLike) {
    rmSync(OUT_FILE, { force: true });
    console.log(`[devtools-workspace] removed (${cleanOnly ? '--clean' : 'production-like environment'})`);
  } else {
    const uuid = _uuidV5(REPO_ROOT, UUID_NAMESPACE);
    mkdirSync(dirname(OUT_FILE), { recursive: true });
    writeFileSync(OUT_FILE, JSON.stringify({ workspace: { root: REPO_ROOT, uuid } }, null, 2) + '\n');
    console.log(`[devtools-workspace] ${REPO_ROOT} -> ${uuid}`);
  }
} catch (error) {
  console.warn('[devtools-workspace] skipped:', error.message);
}
