/**
 * Antigravity probe + parser-replay harness.
 *
 * Why: when the upstream surface keeps growing (new tool delta types, new sandbox tools), guessing
 * shapes from docs alone is brittle. This script captures a real SSE stream and replays it through
 * the actual parser (createGeminiInteractionsParserSSE), so we see exactly what the parser does and
 * what gets surfaced vs silent-skipped.
 *
 * Usage:
 *   GEMINI_API_KEY=... npx tsx tools/develop/aix-gemini-antigravity-probe/probe.ts run "<prompt>"
 *   GEMINI_API_KEY=... npx tsx tools/develop/aix-gemini-antigravity-probe/probe.ts capture <file> "<prompt>"
 *   npx tsx tools/develop/aix-gemini-antigravity-probe/probe.ts replay <file>
 *
 * The `run` subcommand captures to tools/develop/aix-gemini-antigravity-probe/captures/<ts>.jsonl then replays.
 * Captures persist so you can diff parser output across changes without re-hitting the API.
 *
 * Output: one line per parser-emitted particle, plus a delta-type histogram and any unknown shapes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { createGeminiInteractionsParserSSE } from '~/modules/aix/server/dispatch/chatGenerate/parsers/gemini.interactions.parser';
import type { IParticleTransmitter } from '~/modules/aix/server/dispatch/chatGenerate/parsers/IParticleTransmitter';


// -- Mock IParticleTransmitter: records every call in arrival order --

type LogEntry = { call: string; args: unknown[] };

function createRecordingTransmitter(): { pt: IParticleTransmitter; log: LogEntry[] } {
  const log: LogEntry[] = [];
  const rec = (call: string) => (...args: unknown[]) => { log.push({ call, args }); };
  const pt: IParticleTransmitter = {
    setDialectEnded: rec('setDialectEnded'),
    setDialectTerminatingIssue: rec('setDialectTerminatingIssue'),
    setTokenStopReason: rec('setTokenStopReason'),
    endMessagePart: rec('endMessagePart'),
    appendText: rec('appendText'),
    appendReasoningText: rec('appendReasoningText'),
    setReasoningSignature: rec('setReasoningSignature'),
    addReasoningRedactedData: rec('addReasoningRedactedData'),
    appendAutoText_weak: rec('appendAutoText_weak'),
    appendAudioInline: rec('appendAudioInline'),
    appendImageInline: rec('appendImageInline'),
    appendHostedResource: rec('appendHostedResource'),
    startFunctionCallInvocation: rec('startFunctionCallInvocation'),
    appendFunctionCallInvocationArgs: rec('appendFunctionCallInvocationArgs'),
    addCodeExecutionInvocation: rec('addCodeExecutionInvocation'),
    addCodeExecutionResponse: rec('addCodeExecutionResponse'),
    appendUrlCitation: rec('appendUrlCitation'),
    sendCGControl: rec('sendCGControl'),
    sendOperationState: rec('sendOperationState'),
    sendSetVendorState: rec('sendSetVendorState'),
    setModelName: rec('setModelName'),
    setProviderInfraLabel: rec('setProviderInfraLabel'),
    setUpstreamHandle: rec('setUpstreamHandle'),
    updateMetrics: rec('updateMetrics'),
  };
  return { pt, log };
}


// -- SSE frame helpers --

type SSEFrame = { event: string; data: string };

function parseSSEFrames(raw: string): SSEFrame[] {
  const frames: SSEFrame[] = [];
  for (const chunk of raw.split('\n\n')) {
    if (!chunk.trim()) continue;
    let event = '';
    const dataLines: string[] = [];
    for (const line of chunk.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    frames.push({ event, data: dataLines.join('\n') });
  }
  return frames;
}


// -- Capture --

async function captureToFile(prompt: string, outPath: string): Promise<void> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error('GEMINI_API_KEY not set');
  const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const body = {
    agent: 'antigravity-preview-05-2026',
    input: prompt,
    stream: true,
    store: true,
    background: false,
    environment: 'remote',
  };

  console.log('[capture] POST', url);
  console.log('[capture] prompt:', JSON.stringify(prompt));
  console.log('[capture] -> output:', outPath);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const out = fs.createWriteStream(outPath, { flags: 'w' });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY, 'Accept': 'text/event-stream' },
    body: JSON.stringify(body),
  });
  console.log('[capture] HTTP', res.status, res.headers.get('content-type'));
  if (!res.ok) { console.error(await res.text()); throw new Error(`HTTP ${res.status}`); }

  // Write the request envelope as the first JSONL record for context
  out.write(JSON.stringify({ _meta: { prompt, requestBody: body, started: new Date().toISOString() } }) + '\n');

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let frameCount = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frameText = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const frames = parseSSEFrames(frameText + '\n\n');
      for (const f of frames) {
        out.write(JSON.stringify(f) + '\n');
        frameCount++;
      }
    }
  }
  out.end();
  console.log(`[capture] wrote ${frameCount} frames to ${outPath}`);
}


// -- Replay --

type ReplayOptions = { modelName?: string };

function replayFromFile(filePath: string, opts: ReplayOptions = {}): void {
  const modelName = opts.modelName ?? 'antigravity-preview-05-2026';
  console.log('[replay]', filePath, '(model:', modelName, ')');

  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  if (!lines.length) { console.error('empty file'); return; }

  // First line may be a _meta envelope
  let firstIdx = 0;
  try {
    const first = JSON.parse(lines[0]);
    if (first?._meta) {
      console.log('[replay] meta:', first._meta.prompt);
      firstIdx = 1;
    }
  } catch { /* not JSON */ }

  const { pt, log } = createRecordingTransmitter();
  const parse = createGeminiInteractionsParserSSE(modelName);

  // Track delta-type histogram + collect any "unknown shape" hits
  const deltaTypes: Record<string, number> = {};
  let totalFrames = 0;

  // Intercept console.warn during the parse to capture parser warnings inline
  const origWarn = console.warn;
  const warnings: { msg: string; args: unknown[] }[] = [];
  console.warn = (msg?: any, ...args: any[]) => {
    if (typeof msg === 'string') warnings.push({ msg, args });
    origWarn.call(console, '[parser-warn]', msg, ...args);
  };

  try {
    for (let i = firstIdx; i < lines.length; i++) {
      const f = JSON.parse(lines[i]) as SSEFrame;
      totalFrames++;
      // delta-type histogram
      if (f.event === 'content.delta') {
        try {
          const p = JSON.parse(f.data);
          const t = p?.delta?.type ?? '(no-type)';
          deltaTypes[t] = (deltaTypes[t] ?? 0) + 1;
        } catch {}
      }
      // hand the raw data + event-name to the parser
      parse(pt, f.data, f.event);
    }
  } finally {
    console.warn = origWarn;
  }

  console.log(`\n[replay] frames processed: ${totalFrames}`);

  if (Object.keys(deltaTypes).length) {
    console.log('\n[replay] content.delta type histogram:');
    for (const [t, n] of Object.entries(deltaTypes).sort((a, b) => b[1] - a[1]))
      console.log(`  ${String(n).padStart(4)}  ${t}`);
  }

  if (warnings.length) {
    console.log(`\n[replay] parser warnings: ${warnings.length}`);
    for (const w of warnings.slice(0, 10)) console.log('  -', w.msg, JSON.stringify(w.args).slice(0, 200));
    if (warnings.length > 10) console.log(`  ... and ${warnings.length - 10} more`);
  }

  // Particle log (pretty)
  console.log(`\n[replay] particles emitted: ${log.length}`);
  const interesting = ['sendOperationState', 'appendText', 'appendReasoningText', 'setUpstreamHandle', 'setModelName', 'setTokenStopReason', 'setDialectEnded', 'setDialectTerminatingIssue', 'updateMetrics', 'endMessagePart', 'appendImageInline', 'appendUrlCitation'];
  const histogram: Record<string, number> = {};
  for (const e of log) histogram[e.call] = (histogram[e.call] ?? 0) + 1;
  console.log('  histogram:', JSON.stringify(histogram));

  // Dump non-text particles in order (text would flood the log)
  console.log('\n[replay] non-text particles (in order):');
  let printed = 0;
  for (const e of log) {
    if (e.call === 'appendText' || e.call === 'appendReasoningText' || e.call === 'appendAutoText_weak') continue;
    if (!interesting.includes(e.call) && printed > 40) continue;
    printed++;
    console.log('  ·', e.call, _summarizeArgs(e.args));
    if (printed > 80) { console.log('  ... (truncated; pass --full to dump all)'); break; }
  }
}

