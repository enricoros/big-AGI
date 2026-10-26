#!/usr/bin/env node
// Dropped-code check: puts a marker after every compound statement and at every function entry, minifies each file
// with Next's SWC and with Terser, and reports code SWC deleted while Terser kept it, TypeScript sees it as reachable,
// and its function survived. No markers go inside switch clauses: they would change the shapes that trigger the bugs.
// Usage (repo root): node tools/develop/swc-minify-check/dropped.mjs [path...]   (default: src/)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { NEXT_VERSION, minifySwc, minifyTerser, transformTs } from './nextswc.mjs';

const ts = createRequire(import.meta.url)('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PARALLEL = 6;

function collectFiles(target, out) {
  if (fs.statSync(target).isFile()) return void out.push(target);
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') collectFiles(full, out); }
    else if (/\.tsx?$/.test(entry.name) && !/\.(d|test)\.ts$/.test(entry.name)) out.push(full);
  }
}

const isFunctionLike = (n) => (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)
  || ts.isConstructorDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n)) && !!n.body && ts.isBlock(n.body);
const isCompound = (s) => ts.isSwitchStatement(s) || ts.isIfStatement(s) || ts.isForStatement(s) || ts.isForInStatement(s) || ts.isForOfStatement(s)
  || ts.isWhileStatement(s) || ts.isDoStatement(s) || ts.isTryStatement(s) || ts.isLabeledStatement(s) || ts.isBlock(s);
const isClause = (n) => ts.isCaseClause(n) || ts.isDefaultClause(n);
const functionName = (n) => n.name?.getText() ?? (ts.isVariableDeclaration(n.parent) ? n.parent.name.getText() : '(anonymous)');

// file-level `const FLAG = <literal>`: the minifier folds what they gate, and Terser does not, so that is no finding
const LITERALS = new Set([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword, ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral]);
const literalConstants = (sf) => new Set(sf.statements
  .filter((s) => ts.isVariableStatement(s) && s.declarationList.flags & ts.NodeFlags.Const)
  .flatMap((s) => s.declarationList.declarations)
  .filter((d) => ts.isIdentifier(d.name) && d.initializer && LITERALS.has(d.initializer.kind))
  .map((d) => d.name.text));
function readsConstant(statement, constants) {
  const test = statement.expression ?? statement.condition; // if, switch, while, do / for
  let found = false;
  if (test) (function walk(n) { if (ts.isIdentifier(n) && constants.has(n.text)) found = true; else ts.forEachChild(n, walk); })(test);
  return found;
}

/** Marks one file and minifies it both ways; returns the markers SWC removed that Terser kept, in a live function. */
async function probe(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const constants = literalConstants(sf);
  const inserts = [], markers = new Map(); // id -> { line, what, fnId, fnName }
  (function visit(node, fnId, fnName, inClause) {
    if (isFunctionLike(node)) {
      fnId = markers.size + 1;
      fnName = functionName(node);
      markers.set(fnId, { line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, what: 'entry', fnName });
      inserts.push([node.body.getStart() + 1, `__M(${fnId});`]);
      inClause = false;
    }
    const statements = ts.isBlock(node) || ts.isSourceFile(node) || ts.isModuleBlock(node) || isClause(node) ? node.statements : null;
    if (statements && !inClause && !isClause(node))
      statements.forEach((s, i) => {
        if (i === statements.length - 1 || !isCompound(s) || readsConstant(s, constants)) return;
        const id = markers.size + 1;
        markers.set(id, { line: sf.getLineAndCharacterOfPosition(s.getStart()).line + 1, what: ts.SyntaxKind[s.kind], fnId, fnName });
        inserts.push([s.end, `;__M(${id});`]);
      });
    ts.forEachChild(node, (child) => visit(child, fnId, fnName, inClause || isClause(node)));
  })(sf, 0, '(module)', false);
  if (!markers.size) return { file, markers: 0, candidates: [] };

  let marked = source;
  for (const [pos, text] of inserts.sort((a, b) => b[0] - a[0])) marked = marked.slice(0, pos) + text + marked.slice(pos);
  const cjs = await transformTs(marked, file);
  const present = async (minify) => new Set([...(await minify(cjs)).matchAll(/__M\((\d+)\)/g)].map((m) => +m[1]));
  const [bySwc, byTerser] = await Promise.all([present(minifySwc), present(minifyTerser)]);
  const candidates = [...markers].filter(([id, m]) => m.what !== 'entry' && !bySwc.has(id) && byTerser.has(id) && (!m.fnId || bySwc.has(m.fnId)));
  return { file, marked, markers: markers.size, candidates };
}

/** Removes candidates TypeScript reports as unreachable code (7027) in the marked source. */
function reachableOnly(results) {
  const sources = new Map(results.map((r) => [r.file, r.marked]));
  const options = { allowUnreachableCode: false, noResolve: true, noEmit: true, types: [], target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, lang, ...rest) => sources.has(name) ? ts.createSourceFile(name, sources.get(name), lang, true) : getSourceFile(name, lang, ...rest);
  const program = ts.createProgram([...sources.keys()], options, host);
  return results.flatMap((r) => {
    const unreachable = program.getSemanticDiagnostics(program.getSourceFile(r.file)).filter((d) => d.code === 7027);
    return r.candidates
      .filter(([id]) => {
        const at = r.marked.indexOf(`__M(${id});`);
        return !unreachable.some((d) => at >= d.start && at < d.start + d.length);
      })
      .map(([, m]) => `${path.relative(ROOT, r.file)}:${m.line} ${m.fnName}: code after ${m.what} dropped`);
  });
}

const files = [];
for (const target of process.argv.slice(2).length ? process.argv.slice(2) : [path.join(ROOT, 'src')]) collectFiles(path.resolve(target), files);
console.log(`Next ${NEXT_VERSION} SWC minifier, Terser as reference: ${files.length} files`);

const results = [], skipped = [];
let next = 0;
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (next < files.length) {
    const file = files[next++];
    try { results.push(await probe(file)); } catch (error) { skipped.push(`${path.relative(ROOT, file)}: ${String(error?.message ?? error).split('\n')[0]}`); }
  }
}));

for (const line of skipped) console.log(`  skipped ${line}`);
const suspects = reachableOnly(results.filter((r) => r.candidates.length));
for (const line of suspects) console.log(`  SUSPECT ${line}`);
const markerCount = results.reduce((sum, r) => sum + r.markers, 0);
console.log(suspects.length ? `${suspects.length} suspects (${results.length} files, ${markerCount} markers)` : `no reachable code dropped (${results.length} files, ${markerCount} markers)`);
process.exit(suspects.length ? 1 : 0);
