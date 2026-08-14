#!/usr/bin/env node
// @ts-check
/**
 * LLMs Defs Versions Generator
 *
 * Derives a per-vendor version for the model definitions from the *runtime semantics* of the
 * source files claimed by `src/modules/llms/server/llms.defs.manifest.ts`: each file is
 * normalized through the TypeScript transpiler (comments removed, types erased, whitespace
 * re-emitted), so comment/formatting/type-only edits never roll a version, while any change
 * to shipped data or parsing logic does. The manifest `epoch` is folded in as the editorial
 * force-roll lever.
 *
 * Output: `src/modules/llms/server/gen/llms.defs.versions.ts` (committed; the build regenerates
 * it, so a dirty file after a build is the signal to commit - and deployed bundles always use
 * fresh hashes even if the commit lags).
 *
 * Invoked automatically by the `predev`/`prebuild` npm scripts (package.json); run manually with:
 *   node tools/develop/gen-llms-defs/generate-llms-defs.mjs [--check]
 *
 * `--check`: recompute only; exit 2 if the committed file is out of date (no write).
 *
 * Docs: kb/modules/LLM-defs-refresh.md
 *
 * Integrity gates (non-zero exit fails the build):
 * - every manifest file must exist
 * - every `*.models.ts` under src/modules/llms/server/ must be claimed by at least one bucket
 * - import audit: relative value-imports of a claimed file must be claimed by the same bucket,
 *   by `_shared`, listed in the bucket's `ignoreImports`, or be transport infra (`*.access.ts`);
 *   `import type` never affects runtime output and is ignored. listModels.dispatch.ts is the
 *   composition root (imports every parser) and is exempt.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';


// configuration
const SCHEME_REV = 1; // bump to force-roll every bucket on hashing-scheme changes
const SERVER_DIR = 'src/modules/llms/server';
const MANIFEST_PATH = `${SERVER_DIR}/llms.defs.manifest.ts`;
const OUTPUT_PATH = `${SERVER_DIR}/gen/llms.defs.versions.ts`;
const AUDIT_EXEMPT_FILES = ['listModels.dispatch.ts']; // composition roots: import every parser by design
const AUDIT_INFRA_RE = /\.access\.ts$/; // transport plumbing: affects fetch, not definitions

const _repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const _checkOnly = process.argv.includes('--check');

/** @typedef {{ files: readonly string[], epoch?: number, ignoreImports?: readonly string[] }} ManifestEntry */
/** @typedef {Record<string, ManifestEntry>} Manifest */

/** @param {string} message @returns {never} */
const _fail = (message) => {
  console.error(` ❌ llms-defs: ${message}`);
  process.exit(1);
};


// --- load the manifest (transpile in-memory; its only import is `import type`, which erases) ---

/** @returns {Promise<Manifest>} */
async function loadManifest() {
  const manifestAbs = join(_repoRoot, MANIFEST_PATH);
  if (!existsSync(manifestAbs))
    _fail(`manifest not found: ${MANIFEST_PATH}`);
  const transpiled = ts.transpileModule(readFileSync(manifestAbs, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    fileName: 'llms.defs.manifest.ts',
  }).outputText;
  const manifestModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
  if (!manifestModule.LLMS_DEFS_MANIFEST || !manifestModule.LLMS_DEFS_EXTRA_BUCKETS)
    _fail('manifest is missing LLMS_DEFS_MANIFEST / LLMS_DEFS_EXTRA_BUCKETS exports');
  return { ...manifestModule.LLMS_DEFS_MANIFEST, ...manifestModule.LLMS_DEFS_EXTRA_BUCKETS };
}


// --- semantic normalization + hashing ---

/** @param {string} input */
const _sha256 = (input) => createHash('sha256').update(input).digest('hex');

/** @type {Map<string, string>} */
const _fileDigestCache = new Map();

/** @param {string} relPath */
function fileDigest(relPath) {
  const cached = _fileDigestCache.get(relPath);
  if (cached)
    return cached;
  const source = readFileSync(join(_repoRoot, SERVER_DIR, relPath), 'utf8');
  const normalized = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: true,
      newLine: ts.NewLineKind.LineFeed, // cross-platform determinism
    },
    fileName: relPath.split('/').pop(),
  }).outputText;
  const digest = _sha256(`${relPath}\n${normalized}`);
  _fileDigestCache.set(relPath, digest);
  return digest;
}

/** @param {ManifestEntry} entry */
function bucketDigest(entry) {
  const lines = [
    `scheme:${SCHEME_REV}`,
    ...[...entry.files].sort().map((f) => `${f}:${fileDigest(f)}`),
    `epoch:${entry.epoch ?? 0}`,
  ];
  return _sha256(lines.join('\n'));
}


// --- integrity: existence, coverage, import audit ---

/** @param {string} dirAbs @returns {string[]} */
function listFilesRecursive(dirAbs) {
  return readdirSync(dirAbs, { withFileTypes: true }).flatMap((entry) => {
    const abs = join(dirAbs, entry.name);
    return entry.isDirectory() ? listFilesRecursive(abs) : [abs];
  });
}

