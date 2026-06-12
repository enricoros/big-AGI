/**
 * AIX Protocol Lab - terminal ledger.
 *
 * Compact colored stdout view: one line per wire event with its paired transmitter calls,
 * particles and diagnostics indented under it. The HTML ledger is the full instrument;
 * this is the at-a-glance view after a capture or replay.
 */

import type { LabReport } from './checks';
import type { LabEvent, LabRun } from './trace';
import { projectionSignature } from './checks';


// minimal ANSI palette (matches the probe/sweep tools: no deps)
const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
};
const paint = (color: string, s: string) => `${color}${s}${C.reset}`;


function _eventLabel(run: LabRun, ev: LabEvent): string {
  if (ev.name) return ev.name;
  const d = ev.data as any;
  return d?.type // openai-responses
    ?? (d?.choices?.[0] ? 'cc-chunk' : undefined) // openai chat completions
    ?? (d?.candidates ? 'gem-chunk' : undefined) // gemini generateContent
    ?? (run.meta.streaming ? 'event' : 'full-body');
}

function _particleLabel(p: any): string {
  if ('t' in p) return paint(C.green, `t "${_ellipsize(p.t, 50)}"`);
  if ('cg' in p) {
    const detail = p.cg === 'end' ? ` ${p.terminationReason}${p.tokenStopReason ? '/' + p.tokenStopReason : ''}`
      : p.cg === 'set-model' ? ` ${p.name}`
        : p.cg === 'issue' ? ` ${_ellipsize(p.issueText, 60)}`
          : p.cg === 'set-upstream-handle' ? ` ${p.handle?.runId}`
            : p.cg === 'set-metrics' ? ` ${JSON.stringify(p.metrics)}`
              : '';
    return paint(C.gray, `cg:${p.cg}${detail}`);
  }
  switch (p.p) {
    case '❤':
      return paint(C.gray, '❤');
    case 'tr_':
      return paint(C.magenta, `tr_ "${_ellipsize(p._t, 50)}"`);
    case 'trs':
      return paint(C.magenta, 'trs (signature)');
    case 'trr_':
      return paint(C.magenta, `trr_ (${p._data?.length ?? 0} redacted chars)`);
    case 'fci':
      return paint(C.yellow, `fci ${p.name} (${p.id})${p.i_args ? ` args:"${_ellipsize(p.i_args, 40)}"` : ''}`);
    case '_fci':
      return paint(C.yellow, `_fci +"${_ellipsize(p._args, 40)}"`);
    case 'cei':
      return paint(C.yellow, `cei ${p.language} (${p.code?.length} chars)`);
    case 'cer':
      return paint(C.yellow, `cer ${p.error ? 'ERROR' : 'ok'} (${p.result?.length} chars)`);
    case 'vp':
      return paint(C.cyan, `vp ${p.mot}${p.state ? `:${p.state}` : ''}${p.parentOpId ? ' (nested)' : ''} "${_ellipsize(p.text, 40)}"${p.iTexts ? ` i:${p.iTexts.join('').length}ch` : ''}${p.oTexts ? ` o:${p.oTexts.join('').length}ch` : ''}`);
    case 'urlc':
      return paint(C.blue, `urlc ${_ellipsize(p.url, 60)}`);
    case 'ii':
      return paint(C.blue, `ii ${p.mimeType} (${p.i_b64?.length ?? 0} b64)`);
    case 'ia':
      return paint(C.blue, `ia ${p.mimeType}`);
    case 'hres':
      return paint(C.blue, `hres ${p.kind}`);
    case 'svs':
      return paint(C.gray, `svs ${p.vendor}`);
    default:
      return paint(C.gray, JSON.stringify(p).slice(0, 80));
  }
}

function _ellipsize(s: string | undefined, max: number): string {
  if (!s) return '';
  const flat = s.replace(/\n/g, '\\n');
  return flat.length <= max ? flat : flat.slice(0, max) + '…';
}


