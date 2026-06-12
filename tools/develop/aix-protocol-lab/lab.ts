/**
 * AIX Protocol Lab - CLI entry point.
 *
 * Protocol microscope for the AIX decode layer: capture timestamped wire streams through the
 * REAL dispatch pipeline (adapters + demuxers + parsers + executor), pair every wire event with
 * the transmitter calls and particles it produced, replay captures offline, fetch the
 * non-streaming oracle for stored-response APIs, run differential checks, and render
 * paired-ledger HTML.
 *
 * Run from the repo root:
 *   npx tsx tools/develop/aix-protocol-lab/lab.ts list
 *   npx tsx tools/develop/aix-protocol-lab/lab.ts capture anthropic-messages kitchen-sink
 *   npx tsx tools/develop/aix-protocol-lab/lab.ts capture openai-responses search --ns --oracle
 *   npx tsx tools/develop/aix-protocol-lab/lab.ts replay captures/<file>.json
 *   npx tsx tools/develop/aix-protocol-lab/lab.ts report captures/<file>.json
 *   npx tsx tools/develop/aix-protocol-lab/lab.ts diff <a>.json <b>.json [--exact]
 *   npx tsx tools/develop/aix-protocol-lab/lab.ts matrix kitchen-sink
 *
 * API keys: looked up in process.env, then .env.api-keys / .env.local / .env at the repo root.
 * Keys never enter the trace files (request headers are not recorded).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { classifyNotable, compareProjections, projectParticles, runChecks } from './checks';
import { captureRun, isLabFlavor, LAB_FLAVORS, oracleRun, replayRun } from './engine';
import { findScenario, LAB_DEFAULT_MODELS, LAB_SCENARIOS } from './scenarios';
import { LabFlavor, LabRun } from './trace';
import { renderFindingsTerminal, renderReportTerminal, renderTerminal } from './render-terminal';
import { renderHtml } from './render-html';


const LAB_DIR = path.dirname(fileURLToPath(import.meta.url));
const CAPTURES_DIR = path.join(LAB_DIR, 'captures');


// -- file helpers --

function _stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

function _saveRun(run: LabRun, kindSuffix: string, baseName?: string): string {
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
  const base = baseName ?? `${run.meta.scenarioId}.${run.meta.flavor}.${_stamp()}`;
  const filePath = path.join(CAPTURES_DIR, `${base}.${kindSuffix}.json`);
  fs.writeFileSync(filePath, JSON.stringify(run, null, 1));
  return filePath;
}

function _loadRun(filePath: string): LabRun {
  const run = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as LabRun;
  if (run?.v !== 1 || !run.meta || !Array.isArray(run.segments))
    throw new Error(`${filePath} is not a lab run file`);
  return run;
}

function _writeHtml(run: LabRun, runFilePath: string): string {
  const htmlPath = runFilePath.replace(/\.json$/, '.html');
  fs.writeFileSync(htmlPath, renderHtml(run, runChecks(run)));
  return htmlPath;
}

function _rel(p: string): string {
  return path.relative(process.cwd(), p);
}


// -- commands --

function cmdList(): void {
  console.log('flavors:');
  for (const flavor of LAB_FLAVORS)
    console.log(`  ${flavor.padEnd(22)} default model: ${LAB_DEFAULT_MODELS[flavor]}`);
  console.log('\nscenarios:');
  for (const s of LAB_SCENARIOS) {
    const caps = Object.entries(s.caps).filter(([, v]) => v).map(([k]) => k).join('+') || 'none';
    console.log(`  ${s.id.padEnd(14)} [${caps}] ${s.description}`);
  }
}

async function cmdCapture(flavor: LabFlavor, scenarioId: string, flags: { model?: string; ns?: boolean; oracle?: boolean; noStream?: boolean; timeout?: string; echo?: boolean; quietEvents?: boolean }): Promise<void> {
  findScenario(scenarioId); // validate early
  const timeoutMs = flags.timeout ? parseInt(flags.timeout, 10) * 1000 : undefined;
  const base = `${scenarioId}.${flavor}.${_stamp()}`;

  // streaming capture (or NS-only with --no-stream)
  const streaming = !flags.noStream;
  console.log(`capturing ${flavor} / ${scenarioId} (${streaming ? 'streaming' : 'non-streaming'})...`);
  const { run, keySource, unsupportedCaps } = await captureRun({
    flavor, scenarioId, modelIdOverride: flags.model, streaming,
    enableResumability: !!flags.oracle, timeoutMs, echoConsole: flags.echo,
  });
  if (unsupportedCaps.length)
    console.log(`note: capability switches without a mapping on ${flavor}: ${unsupportedCaps.join(', ')}`);
  console.log(`key: ${keySource}`);
  const runPath = _saveRun(run, streaming ? 's' : 'ns', base);
  console.log(renderTerminal(run, { events: !flags.quietEvents }));
  console.log(renderReportTerminal(runChecks(run)));
  console.log(`\nrun:  ${_rel(runPath)}\nhtml: ${_rel(_writeHtml(run, runPath))}`);

  // NS twin (a separate generation - structural comparison only)
  if (flags.ns && streaming) {
    console.log(`\ncapturing NS twin...`);
    const twin = await captureRun({ flavor, scenarioId, modelIdOverride: flags.model, streaming: false, timeoutMs, echoConsole: flags.echo });
    const twinPath = _saveRun(twin.run, 'ns', base);
    console.log(renderTerminal(twin.run, { events: false }));
    console.log(`twin: ${_rel(twinPath)}  html: ${_rel(_writeHtml(twin.run, twinPath))}`);
    console.log('\nstreaming vs NS twin (structural, separate generations):');
    console.log(renderFindingsTerminal(compareProjections('S', projectParticles(run.finalParticles), 'NS', projectParticles(twin.run.finalParticles), false)));
  }

  // oracle: the SAME stored generation, fetched non-streaming (exact comparison)
  if (flags.oracle) {
    console.log(`\nfetching oracle (same generation, non-streaming)...`);
    try {
      const oracle = await oracleRun(run, timeoutMs, flags.echo);
      const oraclePath = _saveRun(oracle, 'oracle', base);
      console.log(renderTerminal(oracle, { events: false }));
      console.log(`oracle: ${_rel(oraclePath)}  html: ${_rel(_writeHtml(oracle, oraclePath))}`);
      console.log('\nstreaming vs oracle (exact, same generation):');
      console.log(renderFindingsTerminal(compareProjections('S', projectParticles(run.finalParticles), 'ORACLE', projectParticles(oracle.finalParticles), true)));
    } catch (error: any) {
      console.log(`oracle failed: ${error?.message}`);
    }
  }
}

async function cmdReplay(runFile: string, flags: { echo?: boolean }): Promise<void> {
  const source = _loadRun(runFile);
  console.log(`replaying ${_rel(runFile)} through the live parsers...`);
  const replayed = await replayRun(source, path.basename(runFile), flags.echo);
  const replayPath = _saveRun(replayed, 'replay', path.basename(runFile).replace(/\.json$/, ''));
  console.log(renderTerminal(replayed));
  console.log(renderReportTerminal(runChecks(replayed)));
  console.log(`\nreplay: ${_rel(replayPath)}  html: ${_rel(_writeHtml(replayed, replayPath))}`);

  // replay fidelity: same bytes through the same pipeline must produce the same translation
  console.log('\nreplay fidelity (capture vs replay, exact):');
  console.log(renderFindingsTerminal(compareProjections('CAPTURE', projectParticles(source.finalParticles), 'REPLAY', projectParticles(replayed.finalParticles), true)));
  const srcEvents = source.segments.reduce((a, s) => a + s.events.length, 0);
  const repEvents = replayed.segments.reduce((a, s) => a + s.events.length, 0);
  if (srcEvents !== repEvents)
    console.log(`WARN  replay-events  capture parsed ${srcEvents} events, replay parsed ${repEvents} (demuxer/chunking difference)`);
}

function cmdReport(runFile: string): void {
  const run = _loadRun(runFile);
  console.log(renderTerminal(run, { events: false }));
  console.log(renderReportTerminal(runChecks(run)));
  console.log(`html: ${_rel(_writeHtml(run, runFile))}`);
}

function cmdHtml(runFile: string, out?: string): void {
  const run = _loadRun(runFile);
  const htmlPath = out ?? runFile.replace(/\.json$/, '.html');
  fs.writeFileSync(htmlPath, renderHtml(run, runChecks(run)));
  console.log(_rel(htmlPath));
}

function cmdDiff(fileA: string, fileB: string, exact: boolean): void {
  const a = _loadRun(fileA), b = _loadRun(fileB);
  console.log(`diff (${exact ? 'exact - same generation expected' : 'structural - twins'}):\n  A: ${_rel(fileA)}\n  B: ${_rel(fileB)}\n`);
  console.log(renderFindingsTerminal(compareProjections('A', projectParticles(a.finalParticles), 'B', projectParticles(b.finalParticles), exact)));
}

/**
 * Hunt mode: repeat a capture N times, keep only anomalous traces, aggregate findings.
 * Built for rare-event hunting (e.g. OpenAI Responses out-of-order/interleaving): single runs
 * prove nothing about rare behavior; this turns the lab into a detector.
 */
