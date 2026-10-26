// Next's production pipeline for one file: a TS transform, then the minify step `next build` runs on client chunks.
// After a Next upgrade, recheck MINIFY_OPTIONS against next/dist/build/webpack/plugins/minify-webpack-plugin/src/index.js
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc');
const terser = require('next/dist/compiled/terser/bundle.min.js');

export const NEXT_VERSION = require('next/package.json').version;

// MinifyPlugin options for the client compilation (mangling on, char frequency on)
const MINIFY_OPTIONS = {
  compress: { inline: 2, global_defs: { 'process.env.__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE': false }, keep_classnames: false, keep_fnames: false },
  mangle: { reserved: ['AbortSignal'], disableCharFreq: false },
  module: 'unknown',
  output: { comments: false },
};

// the same intent for Terser, the independent reference
const TERSER_OPTIONS = {
  compress: { inline: 2, global_defs: { 'process.env.__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE': false } },
  mangle: { reserved: ['AbortSignal'] },
  module: false,
};

/** TS/TSX source to CommonJS, close to Next's loader output (ES2022, automatic JSX runtime). */
export async function transformTs(source, filename) {
  const tsx = filename.endsWith('.tsx');
  const { code } = await swc.transform(source, {
    filename,
    jsc: { parser: { syntax: 'typescript', tsx }, target: 'es2022', transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  return code;
}

// a webpack module factory assigned to a global: the minifier treats it as it treats a chunk
const asChunk = (cjs) => `self.__m={1:function(module,exports,require){${cjs}\n}};`;

export const minifySwc = async (cjs) => (await swc.minify(asChunk(cjs), MINIFY_OPTIONS)).code;
export const minifyTerser = async (cjs) => (await terser.minify(asChunk(cjs), TERSER_OPTIONS)).code;

/** Exports of an unminified CommonJS module. */
export function loadModule(cjs, requireStub) {
  const mod = { exports: {} };
  vm.runInThisContext(`(function (module, exports, require) {${cjs}\n})`)(mod, mod.exports, requireStub);
  return mod.exports;
}

/** Exports of a minified chunk produced by minifySwc. */
export function loadChunk(code, requireStub) {
  const self = {};
  vm.runInThisContext(`(function (self) {${code}\n})`)(self);
  const mod = { exports: {} };
  self.__m[1](mod, mod.exports, requireStub);
  return mod.exports;
}