/** @param {Manifest} manifest */
function checkExistenceAndCoverage(manifest) {
  const claimed = new Set(Object.values(manifest).flatMap((entry) => entry.files));

  const missing = [...claimed].filter((f) => !existsSync(join(_repoRoot, SERVER_DIR, f)));
  if (missing.length)
    _fail(`manifest references missing files: ${missing.join(', ')}`);

  const unclaimed = listFilesRecursive(join(_repoRoot, SERVER_DIR))
    .map((abs) => relative(join(_repoRoot, SERVER_DIR), abs).split('\\').join('/'))
    .filter((rel) => rel.endsWith('.models.ts') && !claimed.has(rel));
  if (unclaimed.length)
    _fail(`model definition files not claimed by any manifest bucket: ${unclaimed.join(', ')}\n   -> claim them in ${MANIFEST_PATH}`);
}

/** Relative value-import specifiers of a file (`import type` is erased at runtime: ignored). @param {string} relPath */
function relativeValueImports(relPath) {
  const sourceFile = ts.createSourceFile(relPath, readFileSync(join(_repoRoot, SERVER_DIR, relPath), 'utf8'), ts.ScriptTarget.Latest, false);
  const specifiers = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (!clause) continue; // bare side-effect import: keep (value semantics)
    // whole-clause `import type` (isTypeOnly deprecated in favor of phaseModifier in newer TS)
    if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword || clause.isTypeOnly === true) continue;
    const named = clause.namedBindings;
    const hasValueBinding = !!clause.name // default import
      || (named && ts.isNamespaceImport(named)) // import * as
      || (named && ts.isNamedImports(named) && named.elements.some((el) => !el.isTypeOnly));
    if (!hasValueBinding) continue; // all specifiers are `type`
    const spec = statement.moduleSpecifier.text;
    if (spec.startsWith('.'))
      specifiers.push(spec);
  }
  return specifiers;
}

/** @param {Manifest} manifest */
function auditImports(manifest) {
  const sharedFiles = new Set(manifest._shared?.files ?? []);
  const problems = [];

  for (const [bucketId, entry] of Object.entries(manifest)) {
    const allowed = new Set([...entry.files, ...sharedFiles, ...(entry.ignoreImports ?? [])]);
    for (const file of entry.files) {
      if (AUDIT_EXEMPT_FILES.includes(file.split('/').pop() ?? '')) continue;
      for (const spec of relativeValueImports(file)) {
        const target = normalize(join(dirname(file), spec)).split('\\').join('/');
        const targetTs = target.endsWith('.ts') ? target : `${target}.ts`;
        if (!existsSync(join(_repoRoot, SERVER_DIR, targetTs))) continue; // resolves elsewhere (index/tsx): out of audit scope
        if (AUDIT_INFRA_RE.test(targetTs) || allowed.has(targetTs)) continue;
        problems.push(`[${bucketId}] ${file} imports ${targetTs}`);
      }
    }
  }

  if (problems.length)
    _fail(`unclaimed value-imports (their changes would not roll the bucket):\n   ${problems.join('\n   ')}\n   -> claim the file in the bucket, or acknowledge it in the bucket's ignoreImports`);
}


// --- output ---

/** @param {Record<string, string>} versions */
function renderOutput(versions) {
  const keys = Object.keys(versions).sort();
  // IDE: block auto-injection of TypeScript into the template below (its relative import is meaningless from here)
  // language=TEXT
  return `// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
${keys.map((k) => `  ${k.startsWith('_') ? k : `${k}`}: '${versions[k]}',`).join('\n')}
} as const satisfies LlmsDefsVersions;
`;
}

/** @param {string} outputAbs @returns {Record<string, string>} */
function previousVersions(outputAbs) {
  /** @type {Record<string, string>} */
  const previous = {};
  if (!existsSync(outputAbs)) return previous;
  for (const match of readFileSync(outputAbs, 'utf8').matchAll(/^ {2}(\w+): '([0-9a-f]+)',$/gm))
    previous[match[1]] = match[2];
  return previous;
}


// --- main ---

const manifest = await loadManifest();
checkExistenceAndCoverage(manifest);
auditImports(manifest);

const sharedDigest = bucketDigest(manifest._shared);
/** @type {Record<string, string>} */
const versions = {};
for (const [bucketId, entry] of Object.entries(manifest))
  versions[bucketId] = (bucketId === '_shared' ? sharedDigest : _sha256(`${sharedDigest}\n${bucketDigest(entry)}`)).slice(0, 12);

const outputAbs = join(_repoRoot, OUTPUT_PATH);
const rendered = renderOutput(versions);
const previous = previousVersions(outputAbs);
const rolled = Object.keys(versions).filter((k) => previous[k] !== versions[k]).sort();

if (!rolled.length && existsSync(outputAbs) && readFileSync(outputAbs, 'utf8') === rendered) {
  console.log(` ✅ llms-defs: ${Object.keys(versions).length} buckets unchanged`);
  process.exit(0);
}

if (_checkOnly) {
  console.error(` ❌ llms-defs: ${OUTPUT_PATH} is out of date (rolls: ${rolled.join(', ') || 'format'}) - run: node tools/develop/gen-llms-defs/generate-llms-defs.mjs`);
  process.exit(2);
}

mkdirSync(dirname(outputAbs), { recursive: true });
writeFileSync(outputAbs, rendered, 'utf8');
console.log(` 🟡 llms-defs: ${rolled.length ? `rolled ${rolled.join(', ')}` : 'reformatted'} -> ${OUTPUT_PATH} (commit it)`);