async function cmdHunt(flavor: LabFlavor, scenarioId: string, flags: { runs?: string; model?: string; timeout?: string; keepAll?: boolean }): Promise<void> {
  findScenario(scenarioId);
  const totalRuns = flags.runs ? parseInt(flags.runs, 10) : 5;
  const timeoutMs = flags.timeout ? parseInt(flags.timeout, 10) * 1000 : undefined;
  const codeCounts = new Map<string, number>();
  const rows: string[] = [];
  let kept = 0;

  console.log(`hunting: ${flavor} / ${scenarioId} x ${totalRuns} runs (keeping ${flags.keepAll ? 'all' : 'only notable'} traces)\n`);
  for (let i = 1; i <= totalRuns; i++) {
    const startedAt = Date.now();
    try {
      const { run } = await captureRun({ flavor, scenarioId, modelIdOverride: flags.model, streaming: true, timeoutMs });
      const report = runChecks(run);
      const { notable, reasons } = classifyNotable(run, report);
      for (const reason of reasons)
        codeCounts.set(reason, (codeCounts.get(reason) ?? 0) + 1);
      const events = run.segments.reduce((a, s) => a + s.events.length, 0);
      let fileNote = '';
      if (notable || flags.keepAll) {
        const runPath = _saveRun(run, 's', `${scenarioId}.${flavor}.hunt${String(i).padStart(2, '0')}.${_stamp()}`);
        _writeHtml(run, runPath);
        fileNote = ` -> ${path.basename(runPath)}`;
        kept++;
      }
      const status = notable ? `NOTABLE [${reasons.join(', ')}]` : 'clean';
      rows.push(`run ${String(i).padStart(2)}/${totalRuns}  ${events} ev  ${Date.now() - startedAt}ms  ${status}${fileNote}`);
      console.log(rows[rows.length - 1]);
    } catch (error: any) {
      rows.push(`run ${String(i).padStart(2)}/${totalRuns}  FAILED: ${error?.message}`);
      console.log(rows[rows.length - 1]);
      codeCounts.set('engine-failure', (codeCounts.get('engine-failure') ?? 0) + 1);
    }
  }

  console.log(`\nhunt summary: ${totalRuns} runs, ${kept} trace(s) kept`);
  if (codeCounts.size) {
    console.log('finding frequency across runs:');
    for (const [code, count] of [...codeCounts.entries()].sort((a, b) => b[1] - a[1]))
      console.log(`  ${String(count).padStart(3)}x  ${code}`);
  } else {
    console.log('no notable findings: all runs clean against the grammar, coverage, and parser checks.');
  }
}