export function renderTerminal(run: LabRun, opts?: { events?: boolean }): string {
  const lines: string[] = [];
  const m = run.meta;
  lines.push(paint(C.bold, `── ${m.scenarioId} · ${m.flavor} · ${m.modelId} · ${m.streaming ? 'streaming' : 'non-streaming'} · ${m.kind} ──`));

  run.segments.forEach((seg, si) => {
    const reqSize = seg.request.body ? JSON.stringify(seg.request.body).length : 0;
    lines.push(paint(C.bold, `segment ${si}`) + paint(C.gray, `  POST ${seg.request.url}  body:${reqSize.toLocaleString()}ch  rawChunks:${seg.rawChunks?.length ?? 0}  events:${seg.events.length}`));
    if (opts?.events !== false)
      for (const ev of seg.events) {
        lines.push(`  ${paint(C.gray, `#${String(ev.i).padStart(3)} +${String(ev.t).padStart(6)}ms`)} ${paint(C.bold, _eventLabel(run, ev))} ${paint(C.gray, `${ev.size}ch`)}${ev.parseError ? paint(C.red, `  PARSE: ${ev.parseError}`) : ''}`);
        for (const particle of ev.particles)
          lines.push(`        ${_particleLabel(particle)}`);
        for (const diag of ev.diags)
          lines.push(`        ${paint(diag.level === 'log' ? C.gray : C.red, `⚑ ${_ellipsize(diag.text, 140)}`)}`);
      }
    for (const diag of seg.looseDiags)
      lines.push(`  ${paint(diag.level === 'log' ? C.gray : C.red, `⚑ ${_ellipsize(diag.text, 140)}`)}`);
  });

  const o = run.outcome;
  lines.push(paint(o.ok ? C.green : C.red, `outcome: ${o.ok ? 'ok' : 'NOT-OK'}  end:${o.endReason ?? '?'}  stop:${o.tokenStopReason ?? '?'}  ${o.durationMs}ms${o.aborted ? '  ABORTED' : ''}${o.error ? `  error:${o.error}` : ''}`));
  return lines.join('\n');
}


export function renderReportTerminal(report: LabReport): string {
  const lines: string[] = [];

  const sectionFindings = (title: string, findings: { severity: string; code: string; text: string; where?: string }[]) => {
    lines.push(paint(C.bold, `· ${title}`) + (findings.length ? '' : paint(C.green, '  clean')));
    for (const f of findings) {
      const color = f.severity === 'error' ? C.red : f.severity === 'warn' ? C.yellow : C.gray;
      lines.push(`  ${paint(color, f.severity.toUpperCase().padEnd(5))} ${f.code}${f.where ? paint(C.gray, ` @${f.where}`) : ''}  ${f.text}`);
    }
  };

  sectionFindings('wire grammar', report.grammar);
  if (report.sequencing.length)
    sectionFindings('deep sequencing (seq chain · lifecycle · delta-vs-done · final-output oracle)', report.sequencing);
  sectionFindings('event coverage (raw re-demux vs parsed)', report.coverage);

  lines.push(paint(C.bold, '· translation loss (wire -> particles)'));
  for (const row of report.loss) {
    const color = row.verdict === 'full' ? C.green : row.verdict === 'partial' ? C.yellow : row.verdict === 'dropped' ? C.red : C.gray;
    lines.push(`  ${paint(color, row.verdict.padEnd(8))} ${row.category.padEnd(38)} wire: ${row.wire.padEnd(34)} particles: ${row.particles}${row.note ? paint(C.gray, `\n           ${row.note}`) : ''}`);
  }

  lines.push(paint(C.bold, '· parser diagnostics') + `  ${report.parserDiags.warns ? paint(C.yellow, `${report.parserDiags.warns} warnings`) : paint(C.green, 'no warnings')}, ${report.parserDiags.logs} logs`);
  for (const sample of report.parserDiags.samples)
    lines.push(paint(C.yellow, `  ⚑ ${sample}`));

  lines.push(paint(C.bold, '· projection ') + projectionSignature(report.projection));
  return lines.join('\n');
}


export function renderFindingsTerminal(findings: { severity: string; code: string; text: string }[]): string {
  return findings.map(f => {
    const color = f.severity === 'error' ? C.red : f.severity === 'warn' ? C.yellow : C.gray;
    return `${paint(color, f.severity.toUpperCase().padEnd(5))} ${f.code}  ${f.text}`;
  }).join('\n');
}
