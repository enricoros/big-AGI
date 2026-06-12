/**
 * AIX Protocol Lab - paired-ledger HTML renderer.
 *
 * Self-contained single-file HTML: wire events on the left (decoded payloads expandable),
 * the decode layer's reaction on the right (transmitter calls, emitted particles, console
 * diagnostics), anomalies highlighted. No external assets, no server - open in any browser.
 */

import type { LabReport } from './checks';
import type { LabEvent, LabRun, LabSegment } from './trace';
import { projectionSignature } from './checks';


function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _json(value: unknown, maxChars = 250_000): string {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2) ?? 'undefined';
  } catch {
    text = String(value);
  }
  if (text.length > maxChars) text = text.slice(0, maxChars) + `\n…[+${(text.length - maxChars).toLocaleString()} chars]`;
  return esc(text);
}

function _flat(s: string | undefined, max: number): string {
  if (!s) return '';
  const flat = s.replace(/\n/g, '\\n');
  return flat.length <= max ? flat : flat.slice(0, max) + '…';
}


// -- particle chips --

type ChipFamily = 'text' | 'reasoning' | 'tool' | 'op' | 'cite' | 'media' | 'ctrl' | 'err';

function _particleChip(p: any): { family: ChipFamily; label: string; full: unknown } {
  if ('t' in p) return { family: 'text', label: `t "${_flat(p.t, 60)}"`, full: p };
  if ('cg' in p) {
    if (p.cg === 'issue') return { family: 'err', label: `cg:issue ${_flat(p.issueText, 60)}`, full: p };
    const detail = p.cg === 'end' ? ` ${p.terminationReason}${p.tokenStopReason ? '/' + p.tokenStopReason : ''}`
      : p.cg === 'set-model' ? ` ${p.name}`
        : p.cg === 'set-upstream-handle' ? ` ${p.handle?.runId}` : '';
    return { family: 'ctrl', label: `cg:${p.cg}${detail}`, full: p };
  }
  switch (p.p) {
    case '❤':
      return { family: 'ctrl', label: '❤', full: p };
    case 'tr_':
      return { family: 'reasoning', label: `tr_ "${_flat(p._t, 60)}"`, full: p };
    case 'trs':
      return { family: 'reasoning', label: 'trs signature', full: p };
    case 'trr_':
      return { family: 'reasoning', label: `trr_ ${p._data?.length ?? 0} redacted chars`, full: p };
    case 'fci':
      return { family: 'tool', label: `fci ${p.name}${p.i_args ? ` "${_flat(p.i_args, 40)}"` : ''}`, full: p };
    case '_fci':
      return { family: 'tool', label: `_fci +"${_flat(p._args, 40)}"`, full: p };
    case 'cei':
      return { family: 'tool', label: `cei ${p.language} ${p.code?.length}ch`, full: p };
    case 'cer':
      return { family: 'tool', label: `cer ${p.error ? 'ERROR' : 'ok'} ${p.result?.length}ch`, full: p };
    case 'vp':
      return { family: 'op', label: `vp ${p.mot}${p.state ? ':' + p.state : ''}${p.parentOpId ? ' ⤷nested' : ''} "${_flat(p.text, 48)}"${p.iTexts ? ` i:${p.iTexts.join('').length}ch` : ''}${p.oTexts ? ` o:${p.oTexts.join('').length}ch` : ''}`, full: p };
    case 'urlc':
      return { family: 'cite', label: `urlc ${_flat(p.url, 60)}`, full: p };
    case 'ii':
      return { family: 'media', label: `ii ${p.mimeType} ${(p.i_b64?.length ?? 0).toLocaleString()}b64`, full: { ...p, i_b64: `[${p.i_b64?.length ?? 0} b64 chars]` } };
    case 'ia':
      return { family: 'media', label: `ia ${p.mimeType}`, full: { ...p, a_b64: `[${p.a_b64?.length ?? 0} b64 chars]` } };
    case 'hres':
      return { family: 'media', label: `hres ${p.kind}`, full: p };
    case 'svs':
      return { family: 'ctrl', label: `svs ${p.vendor}`, full: p };
    default:
      return { family: 'ctrl', label: JSON.stringify(p).slice(0, 60), full: p };
  }
}

