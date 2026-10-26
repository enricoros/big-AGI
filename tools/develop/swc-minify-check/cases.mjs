#!/usr/bin/env node
// Minify check for listed functions: calls each function in cases/ from its real source, unminified and through
// Next's minifier, on every case, and reports where the two disagree (or where the source disagrees with an expected value).
// Usage (repo root): node tools/develop/swc-minify-check/cases.mjs [case-file...] [--source <path>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { NEXT_VERSION, loadChunk, loadModule, minifySwc, transformTs } from './nextswc.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

const args = process.argv.slice(2);
const sourceAt = args.indexOf('--source');
const sourceOverride = sourceAt >= 0 ? args.splice(sourceAt, 2)[1] : null;
const caseFiles = args.length ? args.map((f) => path.resolve(f))
  : fs.readdirSync(path.join(HERE, 'cases')).filter((f) => f.endsWith('.mjs')).map((f) => path.join(HERE, 'cases', f));
if (sourceOverride && caseFiles.length !== 1) {
  console.error('--source needs exactly one case file');
  process.exit(2);
}

const show = (v) => {
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
};
const call = (fn, callArgs) => {
  try { return show(fn(...callArgs)); } catch (error) { return `throws ${error?.message}`; }
};

console.log(`Next ${NEXT_VERSION} SWC minifier`);
let failures = 0;
for (const caseFile of caseFiles) {
  const { default: spec } = await import(pathToFileURL(caseFile).href);
  const sourcePath = sourceOverride ? path.resolve(sourceOverride) : path.resolve(ROOT, spec.source);
  const requireStub = (id) => Object.entries(spec.stubs ?? {}).find(([suffix]) => id.endsWith(suffix))?.[1] ?? {};

  const cjs = await transformTs(fs.readFileSync(sourcePath, 'utf8'), sourcePath);
  const plain = loadModule(cjs, requireStub)[spec.export];
  const minified = loadChunk(await minifySwc(cjs), requireStub)[spec.export];
  if (typeof plain !== 'function' || typeof minified !== 'function') {
    console.error(`${spec.export} is not an exported function of ${sourcePath}`);
    process.exit(2);
  }

  let wrong = 0;
  for (const [callArgs, ...expected] of spec.cases) {
    const source = call(plain, callArgs), minifiedResult = call(minified, callArgs);
    const unexpected = expected.length > 0 && source !== show(expected[0]);
    if (source === minifiedResult && !unexpected) continue;
    wrong++;
    console.log(`  MISMATCH ${show(callArgs)}: source ${source} | minified ${minifiedResult}${expected.length ? ` | expected ${show(expected[0])}` : ''}`);
  }
  console.log(`${path.relative(ROOT, sourcePath)} ${spec.export}: ${wrong ? `${wrong} of ${spec.cases.length} cases differ` : `all ${spec.cases.length} cases match`}`);
  failures += wrong;
}
process.exit(failures ? 1 : 0);
