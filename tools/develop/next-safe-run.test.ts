import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findMissingNextChunkError, inspectNextBuildState } from './next-safe-run';

function makeProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'big-agi-next-safe-run-'));
}

function writeJsonFile(projectRoot: string, relativePath: string, value: unknown) {
  const filePath = join(projectRoot, relativePath);
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeTextFile(projectRoot: string, relativePath: string, value = '') {
  const filePath = join(projectRoot, relativePath);
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, value);
}

test('treats a missing build manifest as a broken .next tree', () => {
  const projectRoot = makeProjectRoot();
  mkdirSync(join(projectRoot, 'pages'));
  writeJsonFile(projectRoot, '.next/server/pages-manifest.json', {
    '/_app': 'pages/_app.js',
    '/_document': 'pages/_document.js',
    '/_error': 'pages/_error.js',
  });
  writeTextFile(projectRoot, '.next/server/webpack-runtime.js');

  const result = inspectNextBuildState(projectRoot);

  assert.equal(result.isBroken, true);
  assert.match(result.reason ?? '', /build-manifest\.json/);
});

test('treats a pages manifest missing Next core pages as a broken .next tree', () => {
  const projectRoot = makeProjectRoot();
  mkdirSync(join(projectRoot, 'pages'));
  writeJsonFile(projectRoot, '.next/build-manifest.json', {});
  writeTextFile(projectRoot, '.next/server/webpack-runtime.js');
  writeJsonFile(projectRoot, '.next/server/pages-manifest.json', {
    '/': 'pages/index.js',
  });

  const result = inspectNextBuildState(projectRoot);

  assert.equal(result.isBroken, true);
  assert.match(result.reason ?? '', /pages-manifest\.json/);
});

test('accepts a healthy pages-router build tree', () => {
  const projectRoot = makeProjectRoot();
  mkdirSync(join(projectRoot, 'pages'));
  writeJsonFile(projectRoot, '.next/build-manifest.json', {});
  writeTextFile(projectRoot, '.next/server/webpack-runtime.js');
  writeJsonFile(projectRoot, '.next/server/pages-manifest.json', {
    '/_app': 'pages/_app.js',
    '/_document': 'pages/_document.js',
    '/_error': 'pages/_error.js',
    '/': 'pages/index.js',
  });

  const result = inspectNextBuildState(projectRoot);

  assert.deepStrictEqual(result, { isBroken: false });
});

test('treats a pages-router build with missing referenced server chunks as broken', () => {
  const projectRoot = makeProjectRoot();
  mkdirSync(join(projectRoot, 'pages'));
  writeJsonFile(projectRoot, '.next/build-manifest.json', {});
  writeTextFile(projectRoot, '.next/server/webpack-runtime.js');
  writeJsonFile(projectRoot, '.next/server/pages-manifest.json', {
    '/_app': 'pages/_app.js',
    '/_document': 'pages/_document.js',
    '/_error': 'pages/_error.js',
    '/': 'pages/index.js',
  });
  writeTextFile(projectRoot, '.next/server/pages/_app.js');
  writeTextFile(projectRoot, '.next/server/pages/_error.js');
  writeTextFile(projectRoot, '.next/server/pages/_document.js', 'var t=require("../webpack-runtime.js"); t.X(0,[9963,883,936],()=>{});');
  writeTextFile(projectRoot, '.next/server/chunks/883.js');
  writeTextFile(projectRoot, '.next/server/chunks/936.js');

  const result = inspectNextBuildState(projectRoot);

  assert.equal(result.isBroken, true);
  assert.match(result.reason ?? '', /9963\.js/);
});

test('detects missing Next server chunks from runtime logs', () => {
  const errorText = `
Error: Cannot find module './9963.js'
Require stack:
- /tmp/project/.next/server/webpack-runtime.js
- /tmp/project/.next/server/pages/_document.js
`;

  assert.equal(findMissingNextChunkError(errorText), '9963.js');
});