function _summarizeArgs(args: unknown[]): string {
  try {
    const s = JSON.stringify(args);
    return s.length > 220 ? s.slice(0, 217) + '...' : s;
  } catch { return '[unserializable]'; }
}


// -- CLI --

function tsCaptureName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `antigravity-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jsonl`;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    console.log('usage:');
    console.log('  run "<prompt>"             # capture to scripts/dev/captures/<ts>.jsonl, then replay');
    console.log('  capture <file> "<prompt>"  # capture only');
    console.log('  replay <file>              # replay a previously captured file through the parser');
    process.exit(1);
  }

  const capturesDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), 'captures');

  if (cmd === 'run') {
    const prompt = rest.join(' ');
    if (!prompt) { console.error('missing prompt'); process.exit(1); }
    const outPath = path.join(capturesDir, tsCaptureName());
    await captureToFile(prompt, outPath);
    console.log('---');
    replayFromFile(outPath);
    return;
  }

  if (cmd === 'capture') {
    const [file, ...promptParts] = rest;
    if (!file) { console.error('missing file'); process.exit(1); }
    const prompt = promptParts.join(' ');
    if (!prompt) { console.error('missing prompt'); process.exit(1); }
    await captureToFile(prompt, file);
    return;
  }

  if (cmd === 'replay') {
    const [file] = rest;
    if (!file) { console.error('missing file'); process.exit(1); }
    replayFromFile(file);
    return;
  }

  console.error('unknown command:', cmd);
  process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
