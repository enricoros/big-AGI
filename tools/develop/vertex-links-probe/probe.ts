/**
 * Vertex AI grounding links probe: where Gemini puts redirect links, how the redirect host answers, and what breaks it.
 * Measurements and expectations: README.md next to this file.
 *
 *   GEMINI_API_KEY=... npx tsx tools/develop/vertex-links-probe/probe.ts fresh [model] [calls] [links.json]
 *   npx tsx tools/develop/vertex-links-probe/probe.ts burst <links.json> [64,256,1024]
 *   npx tsx tools/develop/vertex-links-probe/probe.ts expired
 */

import * as fs from 'node:fs';

import { VERTEX_GROUNDING_REDIRECT_REGEX } from '~/modules/google/vertexai.types';


// links from 2026-06-11 (gemini-2.5-flash grounding): 302 at 8 days, 404 by 2026-11-05
const EXPIRED_SAMPLES = [
  'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHvVhBBwjWESwXcWQH8wm6MNDyJY3FOqt7Q4Jkij_DodoMI0dtx5g-q6BNc6CxgGKmQWrCjLDQ_5-4bIQSzAE2akCOrP-R4EaS91YKk6Bfu153zEuCxXN1Vlcx9IOIBOQmw8l5_wnPvYNFdHNLAs6cw',
  'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzT0gP8RsQ3cubKcoSls7Ulx7EMeivI9lQif4L_lxesigitp1B2z0Gj1qXeOnz-4uz2LZBVeHpiOZDC2YkG3AxsMtvyemyiXZoFbf_XBVViN9zTGdxX0bU21uPaFf097ziki1ZgOo=',
  'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGaUi-68RO0Z6q27stfE1FP4dik7qFfua4kQVVPrK3rREt_jR9saoCWYUlL6xlwsAiQuXmOi2ek1Eje9-AlNxbfw6NMHOK0HWjbeur3A-Q7jMNuvytk0_X93WmGfMI=',
];

const TOPICS = ['fusion energy startups this year', 'EU AI Act enforcement actions', 'solid state battery breakthroughs', 'quantum error correction progress',
  'JWST exoplanet findings', 'US high speed rail projects', 'Mars rover discoveries', 'the latest TypeScript release'];


type Head = { url: string, status: number | string, ms: number };

async function head(url: string, timeoutMs = 10_000): Promise<Head> {
  const start = Date.now();
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    return { url, status: response.status >= 300 && response.status < 400 && !response.headers.get('location')?.startsWith('http') ? `${response.status} no location` : response.status, ms: Date.now() - start };
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? (error.cause as Error & { code?: string }).code ?? error.cause.message : undefined;
    return { url, status: `error ${cause ?? (error instanceof Error ? error.name : String(error))}`, ms: Date.now() - start };
  }
}

function summary(label: string, heads: Head[]) {
  const ms = heads.map(h => h.ms).sort((a, b) => a - b);
  const at = (p: number) => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] ?? NaN;
  const statuses: Record<string, number> = {};
  for (const { status } of heads) statuses[status] = (statuses[status] ?? 0) + 1;
  console.log(`${label.padEnd(14)} n=${heads.length} p50=${at(.5)}ms p99=${at(.99)}ms max=${ms.at(-1)}ms`, statuses);
}

/** Streams answers with Search + URL Context (as the app sends them), HEADs each link at first sight, +1s and +5s. */
async function fresh(model: string, calls: number, outFile?: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const firstSight: Promise<Head>[] = [], later: Promise<Head>[] = [];
  const all = new Set<string>();

  const runs = await Promise.all(TOPICS.slice(0, calls).map(async topic => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `Research ${topic}. Read the most relevant sources in full. End with a "Sources" section listing every source as a markdown link with its exact URL.` }] }],
        tools: [{ googleSearch: {} }, { urlContext: {} }], toolConfig: { includeServerSideToolInvocations: true },
      }),
    });
    if (!response.ok || !response.body) return { topic, error: `HTTP ${response.status}: ${(await response.text()).slice(0, 200)}` };

    const where: Record<string, number> = {};
    const see = (source: string, value: unknown) => {
      for (const [url] of JSON.stringify(value).matchAll(VERTEX_GROUNDING_REDIRECT_REGEX)) {
        where[source] = (where[source] ?? 0) + 1;
        if (all.has(url)) continue;
        all.add(url);
        firstSight.push(head(url));
        later.push(new Promise<Head>(resolve => setTimeout(() => resolve(head(url)), 1000)), new Promise<Head>(resolve => setTimeout(() => resolve(head(url)), 5000)));
      }
    };

    let text = '', buffer = '';
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n'); // Gemini separates events with CRLF
      for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!line.startsWith('data: ')) continue;
        const candidate = JSON.parse(line.slice(6)).candidates?.[0];
        for (const part of candidate?.content?.parts ?? []) {
          if (part.text) text += part.text; // scanned once complete: mid-stream it holds cut-off links, which 404
          if (part.toolCall) see(`toolCall ${part.toolCall.toolType}`, part.toolCall);
          if (part.toolResponse) see(`toolResponse ${part.toolResponse.toolType}`, part.toolResponse);
        }
        if (candidate?.groundingMetadata?.groundingChunks) see('grounding', candidate.groundingMetadata.groundingChunks);
      }
    }
    see('text', text);
    return { topic, where };
  }));

  console.log(`${model}: ${all.size} links`);
  runs.forEach(run => console.log(' ', JSON.stringify(run)));
  const heads = await Promise.all(firstSight);
  summary('first sight', heads);
  summary('+1s and +5s', await Promise.all(later));
  if (outFile) fs.writeFileSync(outFile, JSON.stringify([...all], null, 1));
}

/** HEADs the links at rising concurrency, twice the concurrency in requests per level, until something is not a 302. */
async function burst(linksFile: string, levels: number[]) {
  const links: string[] = JSON.parse(fs.readFileSync(linksFile, 'utf8'));
  for (const concurrency of levels) {
    const total = Math.max(concurrency * 2, links.length), heads: Head[] = [];
    let next = 0;
    const start = Date.now();
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (next < total) heads.push(await head(links[next++ % links.length]));
    }));
    summary(`${concurrency} in flight`, heads);
    console.log(`  wall ${Date.now() - start}ms`);
    if (heads.some(h => h.status !== 302)) break;
  }
}


const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'fresh':
    void fresh(args[0] ?? 'gemini-4-argon', Number(args[1] ?? 4), args[2]);
    break;
  case 'burst':
    void burst(args[0], (args[1] ?? '64,256,1024').split(',').map(Number));
    break;
  case 'expired':
    void Promise.all(EXPIRED_SAMPLES.map(url => head(url))).then(heads => summary('expired', heads));
    break;
  default:
    console.log('usage: probe.ts fresh [model] [calls] [links.json] | burst <links.json> [levels] | expired');
}