function _chipHtml(p: any): string {
  const { family, label, full } = _particleChip(p);
  return `<details class="chip ${family}"><summary>${esc(label)}</summary><pre>${_json(full)}</pre></details>`;
}


// -- event rows --

function _eventTypeLabel(run: LabRun, ev: LabEvent): string {
  if (ev.name) return ev.name;
  const d = ev.data as any;
  return d?.type ?? (d?.choices?.[0] ? 'cc-chunk' : d?.candidates ? 'gem-chunk' : run.meta.streaming ? 'event' : 'full-body');
}

function _eventRow(run: LabRun, ev: LabEvent): string {
  const hasWarn = ev.diags.some(d => d.level !== 'log');
  const rowClass = ev.parseError ? 'row error' : hasWarn ? 'row warn' : 'row';
  // sequencing aids: OpenAI Responses sequence_number + output_index, Anthropic block index
  const d = ev.data as any;
  const seqChips = [
    typeof d?.sequence_number === 'number' ? `<span class="seq">seq ${d.sequence_number}</span>` : '',
    typeof d?.output_index === 'number' ? `<span class="seq">item ${d.output_index}${typeof d?.content_index === 'number' ? `.c${d.content_index}` : ''}${typeof d?.summary_index === 'number' ? `.s${d.summary_index}` : ''}</span>` : '',
    typeof d?.index === 'number' && run.meta.flavor === 'anthropic-messages' ? `<span class="seq">blk ${d.index}</span>` : '',
  ].join('');
  const callsHtml = ev.calls.map(c =>
    `<details class="call"><summary>↳ ${esc(c.m)}(${esc(_flat(c.args.map(a => typeof a === 'string' ? JSON.stringify(a) : JSON.stringify(a)).join(', '), 90))})</summary><pre>${_json(c.args)}</pre></details>`,
  ).join('');
  const particlesHtml = ev.particles.map(_chipHtml).join('');
  const diagsHtml = ev.diags.map(d => `<div class="diag ${d.level}">⚑ ${esc(_flat(d.text, 400))}</div>`).join('');
  return `
<div class="${rowClass}">
  <div class="wire">
    <div class="evhead"><span class="ord">#${ev.i}</span><span class="t">+${(ev.t / 1000).toFixed(3)}s</span><span class="etype">${esc(_eventTypeLabel(run, ev))}</span>${seqChips}<span class="size">${ev.size.toLocaleString()}ch</span></div>
    ${ev.parseError ? `<div class="parse-error">PARSE THREW: ${esc(ev.parseError)}</div>` : ''}
    <details class="payload"><summary>payload</summary><pre>${_json(ev.data)}</pre></details>
  </div>
  <div class="decode">
    ${callsHtml || '<span class="none">(no transmitter calls)</span>'}
    <div class="particles">${particlesHtml}</div>
    ${diagsHtml}
  </div>
</div>`;
}

function _segmentHtml(run: LabRun, seg: LabSegment, index: number): string {
  const bodySize = seg.request.body ? JSON.stringify(seg.request.body).length : 0;
  const loose = seg.looseParticles.length ? `<div class="loose">loose particles (no event open): ${seg.looseParticles.map(lp => _chipHtml(lp.particle)).join('')}</div>` : '';
  const looseDiags = seg.looseDiags.map(d => `<div class="diag ${d.level}">⚑ ${esc(_flat(d.text, 400))}</div>`).join('');
  return `
<section class="segment">
  <h2>segment ${index} <span class="sub">${esc(seg.request.method)} ${esc(seg.request.url)} · body ${bodySize.toLocaleString()}ch · ${seg.rawChunks?.length ?? 0} raw chunks · ${seg.events.length} events</span></h2>
  <details class="payload reqbody"><summary>request body</summary><pre>${_json(seg.request.body)}</pre></details>
  ${looseDiags}${loose}
  ${seg.events.map(ev => _eventRow(run, ev)).join('')}
</section>`;
}


// -- report section --