async function cmdMatrix(scenarioId: string, flags: { flavors?: string; ns?: boolean; timeout?: string }): Promise<void> {
  const flavors = (flags.flavors ? flags.flavors.split(',') : LAB_FLAVORS).filter(isLabFlavor);
  for (const flavor of flavors) {
    console.log(`\n===== ${flavor} =====`);
    try {
      await cmdCapture(flavor, scenarioId, { ns: flags.ns, timeout: flags.timeout, quietEvents: true });
    } catch (error: any) {
      console.log(`skipped: ${error?.message}`);
    }
  }
}


// -- main --

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      model: { type: 'string' },
      ns: { type: 'boolean' },
      oracle: { type: 'boolean' },
      'no-stream': { type: 'boolean' },
      timeout: { type: 'string' },
      echo: { type: 'boolean' },
      'quiet-events': { type: 'boolean' },
      exact: { type: 'boolean' },
      flavors: { type: 'string' },
      out: { type: 'string', short: 'o' },
      runs: { type: 'string' },
      'keep-all': { type: 'boolean' },
    },
  });

  const [command, ...rest] = positionals;
  switch (command) {
    case 'list':
      return cmdList();
    case 'capture': {
      const [flavor, scenarioId] = rest;
      if (!flavor || !isLabFlavor(flavor) || !scenarioId)
        throw new Error(`usage: capture <${LAB_FLAVORS.join('|')}> <scenario> [--model id] [--ns] [--oracle] [--no-stream] [--timeout s] [--echo]`);
      return await cmdCapture(flavor, scenarioId, { model: values.model, ns: values.ns, oracle: values.oracle, noStream: values['no-stream'], timeout: values.timeout, echo: values.echo, quietEvents: values['quiet-events'] });
    }
    case 'replay':
      if (!rest[0]) throw new Error('usage: replay <run.json> [--echo]');
      return await cmdReplay(rest[0], { echo: values.echo });
    case 'report':
      if (!rest[0]) throw new Error('usage: report <run.json>');
      return cmdReport(rest[0]);
    case 'html':
      if (!rest[0]) throw new Error('usage: html <run.json> [-o out.html]');
      return cmdHtml(rest[0], values.out);
    case 'diff':
      if (!rest[0] || !rest[1]) throw new Error('usage: diff <a.json> <b.json> [--exact]');
      return cmdDiff(rest[0], rest[1], !!values.exact);
    case 'hunt': {
      const [flavor, scenarioId] = rest;
      if (!flavor || !isLabFlavor(flavor) || !scenarioId)
        throw new Error(`usage: hunt <${LAB_FLAVORS.join('|')}> <scenario> [--runs N] [--model id] [--timeout s] [--keep-all]`);
      return await cmdHunt(flavor, scenarioId, { runs: values.runs, model: values.model, timeout: values.timeout, keepAll: values['keep-all'] });
    }
    case 'matrix':
      if (!rest[0]) throw new Error('usage: matrix <scenario> [--flavors f1,f2] [--ns] [--timeout s]');
      return await cmdMatrix(rest[0], { flavors: values.flavors, ns: values.ns, timeout: values.timeout });
    default:
      cmdList();
      console.log('\ncommands: list · capture · replay · report · html · diff · matrix · hunt   (see file header for usage)');
  }
}

main().catch((error) => {
  console.error(`\nlab error: ${error?.message ?? error}`);
  process.exit(1);
});
