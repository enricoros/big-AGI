/**
 * Runnable test for the Jina patch (browse dialect + search provider).
 *
 * Run from the repo root:
 *   node tests/jina-patch.test.mjs            # static + live keyless checks
 *   JINA_API_KEY=jina_... node tests/jina-patch.test.mjs   # also tests s.jina.ai search
 *
 * What it verifies:
 *  1. [static] the patch wiring is present in the modified source files
 *  2. [live]   r.jina.ai returns the JSON envelope workerJina() expects (keyless, low rate limit)
 *  3. [live]   the workerJina parsing logic maps the envelope to FetchPageWorkerOutputSchema shape
 *  4. [live]   s.jina.ai returns the array-of-results shape the search router expects (needs key)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JINA_KEY = process.env.JINA_API_KEY || '';

let failures = 0;
function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
  if (!cond) failures++;
}

// --- 1. static wiring checks ---
const browseRouter = readFileSync(join(root, 'src/modules/browse/browse.router.ts'), 'utf8');
check('browse router: browse-jina dialect', browseRouter.includes("'browse-jina'"));
check('browse router: workerJina defined', /async function workerJina\(/.test(browseRouter));
check('browse router: env.JINA_API_KEY fallback', browseRouter.includes('env.JINA_API_KEY'));

const browseClient = readFileSync(join(root, 'src/modules/browse/browse.client.ts'), 'utf8');
check('browse client: dialect switch', browseClient.includes("dialect: 'browse-jina'"));

const searchRouter = readFileSync(join(root, 'src/modules/google/search.router.ts'), 'utf8');
check('search router: jina provider', searchRouter.includes("'jina'") && searchRouter.includes('https://s.jina.ai/'));

const envServer = readFileSync(join(root, 'src/server/env.server.ts'), 'utf8');
check('env.server: JINA_API_KEY declared', envServer.includes('JINA_API_KEY'));

// --- 2/3. live r.jina.ai check (mirrors workerJina in browse.router.ts) ---
async function workerJina(targetUrl, transforms, apiKey) {
  const result = { url: targetUrl, title: '', content: undefined, error: undefined, stopReason: 'error' };
  const wantsMarkdown = transforms.includes('markdown');
  const wantsText = transforms.includes('text');
  if (!wantsMarkdown && !wantsText) { result.error = 'html-only unsupported'; return result; }
  const response = await fetch(`https://r.jina.ai/${targetUrl}`, {
    headers: { 'Accept': 'application/json', 'X-Return-Format': 'markdown', ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}) },
    signal: AbortSignal.timeout(45000),
  });
  const envelope = await response.json();
  if (!response.ok || !envelope?.data) { result.error = envelope?.readableMessage || `HTTP ${response.status}`; return result; }
  const markdown = typeof envelope.data.content === 'string' ? envelope.data.content : '';
  if (!markdown.trim()) { result.error = 'empty content'; return result; }
  result.title = envelope.data.title || '';
  result.content = {};
  if (wantsMarkdown) result.content.markdown = markdown;
  if (wantsText) result.content.text = markdown;
  result.stopReason = 'end';
  return result;
}

try {
  const page = await workerJina('https://example.com', ['markdown', 'text'], JINA_KEY);
  check('live: r.jina.ai fetch example.com', page.stopReason === 'end', page.error || `title="${page.title}"`);
  check('live: markdown content present', !!page.content?.markdown?.includes('Example Domain'));
  check('live: text transform filled', !!page.content?.text);
  const htmlOnly = await workerJina('https://example.com', ['html'], JINA_KEY);
  check('live: html-only request errors cleanly', !!htmlOnly.error && htmlOnly.stopReason === 'error');
} catch (e) {
  check('live: r.jina.ai fetch example.com', false, e.message);
}

// --- 4. live s.jina.ai check (needs a real key) ---
if (JINA_KEY) {
  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent('what is big-agi')}`, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${JINA_KEY}` },
      signal: AbortSignal.timeout(45000),
    });
    const data = await res.json();
    const arr = data?.data;
    check('live: s.jina.ai returns result array', Array.isArray(arr) && arr.length > 0, `${arr?.length} results`);
    check('live: results have title/url/description', !!arr?.[0]?.title && !!arr?.[0]?.url);
  } catch (e) {
    check('live: s.jina.ai search', false, e.message);
  }
} else {
  console.log('SKIP  s.jina.ai live search (set JINA_API_KEY to run)');
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