function _reportHtml(report: LabReport): string {
  const findingRow = (f: { severity: string; code: string; text: string; where?: string }) =>
    `<tr class="${f.severity}"><td>${f.severity}</td><td>${esc(f.code)}</td><td>${esc(f.where ?? '')}</td><td><pre class="inline">${esc(f.text)}</pre></td></tr>`;
  const lossRow = (r: { category: string; wire: string; particles: string; verdict: string; note?: string }) =>
    `<tr class="v-${r.verdict.replace('/', '')}"><td>${esc(r.verdict)}</td><td>${esc(r.category)}</td><td>${esc(r.wire)}</td><td>${esc(r.particles)}</td><td>${esc(r.note ?? '')}</td></tr>`;
  return `
<section class="report">
  <h2>checks</h2>
  <h3>wire grammar ${report.grammar.length ? '' : '· clean'}</h3>
  ${report.grammar.length ? `<table><tr><th>sev</th><th>code</th><th>where</th><th>detail</th></tr>${report.grammar.map(findingRow).join('')}</table>` : ''}
  ${report.sequencing.length ? `<h3>deep sequencing</h3><table><tr><th>sev</th><th>code</th><th>where</th><th>detail</th></tr>${report.sequencing.map(findingRow).join('')}</table>` : ''}
  <h3>event coverage ${report.coverage.length ? '' : '· clean'}</h3>
  ${report.coverage.length ? `<table><tr><th>sev</th><th>code</th><th>where</th><th>detail</th></tr>${report.coverage.map(findingRow).join('')}</table>` : ''}
  <h3>translation loss</h3>
  <table><tr><th>verdict</th><th>category</th><th>wire</th><th>particles</th><th>note</th></tr>${report.loss.map(lossRow).join('')}</table>
  <h3>parser diagnostics · ${report.parserDiags.warns} warnings, ${report.parserDiags.logs} logs</h3>
  ${report.parserDiags.samples.map(s => `<div class="diag warn">⚑ ${esc(s)}</div>`).join('')}
  <h3>projection</h3>
  <pre class="inline">${esc(projectionSignature(report.projection))}</pre>
</section>`;
}


// -- page --

const CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { background: #14161a; color: #cfd3da; font: 13px/1.45 ui-monospace, 'JetBrains Mono', Menlo, monospace; margin: 0; padding: 1.5rem 2rem 4rem; }
h1 { font-size: 1.1rem; color: #fff; } h2 { font-size: .95rem; color: #e8eaf0; border-bottom: 1px solid #2a2e36; padding-bottom: .3rem; margin-top: 2rem; }
h3 { font-size: .8rem; color: #9aa1ad; text-transform: uppercase; letter-spacing: .04em; }
.sub { color: #6b7280; font-weight: normal; font-size: .75rem; }
.meta { display: flex; gap: 1.2rem; flex-wrap: wrap; color: #9aa1ad; margin: .4rem 0 .8rem; }
.meta b { color: #e8eaf0; }
.outcome.ok { color: #4ade80; } .outcome.bad { color: #f87171; }
.row { display: grid; grid-template-columns: minmax(320px, 42%) 1fr; gap: 0 1rem; border-top: 1px solid #23262d; padding: .35rem 0; }
.row.error { border-left: 3px solid #ef4444; padding-left: .5rem; background: #1d1416; }
.row.warn { border-left: 3px solid #eab308; padding-left: .5rem; }
.evhead { display: flex; gap: .6rem; align-items: baseline; }
.ord { color: #6b7280; } .t { color: #818cf8; } .etype { color: #e8eaf0; font-weight: 600; } .size { color: #6b7280; font-size: .75rem; }
.seq { color: #34d399; font-size: .72rem; border: 1px solid #134e4a; border-radius: 4px; padding: 0 .35rem; }
.parse-error { color: #f87171; font-weight: 600; }
details.payload > summary { cursor: pointer; color: #6b7280; font-size: .75rem; }
details.payload pre, details.chip pre, details.call pre { background: #0d0f12; border: 1px solid #2a2e36; border-radius: 6px; padding: .6rem; overflow-x: auto; max-height: 480px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; }
details.call > summary { cursor: pointer; color: #9aa1ad; font-size: .78rem; list-style: none; }
.particles { display: flex; flex-wrap: wrap; gap: .25rem .35rem; margin-top: .15rem; }
details.chip { display: inline-block; }
details.chip > summary { cursor: pointer; list-style: none; display: inline-block; border-radius: 4px; padding: .05rem .45rem; font-size: .78rem; border: 1px solid transparent; }
.chip.text > summary { background: #0c2818; color: #4ade80; border-color: #14532d; }
.chip.reasoning > summary { background: #221033; color: #c084fc; border-color: #581c87; }
.chip.tool > summary { background: #2a2008; color: #fbbf24; border-color: #713f12; }
.chip.op > summary { background: #082530; color: #22d3ee; border-color: #155e75; }
.chip.cite > summary { background: #0c1a33; color: #60a5fa; border-color: #1e3a8a; }
.chip.media > summary { background: #1a2433; color: #93c5fd; border-color: #334e75; }
.chip.ctrl > summary { background: #1c1f26; color: #8b919c; border-color: #2a2e36; }
.chip.err > summary { background: #2d1215; color: #f87171; border-color: #7f1d1d; }
.diag { font-size: .78rem; } .diag.warn, .diag.error { color: #fbbf24; } .diag.log { color: #6b7280; }
.none { color: #4b5563; font-size: .75rem; }
.loose { margin: .3rem 0; color: #6b7280; font-size: .78rem; }
table { border-collapse: collapse; width: 100%; font-size: .78rem; margin: .4rem 0 1rem; }
th, td { border: 1px solid #2a2e36; padding: .25rem .5rem; text-align: left; vertical-align: top; }
th { color: #9aa1ad; background: #1a1d23; }
tr.error td:first-child { color: #f87171; font-weight: 700; } tr.warn td:first-child { color: #fbbf24; } tr.info td:first-child { color: #6b7280; }
tr.v-full td:first-child { color: #4ade80; } tr.v-partial td:first-child { color: #fbbf24; } tr.v-dropped td:first-child { color: #f87171; } tr.v-extra td:first-child { color: #60a5fa; }
pre.inline { white-space: pre-wrap; word-break: break-word; background: #0d0f12; border: 1px solid #2a2e36; border-radius: 6px; padding: .5rem; }
.toolbar { position: fixed; top: .6rem; right: 1rem; } .toolbar button { background: #1c1f26; color: #cfd3da; border: 1px solid #2a2e36; border-radius: 6px; padding: .2rem .7rem; cursor: pointer; font: inherit; font-size: .75rem; }
`;

const JS = `
function setAll(open) { document.querySelectorAll('details').forEach(d => d.open = open); }
`;

export function renderHtml(run: LabRun, report?: LabReport): string {
  const m = run.meta;
  const o = run.outcome;
  const totalParticles = run.finalParticles.length;
  const totalEvents = run.segments.reduce((a, s) => a + s.events.length, 0);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>aix-lab · ${esc(m.scenarioId)} · ${esc(m.flavor)} · ${esc(m.kind)}</title>
<style>${CSS}</style>
<script>${JS}</script>
</head>
<body>
<div class="toolbar"><button onclick="setAll(true)">expand all</button> <button onclick="setAll(false)">collapse all</button></div>
<h1>AIX Protocol Lab · paired ledger</h1>
<div class="meta">
  <span>scenario <b>${esc(m.scenarioId)}</b></span>
  <span>flavor <b>${esc(m.flavor)}</b></span>
  <span>model <b>${esc(m.modelId)}</b></span>
  <span><b>${m.streaming ? 'streaming' : 'non-streaming'}</b></span>
  <span>kind <b>${esc(m.kind)}${m.replayOf ? ` of ${esc(m.replayOf)}` : ''}</b></span>
  <span>captured <b>${esc(m.capturedAt)}</b></span>
</div>
<div class="meta">
  <span class="outcome ${o.ok ? 'ok' : 'bad'}">outcome <b>${o.ok ? 'ok' : 'NOT-OK'}</b> · end ${esc(o.endReason ?? '?')} · stop ${esc(o.tokenStopReason ?? '?')}${o.aborted ? ' · ABORTED' : ''}${o.error ? ` · ${esc(o.error)}` : ''}</span>
  <span>${(o.durationMs ?? 0).toLocaleString()}ms · ${run.segments.length} segment(s) · ${totalEvents} events · ${totalParticles} particles</span>
</div>
<div class="meta"><span class="sub">prompt: ${esc(m.promptPreview)}</span></div>
${report ? _reportHtml(report) : ''}
${run.segments.map((seg, i) => _segmentHtml(run, seg, i)).join('')}
</body>
</html>`;
}
