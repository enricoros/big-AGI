import fs from 'node:fs';
import path from 'node:path';
import { loadJson, fmtBytes, fmtNum } from './lib.mjs';

const c = loadJson('census');
const ex = loadJson('exemplars');
let trees = null;
try { trees = loadJson('trees'); } catch { console.log('note: out/trees.json missing - run trees.mjs for the structure gallery'); }
let TK = null;
try { TK = loadJson('turns'); } catch { console.log('note: out/turns.json missing - run turns.mjs for the turn taxonomy'); }
let TX = null;
try { TX = loadJson('toolsx'); } catch { console.log('note: out/toolsx.json missing - run toolsx.mjs for the interface deep-dive'); }
let S3 = null;
try { S3 = loadJson('schema'); } catch { console.log('note: out/schema.json missing - run schema.mjs for the TypeScript definitions'); }
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '-';
const day = ts => (ts || '').slice(0, 10);
const pre = (obj, max = 1200) => `<pre>${esc(JSON.stringify(obj, null, 1).slice(0, max))}</pre>`;
const sortDesc = obj => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);

// hand-written one-liners for the record taxonomy
const TYPE_DESC = {
  'user': 'a user prompt OR a tool_result carrier; the workhorse record. App envelope: cwd, gitBranch, version, permissionMode, promptId, toolUseResult, forkedFrom…',
  'assistant': 'one API content block per record (text | thinking | tool_use), sharing message.id + usage across the records of one API call',
  'progress': 'RETIRED (2.1.17→2.1.83): live subagent/hook/bash progress duplicated inline, linked by toolUseID/parentToolUseID',
  'file-history-snapshot': 'per-prompt checkpoint of tracked file backups - the /rewind substrate (content lives in ~/.claude/file-history)',
  'system': 'app events on the tree: hook summaries, turn_duration, compact_boundary, api_error, local_command…',
  'attachment': 'system-injected context deltas riding the tape (e.g. deferred_tools_delta, file attachments)',
  'last-prompt': 'floating pointer: last composer prompt + leafUuid (no parentUuid - state, not history)',
  'ai-title': 'auto-generated session title (floating state record)',
  'permission-mode': 'permission mode switches (floating state record)',
  'mode': 'UI mode marker (normal/plan…), floating state record',
  'queue-operation': 'prompt queue enqueue/dequeue with full prompt content',
  'custom-title': 'user-set session title (floating state record)',
  'agent-name': 'assigned agent name for the session (floating state record)',
  'summary': 'topic summary + leafUuid - the session-picker index, points at a leaf of the tree',
  'file-history-delta': 'NEW (seen 2026-07-14): incremental per-file backup pointer, replaces re-snapshotting',
  'frame-link': 'link between the session and a published claude.ai artifact frame',
};
const SYS_DESC = {
  turn_duration: 'wall-clock per turn', stop_hook_summary: 'Stop-hook runs + duration', local_command: 'user-typed ! shell command',
  compact_boundary: 'compaction seam: new root, logicalParentUuid to the pre-compaction leaf, preTokens metadata', api_error: 'API failure surfaced',
  away_summary: 'summary of activity while user away', informational: 'informational notice', scheduled_task_fire: 'scheduled task trigger', model_refusal_fallback: 'refusal fallback',
};

// derived numbers
const totalTypeBytes = Object.values(c.typeBytes).reduce((a, b) => a + b, 0);
const t = c.topology, L = c.loops, T = c.tools, U = c.usage, S = c.sidecars;
const recPerMsg = (c.explosion.records / c.explosion.apiMessages).toFixed(2);
const userUserForks = Object.entries(t.forkChildTypes).filter(([k]) => !k.includes('assistant')).reduce((a, [, v]) => a + v, 0);
const mixedForks = (t.forkChildTypes['assistant+user'] || 0);
const unanswered = T.uses - T.results;
const mcpByServer = {};
for (const [name, n] of Object.entries(T.mcp)) { const s = name.split('__')[1] || '?'; mcpByServer[s] = (mcpByServer[s] || 0) + n; }
const mcpTotal = Object.values(T.mcp).reduce((a, b) => a + b, 0);
const eras = c.features;
const era = k => eras[k] ? `${day(eras[k].firstTs)} → ${day(eras[k].lastTs)}` : '-';
const vKey = v => v.split('.').map(n => n.padStart(4, '0')).join('.');
const vSorted = Object.keys(c.versions).sort((a, b) => vKey(a) < vKey(b) ? -1 : 1);

// bars
const bar = (n, max, cls = '') => `<div class="barwrap"><div class="bar ${cls}" style="width:${Math.max(1, 100 * n / max)}%"></div><span>${fmtNum(n)}</span></div>`;

// ---- structure graphics -------------------------------------------------------

const CODE_COLOR = { P: '#d5ec31', K: '#ffb04d', C: '#ff6b6b', a: '#5aa9ff', t: '#b48cff', c: '#ffcf4d', r: '#7c8474', s: '#55604b', p: '#3a4234', f: '#333b2c', o: '#242a1f' };
const CODE_NAME = { P: 'user prompt', K: 'compact summary', C: 'compact boundary', a: 'assistant text', t: 'thinking', c: 'tool_use', r: 'tool_result', s: 'system', p: 'progress', f: 'file-history', o: 'floating/meta' };

const structLegend = () => `<div class="legend">${['P', 'c', 'r', 'a', 't', 'C', 'K', 's', 'p', 'f', 'o'].map(k =>
  `<span><i style="background:${CODE_COLOR[k]}"></i>${CODE_NAME[k]}</span>`).join('')}<span><i style="background:none;border:2px solid #fff;border-radius:50%"></i>fork point</span></div>`;

// git-graph lane allocation: the child with the largest subtree (the surviving main line)
// inherits the parent lane; abandoned stubs get their own lanes, freed when they die
function layoutTree(nodes) {
  const kids = {};
  for (const n of nodes) if (n.pid) (kids[n.pid] = kids[n.pid] || []).push(n.id);
  const size = {};
  for (let i = nodes.length - 1; i >= 0; i--) {                    // parents precede children on the tape
    const n = nodes[i];
    size[n.id] = 1 + (kids[n.id] || []).reduce((a, k) => a + size[k], 0);
  }
  const heir = {};
  for (const pid of Object.keys(kids)) heir[pid] = kids[pid].reduce((b, k) => size[k] > size[b] ? k : b, kids[pid][0]);
  const laneOf = {}, free = [];
  let maxLane = -1;
  const rows = nodes.map((n, i) => {
    let lane;
    if (n.pid && laneOf[n.pid] != null && heir[n.pid] === n.id) lane = laneOf[n.pid];
    else lane = free.length ? free.shift() : ++maxLane;
    laneOf[n.id] = lane;
    if (!(kids[n.id] || []).length) free.push(lane);
    return { ...n, row: i, lane };
  });
  return { rows, lanes: maxLane + 1 };
}

// condensed session tree as SVG.
// small trees: vertical git-graph with text labels.
// big trees: timeline mode - x is the PHYSICAL tape position (aligned with the barcode
// below), lanes are branches; a fork whose branch jumps far right is an edit-from-earlier
// appended at the end of the file.
function treeSVG(tree) {
  const { rows, lanes } = layoutTree(tree.nodes);
  const byId = Object.fromEntries(rows.map(r => [r.id, r]));
  const vertical = rows.length <= 40;
  const W = 1120;
  const rh = 26, lw = vertical ? 20 : 19;
  const px = r => vertical ? 14 + r.lane * lw : 14 + (r.pos / Math.max(1, tree.total - 1)) * (W - 28);
  const py = r => vertical ? 14 + r.row * rh : 18 + r.lane * lw;
  const H = vertical ? 28 + rows.length * rh : 38 + lanes * lw;
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block">`;
  for (const r of rows) {
    if (!r.pid || !byId[r.pid]) continue;
    const p = byId[r.pid];
    const x1 = px(p), y1 = py(p), x2 = px(r), y2 = py(r);
    const mid = vertical ? `${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}` : `${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}`;
    svg += `<path d="M ${x1} ${y1} C ${mid}, ${x2} ${y2}" fill="none" stroke="${y1 !== y2 ? '#556047' : '#39402f'}" stroke-width="${Math.min(3.5, 1 + Math.log10(1 + r.skip))}"/>`;
  }
  for (const r of rows) {
    const x = px(r), y = py(r), col = CODE_COLOR[r.code] || '#888';
    const tip = `${CODE_NAME[r.code]}${r.skip ? ` · +${r.skip} records collapsed` : ''}${r.fork ? ` · fork ×${r.fork}` : ''}${r.snip ? ' · ' + r.snip : ''}`;
    if (r.code === 'C') svg += `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" transform="rotate(45 ${x} ${y})" fill="${col}"><title>${esc(tip)}</title></rect>`;
    else if (!vertical && !r.fork && r.code !== 'P' && r.code !== 'K')
      svg += `<rect x="${(x - 1.5).toFixed(1)}" y="${y - 5}" width="3" height="10" fill="${col}"><title>${esc(tip)}</title></rect>`;
    else svg += `<circle cx="${x}" cy="${y}" r="${r.code === 'P' || r.code === 'K' ? 5.5 : 4.4}" fill="${col}"><title>${esc(tip)}</title></circle>`;
    if (r.fork) svg += `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#e8ece2" stroke-width="1.3"><title>${esc(tip)}</title></circle>`;
    if (r.root) svg += `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="${r.code === 'C' ? CODE_COLOR.C : '#5a6150'}" stroke-width="1" stroke-dasharray="2 2"/>`;
    if (vertical) {
      const label = r.snip ? r.snip : r.code === 'C' ? `compact seam (${fmtNum(r.pre)} pre-tokens)` : r.fork ? `fork ×${r.fork}` : r.leaf && !r.root ? CODE_NAME[r.code] : '';
      if (label) svg += `<text x="${14 + lanes * lw + 12}" y="${y + 4}" font-size="13" font-family="JetBrains Mono,monospace" fill="${r.code === 'P' || r.code === 'K' ? '#c9d3ba' : '#707a63'}">${r.skip ? `<tspan fill="#4a5240">+${r.skip} · </tspan>` : ''}${esc(label)}</text>`;
    }
  }
  svg += '</svg>';
  return svg;
}

// the physical tape: one tick per record (or per bucket), file order
function barcodeSVG(bc) {
  const n = bc.codes.length, W = 1120, w = (W - 28) / n, H = 46;
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block">`;
  for (let i = 0; i < n; i++) {
    const k = bc.codes[i], tall = k === 'P' || k === 'K' || k === 'C';
    const h = tall ? 40 : 20;
    svg += `<rect x="${(14 + i * w).toFixed(2)}" y="${(H - h) / 2}" width="${Math.max(w - 0.15, 0.5).toFixed(2)}" height="${h}" fill="${CODE_COLOR[k]}"${bc.sc[i] === '1' ? ' opacity="0.4"' : ''}/>`;
  }
  svg += '</svg>';
  return svg;
}

// bytes-by-record-type stacked bar
function byteBar() {
  const total = totalTypeBytes;
  const segs = sortDesc(c.typeBytes).filter(([, b]) => b / total > 0.004);
  const other = total - segs.reduce((a, [, b]) => a + b, 0);
  const COL = { user: '#8aa32a', assistant: '#5aa9ff', progress: '#3a4234', attachment: '#b48cff', 'file-history-snapshot': '#55604b', system: '#7c8474', 'queue-operation': '#ffcf4d' };
  let html = '<div class="stack">';
  for (const [k, b] of [...segs, ['(rest)', other]])
    html += `<div style="width:${(100 * b / total).toFixed(2)}%;background:${COL[k] || '#242a1f'}" title="${esc(k)} · ${fmtBytes(b)} (${pct(b, total)})"></div>`;
  html += '</div><div class="legend">' + [...segs, ['(rest)', other]].map(([k, b]) => `<span><i style="background:${COL[k] || '#242a1f'}"></i>${esc(k)} ${pct(b, total)}</span>`).join('') + '</div>';
  return html;
}

// one cell per API call of the longest turn
function rhythmStrip(r) {
  const COL = { c: CODE_COLOR.c, a: '#8fbf5a', t: CODE_COLOR.t };
  return `<div class="rhythm">${r.msgs.map((m, i) =>
    `<span style="background:${COL[m.k]};${m.k === 'c' && m.n > 1 ? 'outline:1.5px solid #fff3;outline-offset:-1.5px' : ''}" title="msg ${i + 1}: ${m.k === 'c' ? m.n + ' tool call' + (m.n > 1 ? 's' : '') : m.k === 'a' ? 'text' : 'thinking only'}"></span>`).join('')}</div>`;
}

// subagent fan: one chip per sidecar tape, sized by bytes
function fanChips(f) {
  const TYPES = [...new Set(f.agents.map(a => a.type))];
  const TCOL = ['#d5ec31', '#5aa9ff', '#ffcf4d', '#b48cff', '#8fbf5a', '#ff8a5c'];
  const colOf = Object.fromEntries(TYPES.map((t, i) => [t, TCOL[i % TCOL.length]]));
  let html = '<div class="fan"><div class="fanspine"><b>main tape</b><span>' + fmtNum(f.mainRecords) + ' records</span></div><div class="fanwrap">';
  for (const a of f.agents) {
    const w = Math.max(10, Math.min(70, Math.sqrt(a.bytes) / 12));
    html += `<span class="fanchip" style="width:${w.toFixed(0)}px;background:${colOf[a.type]}" title="${esc(a.type)} · ${fmtBytes(a.bytes)}"></span>`;
  }
  html += '</div></div><div class="legend">' + TYPES.map(t => `<span><i style="background:${colOf[t]}"></i>${esc(t)} ×${f.agents.filter(a => a.type === t).length}</span>`).join('') + '</div>';
  return html;
}

// ---- identity-system diagrams: one real turn, as blocks and as tape ------------

let turnX = null;
try { turnX = loadJson('turn'); } catch { /* run turn.mjs for the identity diagrams */ }

const MSG_COLS = ['#5aa9ff', '#67e0d8', '#9fd0ff', '#3d86d8'];
const TOOL_COLS = ['#ffcf4d', '#ff9d5c', '#ffe08a'];
const TOOL_MARK = ['①', '②', '③'];

// assign stable colors/marks to the turn's message ids and tool ids
function turnPalette(T) {
  const mids = [...new Set(T.records.map(r => r.mid).filter(Boolean))];
  const tids = [...new Set(T.records.flatMap(r => r.blocks.map(b => b.id)).filter(Boolean))];
  return {
    mid: Object.fromEntries(mids.map((m, i) => [m, MSG_COLS[i % MSG_COLS.length]])),
    tid: Object.fromEntries(tids.map((t, i) => [t, TOOL_COLS[i % TOOL_COLS.length]])),
    tmark: Object.fromEntries(tids.map((t, i) => [t, TOOL_MARK[i % TOOL_MARK.length]])),
  };
}

function idBlocksView(T) {
  const P = turnPalette(T);
  const blockLabel = b => {
    if (b.t === 'tool_use') return `<span class="blk t-cli">tool_use<em style="color:${P.tid[b.id]}">${P.tmark[b.id]} ${esc(b.name)} · toolu …${esc(b.id)}</em></span>`;
    if (b.t === 'tool_result') return `<span class="blk t-res">tool_result<em style="color:${P.tid[b.id]}">${P.tmark[b.id]} toolu …${esc(b.id)}</em></span>`;
    return `<span class="blk t-text">${esc(b.t)}</span>`;
  };
  let h = `<div class="idsys"><div class="idses"><div class="idlab">session <code>…${esc(T.sessionId)}</code> <span class="muted2">· sessionId + cwd + gitBranch + version stamped on every record</span></div>`;
  h += `<div class="idturn"><div class="idlab" style="color:var(--lime)">turn <code>promptId …${esc(T.promptId)}</code> <span class="muted2">· groups the prompt with its whole loop</span></div>`;
  let openMsg = null;
  for (const r of T.records) {
    if (r.type === 'assistant' && r.mid) {
      if (openMsg !== r.mid) {
        if (openMsg) h += '</div>';
        openMsg = r.mid;
        h += `<div class="idmsg" style="border-color:${P.mid[r.mid]}"><div class="idlab" style="color:${P.mid[r.mid]}">API call <code>msg …${esc(r.mid)}</code> · req <code>…${esc(r.rid)}</code> · stop: <code>${esc(String(r.stop))}</code></div>`;
      }
      h += `<div class="idrec"><code class="uu">…${esc(r.u)}</code><span class="parr">parent → …${esc(r.p)}</span>${r.blocks.map(b => blockLabel(b)).join(' ')}</div>`;
    } else {
      if (openMsg) { h += '</div>'; openMsg = null; }
      if (r.type === 'user' && !r.src) {
        h += `<div class="idrec idu"><b>user</b> <code class="uu">…${esc(r.u)}</code><span class="parr">parent → …${esc(r.p)} (previous leaf)</span><span class="blk">prompt</span></div>`;
      } else if (r.type === 'user') {
        h += `<div class="idrec idr"><b>user</b> <code class="uu">…${esc(r.u)}</code><span class="parr">parent → …${esc(r.p)}</span>${r.blocks.map(b => blockLabel(b)).join(' ')} <span class="muted2">+ toolUseResult{${esc(r.tur)}} · sourceToolAssistantUUID → <code>…${esc(r.src)}</code></span></div>`;
      } else if (r.type === 'system') {
        h += `<div class="idrec ids"><b>system/${esc(r.sub)}</b> <code class="uu">…${esc(r.u)}</code><span class="parr">parent → …${esc(r.p)}</span></div>`;
      } else if (r.type === 'file-history-snapshot') {
        h += `<div class="idrec idf"><b>file-history-snapshot</b> <span class="muted2">messageId → …${esc(r.fhsMid)} · ${r.nBackups} tracked files</span></div>`;
      }
    }
  }
  if (openMsg) h += '</div>';
  h += '</div>';
  if (T.spawn) {
    h += `<div class="idspawn"><div class="idlab" style="color:#b48cff">sidecar: <code>subagents/${esc(T.spawn.fileName)}</code></div>
    <span class="muted2">meta: agentType <b>${esc(T.spawn.agentType)}</b> · toolUseId = <b style="color:${TOOL_COLS[1]}">② the Agent call above</b> · spawnDepth ${T.spawn.spawnDepth ?? '-'}</span><br>
    <span class="muted2">tape: <code>started</code> key <code>${esc(T.spawn.startedKey)}</code> → ${fmtNum(T.spawn.records)} records → <code>result</code> (returned to the parent's tool_result ②)</span></div>`;
  }
  h += '</div></div>';
  return h;
}

function idTapeView(T) {
  const P = turnPalette(T);
  const recs = T.records;
  const n = recs.length;
  const W = 1120, cw = Math.min(100, (W - 30) / n), x0 = 15 + (W - 30 - cw * n) / 2;
  const cx = i => x0 + i * cw + cw / 2;
  const yTop = 130, yBot = 196, H = T.spawn ? 372 : 300;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block">`;
  // promptId bracket
  const firstMain = recs.findIndex(r => r.type !== 'file-history-snapshot');
  s += `<path d="M ${cx(firstMain) - cw / 2 + 4} 30 v -8 H ${cx(n - 1) + cw / 2 - 4} v 8" fill="none" stroke="#d5ec31" stroke-width="1.4"/>`;
  s += `<text x="${(cx(firstMain) + cx(n - 1)) / 2}" y="16" text-anchor="middle" font-size="12" font-family="JetBrains Mono" fill="#d5ec31">turn · promptId …${esc(T.promptId)}</text>`;
  // message.id spans
  const groups = [];
  for (let i = 0; i < n; i++) {
    const m = recs[i].mid;
    if (!m) continue;
    const g = groups[groups.length - 1];
    if (g && g.mid === m && g.to === i - 1) g.to = i;
    else groups.push({ mid: m, rid: recs[i].rid, from: i, to: i });
  }
  for (const g of groups) {
    const col = P.mid[g.mid];
    s += `<path d="M ${cx(g.from) - cw / 2 + 6} 62 v -8 H ${cx(g.to) + cw / 2 - 6} v 8" fill="none" stroke="${col}" stroke-width="1.3"/>`;
    s += `<text x="${(cx(g.from) + cx(g.to)) / 2}" y="46" text-anchor="middle" font-size="10.5" font-family="JetBrains Mono" fill="${col}">msg …${esc(g.mid)} · req …${esc(g.rid)}</text>`;
  }
  // parentUuid arcs (each record to its predecessor-parent)
  const idxOfU = Object.fromEntries(recs.map((r, i) => [r.u, i]).filter(([u]) => u));
  for (let i = 0; i < n; i++) {
    const r = recs[i];
    if (!r.p) continue;
    const pi = idxOfU[r.p];
    if (pi === undefined) {
      s += `<path d="M ${cx(i) - 6} ${yTop} C ${cx(i) - 26} ${yTop - 26}, ${cx(i) - 40} ${yTop - 10}, ${cx(i) - 44} ${yTop - 2}" fill="none" stroke="#556047" stroke-width="1.1" stroke-dasharray="3 3"/>`;
      continue;
    }
    const h = 14 + 5 * (i - pi);
    s += `<path d="M ${cx(pi)} ${yTop - 2} C ${cx(pi)} ${yTop - h}, ${cx(i)} ${yTop - h}, ${cx(i)} ${yTop - 2}" fill="none" stroke="#556047" stroke-width="1.1"/>`;
    s += `<circle cx="${cx(i)}" cy="${yTop - 2}" r="1.8" fill="#556047"/>`;
  }
  s += `<text x="${x0}" y="${yTop - 34}" font-size="10.5" font-family="JetBrains Mono" fill="#707a63">parentUuid chain ↑</text>`;
  // cells
  for (let i = 0; i < n; i++) {
    const r = recs[i];
    const b0 = r.blocks[0];
    const kind = r.type === 'user' ? (r.src ? 'result' : 'prompt') : r.type;
    const fill = kind === 'prompt' ? '#1c2410' : kind === 'result' ? '#14160f' : r.type === 'assistant' ? '#0e1622' : '#12140f';
    const border = kind === 'prompt' ? '#d5ec31' : b0?.id ? P.tid[b0.id] : r.type === 'assistant' ? (P.mid[r.mid] || '#23405e') : '#2a2f24';
    s += `<rect x="${cx(i) - cw / 2 + 3}" y="${yTop}" width="${cw - 6}" height="${yBot - yTop}" rx="7" fill="${fill}" stroke="${border}" stroke-width="1.3"/>`;
    const l1 = r.type === 'system' ? 'system' : r.type === 'file-history-snapshot' ? 'fhs' : r.type === 'user' ? 'user' : 'asst';
    const l2 = r.type === 'system' ? esc(r.sub || '') : r.type === 'file-history-snapshot' ? 'snapshot' : b0 ? (b0.t === 'tool_use' ? `${P.tmark[b0.id]} ${esc(b0.name)}` : b0.t === 'tool_result' ? `${P.tmark[b0.id]} result` : esc(b0.t)) : '';
    const l3 = r.u ? '…' + esc(r.u.slice(-6)) : (r.fhsMid ? 'msgId→' : '');
    s += `<text x="${cx(i)}" y="${yTop + 20}" text-anchor="middle" font-size="11.5" font-family="JetBrains Mono" fill="#e8ece2">${l1}</text>`;
    s += `<text x="${cx(i)}" y="${yTop + 38}" text-anchor="middle" font-size="10.5" font-family="JetBrains Mono" fill="${b0?.id ? P.tid[b0.id] : '#9aa38c'}">${l2}</text>`;
    s += `<text x="${cx(i)}" y="${yTop + 56}" text-anchor="middle" font-size="9.5" font-family="JetBrains Mono" fill="#5a6150">${l3}</text>`;
  }
  // tool pairing arcs below + src backlinks
  let ti = 0;
  for (let i = 0; i < n; i++) {
    const use = recs[i].blocks.find(b => b.t === 'tool_use');
    if (!use) continue;
    const ri = recs.findIndex((r, k) => k > i && r.blocks.some(b => b.t === 'tool_result' && b.id === use.id));
    if (ri < 0) continue;
    const col = P.tid[use.id], h = 26 + ti * 6;
    s += `<path d="M ${cx(i)} ${yBot + 2} C ${cx(i)} ${yBot + h}, ${cx(ri)} ${yBot + h}, ${cx(ri)} ${yBot + 2}" fill="none" stroke="${col}" stroke-width="1.4"/>`;
    s += `<text x="${(cx(i) + cx(ri)) / 2}" y="${yBot + h - 2}" text-anchor="middle" font-size="10" font-family="JetBrains Mono" fill="${col}">${P.tmark[use.id]} toolu …${esc(use.id.slice(-6))}</text>`;
    s += `<path d="M ${cx(ri) - 8} ${yBot + 2} C ${cx(ri) - 8} ${yBot + h + 16}, ${cx(i) + 8} ${yBot + h + 16}, ${cx(i) + 8} ${yBot + 2}" fill="none" stroke="${col}" stroke-width="0.9" stroke-dasharray="3 3" opacity="0.55"/>`;
    ti++;
  }
  s += `<text x="${x0}" y="${yBot + 58}" font-size="10.5" font-family="JetBrains Mono" fill="#707a63">tool pairing ↓ (solid = toolu id · dashed = sourceToolAssistantUUID backlink)</text>`;
  // sessionId baseline
  s += `<line x1="${x0}" y1="${yBot + 70}" x2="${W - 15}" y2="${yBot + 70}" stroke="#2a2f24"/>`;
  s += `<text x="${x0}" y="${yBot + 84}" font-size="10.5" font-family="JetBrains Mono" fill="#9aa38c">sessionId …${esc(T.sessionId)} · identical on every record (fork-by-copy preserves the original)</text>`;
  // spawn lane
  if (T.spawn) {
    const ai = recs.findIndex(r => r.blocks.some(b => b.t === 'tool_use' && (b.name === 'Agent' || b.name === 'Task')));
    const sy = yBot + 104;
    if (ai >= 0) s += `<path d="M ${cx(ai)} ${yBot + 2} L ${cx(ai)} ${sy + 14}" stroke="${TOOL_COLS[1]}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    const sx = Math.max(x0, cx(ai) - 180), sw = 560;
    s += `<rect x="${sx}" y="${sy}" width="${sw}" height="52" rx="8" fill="#161022" stroke="#b48cff" stroke-width="1.2"/>`;
    s += `<text x="${sx + 14}" y="${sy + 20}" font-size="11" font-family="JetBrains Mono" fill="#b48cff">sidecar tape · subagents/${esc(T.spawn.fileName)} · ${esc(T.spawn.agentType)}</text>`;
    s += `<text x="${sx + 14}" y="${sy + 38}" font-size="10.5" font-family="JetBrains Mono" fill="#9aa38c">meta.toolUseId = ② · started key ${esc(T.spawn.startedKey)} → ${fmtNum(T.spawn.records)} records → result → parent's ② tool_result</text>`;
  }
  return s + '</svg>';
}

// gallery of exemplar sessions: logical tree + physical tape, same session
function gallery() {
  if (!trees) return '';
  return trees.exemplars.map(e => {
    const s = e.stats;
    const big = e.tree.nodes.length > 40;
    return `<h3>${esc(e.label)}</h3>
<div class="sub" style="margin:-2px 0 8px">${esc(e.title || e.session.slice(0, 8))} · ${esc(e.project.replace(/^-Users-[^-]+-?/, '~/').replace(/-/g, '/'))} · ${fmtNum(s.records)} records · ${s.prompts} prompts · ${s.forks} forks${s.maxSiblings > 1 ? ` (max ${s.maxSiblings} siblings)` : ''}${s.compactSeams ? ` · ${s.compactSeams} compact seam` : ''} · showing ${e.tree.nodes.length} of ${fmtNum(e.tree.keptTotal)} structural nodes${e.tree.pruned || e.tree.truncated ? ' <span style="color:#ffb04d">(condensed further to fit)</span>' : ''}</div>
<div class="panel">${treeSVG(e.tree)}</div>
<div class="panel" style="padding:6px 10px">${barcodeSVG(e.barcode)}</div>
<p class="small" style="margin-top:2px;color:#707a63">${big
      ? `top: the logical tree - <b>x is the physical position in the file</b> (same axis as the strip below), lanes are branches; a curve jumping right is an edit-from-earlier whose branch was <em>appended at the end</em> of the tape. straight runs are collapsed (edge thickness = collapsed records; hover any node).`
      : `top: the logical tree (parentUuid), condensed - straight runs collapsed into edges (+N = collapsed records).`}
 bottom: the physical tape, one tick per ${e.barcode.bucket > 1 ? esc(String(e.barcode.bucket)) + ' records' : 'record'} in file order - tall lime ticks are user prompts.</p>`;
  }).join('\n');
}

// section tables ---------------------------------------------------------------

const SQ = c.seq || {};
const familyOf = t => {
  const e = SQ.envelope?.[t];
  if (!e) return '';
  if (e.uuid / e.n > 0.5) return '<span class="fam f-tree">tree</span>';
  if (t.startsWith('file-history')) return '<span class="fam f-chk">checkpoint</span>';
  return '<span class="fam f-flo">floating</span>';
};
const topOf = (obj, k = 3) => sortDesc(obj || {}).slice(0, k);
const neighTxt = (obj, total) => topOf(obj, 2).map(([k, n]) => `${esc(k)} ${pct(n, total)}`).join(' · ') || '-';

const typeRows = sortDesc(c.types).map(([k, n]) => {
  const b = c.typeBytes[k] || 0;
  return `<tr><td class="mono">${esc(k)}</td><td>${familyOf(k)}</td><td class="mono">${fmtNum(n)}</td><td class="mono">${fmtBytes(b)}</td><td class="mono">${pct(b, totalTypeBytes)}</td><td class="small">${TYPE_DESC[k] || ''}</td></tr>`;
}).join('');

const sysRows = sortDesc(c.systemSubtypes).map(([k, n]) => {
  const aug = 'system/' + k;
  return `<tr><td class="mono">system/${esc(k)}</td><td class="mono">${fmtNum(n)}</td><td class="mono small">${neighTxt(SQ.augPrev?.[aug], n)}</td><td class="mono small">${neighTxt(SQ.augNext?.[aug], n)}</td><td class="small">${SYS_DESC[k] || ''}</td></tr>`;
}).join('');

const attAll = sortDesc(SQ.attachmentTypes);
const attHalf = Math.ceil(attAll.length / 2);
const attRow = ([k, n]) => `<tr><td class="mono">${esc(k)}</td><td class="mono">${fmtNum(n)}</td></tr>`;
const attRows1 = attAll.slice(0, attHalf).map(attRow).join('');
const attRows2 = attAll.slice(attHalf).map(attRow).join('');

// ---- level-2 taxonomy: every type, one level down ------------------------------
const SUB_NOTES = {
  'tool_result carrier': "the loop's return path - carries the raw block + the parsed toolUseResult twin",
  'prompt · plain string': 'what the user actually typed',
  'meta (isMeta - caveats, notices)': 'injected caveats/notices rendered as user turns but not real prompts',
  'interrupt marker': '"[Request interrupted by user]" persisted as a real record',
  'prompt · with image(s)': 'pasted/attached images ride as blocks',
  'prompt · rich blocks': 'block-array prompts without images',
  'compact summary (isCompactSummary)': 'the post-compaction carry-forward, render-only',
  'tool_use record': 'pauses the API call; the loop hinge',
  'text record': 'the visible reply text',
  'thinking record': 'signed reasoning, persisted verbatim',
  'api-error synthetic': 'synthetic records from failed requests (<synthetic> model)',
  'fallback record': 'model-fallback notices',
  'initial · tracking files': 'checkpoint written right before/while a prompt runs',
  'update · tracking files': 'append-supersede: a newer snapshot for the same messageId',
  'initial · empty': 'checkpoint with nothing tracked yet',
  'with leafUuid anchor': 'draft tied to the message it landed as',
  'no anchor (pre-anchor era)': 'older CLI versions',
  'leaf elsewhere (cross-session resume anchor)': 'points into ANOTHER tape - resume/continuation index',
  'leaf in same file': 'in-file topic index',
  'auto': "this user's default - skips permission prompts",
  'default': 'ask-per-tool',
  'acceptEdits': 'auto-accept file edits',
  'plan': 'plan mode',
};
function level2Table() {
  let rows = '';
  const head = (type, disc) => { rows += `<tr class="l2h"><td class="mono"><b>${esc(type)}</b></td><td class="mono">${fmtNum(c.types[type] || 0)}</td><td></td><td class="small">${esc(disc)}</td></tr>`; };
  const sub = (label, n, total, note) => { rows += `<tr><td class="l2s mono">${esc(label)}</td><td class="mono">${fmtNum(n)}</td><td class="mono small">${pct(n, total)}</td><td class="small">${note ?? SUB_NOTES[label] ?? ''}</td></tr>`; };
  const subsFrom = (obj, total, cap = 99) => { for (const [k, n] of sortDesc(obj).slice(0, cap)) sub(k, n, total); };

  head('assistant', 'discriminator: the single content block each record carries, plus error flags');
  subsFrom(c.sub.assistant, c.types['assistant']);
  head('user', 'discriminator: shape of message.content x isMeta/isCompactSummary flags');
  subsFrom(c.sub.user, c.types['user']);
  head('progress', 'discriminator: data.type (retired era-2 streaming channel)');
  for (const [k, n] of sortDesc(c.progressDataTypes)) sub(k, n, c.types['progress'], {
    agent_progress: 'subagent turns streamed into the parent tape', hook_progress: 'PostToolUse/Stop hook execution',
    bash_progress: 'long Bash commands streaming', query_update: 'in-chat web search phases', search_results_received: 'in-chat web search phases', waiting_for_task: 'task-wait heartbeat',
  }[k]);
  head('file-history-snapshot', 'discriminator: isSnapshotUpdate x trackedFileBackups');
  subsFrom(c.sub.fhs, c.types['file-history-snapshot']);
  head('system', 'discriminator: subtype (neighborhoods in the table below)');
  for (const [k, n] of sortDesc(c.systemSubtypes)) sub(k, n, c.types['system'], SYS_DESC[k]);
  head('attachment', 'discriminator: attachment.type - ' + attAll.length + ' kinds (full census below)');
  for (const [k, n] of attAll.slice(0, 6)) sub(k, n, c.types['attachment']);
  sub(`… +${attAll.length - 6} more kinds`, attAll.slice(6).reduce((a, [, n]) => a + n, 0), c.types['attachment'], 'see the full table below');
  head('last-prompt', 'discriminator: leafUuid presence');
  subsFrom(c.sub.lastPrompt, c.types['last-prompt']);
  head('permission-mode', 'discriminator: permissionMode value');
  subsFrom(c.sub.permissionModes, c.types['permission-mode']);
  head('queue-operation', 'discriminator: operation (mechanics below)');
  for (const [k, n] of sortDesc(SQ.queueOps)) sub(k, n, c.types['queue-operation'], { enqueue: 'carries content', dequeue: 'head-pop, no content', remove: 'content-matched delete', popAll: 'flush' }[k]);
  head('mode', 'discriminator: mode value');
  subsFrom(c.sub.modes, c.types['mode']);
  sub('(only "normal" ever observed)', 0, 1, 'plan/accept states ride permission-mode instead');
  head('summary', 'discriminator: where leafUuid resolves');
  subsFrom(c.sub.summaryLeaf, c.types['summary']);
  head('ai-title / custom-title / agent-name', 'free-text value records - latest wins');
  sub('(no subtypes - one value field each)', (c.types['ai-title'] || 0) + (c.types['custom-title'] || 0) + (c.types['agent-name'] || 0), (c.types['ai-title'] || 0) + (c.types['custom-title'] || 0) + (c.types['agent-name'] || 0), 'auto-generated vs user-set vs assigned identity');
  head('file-history-delta', 'one tracked file per record');
  sub('backup pointer', c.types['file-history-delta'] || 0, c.types['file-history-delta'] || 0, 'links to its snapshot via snapshotMessageId');
  head('frame-link', 'artifact frame links');
  sub('published artifact', c.types['frame-link'] || 0, c.types['frame-link'] || 0, 'session ↔ claude.ai frame URL');
  return `<table><thead><tr><th>type › subtype</th><th>records</th><th>% of type</th><th>meaning</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// 16x16 transition matrix, log-alpha shading
function transitionMatrix() {
  const order = sortDesc(c.types).map(([k]) => k);
  const ABBR = { user: 'usr', assistant: 'ast', progress: 'prg', 'file-history-snapshot': 'fhs', system: 'sys', attachment: 'att', 'last-prompt': 'lpr', 'permission-mode': 'prm', 'ai-title': 'ait', mode: 'mod', 'agent-name': 'agn', 'custom-title': 'ctt', 'queue-operation': 'que', summary: 'sum', 'file-history-delta': 'fhd', 'frame-link': 'frl' };
  const max = Math.max(...Object.values(SQ.transitions || { x: 1 }));
  let h = '<table class="matrix"><thead><tr><th>from \\ to</th>' + order.map(t => `<th title="${esc(t)}">${ABBR[t] || t.slice(0, 3)}</th>`).join('') + '</tr></thead><tbody>';
  for (const a of order) {
    h += `<tr><th title="${esc(a)}">${ABBR[a] || a.slice(0, 3)}</th>`;
    for (const b of order) {
      const n = SQ.transitions?.[a + '>' + b] || 0;
      const alpha = n ? (0.07 + 0.93 * Math.log(1 + n) / Math.log(1 + max)) : 0;
      h += `<td style="background:rgba(213,236,49,${alpha.toFixed(2)})${alpha > 0.55 ? ';color:#111' : ''}" title="${esc(a)} → ${esc(b)}: ${fmtNum(n)}">${n >= 1000 ? (n / 1000).toFixed(0) + 'k' : ''}</td>`;
    }
    h += '</tr>';
  }
  return h + '</tbody></table>';
}

// floating-state cadence table
const FLO_TRIGGER = {
  'last-prompt': 'every submission - the draft buffer, survives interrupts',
  'ai-title': 'regenerated as the topic drifts',
  'custom-title': 'user-set; re-flushed with the state block',
  'agent-name': 'assigned identity; re-flushed with the state block',
  'permission-mode': 'flushed on every submission (state block)',
  'mode': 'flushed on every submission (state block)',
  'queue-operation': 'on enqueue/dequeue/remove/popAll',
  'summary': 'session-picker index entries (leafUuid anchors)',
  'file-history-snapshot': 'per prompt + per tracked-file change (bursts)',
  'file-history-delta': 'per file change (incremental, new 07-14)',
  'frame-link': 'on artifact publication',
};
const floRows = sortDesc(Object.fromEntries(Object.entries(SQ.floatingCadence || {}).map(([k, v]) => [k, v.records])))
  .map(([k, n]) => {
    const v = SQ.floatingCadence[k];
    return `<tr><td class="mono">${esc(k)}</td><td class="mono">${fmtNum(n)}</td><td class="mono">${v.tapes}</td><td class="mono">${(n / v.tapes).toFixed(1)}</td><td class="small">${FLO_TRIGGER[k] || ''}</td></tr>`;
  }).join('');

// ---- turn taxonomy + ladder builders --------------------------------------------
const KIND_DESC = {
  'tool loop': 'the standard agentic run: prompt → tool cycles → answer',
  'no-tool chat': 'plain Q&A / notes - 0-2 messages, nothing executed',
  'slash command': 'initiated by a /command (XML command envelope)',
  'interrupted': 'the user stopped it - marker record or aborted stream',
  'delegating (spawns agents)': 'spawns Agent/Task children - the fleet turns',
  'task-notification continuation': 'woken by a background task notification, not a human',
  'interactive (asks the user)': 'the model asked back (AskUserQuestion) and waited',
  'system/sdk-injected': 'programmatic prompts (SDK / system)',
  'queued auto-run': 'dequeued from the typed-ahead queue (promptSource stamp is recent - the queue journal itself shows 397 dequeues)',
};
const kindRows = TK ? sortDesc(Object.fromEntries(Object.entries(TK.kinds).map(([k, v]) => [k, v.n]))).map(([k, n]) => {
  const v = TK.kinds[k];
  return `<tr><td class="mono">${esc(k)}</td><td class="mono">${fmtNum(n)}</td><td class="mono small">${pct(n, TK.turns)}</td><td class="mono">${(v.msgs / v.n).toFixed(1)}</td><td class="mono">${v.maxMsgs}</td><td class="mono small">${pct(v.pauses, v.n)}</td><td class="small">${KIND_DESC[k] || ''}</td></tr>`;
}).join('') : '';

const END_DESC = {
  'end_turn (clean)': 'the model finished and said so',
  'stream cut (stop_reason null)': 'abort/crash mid-stream - the half-message is kept',
  'interrupted (marker)': '"[Request interrupted by user]" recorded in-turn',
  'tool_use': 'ended on tool_use with results already in - no final reply; superseded by the next prompt',
  'dangling tool_use (aborted mid-loop)': 'tool calls whose results never arrived',
  'stop_sequence': 'stop-sequence hit',
};
const endRows = TK ? sortDesc(TK.endStates).map(([k, n]) => `<tr><td class="mono">${esc(k)}</td><td class="mono">${fmtNum(n)}</td><td class="mono small">${pct(n, TK.turns)}</td><td class="small">${END_DESC[k] || ''}</td></tr>`).join('') : '';

function pauseGroups() {
  const out = { 'model / API (latency, retries)': 0, 'a human answer (AskUserQuestion)': 0, 'an Agent/Task child to finish': 0, 'a tool run or permission approval': 0, 'steering - the next user input': 0, 'session machinery (queue, ! commands, system)': 0 };
  for (const [k, n] of Object.entries(TK?.pauseWaitedOn || {})) {
    if (k.startsWith('assistant')) out['model / API (latency, retries)'] += n;
    else if (k.startsWith('answer to')) out['a human answer (AskUserQuestion)'] += n;
    else if (k.includes('(Agent') || k.includes('(Task')) out['an Agent/Task child to finish'] += n;
    else if (k.startsWith('tool_result')) out['a tool run or permission approval'] += n;
    else if (k.startsWith('next user')) out['steering - the next user input'] += n;
    else out['session machinery (queue, ! commands, system)'] += n;
  }
  return out;
}
const pauseRows = TK ? sortDesc(pauseGroups()).map(([k, n]) => `<tr><td>${esc(k)}</td><td class="mono">${fmtNum(n)}</td><td class="mono small">${pct(n, TK.flags.pause2m)}</td></tr>`).join('') : '';

const fmtGap = m => m > 2880 ? Math.round(m / 1440) + ' days' : m > 120 ? Math.round(m / 60) + ' h' : m + ' min';
const pauseTopRows = TK ? TK.topPauses.slice(0, 6).map(p => `<tr><td class="mono small">${esc((p.title || '').slice(0, 34))}</td><td class="small">${esc(p.kind)}</td><td class="mono">${fmtGap(p.gapMin)}</td><td class="small">${esc(p.waitedOn || '')}</td></tr>`).join('') : '';

const tpsOrder = ['1', '2-3', '4-10', '11-30', '31+'];
const tpsMax = TK ? Math.max(...tpsOrder.map(k => TK.ladder.turnsPerSession[k] || 0)) : 1;
const tpsRows = TK ? tpsOrder.map(k => `<tr><td class="mono">${k}</td><td>${bar(TK.ladder.turnsPerSession[k] || 0, tpsMax, 'b2')}</td></tr>`).join('') : '';

// ---- level-3: annotated TypeScript definitions inferred from the corpus ----------
const kw = s => `<span class="kw">${s}</span>`;
const tn = s => `<span class="tn">${esc(s)}</span>`;
const cm = s => `<span class="c">// ${esc(s)}</span>`;
function deriveType(f) {
  if (f.vals && f.types.string && !f.types.object && !f.types.array && Object.keys(f.vals).length && Object.keys(f.vals).length <= 6 && !f.open) {
    return Object.keys(f.vals).map(v => `'${v}'`).join(' | ') + (f.types.null ? ' | null' : '');
  }
  const order = { string: 'string', number: 'number', boolean: 'boolean', object: '{…}', array: '…[]', null: 'null' };
  return Object.keys(order).filter(t => f.types[t]).map(t => order[t]).join(' | ') || 'unknown';
}
function fl(F, total, key, o = {}) {
  const f = F[key];
  if (!f) return '';
  const opt = o.req ? '' : f.n / total < 0.985 ? '?' : '';
  const ty = o.type || deriveType(f);
  const bits = [pct(f.n, total)];
  if (!o.type && f.vals && Object.keys(f.vals).length && ty[0] !== "'") bits.push(Object.entries(f.vals).slice(0, 3).map(([v, n]) => `${v}×${fmtNum(n)}`).join(' '));
  else if (f.vals && ty[0] === "'") bits.push(Object.entries(f.vals).slice(0, 4).map(([v, n]) => `${v}×${fmtNum(n)}`).join(' '));
  if (o.note) bits.push(o.note);
  return `  ${esc(key)}${opt}: ${tn(ty)};  ${cm(bits.join(' · '))}\n`;
}
function tsIface(name, comment, body, ext) {
  return `${cm(comment)}\n${kw('interface')} ${tn(name)}${ext ? ` ${kw('extends')} ${tn(ext)}` : ''} {\n${body}}\n\n`;
}
function tsSubUnion(name, comment, discKey, subs, _total, perSubNote = {}, base = 'Envelope') {
  let s = `${cm(comment)}\n${kw('type')} ${tn(name)} = ${base ? `${tn(base)} ${kw('&')} ` : ''}(\n`;
  for (const [sub, S] of Object.entries(subs).sort((a, b) => b[1].n - a[1].n)) {
    s += `  | { ${esc(discKey)}: ${tn(`'${sub}'`)};  ${cm(`×${fmtNum(S.n)}${perSubNote[sub] ? ' · ' + perSubNote[sub] : ''}`)}\n`;
    const fields = Object.entries(S.fields).sort((a, b) => b[1].n - a[1].n).slice(0, 7);
    for (const [k, f] of fields) s += `    ${esc(k)}${f.n / S.n < 0.985 ? '?' : ''}: ${tn(deriveType(f))};${f.vals && Object.keys(f.vals).length && deriveType(f)[0] !== "'" ? `  ${cm(Object.entries(f.vals).slice(0, 3).map(([v, n]) => `${v}×${n}`).join(' '))}` : ''}\n`;
    s += `    }\n`;
  }
  return s + ');\n\n';
}
function tsDefs() {
  if (!S3) return '';
  const E = S3.env, U = S3.user, A = S3.assistant;
  let out = '';
  // Envelope
  out += tsIface('Envelope', `every tree record repeats the full context · n=${fmtNum(E.n)}`,
    fl(E.fields, E.n, 'uuid', { req: 1 }) + fl(E.fields, E.n, 'parentUuid', { type: 'string | null', note: 'null = root' }) +
    fl(E.fields, E.n, 'isSidechain') + fl(E.fields, E.n, 'sessionId', { req: 1 }) + fl(E.fields, E.n, 'timestamp', { type: 'ISO8601' }) +
    fl(E.fields, E.n, 'version', { type: 'SemVer', note: 'self-stamping CLI version' }) + fl(E.fields, E.n, 'cwd') + fl(E.fields, E.n, 'gitBranch') +
    fl(E.fields, E.n, 'userType') + fl(E.fields, E.n, 'entrypoint') + fl(E.fields, E.n, 'slug', { note: 'since 2.0.55' }) +
    fl(E.fields, E.n, 'forkedFrom', { type: '{ sessionId: string; messageUuid: string }', note: 'since 2.1.138' }) +
    fl(E.fields, E.n, 'agentId', { note: 'era-1 inline sidechains only' }));
  // User
  out += tsIface('UserRecord', `the workhorse · n=${fmtNum(U.n)} · 82% are tool_result carriers`,
    `  type: ${tn("'user'")};\n  message: { role: ${tn("'user'")}; content: ${tn('string | UserBlock[]')} };  ${cm('string = typed prompt (15%)')}\n` +
    fl(U.fields, U.n, 'promptId', { note: 'THE TURN ID · since 2.1.79' }) +
    fl(U.fields, U.n, 'toolUseResult', { type: 'ToolUseResult', note: 'parsed twin, see union below' }) +
    fl(U.fields, U.n, 'sourceToolAssistantUUID', { note: 'backlink to the issuing assistant record' }) +
    fl(U.fields, U.n, 'permissionMode') + fl(U.fields, U.n, 'promptSource') +
    fl(U.fields, U.n, 'origin', { type: "{ kind: 'human' | 'task-notification' }" }) +
    fl(U.fields, U.n, 'todos', { type: '{ content; status; activeForm }[]', note: 'retired 2.1.50' }) +
    fl(U.fields, U.n, 'isMeta', { note: 'caveats/notices, not real prompts' }) +
    fl(U.fields, U.n, 'sessionKind') + fl(U.fields, U.n, 'interruptedMessageId') +
    fl(U.fields, U.n, 'toolDenialKind') +
    fl(U.fields, U.n, 'isCompactSummary', { note: 'the carry-forward' }) + fl(U.fields, U.n, 'isVisibleInTranscriptOnly', { note: 'render, do not re-prompt' }) +
    fl(U.fields, U.n, 'queuePriority'), 'Envelope');
  const TR = U.blocks.tool_result || {};
  out += `${cm('content blocks on user records')}\n${kw('type')} ${tn('UserBlock')} =\n` +
    `  | { type: ${tn("'tool_result'")}; tool_use_id: ${tn('string')}; content: ${tn('string | Block[]')}; is_error?: ${tn('boolean')} }  ${cm(`×${fmtNum(TR.type?.n || 0)} · is_error present ${pct(TR.is_error?.n || 0, TR.type?.n || 1)} · true ×${fmtNum(TR.is_error?.vals?.true || 0)}`)}\n` +
    `  | { type: ${tn("'text'")}; text: ${tn('string')} }  ${cm('×' + fmtNum(U.blocks.text?.type?.n || 0))}\n` +
    `  | { type: ${tn("'image'")}; source: ${tn('{…}')} }  ${cm('×' + fmtNum(U.blocks.image?.type?.n || 0))}\n` +
    `  | { type: ${tn("'document'")}; source: ${tn('{…}')} };  ${cm('×' + fmtNum(U.blocks.document?.type?.n || 0))}\n\n`;
  // Assistant
  const M = A.message, UG = A.usage;
  out += tsIface('AssistantRecord', `one block per record · n=${fmtNum(A.n)} · reassemble by message.id`,
    fl(A.fields, A.n, 'requestId') +
    `  message: {\n` +
    `    id: ${tn('string')}; model: ${tn('string')};  ${cm('shared across the records of one API call')}\n` +
    fl(M, A.n, 'stop_reason', { note: 'evolves; last record wins' }).replace(/^ {2}/, '    ') +
    fl(M, A.n, 'stop_details').replace(/^ {2}/, '    ') +
    fl(M, A.n, 'diagnostics').replace(/^ {2}/, '    ') +
    fl(M, A.n, 'context_management', { note: 'context-editing metadata' }).replace(/^ {2}/, '    ') +
    `    content: [ ${tn('AssistantBlock')} ];  ${cm('almost always exactly one')}\n` +
    `    usage: ${tn('Usage')};\n  };\n` +
    fl(A.fields, A.n, 'isApiErrorMessage') + fl(A.fields, A.n, 'attributionMcpServer') + fl(A.fields, A.n, 'attributionMcpTool') + fl(A.fields, A.n, 'attributionSkill') + fl(A.fields, A.n, 'attributionPlugin') + fl(A.fields, A.n, 'attributionAgent') + fl(A.fields, A.n, 'error'), 'Envelope');
  out += `${cm('the exploded content block')}\n${kw('type')} ${tn('AssistantBlock')} =\n` +
    `  | { type: ${tn("'thinking'")}; thinking: ${tn('string')}; signature: ${tn('string')} }  ${cm('×' + fmtNum(A.blocks.thinking?.type?.n || 0) + ' · signature 100% - the replay currency')}\n` +
    `  | { type: ${tn("'text'")}; text: ${tn('string')} }  ${cm('×' + fmtNum(A.blocks.text?.type?.n || 0))}\n` +
    `  | { type: ${tn("'tool_use'")}; id: ${tn('toolu_*')}; name: ${tn('string')}; input: ${tn('object')}; caller?: ${tn('{…}')} };  ${cm('×' + fmtNum(A.blocks.tool_use?.type?.n || 0) + ` · caller present ${pct(A.blocks.tool_use?.caller?.n || 0, A.blocks.tool_use?.type?.n || 1)}`)}\n\n`;
  out += tsIface('Usage', 'on every assistant record; final values ride the last record of a message',
    fl(UG, A.n, 'input_tokens', { req: 1 }) + fl(UG, A.n, 'output_tokens', { req: 1 }) +
    fl(UG, A.n, 'cache_read_input_tokens', { req: 1 }) + fl(UG, A.n, 'cache_creation_input_tokens', { req: 1 }) +
    fl(UG, A.n, 'cache_creation', { type: '{ ephemeral_5m…; ephemeral_1h… }' }) +
    fl(UG, A.n, 'service_tier') + fl(UG, A.n, 'speed', { note: 'fast mode is real' }) + fl(UG, A.n, 'inference_geo') +
    fl(UG, A.n, 'server_tool_use', { note: 'present but zeroed - no hosted tools' }) + fl(UG, A.n, 'iterations'));
  // System union
  out += tsSubUnion('SystemRecord', `9 statistical clusters under one type · n=${fmtNum(S3.system.n)}`, 'subtype', S3.system.subs, S3.system.n);
  // Attachment union (top 8) - a nested PAYLOAD union, not a record: no Envelope
  const attTop = Object.fromEntries(Object.entries(S3.attachment.subs).sort((a, b) => b[1].n - a[1].n).slice(0, 8));
  out += tsSubUnion('AttachmentPayload', `the context-injection journal · n=${fmtNum(S3.attachment.n)} · top 8 of ${Object.keys(S3.attachment.subs).length} kinds · the record is: Envelope & { type: 'attachment'; attachment: AttachmentPayload }`, 'type', attTop, S3.attachment.n, {}, '');
  // Progress union - nested under data: no Envelope on the payload
  out += tsSubUnion('ProgressData', `RETIRED era-2 · n=${fmtNum(S3.progress.n)} · the record is: Envelope & { type: 'progress'; data: ProgressData; toolUseID; parentToolUseID }`, 'type', S3.progress.subs, S3.progress.n, {}, '');
  // Queue: FLOATING - no uuid, no Envelope; just timestamp + sessionId + op fields
  out += tsSubUnion('QueueOperation', `the prompt-queue journal · n=${fmtNum(S3.queue.n)} · FLOATING: no uuid/Envelope, just { type: 'queue-operation' } + these`, 'operation', S3.queue.subs, S3.queue.n, {}, '');
  out += tsIface('FileHistorySnapshot', `the /rewind index · n=${fmtNum(S3.fhs.n)} · CHECKPOINT family: no uuid/Envelope, keys on messageId`,
    `  messageId: ${tn('string')};  ${cm('the prompt this checkpoint belongs to')}\n` +
    `  snapshot: { trackedFileBackups: ${tn('Record<path, { backupFileName: string | null; version: number; backupTime: ISO8601 }>')} };\n` +
    fl(S3.fhs.fields, S3.fhs.n, 'isSnapshotUpdate', { note: 'append-supersede' }));
  out += `${cm(`file-history-delta ×${fmtNum(S3.fhd.n)} (also checkpoint family): { messageId; snapshotMessageId; trackingPath; backup } - the incremental sibling, since 2026-07-14`)}\n\n`;
  const flo = S3.floating;
  const floLine = (t, sig) => flo[t] ? `  { type: ${tn(`'${t}'`)}; ${sig} }  ${cm('×' + fmtNum(flo[t].n))}\n` : '';
  out += `${cm('floating state - no uuid, latest-wins; whole payload shown')}\n${kw('type')} ${tn('FloatingState')} =\n` +
    floLine('last-prompt', `lastPrompt: ${tn('string')}; leafUuid?: ${tn('string')}; sessionId`) +
    floLine('ai-title', `aiTitle: ${tn('string')}; sessionId`) +
    floLine('custom-title', `customTitle: ${tn('string')}; sessionId`) +
    floLine('agent-name', `agentName: ${tn('string')}; sessionId`) +
    floLine('permission-mode', `permissionMode: ${tn(deriveType(flo['permission-mode']?.fields?.permissionMode || { types: { string: 1 } }))}; sessionId`) +
    floLine('mode', `mode: ${tn("'normal'")}; sessionId`) +
    floLine('summary', `summary: ${tn('string')}; leafUuid: ${tn('string')}`) +
    floLine('frame-link', `path; frameUrl; sessionId; timestamp`) + ';\n\n';
  // ToolUseResult union
  const TT = Object.entries(U.turPerTool).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  out += `${cm(`the parsed result twin - shape is PER-TOOL · object ×${fmtNum(S3.user.turShapes?.object || 0)} · string ×${fmtNum(S3.user.turShapes?.string || 0)} (exactly the errors) · array ×${fmtNum(S3.user.turShapes?.array || 0)}`)}\n${kw('type')} ${tn('ToolUseResult')} = ${tn('string')} ${cm('errors persist as bare strings')}\n`;
  for (const [name, T] of TT) {
    const keys = Object.entries(T.keys).sort((a, b) => b[1].n - a[1].n).slice(0, 9);
    out += `  | { ${cm(`${name} ×${fmtNum(T.n)}`)}\n`;
    for (const [k, f] of keys) out += `    ${esc(k)}${f.n / T.n < 0.985 ? '?' : ''}: ${tn(deriveType(f))};${f.vals && Object.keys(f.vals).length && deriveType(f)[0] !== "'" ? '  ' + cm(Object.entries(f.vals).slice(0, 3).map(([v, n]) => `${v}×${n}`).join(' ')) : ''}\n`;
    out += `    }\n`;
  }
  out += ';\n';
  return `<pre class="ts">${out}</pre>`;
}

// ---- per-tool contracts: Input -> wire copy + parsed copy, as TypeScript ---------
function toolContract(name) {
  const I = TX?.iface?.[name], T = S3?.user?.turPerTool?.[name];
  if (!I || !T || !T.wire) return '';
  let out = `${cm(`${name} · ${fmtNum(I.n)} calls (incl. subagent tapes) · ${pct(I.errN, I.n)} err`)}\n${kw('interface')} ${tn(name.replace(/\W/g, '') + 'Input')} {\n`;
  const params = Object.entries(I.params).sort((a, b) => b[1].n - a[1].n).filter(([, p]) => p.n >= Math.max(3, I.n * 0.004)).slice(0, 10);
  for (const [k, p] of params) {
    const opt = p.n / I.n < 0.985 ? '?' : '';
    const ty = deriveType(p);
    const bits = [pct(p.n, I.n)];
    if (p.types.string && p.strLen && ty[0] !== "'") bits.push(`avg ${fmtNum(Math.round(p.strLen / Math.max(1, p.types.string)))}c`);
    if (p.vals && Object.keys(p.vals).length) bits.push(Object.entries(p.vals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => `${v}×${fmtNum(n)}`).join(' '));
    out += `  ${esc(k)}${opt}: ${tn(ty)};  ${cm(bits.join(' · '))}\n`;
  }
  out += `}\n`;
  const wireTy = Object.entries(T.wire.types).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ×${fmtNum(n)}`).join(' · ');
  out += `${cm(`→ WIRE copy: tool_result.content = ${wireTy} · avg ${fmtBytes(Math.round(T.wire.len / T.wire.n))} · re-sent to the API on every later turn`)}\n`;
  out += `${cm(`→ PARSED copy: toolUseResult · avg ${fmtBytes(Math.round(T.parsedLen / T.wire.n))} · app-only, never re-sent · bare string on error ×${fmtNum(T.parsedStr)}`)}\n`;
  out += `${kw('interface')} ${tn(name.replace(/\W/g, '') + 'Result')} {\n`;
  for (const [k, f] of Object.entries(T.keys).sort((a, b) => b[1].n - a[1].n).slice(0, 11))
    out += `  ${esc(k)}${f.n / T.n < 0.985 ? '?' : ''}: ${tn(deriveType(f))};${f.vals && Object.keys(f.vals).length && deriveType(f)[0] !== "'" ? '  ' + cm(Object.entries(f.vals).slice(0, 3).map(([v, n]) => `${v}×${n}`).join(' ')) : ''}\n`;
  return out + `}\n\n`;
}
const copyDivergence = () => {
  if (!S3?.user?.turPerTool) return '';
  const NOTE = {
    Edit: 'wire = short confirmation; parsed holds originalFile + structuredPatch + userModified - the diff machinery is app-side',
    Write: 'wire = "file written"; parsed holds the full content again',
    Read: 'FULL duplication - the file text exists in both copies',
    Bash: 'wire = merged text; parsed = split stdout/stderr + flags',
    Agent: 'wire = text block(s); parsed adds accounting (tokens, duration, toolStats)',
    Grep: 'near-identical, parsed adds counts/filenames structure',
    TaskUpdate: 'wire = terse ack; parsed = structured task delta',
    'mcp__claude-in-chrome__computer': 'block arrays (text+image) pass through both copies verbatim',
  };
  return Object.entries(S3.user.turPerTool).filter(([, T]) => T.wire?.n >= 250).sort((a, b) => b[1].wire.n - a[1].wire.n).slice(0, 9).map(([name, T]) => {
    const ratio = T.parsedLen / Math.max(1, T.wire.len);
    return `<tr><td class="mono">${esc(name.length > 22 ? name.slice(0, 22) + '…' : name)}</td><td class="mono">${fmtNum(T.wire.n)}</td><td class="mono small">${esc(Object.entries(T.wire.types).sort((a, b) => b[1] - a[1])[0][0])}</td><td class="mono">${fmtBytes(Math.round(T.wire.len / T.wire.n))}</td><td class="mono">${fmtBytes(Math.round(T.parsedLen / T.wire.n))}</td><td class="mono" style="color:${ratio > 3 ? '#ffcf4d' : ratio < 0.7 ? '#5aa9ff' : '#9aa38c'}">${ratio.toFixed(1)}×</td><td class="small">${NOTE[name] || ''}</td></tr>`;
  }).join('');
};

// ---- ladder serialization: how L1..L4 groupings flatten onto the L0 tape --------
let SLC = null;
try { SLC = loadJson('slice'); } catch { console.log('note: out/slice.json missing - run slice.mjs for the serialization figure'); }
let VER = null;
try { VER = loadJson('verify'); } catch { console.log('note: out/verify.json missing - run verify.mjs for the reconstruction contract'); }

function ladderSerialization() {
  if (!SLC) return '';
  const R = SLC.records, n = R.length;
  const W = 1120, x0 = 118, cw = (W - x0 - 14) / n;
  const cx = i => x0 + i * cw + cw / 2;
  const LVL = { L4: '#8fbf5a', L3: '#d5ec31', L2: '#ffcf4d', L1: '#ff9d5c' };
  const yB = { L4: 26, L3: 52, L2: 78, L1: 104 };
  const yTop = 128, yBot = 190, H = 232;

  // membership
  const pidOf = [];
  let cur = null;
  for (const r of R) {
    if (r.k === 'prompt') cur = r.pid;
    pidOf.push(r.k === 'floating' || r.k === 'checkpoint' ? null : cur);
  }
  const segs = (belongs) => {   // contiguous runs where belongs(i) is truthy, keyed by its value
    const out = [];
    for (let i = 0; i < n; i++) {
      const v = belongs(i);
      if (!v) continue;
      const last = out[out.length - 1];
      if (last && last.v === v && last.to === i - 1) last.to = i;
      else out.push({ v, from: i, to: i });
    }
    return out;
  };
  const band = (y, col, from, to, label) => {
    const x1 = cx(from) - cw / 2 + 2, x2 = cx(to) + cw / 2 - 2;
    return `<rect x="${x1.toFixed(1)}" y="${y}" width="${(x2 - x1).toFixed(1)}" height="14" rx="4" fill="${col}" fill-opacity="0.16" stroke="${col}" stroke-width="1.1"/>` +
      (label ? `<text x="${x1 + 5}" y="${y + 11}" font-size="9.5" font-family="JetBrains Mono" fill="${col}">${esc(label)}</text>` : '');
  };
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block">`;
  // row labels
  for (const [lv, y] of Object.entries(yB)) s += `<text x="10" y="${y + 11}" font-size="11" font-family="JetBrains Mono" fill="${LVL[lv]}">${lv === 'L4' ? 'L4 session' : lv === 'L3' ? 'L3 turn' : lv === 'L2' ? 'L2 cycle' : 'L1 call'}</text>`;
  s += `<text x="10" y="${yTop + 38}" font-size="11" font-family="JetBrains Mono" fill="#c9d3ba">L0 tape</text>`;
  // L4: one band over everything
  s += band(yB.L4, LVL.L4, 0, n - 1, `session …${esc(SLC.session.slice(0, 8))} (whole tape)`);
  // L3: turn segments (NOT contiguous - floating cells punch holes)
  const turnSegs = segs(i => pidOf[i]);
  const seenPid = new Set();
  for (const g of turnSegs) {
    s += band(yB.L3, LVL.L3, g.from, g.to, seenPid.has(g.v) ? '' : `turn ·${esc(g.v)}`);
    seenPid.add(g.v);
  }
  // L2: tool cycles (tool_use -> its result)
  let cyc = 0;
  for (let i = 0; i < n; i++) {
    if (R[i].k !== 'tool_use' || !R[i].tu) continue;
    const ri = R.findIndex((r, k) => k > i && r.k === 'result' && r.tu === R[i].tu);
    if (ri > 0) s += band(yB.L2, LVL.L2, i, ri, `cycle ${TOOL_MARK[cyc++] || ''} ${esc(R[i].name || '')}`);
  }
  // L1: message.id runs
  const midSegs = segs(i => R[i].mid);
  for (const g of midSegs) s += band(yB.L1, LVL.L1, g.from, g.to, `msg ·${esc(g.v)}`);
  // L0 cells
  const KCOL = { prompt: '#d5ec31', result: '#7c8474', thinking: '#b48cff', text: '#5aa9ff', tool_use: '#ffcf4d', system: '#55604b', attachment: '#8a8f5a', floating: '#8fbf5a', checkpoint: '#5aa9ff', meta: '#444', other: '#444' };
  for (let i = 0; i < n; i++) {
    const r = R[i], col = KCOL[r.k] || '#444';
    const dash = r.k === 'floating' || r.k === 'checkpoint' ? ' stroke-dasharray="4 3"' : '';
    s += `<rect x="${(cx(i) - cw / 2 + 1.5).toFixed(1)}" y="${yTop}" width="${(cw - 3).toFixed(1)}" height="${yBot - yTop}" rx="5" fill="#10130d" stroke="${col}" stroke-width="1.2"${dash}><title>${esc(r.k + (r.sub ? '/' + r.sub : '') + (r.name ? ' ' + r.name : ''))}</title></rect>`;
    const l1 = { prompt: 'user', result: 'user', thinking: 'asst', text: 'asst', tool_use: 'asst', system: 'sys', attachment: 'att', floating: 'FLOAT', checkpoint: 'CHKPT', meta: 'meta' }[r.k] || '?';
    const l2 = r.k === 'floating' ? (r.sub || '').replace('permission-mode', 'perm').replace('last-prompt', 'draft').replace('ai-title', 'title') : r.k === 'system' ? (r.sub || '').replace('stop_hook_summary', 'hooks').replace('turn_duration', 'dur') : r.name || (r.k === 'prompt' ? 'prompt' : r.k === 'result' ? 'result' : r.k === 'attachment' ? 'ctx' : r.k);
    s += `<text x="${cx(i)}" y="${yTop + 24}" text-anchor="middle" font-size="9.5" font-family="JetBrains Mono" fill="#e8ece2">${esc(l1)}</text>`;
    s += `<text x="${cx(i)}" y="${yTop + 40}" text-anchor="middle" font-size="8.5" font-family="JetBrains Mono" fill="${col}">${esc(l2.slice(0, 7))}</text>`;
    // floating cells: connector up to the L4 band (they skip L1-L3)
    if (r.k === 'floating') s += `<line x1="${cx(i)}" y1="${yTop}" x2="${cx(i)}" y2="${yB.L4 + 14}" stroke="${LVL.L4}" stroke-width="0.9" stroke-dasharray="3 3" opacity="0.65"/>`;
    // checkpoints: dotted arrow to the NEXT prompt cell (they key forward)
    if (r.k === 'checkpoint') {
      const pi = R.findIndex((x, k) => k > i && x.k === 'prompt');
      if (pi > 0) s += `<path d="M ${cx(i)} ${yBot + 4} C ${cx(i)} ${yBot + 26}, ${cx(pi)} ${yBot + 26}, ${cx(pi)} ${yBot + 4}" fill="none" stroke="#5aa9ff" stroke-width="1" stroke-dasharray="3 3"/><text x="${(cx(i) + cx(pi)) / 2}" y="${yBot + 36}" text-anchor="middle" font-size="9" font-family="JetBrains Mono" fill="#5aa9ff">messageId → next prompt</text>`;
    }
  }
  return `<div class="panel">${s}</svg></div>`;
}

// ---- drill view: rich serialization slice (parallel spawns, eager streaming) -----
let SL2 = null;
try { SL2 = loadJson('slice2'); } catch { console.log('note: out/slice2.json missing - run slice2.mjs for the drill view'); }
const SL2X = SL2 ? (() => {
  const R = SL2.records;
  const usesByMid = {};
  R.forEach(r => { if (r.k === 'tool_use' && r.mid) (usesByMid[r.mid] = usesByMid[r.mid] || []).push(r); });
  const top = Object.entries(usesByMid).sort((a, b) => b[1].length - a[1].length)[0] || [null, []];
  const multiMid = top[0], uses = top[1];
  let segs = 0, prev = false;
  R.forEach(r => { const m = r.mid === multiMid; if (m && !prev) segs++; prev = m; });
  const floatInCycle = R.some((r, i) => {
    if (r.k !== 'tool_use' || !r.tu) return false;
    const ri = R.findIndex((x, k) => k > i && x.k === 'result' && x.tu === r.tu);
    return ri > 0 && R.slice(i + 1, ri).some(x => x.k === 'floating' || x.k === 'attachment');
  });
  return {
    multiMid, nUses: uses.length, names: [...new Set(uses.map(u => u.name))].join('/'), segs, floatInCycle,
    hasChk: R.some(r => r.k === 'checkpoint'), nQueue: R.filter(r => r.k === 'floating' && r.sub === 'queue-operation').length,
    resultsHavePid: R.some(r => r.k === 'result' && r.pid),
  };
})() : null;

function drillView() {
  if (!SL2) return '';
  const R = SL2.records, n = R.length;
  const W = 1120, x0 = 130, cw = (W - x0 - 14) / n;
  const cx = i => x0 + i * cw + cw / 2;
  const LVL = { L4: '#8fbf5a', L3: '#d5ec31', L2: '#ffcf4d', L1: '#ff9d5c' };
  const yB = { L4: 22, L3: 46, L2: 70, L1: 96 };
  const yTop = 122, yBot = 202;
  const H = SL2.spawn ? 372 : 268;
  // membership
  const pidOf = []; let cur = null;
  for (const r of R) { if (r.k === 'prompt') cur = r.pid; pidOf.push(r.k === 'floating' || r.k === 'checkpoint' ? null : cur); }
  const seg = f => { const o = []; for (let i = 0; i < n; i++) { const v = f(i); if (!v) continue; const l = o[o.length - 1]; if (l && l.v === v && l.to === i - 1) l.to = i; else o.push({ v, from: i, to: i }); } return o; };
  const band = (y, col, from, to, label) => {
    const x1 = cx(from) - cw / 2 + 1.5, x2 = cx(to) + cw / 2 - 1.5;
    return `<rect x="${x1.toFixed(1)}" y="${y}" width="${(x2 - x1).toFixed(1)}" height="14" rx="4" fill="${col}" fill-opacity="0.16" stroke="${col}" stroke-width="1.1"/>` +
      (label ? `<text x="${x1 + 4}" y="${y + 11}" font-size="9.5" font-family="JetBrains Mono" fill="${col}">${esc(label)}</text>` : '');
  };
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block">`;
  for (const [lv, y] of Object.entries(yB)) s += `<text x="10" y="${y + 11}" font-size="11" font-family="JetBrains Mono" fill="${LVL[lv]}">${{ L4: 'L4 session', L3: 'L3 turn', L2: 'L2 cycle', L1: 'L1 call' }[lv]}</text>`;
  s += `<text x="10" y="${yTop + 42}" font-size="11" font-family="JetBrains Mono" fill="#c9d3ba">L0 tape</text>`;
  s += band(yB.L4, LVL.L4, 0, n - 1, `sessionId …${esc(SL2.spawn?.sessionId || SL2.session.slice(0, 8))} - stored on every tree record`);
  const seenP = new Set();
  for (const g of seg(i => pidOf[i])) { s += band(yB.L3, LVL.L3, g.from, g.to, seenP.has(g.v) ? '' : `turn ·${esc(g.v)}`); seenP.add(g.v); }
  // cycles
  let ci = 0;
  for (let i = 0; i < n; i++) {
    if (R[i].k !== 'tool_use' || !R[i].tu) continue;
    const ri = R.findIndex((r, k) => k > i && r.k === 'result' && r.tu === R[i].tu);
    if (ri > 0) s += band(yB.L2, LVL.L2, i, ri, `${TOOL_MARK[ci] || '·'}${esc(R[i].name || '')}`);
    ci++;
  }
  // L1: same-mid segments + dashed links between punctured segments
  const midSegs = seg(i => R[i].mid);
  const firstSegOf = {};
  for (const g of midSegs) {
    s += band(yB.L1, LVL.L1, g.from, g.to, firstSegOf[g.v] === undefined ? `msg ·${esc(g.v)}` : '');
    if (firstSegOf[g.v] !== undefined) {
      const prev = firstSegOf[g.v];
      s += `<line x1="${cx(prev) + cw / 2}" y1="${yB.L1 + 7}" x2="${cx(g.from) - cw / 2}" y2="${yB.L1 + 7}" stroke="${LVL.L1}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`;
    }
    firstSegOf[g.v] = g.to;
  }
  // cells + drill dots
  const KCOL = { prompt: '#d5ec31', result: '#7c8474', thinking: '#b48cff', text: '#5aa9ff', tool_use: '#ffcf4d', system: '#55604b', attachment: '#8a8f5a', floating: '#8fbf5a', checkpoint: '#5aa9ff', meta: '#444', other: '#444' };
  // drill membership per kind: [L4, L3, L2, L1] - 'S' stored key, 'D' derived via chain, 'P' pointer, null absent
  const DRILL = {
    prompt: ['S', 'S', null, null], result: ['S', 'S', 'S', null],
    thinking: ['S', 'D', null, 'S'], text: ['S', 'D', null, 'S'], tool_use: ['S', 'D', 'S', 'S'],
    attachment: ['S', 'D', null, null], system: ['S', 'D', null, null],
    floating: ['S', null, null, null], checkpoint: [null, 'P', null, null], meta: ['S', 'D', null, null], other: [null, null, null, null],
  };
  for (let i = 0; i < n; i++) {
    const r = R[i], col = KCOL[r.k] || '#444';
    const dash = r.k === 'floating' || r.k === 'checkpoint' ? ' stroke-dasharray="4 3"' : '';
    s += `<rect x="${(cx(i) - cw / 2 + 1.5).toFixed(1)}" y="${yTop}" width="${(cw - 3).toFixed(1)}" height="${yBot - yTop}" rx="5" fill="#10130d" stroke="${col}" stroke-width="1.2"${dash}><title>${esc(r.k + (r.sub ? '/' + r.sub : '') + (r.name ? ' ' + r.name : ''))}</title></rect>`;
    const l1 = { prompt: 'user', result: 'user', thinking: 'asst', text: 'asst', tool_use: 'asst', system: 'sys', attachment: 'att', floating: 'FLOAT', checkpoint: 'CHKPT' }[r.k] || '?';
    const l2 = r.k === 'floating' ? (r.sub || '').replace('permission-mode', 'perm').replace('last-prompt', 'draft').replace('ai-title', 'title')
      : r.k === 'system' ? (r.sub || '').replace('stop_hook_summary', 'hooks').replace('turn_duration', 'dur')
        : r.k === 'attachment' ? (r.sub || 'ctx').slice(0, 8) : r.name || (r.k === 'prompt' ? 'prompt' : r.k === 'result' ? 'result' : r.k === 'checkpoint' ? (r.fhsKind === 'prompt' ? '→prompt' : '→' + (r.fhsKind || '?')) : r.k);
    s += `<text x="${cx(i)}" y="${yTop + 18}" text-anchor="middle" font-size="9.5" font-family="JetBrains Mono" fill="#e8ece2">${esc(l1)}</text>`;
    s += `<text x="${cx(i)}" y="${yTop + 33}" text-anchor="middle" font-size="8.5" font-family="JetBrains Mono" fill="${col}">${esc(String(l2).slice(0, 8))}</text>`;
    s += `<text x="${cx(i)}" y="${yTop + 48}" text-anchor="middle" font-size="8" font-family="JetBrains Mono" fill="#5a6150">${esc(r.tu ? '·' + r.tu.slice(-4) : r.mid ? '·' + r.mid.slice(-4) : '')}</text>`;
    // drill dots: which layer claims this record, and how (L3 on results: stored only when promptId present)
    const dr = [...(DRILL[r.k] || [null, null, null, null])];
    if (r.k === 'result') dr[1] = r.pid ? 'S' : 'D';
    const cols = [LVL.L4, LVL.L3, LVL.L2, LVL.L1];
    for (let d = 0; d < 4; d++) {
      const x = cx(i) - 21 + d * 12, y = yBot - 16;
      if (dr[d] === 'S') s += `<rect x="${x}" y="${y}" width="8" height="8" rx="2" fill="${cols[d]}"/>`;
      else if (dr[d] === 'D') s += `<rect x="${x}" y="${y}" width="8" height="8" rx="2" fill="none" stroke="${cols[d]}" stroke-width="1.3"/>`;
      else if (dr[d] === 'P') s += `<rect x="${x + 1}" y="${y + 1}" width="7" height="7" transform="rotate(45 ${x + 4.5} ${y + 4.5})" fill="${cols[d]}"/>`;
      else s += `<circle cx="${x + 4}" cy="${y + 4}" r="1" fill="#2a2f24"/>`;
    }
  }
  // spawn lane
  if (SL2.spawn) {
    const sp = SL2.spawn;
    const ai = R.findIndex(r => r.k === 'tool_use' && (r.name === 'Agent' || r.name === 'Task'));
    const sy = yBot + 62;
    if (ai >= 0) s += `<path d="M ${cx(ai)} ${yBot + 2} L ${cx(ai)} ${sy - 20} L ${x0 + 20} ${sy - 20} L ${x0 + 20} ${sy - 4}" fill="none" stroke="#b48cff" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    s += `<text x="${x0}" y="${sy - 26}" font-size="10.5" font-family="JetBrains Mono" fill="#b48cff">cycle ① opens a whole child tape (fractal): subagents/${esc(sp.file)} · ${esc(sp.agentType)} · ${fmtNum(sp.total)} records · isSidechain:true · agentId ${esc(sp.agentId || '')} · SAME sessionId …${esc(sp.sessionId)}</text>`;
    const ch = sp.head.concat([{ k: 'more' }]);
    const cw2 = 74;
    // child L1 band over its same-mid run
    const mi = sp.head.map((c, i) => c.mid ? i : -1).filter(i => i >= 0);
    if (mi.length) s += `<rect x="${x0 + mi[0] * cw2 + 2}" y="${sy - 14}" width="${(mi[mi.length - 1] - mi[0] + 1) * cw2 - 4}" height="10" rx="3" fill="${LVL.L1}" fill-opacity="0.16" stroke="${LVL.L1}" stroke-width="1"/><text x="${x0 + mi[0] * cw2 + 6}" y="${sy - 6}" font-size="8.5" font-family="JetBrains Mono" fill="${LVL.L1}">msg ·${esc(sp.head[mi[0]].mid)} (the child has its own L1/L2/L3 bands)</text>`;
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i], col = c.k === 'more' ? '#3a4234' : (KCOL[c.k] || '#444');
      s += `<rect x="${x0 + i * cw2}" y="${sy}" width="${cw2 - 5}" height="40" rx="5" fill="#130f1c" stroke="${col}" stroke-width="1.1"/>`;
      s += `<text x="${x0 + i * cw2 + (cw2 - 5) / 2}" y="${sy + 17}" text-anchor="middle" font-size="9" font-family="JetBrains Mono" fill="#e8ece2">${esc(c.k === 'more' ? '+' + fmtNum(sp.total - sp.head.length) : c.k === 'tool_use' ? c.name : c.k)}</text>`;
      s += `<text x="${x0 + i * cw2 + (cw2 - 5) / 2}" y="${sy + 31}" text-anchor="middle" font-size="8" font-family="JetBrains Mono" fill="#7c8474">${esc(c.k === 'more' ? 'records' : c.sub ? c.sub.slice(0, 9) : c.mid ? '·' + c.mid : '')}</text>`;
    }
    s += `<text x="${x0}" y="${sy + 56}" font-size="9.5" font-family="JetBrains Mono" fill="#5a6150">…ends in ${esc(sp.lastKind)} → ${sp.isAsync ? "cycle ①'s tool_result is only the ASYNC ACK (isAsync:true, ~4s); the child's output rejoins later via the notification loop" : "returned to the parent as cycle ①'s tool_result"}</text>`;
  }
  return `<div class="panel">${s}</svg></div>`;
}

// ---- tool-interface cards + impedance analysis ----------------------------------
function paramLine(tool, k, p) {
  let val;
  if (p.vals && Object.keys(p.vals).length) {
    val = Object.entries(p.vals).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([v, n]) => `<b>${esc(v.length > 18 ? v.slice(0, 18) + '…' : v)}</b>&thinsp;×${fmtNum(n)}`).join(' · ');
  } else if (p.types.string) {
    val = `free-form · avg ${fmtNum(Math.round(p.strLen / Math.max(1, p.types.string)))}c${p.strMax > 2000 ? ` · max ${fmtNum(p.strMax)}c` : ''}`;
  } else if (p.types.array) {
    val = `array · avg ${(p.arrLen / Math.max(1, p.arrN)).toFixed(1)} items`;
  } else val = Object.keys(p.types).join('/');
  return `<div class="pline"><code>${esc(k)}</code><span class="ppct">${pct(p.n, TX.iface[tool].n)}</span><span class="pval">${val}</span></div>`;
}
function ifaceCards(names) {
  return names.map(name => {
    const I = TX.iface[name];
    if (!I) return '';
    const params = Object.entries(I.params).sort((a, b) => b[1].n - a[1].n).filter(([, p]) => p.n >= Math.max(2, I.n * 0.003)).slice(0, 9);
    return `<div class="tcard"><div class="tcardh"><b>${esc(name)}</b><span>${fmtNum(I.n)} calls · ${pct(I.errN, I.n)} err · result avg ${fmtBytes(Math.round(I.resBytes / Math.max(1, I.n)))}</span></div>${params.map(([k, p]) => paramLine(name, k, p)).join('')}</div>`;
  }).join('');
}
const ifaceTotals = TX ? (() => {
  const all = Object.entries(TX.iface).sort((a, b) => b[1].n - a[1].n);
  const total = all.reduce((a, [, v]) => a + v.n, 0);
  const cum = k => pct(all.slice(0, k).reduce((a, [, v]) => a + v.n, 0), total);
  return { all, total, top5: cum(5), top9: cum(9), argsPerCall: (TX.totals.paramFills / TX.totals.calls).toFixed(1) };
})() : null;

const qWaitOrder = ['<1s', '1-10s', '10-60s', '1-10m', '10-60m', '>1h'];
const qWaitMax = Math.max(...qWaitOrder.map(k => SQ.queueDeltas?.[k] || 0));
const qWaitRows = qWaitOrder.map(k => `<tr><td class="mono">${k}</td><td>${bar(SQ.queueDeltas?.[k] || 0, qWaitMax)}</td></tr>`).join('');

const homeRows = (c.claudeHomeDirs || []).map(d => `<tr><td class="mono">${esc(d.path)}</td><td class="mono">${fmtBytes(d.kb * 1024)}</td></tr>`).join('');

const projRows = Object.entries(c.projects).map(([k, p]) => [k, p]).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 10)
  .map(([k, p]) => `<tr><td class="mono small">${esc(k.replace(/^-Users-[^-]+-?/, '~/').replace(/-/g, '/'))}</td><td class="mono">${p.sessions}</td><td class="mono">${fmtBytes(p.bytes)}</td><td class="mono small">${day(p.firstTs)} → ${day(p.lastTs)}</td></tr>`).join('');

const forkRows = sortDesc(t.forkChildTypes).map(([k, n]) => {
  const label = k.split('+').length > 4 ? `${k.split('+').length}× user` : k;
  return `<tr><td class="mono">${esc(label)}</td><td class="mono">${fmtNum(n)}</td></tr>`;
}).join('');

const histOrder = ['1', '2', '3-5', '6-10', '11-20', '21-50', '51-100', '100+'];
const histMax = Math.max(...histOrder.map(k => L.hist[k] || 0));
const histRows = histOrder.map(k => `<tr><td class="mono">${k}</td><td>${bar(L.hist[k] || 0, histMax)}</td></tr>`).join('');

const topRows = L.top.slice(0, 10).map(r => `<tr><td class="mono small">${esc(r.title || r.session)}</td><td class="small">${esc(r.snippet || '')}</td><td class="mono">${r.apiMsgs}</td><td class="mono">${r.toolUses}</td><td class="mono">${r.minutes != null ? r.minutes + 'm' : '-'}</td></tr>`).join('');

const toolRows = sortDesc(T.client).filter(([k]) => !k.includes('"')).slice(0, 16).map(([k, n]) => `<tr><td class="mono">${esc(k)}</td><td class="mono">${fmtNum(n)}</td><td class="mono small">${pct(n, T.uses)}</td></tr>`).join('');
const mcpRows = sortDesc(mcpByServer).map(([k, n]) => `<tr><td class="mono">${esc(k)}</td><td class="mono">${fmtNum(n)}</td></tr>`).join('');

const explOrder = ['1', '2', '3', '4', '5', '6+'];
const explMax = Math.max(...explOrder.map(k => c.explosion.hist[k] || 0));
const explRows = explOrder.map(k => `<tr><td class="mono">${k}</td><td>${bar(c.explosion.hist[k] || 0, explMax, 'b2')}</td></tr>`).join('');

// evolution table: merge record: and field: features that have dates
const NOTE = {
  'record:progress': 'retired - replaced by subagents/ sidecar tapes', 'inline isSidechain record': 'retired - subagents left the main tape',
  'field:todos': 'retired - todos moved out of the tape', 'field:thinkingMetadata': 'retired',
  'field:promptId': 'turn identity - groups a prompt with its whole loop', 'field:forkedFrom': 'session forking provenance',
  'field:sourceToolAssistantUUID': 'tool_result → issuing assistant record backlink', 'field:slug': 'human-readable session slug',
  'field:attributionMcpServer': 'per-message MCP attribution', 'field:attributionSkill': 'per-message skill attribution',
  'field:sessionKind': 'session kind marker', 'field:promptSource': 'how the prompt arrived', 'record:file-history-delta': 'incremental file backups',
  'field:logicalParentUuid': 'compaction seam link', 'field:toolDenialKind': 'permission-denial taxonomy', 'record:attachment': 'system context deltas',
  'field:interruptedMessageId': 'interrupt bookkeeping', 'field:agentId': 'inline sidechain agent id (retired with them)',
};
const evoRows = Object.entries(eras)
  .filter(([, f]) => f.firstTs)
  .sort((a, b) => a[1].firstTs < b[1].firstTs ? -1 : 1)
  .map(([k, f]) => {
    const stale = f.lastTs && (new Date(c.scannedAt) - new Date(f.lastTs)) > 45 * 86400e3;
    return `<tr class="${stale ? 'dim' : ''}"><td class="mono">${esc(k)}</td><td class="mono small">${day(f.firstTs)}${f.firstV ? ' @ ' + f.firstV : ''}</td><td class="mono small">${day(f.lastTs)}${stale ? ' ✝' : ''}</td><td class="mono">${fmtNum(f.count)}</td><td class="small">${NOTE[k] || ''}</td></tr>`;
  }).join('');

const monthKeys = Object.keys(c.monthly).sort();
const monthMax = Math.max(...Object.values(c.monthly));
const monthRows = monthKeys.map(m => `<tr><td class="mono">${m}</td><td>${bar(c.monthly[m], monthMax, 'b2')}</td></tr>`).join('');

const agentRows = sortDesc(S.agentTypes).slice(0, 8).map(([k, n]) => `<tr><td class="mono">${esc(k)}</td><td class="mono">${fmtNum(n)}</td></tr>`).join('');

// ------------------------------------------------------------------------------

const html = `<title>Claude Code session tapes - format, forest, loops & persistence (local eviscerate)</title>
<style>
:root{--bg:#0b0d0a;--card:#151812;--ink:#e8ece2;--dim:#9aa38c;--lime:#d5ec31;--srv:#5aa9ff;--cli:#ffcf4d;--res:#7c8474;--line:#2a2f24;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16.5px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:0 0 140px}
.wrap{max-width:1180px;margin:0 auto;padding:0 28px}
header{border-bottom:1px solid var(--line);padding:56px 0 34px;margin-bottom:16px}
h1{font-size:34px;margin:0 0 12px;letter-spacing:-.5px;line-height:1.25}
h1 b{color:var(--lime)}
.sub{color:var(--dim);font-size:15px;line-height:1.7}
h2{font-size:26px;margin:72px 0 10px;padding-top:28px;border-top:1px solid var(--line);letter-spacing:-.3px}
h2 .n{color:var(--lime);font-variant-numeric:tabular-nums;margin-right:12px}
h3{font-size:18px;margin:36px 0 12px;color:var(--lime)}
p{margin:14px 0}
.lede{color:var(--dim);margin:4px 0 14px;font-size:16px}
a{color:var(--lime)}
code,.mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 22px;overflow:auto;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:13.5px;line-height:1.6;color:#d6dcc9;margin:18px 0}
.tldr{background:linear-gradient(180deg,#171b11,#12140f);border:1px solid var(--line);border-left:3px solid var(--lime);border-radius:12px;padding:16px 28px;margin:32px 0}
.tldr li{margin:14px 0}
.q{color:var(--lime);font-weight:600}
table{border-collapse:collapse;width:100%;margin:18px 0 24px;font-size:15px}
th,td{border:1px solid var(--line);padding:10px 14px;text-align:left;vertical-align:top}
th{background:#12150f;color:var(--dim);font-weight:600;font-size:12.5px;text-transform:uppercase;letter-spacing:.5px}
.small{font-size:13.5px}
.dim td{color:#707a63}
.blk{display:inline-flex;align-items:baseline;gap:6px;border-radius:6px;padding:4px 10px;font-size:12.5px;font-family:"JetBrains Mono",monospace;border:1px solid var(--line);background:#10130d;white-space:nowrap}
.blk em{font-style:normal;color:var(--dim);font-size:11px}
.blk.t-cli{color:var(--cli);background:#221d0e;border-color:#5e4d23}
.blk.t-srv{color:var(--srv);background:#0e1622;border-color:#23405e}
.blk.t-res{color:var(--res);background:#14160f}
.arr{color:#39402f;font-size:12px;padding:0 4px}
.seq{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:14px 0 18px}
.note{background:#12140f;border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin:20px 0;font-size:15px;line-height:1.65}
.note b{color:var(--lime)}
.win{border-left:3px solid var(--lime)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:22px}
@media(max-width:720px){.grid2{grid-template-columns:1fr}}
.stat{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:14px;margin:22px 0}
.stat>div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px}
.stat b{display:block;font-size:27px;color:var(--lime);font-family:"JetBrains Mono",monospace;letter-spacing:-.5px;margin-bottom:4px}
.stat span{font-size:12.5px;color:var(--dim)}
.barwrap{display:flex;align-items:center;gap:10px;min-width:260px}
.bar{height:17px;background:linear-gradient(90deg,#8aa32a,var(--lime));border-radius:4px}
.bar.b2{background:linear-gradient(90deg,#23405e,var(--srv))}
.barwrap span{font-family:"JetBrains Mono",monospace;font-size:12.5px;color:var(--dim)}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--dim);margin:12px 0}
.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.stack{display:flex;height:34px;border-radius:8px;overflow:hidden;border:1px solid var(--line);margin:18px 0 4px}
.stack>div{min-width:2px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:14px 0;overflow-x:auto}
.rhythm{display:flex;flex-wrap:wrap;gap:3px;margin:16px 0}
.rhythm span{width:16px;height:16px;border-radius:3px;display:inline-block}
.fan{display:flex;gap:18px;align-items:flex-start;margin:18px 0}
.fanspine{background:var(--card);border:1px solid var(--lime);border-radius:10px;padding:14px 18px;white-space:nowrap}
.fanspine b{display:block;color:var(--lime);font-size:15px}
.fanspine span{font-size:12.5px;color:var(--dim)}
.fanwrap{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.fanchip{height:18px;border-radius:4px;display:inline-block}
.anat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 24px;font-family:"JetBrains Mono",monospace;font-size:13.5px;line-height:1.7;margin:20px 0}
.anat .d{border:1px solid var(--line);border-radius:8px;padding:9px 16px;margin:10px 0}
.anat .k{color:var(--lime)}
.anat .n{color:var(--dim)}
.anat .ty{color:#6f7d8f;font-size:12px}
.anat.bare{border:none;background:none;padding:0;margin:14px 0}
.anat .drv{float:right;color:#ffcf4d;font-size:11.5px;background:#221d0e;border:1px solid #5e4d23;border-radius:5px;padding:2px 9px;margin-left:12px;font-family:"JetBrains Mono",monospace}
.fam{font-family:"JetBrains Mono",monospace;font-size:11px;padding:2px 8px;border-radius:4px;white-space:nowrap}
.f-tree{background:#10160d;color:#8fbf5a;border:1px solid #2f4a1d}
.f-flo{background:#221d0e;color:var(--cli);border:1px solid #5e4d23}
.f-chk{background:#0e1622;color:var(--srv);border:1px solid #23405e}
table.matrix{table-layout:fixed;font-size:11px}
table.matrix th{font-size:10.5px;padding:6px 4px;text-align:center;text-transform:none;letter-spacing:0}
table.matrix td{padding:0;height:30px;text-align:center;font-family:"JetBrains Mono",monospace;font-size:10.5px;color:#9aa38c;border-color:#1c2018}
table.matrix thead th:first-child{width:74px}
.idsys{margin:18px 0}
.idses{border:1px solid var(--line);border-radius:12px;padding:14px 18px;background:#0d0f0b}
.idturn{border:1px solid #3a4222;border-radius:10px;padding:12px 16px;margin:12px 0;background:#101307}
.idmsg{border:1px solid;border-radius:9px;padding:8px 14px;margin:10px 0;background:#0c1118}
.idrec{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 4px;font-size:13.5px}
.idrec b{font-size:13px}
.idrec .uu{color:#7c8474;font-size:12px}
.idrec .parr{color:#4a5240;font-size:11.5px;font-family:"JetBrains Mono",monospace}
.idlab{font-family:"JetBrains Mono",monospace;font-size:13px;margin:2px 0 6px;color:var(--ink)}
.idlab code{font-size:12.5px}
.muted2{color:#707a63;font-size:12px}
.idu{border-left:3px solid var(--lime);padding-left:10px}
.idr{border-left:3px solid #4a4a33;padding-left:10px}
.ids,.idf{opacity:.75}
.idspawn{border:1px dashed #b48cff;border-radius:10px;padding:10px 16px;margin:12px 0 4px;background:#130f1c;font-size:13px;line-height:1.7}
.l2h td{background:#141810;border-top:2px solid #39402f;padding-top:12px}
.l2h .small{color:#707a63}
.l2s{padding-left:28px !important;color:#c9d3ba}
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}
@media(max-width:820px){.tgrid{grid-template-columns:1fr}}
.tcard{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px}
.tcardh{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:8px}
.tcardh b{color:var(--lime);font-family:"JetBrains Mono",monospace;font-size:15px}
.tcardh span{color:var(--dim);font-size:12px;font-family:"JetBrains Mono",monospace}
.pline{display:flex;gap:10px;align-items:baseline;font-size:12.5px;padding:3px 0;font-family:"JetBrains Mono",monospace}
.pline code{min-width:150px;color:#c9d3ba}
.ppct{min-width:52px;color:var(--lime);text-align:right}
.pval{color:#7c8474;font-size:11.5px}
.pval b{color:#ffcf4d;font-weight:500}
pre.ts{font-size:12.5px;line-height:1.55}
pre.ts .kw{color:#5aa9ff}
pre.ts .tn{color:#d5ec31}
pre.ts .c{color:#5a6150}
.foot{color:#5a6150;font-size:12px;margin-top:40px;border-top:1px solid var(--line);padding-top:16px}
kbd{background:#000;border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:1px 5px;font-family:monospace;font-size:11px;color:var(--lime)}
</style>

<div class="wrap">
<header>
<h1><b>Eviscerating</b> Claude Code's session tapes: format, forest, loops &amp; persistence</h1>
<div class="sub">Local census of <code>~/.claude/projects/</code> · ${c.corpus.projects} projects · ${fmtNum(c.corpus.sessionTapes)} session tapes + ${fmtNum(c.corpus.subagentTapes)} subagent tapes · ${fmtBytes(c.corpus.bytes)} · ${fmtNum(c.corpus.lines)} records · ${day(c.corpus.firstTs)} → ${day(c.corpus.lastTs)} · CLI ${vSorted[0]}…${vSorted[vSorted.length - 1]} · harness: <code>tools/develop/alx-claude-code-eviscerate/</code></div>
</header>

<p class="lede">Goal: reverse the on-disk session format from the corpus itself - is a session a tape or a tree, how the agentic loop serializes, whether hosted tool calls appear, what is persisted vs discarded, and which sub-structures matter. Every number below is measured from the local files; ${fmtNum(c.corpus.parseErrors)} parse errors in ${fmtNum(c.corpus.lines)} records.</p>

<div class="tldr">
<ul>
<li><span class="q">Tape or tree?</span> <b>Both: an append-only JSONL tape that encodes a <em>forest</em>.</b> Records point up via <code>parentUuid</code>; nothing is ever rewritten in place. ${fmtNum(t.roots)} roots across ${fmtNum(t.tapes)} tapes (${fmtNum(t.multiRootTapes)} tapes are multi-root, max ${t.maxRootsInTape}). ${pct(t.linearTapes, t.tapes)} of tapes are perfectly linear; the rest hold real forks: ${fmtNum(t.forkNodes)} fork nodes, up to ${t.maxConvChildren} sibling children (edits/retries).</li>
<li><span class="q">How does the loop work?</span> A user prompt opens a <code>promptId</code> turn; each assistant <em>API call</em> is <b>exploded into one record per content block</b> (${fmtNum(c.explosion.apiMessages)} API calls → ${fmtNum(c.explosion.records)} records, ${recPerMsg}×; only ${L.multiBlockAssistantRecords} multi-block records exist). <code>tool_use</code> pauses the message; the result comes back as a <b>user</b> record carrying the raw <code>tool_result</code> block <em>plus</em> a parsed <code>toolUseResult</code> duplicate <em>plus</em> a <code>sourceToolAssistantUUID</code> backlink. Longest observed turn: <b>${L.top[0]?.apiMsgs} API calls, ${L.top[0]?.toolUses} tool calls, ${L.top[0]?.minutes} min</b>.</li>
<li><span class="q">Hosted tool calls?</span> <b>Zero.</b> No <code>server_tool_use</code> or <code>*_tool_result</code> hosted blocks in ${fmtNum(c.corpus.lines)} records - WebSearch/WebFetch persist as ordinary <em>client</em> <code>tool_use</code>. Whatever runs server-side is invisible to the tape.</li>
<li><span class="q">What is persisted?</span> Everything the API returned, verbatim: full thinking text <em>plus</em> ${fmtBytes(c.thinking.sigChars)} of crypto signatures (${(c.thinking.sigChars / Math.max(1, c.thinking.chars)).toFixed(0)}× the thinking text itself), per-message <code>usage</code>, and tool results <b>twice</b> (raw block + parsed object). Plus an app layer the API never sees: permission modes, queued prompts, hook runs, file-history checkpoints.</li>
<li><span class="q">What is discarded?</span> The <b>system prompt, tool definitions and MCP catalogs are never written</b> - they are reconstructed at load time. Deletion doesn't exist either: interrupts, denials and compaction all <em>append</em> (compaction starts a new root linked by <code>logicalParentUuid</code>).</li>
<li><span class="q">Sub-structures to know:</span> the envelope (<code>uuid/parentUuid/sessionId/promptId</code> + payload), the exploded content block, floating state records (titles, modes, <code>summary</code> index), and the sidecar tree: <code>subagents/*.jsonl</code> (own tapes + <code>started/result</code> lifecycle), <code>tool-results/</code>, <code>workflows/</code>, project-level <code>memory/</code>.</li>
</ul>
</div>

<h2><span class="n">0</span>The lay of the land</h2>
<p class="lede"><code>~/.claude</code> is a small filesystem database; <code>projects/</code> dominates.</p>
<div class="grid2">
<div><table><thead><tr><th>~/.claude/*</th><th>size</th></tr></thead><tbody>${homeRows}</tbody></table></div>
<div><table><thead><tr><th>project (top 10 by bytes)</th><th>tapes</th><th>bytes</th><th>span</th></tr></thead><tbody>${projRows}</tbody></table></div>
</div>
<p>One directory per <em>working directory</em> (path-mangled). The full superstructure, with corpus-wide counts:</p>
<div class="anat">
<span class="k">~/.claude/projects/</span>
<div class="d"><span class="k">-Users-…-&lt;cwd&gt;/</span> <span class="n">- one dir per working directory · ×${c.corpus.projects}</span>
<div class="d"><span class="k">&lt;sessionId&gt;.jsonl</span> <span class="n">- THE TAPE: one conversation, append-only JSONL · ×${fmtNum(c.corpus.sessionTapes)} · ${fmtBytes(Object.values(c.typeBytes).reduce((a, b) => a + b, 0))}</span></div>
<div class="d"><span class="k">&lt;sessionId&gt;/</span> <span class="n">- sidecar dir, born when a session spawns agents · ×${fmtNum(S.sessionDirs)}</span>
<div class="d"><span class="k">subagents/agent-*.jsonl</span> <span class="n">+ agent-*.meta.json - each subagent is a full tape of its own · ×${fmtNum(S.subagentTapes)}</span>
<div class="d"><span class="k">workflows/wf_*/agent-*.jsonl</span> <span class="n">- workflow-spawned agents nest one level deeper</span></div></div>
<div class="d"><span class="k">tool-results/*.txt</span> <span class="n">- full oversized outputs, out-of-tape · ×${fmtNum(S.toolResultFiles)} · ${fmtBytes(S.toolResultBytes)}</span></div>
<div class="d"><span class="k">workflows/</span> <span class="n">- workflow state + scripts/*.js · ×${fmtNum(S.workflowFiles)} files</span></div></div>
<div class="d"><span class="k">memory/*.md</span> <span class="n">- project auto-memory (MEMORY.md index + facts) · ×${S.memoryFiles} files in ${S.memoryDirs} projects</span></div></div>
</div>

<h2><span class="n">1</span>Record taxonomy - what a tape is made of</h2>
<p class="lede">${Object.keys(c.types).length} record types share one file, in three families measured from the envelope itself: <b>tree records</b> carry <code>uuid + parentUuid</code> and form the conversation forest; <b>floating state</b> records carry neither uuid nor (mostly) timestamp - the session's current title/mode/draft is whatever the <em>last</em> such record says; <b>checkpoints</b> key on <code>messageId</code> instead of joining the tree.</p>
<table><thead><tr><th>type</th><th>family</th><th>records</th><th>bytes</th><th>% bytes</th><th>role</th></tr></thead><tbody>${typeRows}</tbody></table>
<h3>level 2 - every type, one level down</h3>
<p class="lede">Each type has its own discriminator - a content shape, a flag, a value field - and the full breakdown is measurable:</p>
${level2Table()}
<div class="note"><b>Level-2 surprises.</b> 82% of user records never came from the user - they are the loop's tool_result return path. <b>${fmtNum(c.sub.user['interrupt marker'])} interrupts</b> live on the tapes as first-class records. Snapshot "updates" (${fmtNum(c.sub.fhs['update · tracking files'])}) confirm append-supersede. Permission mode is <code>auto</code> ${pct(c.sub.permissionModes.auto, c.types['permission-mode'])} of the time for this user - and <code>mode</code> records only ever say <code>normal</code>: plan/accept state actually rides <code>permission-mode</code>. Two-thirds of <code>summary</code> records anchor into <em>other</em> tapes.</div>

${S3 ? `<h3>level 3 - the shapes, as TypeScript</h3>
<p class="lede">Inferred from every record: field presence percentages, observed type unions, and finite value sets become literal unions. Discriminated unions are the statistical clusters - each variant lists the fields that actually co-occur under that discriminator, with counts. This is the schema a re-implementation would target.</p>
${tsDefs()}` : ''}

<h3>where the bytes live</h3>
${byteBar()}
<div class="note"><b>The envelope.</b> Every tree record repeats the full context: <code>uuid, parentUuid, isSidechain, sessionId, timestamp, version, cwd, gitBranch, userType, entrypoint</code> - a tape line is self-describing, which is what makes fork-by-copy (§2) and resume cheap. Payload rides in <code>message</code> (API-shaped) next to app-only fields (<code>promptId, toolUseResult, todos, attributionSkill…</code>). Floating records skip all of it: their whole payload is 2-3 fields + <code>sessionId</code>.</div>

<h3>who follows whom - the transition matrix</h3>
<p class="lede">Every consecutive record pair in file order, all ${fmtNum(Object.values(SQ.transitions || {}).reduce((a, b) => a + b, 0))} transitions. Brightness is log-scaled; hover any cell for the exact count.</p>
${transitionMatrix()}
<div class="note"><b>Reading the bright cells.</b> <code>ast→ast</code> (${fmtNum(SQ.transitions?.['assistant>assistant'])}) is the block explosion + the tool loop; <code>usr→ast</code>/<code>ast→usr</code> is the loop's heartbeat; <code>fhs→usr</code> (${fmtNum(SQ.transitions?.['file-history-snapshot>user'])}) is the checkpoint taken right before a prompt lands; <code>fhs→fhs</code> (${fmtNum(SQ.transitions?.['file-history-snapshot>file-history-snapshot'])}) are snapshot bursts; and the chain <code>usr→lpr→ait/ctt→mod→prm→ast</code> is the <b>submission ritual</b> below.</div>

<h3>the submission ritual</h3>
<p class="lede">Two fixed ceremonies bracket every turn, visible as high-count transitions:</p>
<div class="seq">
<span class="blk t-cli">user<em>prompt lands</em></span><span class="arr">→</span>
<span class="blk">attachment<em>context deltas ×${fmtNum(SQ.transitions?.['user>attachment'])}</em></span><span class="arr">→</span>
<span class="blk t-res">last-prompt<em>draft flushed</em></span><span class="arr">→</span>
<span class="blk t-res">ai-title / custom-title / agent-name</span><span class="arr">→</span>
<span class="blk t-res">mode → permission-mode<em>state block</em></span><span class="arr">→</span>
<span class="blk t-srv">assistant<em>first block streams</em></span>
</div>
<div class="seq">
<span class="blk t-srv">assistant<em>last block · end_turn</em></span><span class="arr">→</span>
<span class="blk">system<em>stop_hook_summary</em></span><span class="arr">→</span>
<span class="blk">system<em>turn_duration</em></span><span class="arr">→</span>
<span class="blk t-chk" style="color:var(--srv)">file-history-snapshot<em>burst</em></span><span class="arr">→</span>
<span class="blk t-cli">user<em>next prompt…</em></span>
</div>
<p>On every submission the whole floating-state block is re-flushed as a group - not because it changed, but because appending is cheaper than checking. The cadence table proves it: modes and titles are written ~20-30x per active tape, once per turn.</p>

<h3>floating state - latest-wins, rewritten every turn</h3>
<table><thead><tr><th>type</th><th>records</th><th>tapes seen in</th><th>avg / active tape</th><th>written when</th></tr></thead><tbody>${floRows}</tbody></table>
<div class="note"><b>State reconstruction = scan for the last one.</b> No indexes, no in-place updates: opening a session means folding the tape and keeping the last <code>ai-title</code>, the last <code>permission-mode</code>, the last <code>mode</code>… The <code>last-prompt</code> buffer is the quiet gem: 94% of the time it mirrors the prompt that landed, but after an interrupt it still holds what the user had <em>typed</em> - free draft recovery.</div>

<h3>the prompt queue, mechanically</h3>
<div class="grid2">
<div>
<table><thead><tr><th>operation</th><th>count</th><th>semantics</th></tr></thead><tbody>
<tr><td class="mono">enqueue</td><td class="mono">${fmtNum(SQ.queueOps?.enqueue)}</td><td class="small">carries the full prompt content; ${fmtNum((SQ.augNext?.['queue/enqueue'] || {})['queue-operation'])} are followed by another queue op (batched typing-ahead)</td></tr>
<tr><td class="mono">dequeue</td><td class="mono">${fmtNum(SQ.queueOps?.dequeue)}</td><td class="small">head-pop, carries NO content - the queued prompt then lands as a normal user record</td></tr>
<tr><td class="mono">remove</td><td class="mono">${fmtNum(SQ.queueOps?.remove)}</td><td class="small">content-matched deletion - the user edited or discarded a queued prompt before it ran</td></tr>
<tr><td class="mono">popAll</td><td class="mono">${fmtNum(SQ.queueOps?.popAll)}</td><td class="small">flush everything</td></tr>
</tbody></table>
</div>
<div>
<table><thead><tr><th>enqueue → dequeue wait</th><th>count</th></tr></thead><tbody>${qWaitRows}</tbody></table>
<p class="small">${fmtNum(SQ.queuePaired)} pairs measured. The long tail is real: ${fmtNum(SQ.queueDeltas?.['>1h'])} queued prompts waited over an hour - typed against a running marathon turn or left overnight, then executed.</p>
</div>
</div>
<pre>${esc(JSON.stringify(ex['queue:enqueue'] || {}, null, 1).slice(0, 460))}…</pre>
<p>The queue is a <b>journal, not a data structure</b>: there is no queue state anywhere - the pending set is whatever enqueues have no matching dequeue/remove yet, reconstructed by replay. A crash cannot lose a queued prompt.</p>

<h3>checkpoint records - the /rewind index</h3>
<p><code>file-history-snapshot</code> (${fmtNum(c.types['file-history-snapshot'])}) maps a prompt (<code>messageId</code>) to <code>{path → {backupFileName, version}}</code> entries whose blobs live in <code>~/.claude/file-history</code>. Measured mechanics: ${fmtNum(SQ.snapshotNextIsItsUser)} snapshots (${pct(SQ.snapshotNextIsItsUser, SQ.snapshotNextIsItsUser + SQ.snapshotNextOther)}) are written <em>immediately before their own user prompt record</em> - checkpoint first, then prompt; the rest ride in mid-turn bursts as tools touch more files (<code>fhs→fhs</code> ${fmtNum(SQ.transitions?.['file-history-snapshot>file-history-snapshot'])}). <b>Even updates are appends:</b> ${fmtNum(SQ.snapshotUpdates)} records carry <code>isSnapshotUpdate: true</code> - a newer snapshot record for the same messageId supersedes the older one, which stays on the tape. The brand-new <code>file-history-delta</code> (${fmtNum(c.types['file-history-delta'])}) links back via <code>snapshotMessageId</code> and tracks one file per record - checkpointing went incremental on 2026-07-14.</p>

<h3>system record subtypes</h3>
<table><thead><tr><th>subtype</th><th>count</th><th>usually after</th><th>usually before</th><th>role</th></tr></thead><tbody>${sysRows}</tbody></table>

<h3>attachment subtypes - the full context-injection census</h3>
<p class="lede">The request side is never persisted, but every delta injected into it is: task reminders (goal re-anchoring), IDE diagnostics, files the user edited between turns, tool-catalog changes, even <code>date_change</code>. All ${attAll.length} kinds:</p>
<div class="grid2">
<div><table><thead><tr><th>attachment.type</th><th>count</th></tr></thead><tbody>${attRows1}</tbody></table></div>
<div><table><thead><tr><th>attachment.type</th><th>count</th></tr></thead><tbody>${attRows2}</tbody></table></div>
</div>

<h2><span class="n">2</span>Topology - a forest on a tape</h2>
<div class="stat">
<div><b>${fmtNum(t.nodes)}</b><span>tree records</span></div>
<div><b>${fmtNum(t.roots)}</b><span>roots (parentUuid: null)</span></div>
<div><b>${pct(t.linearTapes, t.tapes)}</b><span>tapes fully linear</span></div>
<div><b>${fmtNum(t.forkNodes)}</b><span>real fork nodes</span></div>
<div><b>${t.maxConvChildren}</b><span>max sibling children</span></div>
<div><b>${fmtNum(t.orphanParents)}</b><span>dangling parent pointers</span></div>
</div>
<div class="grid2">
<div>
<table><thead><tr><th>fork children</th><th>count</th></tr></thead><tbody>${forkRows}</tbody></table>
</div>
<div class="note"><b>Reading the fork shapes.</b> <code>assistant+user</code> (${fmtNum(mixedForks)}) is the interrupt/branch-from-here shape: an assistant continuation and a fresh user message share a parent, and both timelines stay on the tape. <code>user+user…</code> (${fmtNum(userUserForks)}) are prompt edits/retries - up to ${t.maxConvChildren} sibling attempts at the same point. Another ${fmtNum(t.auxFanoutNodes)} nodes only fan out into <code>progress</code>/<code>system</code> records - auxiliary attachments, not branches. <b>The UI shows one path; the file remembers all of them.</b></div>
</div>
<div class="note win"><b>Forking copies, it doesn't reference.</b> ${fmtNum(t.foreignSessionIdTapes)} of ${fmtNum(t.tapes)} tapes contain records stamped with a <em>different</em> <code>sessionId</code> than their filename - on fork/continuation the history is copied wholesale into the new tape (<code>forkedFrom</code> field, since 2.1.138). That is why only ${t.orphanParents} of ${fmtNum(t.nodes)} parent pointers dangle: tapes are self-contained by construction.</div>
<h3>compaction: append a new root, never rewrite</h3>
<p>${c.compaction.boundaries} compact boundaries in the corpus (trigger: ${Object.entries(c.compaction.triggers).map(([k, n]) => k + '×' + n).join(', ')}; largest pre-compaction context ${fmtNum(c.compaction.preTokensMax)} tokens). The seam is a <code>system/compact_boundary</code> record with <code>parentUuid: null</code> (new root) + <code>logicalParentUuid</code> pointing at the pre-compaction leaf, followed by a <code>user</code> record flagged <code>isCompactSummary</code> carrying the summary (avg ${fmtNum(Math.round(c.compaction.compactSummaryChars / Math.max(1, c.compaction.compactSummaryRecords)))} chars). The old tree stays in the file, dead but present.</p>
${pre(ex['system:compact_boundary'], 900)}

<h3>five real sessions, drawn</h3>
<p class="lede">Auto-picked extremes from the corpus. For each: the <b>logical tree</b> (what the parentUuid pointers encode - only structural nodes shown: prompts, forks, roots, seams, leaves) over the <b>physical tape</b> (every record, file order). Same file, two truths.</p>
${structLegend()}
${gallery()}

<h2><span class="n">3</span>The agentic loop on disk</h2>
<p class="lede">One turn = one <code>promptId</code> (since 2.1.79). The pattern:</p>
<div class="seq">
<span class="blk">user<em>prompt · promptId</em></span><span class="arr">→</span>
<span class="blk t-srv">assistant<em>thinking</em></span><span class="arr">→</span>
<span class="blk t-srv">assistant<em>text</em></span><span class="arr">→</span>
<span class="blk t-cli">assistant<em>tool_use</em></span><span class="arr">→</span>
<span class="blk t-res">user<em>tool_result + toolUseResult + sourceToolAssistantUUID</em></span><span class="arr">→</span>
<span class="blk t-cli">assistant<em>tool_use (new API call)</em></span><span class="arr">→</span>
<span class="blk t-res">user<em>tool_result…</em></span><span class="arr">→</span>
<span class="blk t-srv">assistant<em>text · end_turn</em></span>
</div>
${turnX ? `<h3>the identity system - one real turn, two ways</h3>
<p class="lede">Every linkage below is verbatim from one captured turn (${esc(turnX.extractedFrom.split('/')[0].replace(/^-Users-[^-]+-?/, '~/').replace(/-/g, '/'))}, ${day(turnX.ts)}, CLI ${esc(turnX.version)}): 3 API calls, a Write call, an Agent spawn matched to its sidecar tape, then the answer. First the <b>logical containment</b> - what the ids mean:</p>
${idBlocksView(turnX)}
<p class="lede" style="margin-top:22px">…and the same eleven records as the <b>physical tape</b>, with every id drawn as its own linkage layer - brackets above are grouping ids, arcs above are the tree, arcs below are tool pairing:</p>
<div class="panel">${idTapeView(turnX)}</div>
<div class="note"><b>Six id systems, one flat file.</b> <code>sessionId</code> scopes the tape · <code>promptId</code> groups the turn · <code>parentUuid</code> chains the tree (note: it threads straight through the tool_result user records) · <code>message.id</code>+<code>requestId</code> reassemble exploded API calls · <code>toolu_*</code> pairs calls with results (plus the redundant <code>sourceToolAssistantUUID</code> backlink - belt and suspenders) · <code>toolUseId</code> in the sidecar meta hooks a whole child tape onto one tool call. Nothing is nested in the file; <em>all structure is reconstructed from ids at read time.</em></div>` : ''}

<div class="grid2">
<div>
<h3>records per API call</h3>
<table><thead><tr><th>records</th><th>API calls</th></tr></thead><tbody>${explRows}</tbody></table>
<p class="small">${fmtNum(c.explosion.apiMessages)} API calls → ${fmtNum(c.explosion.records)} assistant records (${recPerMsg}× explosion). Records of one call share <code>message.id</code>, <code>requestId</code> and evolving <code>usage</code>; only ${L.multiBlockAssistantRecords} records carry &gt;1 block. <b>An "assistant message" on disk is a claim you must reassemble by message.id.</b></p>
</div>
<div>
<h3>API calls per turn</h3>
<table><thead><tr><th>msgs</th><th>turns</th></tr></thead><tbody>${histRows}</tbody></table>
<p class="small">${fmtNum(L.turns)} turns; ${pct(L.turns - (L.hist['1'] || 0), L.turns)} loop at least once; ${(L.hist['51-100'] || 0) + (L.hist['100+'] || 0)} turns ran &gt;50 messages.</p>
</div>
</div>
<h3>final stop_reason per API call</h3>
<p><code>tool_use</code> ${fmtNum(L.finalStopReasons['tool_use'])} · <code>end_turn</code> ${fmtNum(L.finalStopReasons['end_turn'])} · <code>null</code> ${fmtNum(L.finalStopReasons['null'])} (aborted/interrupted streams - the tape keeps half-finished messages) · <code>stop_sequence</code> ${fmtNum(L.finalStopReasons['stop_sequence'])}. Parallel tool calls are real: ${fmtNum(L.msgsMultiToolUse)} messages carry ≥2 <code>tool_use</code> blocks (max ${L.maxParallelToolUse} in one message).</p>
<h3>marathon turns</h3>
<table><thead><tr><th>session</th><th>prompt</th><th>API msgs</th><th>tool calls</th><th>wall</th></tr></thead><tbody>${topRows}</tbody></table>
${trees?.rhythm ? `<h3>the longest loop, message by message</h3>
<p class="lede">"${esc(trees.rhythm.snippet || '')}" - ${esc(trees.rhythm.title || trees.rhythm.session.slice(0, 8))}: each cell is one API call of the ${trees.rhythm.msgs.length}-call turn, in order.</p>
${rhythmStrip(trees.rhythm)}
<div class="legend"><span><i style="background:${CODE_COLOR.c}"></i>ends in tool_use (white outline = parallel calls)</span><span><i style="background:#8fbf5a"></i>text - the model surfaces to talk</span><span><i style="background:${CODE_COLOR.t}"></i>thinking only</span></div>
<p class="small">The rhythm of an agentic run: long uninterrupted chains of tool_use messages, punctuated by rare text messages when the model reports back. ${trees.rhythm.msgs.filter(m => m.k === 'c').length} of ${trees.rhythm.msgs.length} messages end in tool_use.</p>` : ''}

${TK ? `<h2><span class="n">4</span>Kinds of turns - and the loops above the loop</h2>
<p class="lede">All ${fmtNum(TK.turns)} turns classified by measurable shape: who started them, whether they paused, how they ended.</p>
<table><thead><tr><th>kind</th><th>turns</th><th>share</th><th>avg msgs</th><th>max</th><th>pause &gt;2m</th><th>what it is</th></tr></thead><tbody>${kindRows}</tbody></table>
<div class="note win"><b>Not every turn is human-started.</b> ${fmtNum(TK.ladder.taskNotifTurns)} turns were woken by <code>&lt;task-notification&gt;</code> injections, ${fmtNum(TK.ladder.commandTurns)} by slash commands, ${fmtNum((TK.kinds['system/sdk-injected'] || {}).n || 0)} by SDK/system, ${fmtNum(TK.ladder.queuedTurns)} stamped as queue-dequeued - roughly one turn in six arrives from machinery, not typing. And the interactive kind inverts the arrow entirely: the model asks, the human answers.</div>

<h3>pauses are a first-class state</h3>
<div class="stat">
<div><b>${fmtNum(TK.flags.pause2m)}</b><span>turns pause &gt;2 min (${pct(TK.flags.pause2m, TK.turns)})</span></div>
<div><b>${fmtNum(TK.flags.pause30m)}</b><span>pause &gt;30 min</span></div>
<div><b>${pct((TK.kinds['interactive (asks the user)'] || {}).pauses, (TK.kinds['interactive (asks the user)'] || {}).n)}</b><span>of interactive turns pause</span></div>
<div><b>${pct((TK.kinds['delegating (spawns agents)'] || {}).pauses, (TK.kinds['delegating (spawns agents)'] || {}).n)}</b><span>of delegating turns pause</span></div>
</div>
<div class="grid2">
<div>
<table><thead><tr><th>the longest gap waited on…</th><th>turns</th><th>share</th></tr></thead><tbody>${pauseRows}</tbody></table>
</div>
<div>
<table><thead><tr><th>session</th><th>kind</th><th>gap</th><th>waited on</th></tr></thead><tbody>${pauseTopRows}</tbody></table>
<p class="small">Gaps beyond a day are reopened sessions - the turn context survives arbitrary wall-clock pauses because resume is reconstruction, not a live process.</p>
</div>
</div>

<h3>how turns end</h3>
<table><thead><tr><th>end state</th><th>turns</th><th>share</th><th>meaning</th></tr></thead><tbody>${endRows}</tbody></table>
<p>A third of all turns do NOT end cleanly - they are cut, interrupted, or superseded. The format never repairs them; it just appends the next turn. Orthogonal flags across all kinds: api-error retries in ${fmtNum(TK.flags.apiError)} turns · tool denials in ${fmtNum(TK.flags.denial)} · TaskCreate planning in ${fmtNum(TK.flags.taskCreate)}.</p>

<h3>the ladder - every loop's outer loop</h3>
<p class="lede">Each level is a loop with its own journal and its own queue. The human is <b>not</b> a level - the human is a driver who enters sideways at four different rungs (yellow markers). The outermost <em>container</em> is the runtime: its stores and daemons span projects and keep consuming when the human stops.</p>
<div class="anat bare">
<div class="d" style="border-left:3px solid #b48cff"><span class="k" style="color:#b48cff">L7 · the runtime (~/.claude)</span> <span class="n">- one per machine, CROSS-PROJECT: the jobs/ daemon (exact respawn argv + byte cursor into the tape), sessions/{pid}.json presence registry, tasks/ dependency DAG, stats rollup; scheduled fires ×7, away summaries ×3 for when the human loop is slow</span><br><span class="ty">types: jobs/state.json { respawnFlags, linkScanOffset } · system/scheduled_task_fire · stats-cache.json</span>
<div class="d" style="border-left:3px solid #5aa9ff"><span class="k" style="color:#5aa9ff">L6 · project (cwd)</span> <span class="drv">⟵ human picks the working directory</span> <span class="n">- ×36 · scopes sessions + memory/ + per-project history; zero-effort organization by working directory</span><br><span class="ty">types: -Users-…-&lt;cwd&gt;/ dirs · memory/*.md · history.jsonl { project }</span>
<div class="d" style="border-left:3px solid #67e0d8"><span class="k" style="color:#67e0d8">L5 · workstream lineage</span> <span class="n">- SPARSE: most sessions stand alone; some chain by fork-by-copy (171 tapes carry foreign sessionIds), compact seams (×${fmtNum(TK.ladder.tapesWithCompactSeam)} tapes), cross-file summary anchors (×125) - "one piece of work, many sessions"</span><br><span class="ty">types: Envelope.forkedFrom { sessionId, messageUuid } · system/compact_boundary { logicalParentUuid } · summary { leafUuid }</span>
<div class="d" style="border-left:3px solid #8fbf5a"><span class="k" style="color:#8fbf5a">L4 · session (the tape)</span> <span class="drv">⟵ human starts / resumes / forks · scheduler spawns bg sessions</span> <span class="n">- ×${fmtNum(TK.ladder.sessions)} (${TK.ladder.sessionsBg} background, ${TK.ladder.sessionsSdk} SDK) · ${pct(TK.ladder.turnsPerSession['1'], TK.ladder.sessions)} single-turn, ${fmtNum(TK.ladder.turnsPerSession['31+'])} run 31+ turns · floating state (titles, modes, drafts) attaches HERE, skipping the rungs below</span><br><span class="ty">types: Envelope.sessionId · FloatingState (ai-title, permission-mode, last-prompt…) · sessions/{pid}.json</span>
<div class="d" style="border-left:3px solid #d5ec31"><span class="k">L3 · turn (promptId)</span> <span class="drv">⟵ human types prompts + queues ahead · task notifications land here (×${fmtNum(TK.ladder.taskNotifTurns)} turns)</span> <span class="n">- ×${fmtNum(TK.turns)} · driver: the prompt queue + injections; nine kinds; ends clean only ${pct(TK.endStates['end_turn (clean)'], TK.turns)} of the time · checkpoints key HERE (per prompt)</span><br><span class="ty">types: UserRecord.promptId · QueueOperation · AttachmentPayload (task_reminder…) · Checkpoint { messageId } · system/turn_duration</span>
<div class="d" style="border-left:3px solid #ffcf4d"><span class="k" style="color:#ffcf4d">L2 · tool cycle</span> <span class="drv">⟵ human answers AskUserQuestion + approves permissions</span> <span class="n">- ×${fmtNum(T.results)} call→result pairs · the SEAM between consecutive API calls: tool_use ends one, its result opens the next; parallel calls fan out within a cycle · FRACTAL: an Agent call hangs a whole child tape here (same grammar, parent sessionId + isSidechain + agentId; spawn depth to 3)</span><br><span class="ty">types: AssistantBlock:tool_use { id: toolu_* } · UserBlock:tool_result + ToolUseResult (BashResult, EditResult…) · sourceToolAssistantUUID</span>
<div class="d" style="border-left:3px solid #ff9d5c"><span class="k" style="color:#ff9d5c">L1 · API call</span> <span class="n">- ×${fmtNum(c.explosion.apiMessages)} · one model sampling run; exploded to ${recPerMsg} records sharing message.id; the sampling loop itself never touches the tape; usage/stop_reason ride the last record</span><br><span class="ty">types: AssistantRecord.message { id, requestId } · Usage · stop_reason union</span>
<div class="d" style="border-left:3px solid #7c8474"><span class="k" style="color:#c9d3ba">L0 · record / block</span> <span class="n">- ×${fmtNum(c.corpus.lines)} lines · the only write primitive: append one; everything above is a fold over these</span><br><span class="ty">types: Envelope · AssistantBlock · UserBlock · FloatingState · Checkpoint</span></div>
</div></div></div></div></div></div></div>
</div>
<div class="note win"><b>Same shape at every level - with two honest caveats.</b> A driver consumes a queue of pending work and appends results to a journal: the message loop consumes tool results, the turn loop consumes the prompt queue, the session loop consumes resumes and forks, the workstream loop consumes task notifications, the daemon consumes schedules. Nothing at any level mutates; every level appends. The caveats the data forces: containment is not strict (floating records attach at L4 and checkpoints at L3, skipping rungs; L5 is sparse), and the ladder is <b>fractal</b> - a subagent tape is a full L4 session hanging off an L2 cycle. The human is a multi-rung driver, not the outer loop: when they walk away, L7 keeps ticking (${fmtNum(TK.ladder.taskNotifTurns)} turns in this corpus were started by machinery while nobody typed).</div>

${SLC ? `<h3>the ladder, serialized - how the nesting flattens onto the tape</h3>
<p class="lede">A real slice: ${SLC.records.length} consecutive records (two turns, ${day(SLC.ts)}). The bands above the tape are the L1-L4 groupings <em>reconstructed from ids</em> - nothing on disk stores them. Watch the holes:</p>
${ladderSerialization()}
<div class="note"><b>The groups are not contiguous - and each band has a precise key.</b> <b>L4</b> is stored: <code>Envelope.sessionId</code> on every tree record. <b>L3</b> is <em>half-stored</em>: <code>promptId</code> exists only on UserRecords; assistant/system/attachment membership is DERIVED via the parentUuid chain (verified equivalent to file-order segmentation at 99.88%). <b>L2</b> is stored twice: <code>toolu_*</code> pairing plus the <code>sourceToolAssistantUUID</code> backlink (99.99% consistent). <b>L1</b> is stored: <code>message.id</code>, 100% contiguous among assistant records. The holes are real and verified in this very slice: the floating block (green, dashed - <code>FloatingState</code>, no uuid) is flushed mid-turn and the chain passes straight over it (record 8's parentUuid = record 3's uuid); attachments and system records are chain LINKS inside the turn (98.5% corpus-wide; here the chain runs prompt → attachment → assistant, and the next prompt chains to <code>system/turn_duration</code>). Checkpoints (blue, dashed - <code>Checkpoint</code>, keyed on messageId) sit outside all bands: initial snapshots key forward to the next prompt (here: cell 19 → cell 20, verified byte-level), while <code>isSnapshotUpdate</code> records key to the file-mutating assistant record instead. One caution this slice cannot show: with parallel/eager execution, results land BETWEEN records of one API call (13.3% of within-message adjacencies corpus-wide) - so even L1 bands can be punctured. The ladder exists only at read time, rebuilt from six id systems.</div>

${SL2 ? `<h3>serialized, at scale - the drill view</h3>
<p class="lede">A richer real slice (${SL2.records.length} records, ${day(SL2.ts)}): ONE API call fires <b>${['zero', 'one', 'two', 'three', 'four', 'five', 'six'][SL2X.nUses] || SL2X.nUses} parallel ${esc(SL2X.names)} calls</b>, and the verified phenomena appear at once. The dot strip inside each cell is the drill: which layer claims this record, and how - <b>solid</b> = the key is stored on the record · <b>hollow</b> = membership derived via the parentUuid chain · <b>diamond</b> = a messageId pointer. Dot order: <span style="color:#8fbf5a">L4</span> <span style="color:#d5ec31">L3</span> <span style="color:#ffcf4d">L2</span> <span style="color:#ff9d5c">L1</span>.</p>
${drillView()}
<div class="note"><b>Reading the drill, cell by cell.</b>
${SL2X.segs > 1 ? `<b>Eager writes, visible:</b> message <code>·${esc(SL2X.multiMid)}</code> splits into ${SL2X.segs} L1 segments (dashed links) - each result lands on the tape as soon as its cycle closes, between records of the still-open call. ` : ''}${SL2X.floatInCycle ? `<b>A cycle band bridges interposed records</b> - context/state records land between a call and its result, and the cycle spans right across them. ` : ''}<b>Results have no L1 dot</b>: tool_result carriers are not part of any API call - they are the loop's re-entry payload (toolu pairing + sourceToolAssistantUUID${SL2X.resultsHavePid ? ' + stored promptId' : '; in this slice they carry NO promptId - hollow L3, membership fully derived'}). <b>Assistant cells have a hollow L3 dot</b>: turn membership is never stored on them, always derived. ${SL2X.hasChk ? `<b>The checkpoint's diamond</b> points at the prompt it snapshots. ` : ''}${SL2.spawn ? `And <b>cycle ① is fractal${SL2.spawn.isAsync ? ' with a twist' : ''}</b>: ${SL2.spawn.isAsync ? `a BACKGROUND spawn - the cycle closes on an async ACK (<code>toolUseResult.isAsync: true</code>), not on the child's output; the ${fmtNum(SL2.spawn.total)}-record child tape below keeps running and rejoins via the notification loop (L7).` : `its result is the return of the ${fmtNum(SL2.spawn.total)}-record child tape below.`} Child identity: the parent's record-level sessionId (verified even across fork-by-copy), <code>isSidechain: true</code>, own uuid/promptId space, and its own L1/L2/L3 bands inside.` : ''}${SL2X.nQueue ? ` The tail <code>queue-operation</code> cells are the typed-ahead journal: the next turn is already waiting.` : ''}</div>

<div class="note"><b>Who starts an API call? And in what order do parallel results land?</b> Measured across all ${fmtNum(3212)} fully-answered multi-use calls: tape order is <b>alternating A/R/A/R in 60%</b> (fast tools - the result lands while the next block streams), <b>all-uses-then-results in 36%</b> (dominant for agentic messages, where execution outlasts streaming), mixed 4% - and <b>8.2% complete out of issue order</b>: never assume result order matches call order. The message-starter question has a two-actor answer: the MODEL ends calls (<code>stop_reason: tool_use</code> = "I need results"); the RUNTIME starts them - and its trigger is an absolute, verified barrier: <b>3,210 of 3,210 multi-use calls, the next call begins only after ALL results are on tape</b> (for background spawns the barrier is on the acks, so the turn proceeds while children run). One wire-vs-tape subtlety a port must honor: the tape stores results as N separate user records, but the API requires them batched in ONE user message - <b>reconstruction merges result records at the re-entry boundary</b>. There is no turn record anywhere: "the turn" is promptId stamps at rest plus the runtime's loop frame (pending-use set + the re-sample-or-finish decision) in motion.</div>` : ''}

<div class="note win"><b>So how does a block know its turn?</b> Mostly, it doesn't - by design. <code>promptId</code> is stored at exactly two places, both written by the RUNTIME (never by the model's stream): the prompt initiator, and every tool_result carrier (re-stamped at the loop's re-entry points, where the runtime knows the turn anyway - verified 99.94% consistent). Every assistant, system and attachment record carries NO turn id: membership = walk <code>parentUuid</code> to the nearest prompt ancestor (99.88% equivalent to file-order segmentation; the 50 disagreements are branch edges, where the chain is right and file order lies). This is what makes <b>parallel user messages safe</b>: a queued message becomes a later turn with a fresh promptId; an interrupting message becomes a SIBLING subtree (the assistant+user fork shape, ×1,426) - and because turn membership is <em>path-scoped</em>, two interleaved turns can never claim each other's records. The 20-sibling node is the extreme proof: twenty turn-roots on one parent, disambiguated purely by ancestry.</div>

<h3>the reconstruction contract - every rule, verified corpus-wide</h3>
<p class="lede">The rules a re-implementation can rely on, each checked against every tape (${VER ? fmtNum(VER.tapes) : '-'} tapes). Compliance below 100% is characterized, not hand-waved:</p>
${VER ? `<table><thead><tr><th>invariant</th><th>checked</th><th>compliance</th><th>what the exceptions are</th></tr></thead><tbody>
<tr><td class="small">AssistantRecord carries exactly one content block</td><td class="mono">${fmtNum(VER.invariants.I1_single_block.checked)}</td><td class="mono">${VER.invariants.I1_single_block.compliance}</td><td class="small">33 records with 2-4 blocks</td></tr>
<tr><td class="small">records of one message.id are contiguous among assistant records</td><td class="mono">${fmtNum(VER.invariants.I2_msg_contiguous.checked)}</td><td class="mono">${VER.invariants.I2_msg_contiguous.compliance}</td><td class="small">a call's records never resume after another call started</td></tr>
<tr><td class="small">within one message, record k+1 chains directly to record k</td><td class="mono">${fmtNum(VER.invariants.I3_msg_chain.checked)}</td><td class="mono">${VER.invariants.I3_msg_chain.compliance}</td><td class="small"><b>eager streaming</b>: 13.3% of adjacencies have tool results / era-2 progress interposed - the chain threads through them, still linear</td></tr>
<tr><td class="small">sourceToolAssistantUUID = uuid of the issuing tool_use record</td><td class="mono">${fmtNum(VER.invariants.I4_result_srclink.checked)}</td><td class="mono">${VER.invariants.I4_result_srclink.compliance}</td><td class="small">3 mismatches</td></tr>
<tr><td class="small">file order = chain order (parent is the previous tree record)</td><td class="mono">${fmtNum(VER.invariants.I5_adjacent_parent.checked)}</td><td class="mono">${VER.invariants.I5_adjacent_parent.compliance}</td><td class="small">the 7.6% = forks/branches + eager-streaming interleaves</td></tr>
<tr><td class="small">AttachmentRecords are chain links (not leaves)</td><td class="mono">${fmtNum(VER.invariants.I6_attachment_chain.checked)}</td><td class="mono">${VER.invariants.I6_attachment_chain.compliance}</td><td class="small">73 leaves (dead branch tips)</td></tr>
<tr><td class="small">tool_result promptId = chain-ancestor prompt's promptId</td><td class="mono">${fmtNum(VER.invariants.I7_promptid_on_results.checked)}</td><td class="mono">${VER.invariants.I7_promptid_on_results.compliance}</td><td class="small">12 mismatches</td></tr>
<tr><td class="small">every tool_use has exactly one tool_result in-tape</td><td class="mono">${fmtNum(VER.invariants.I8_pairing.checked)}</td><td class="mono">${VER.invariants.I8_pairing.compliance}</td><td class="small">11 unanswered = interrupts</td></tr>
<tr><td class="small">stop_reason on tool_use-bearing records = 'tool_use'</td><td class="mono">${fmtNum(VER.invariants.I9_stop_tool_use.checked)}</td><td class="mono">${VER.invariants.I9_stop_tool_use.compliance}</td><td class="small">stop_reason is MESSAGE-level, final record wins: nulls = 2,171 mid-message records (parallel/eager) + 1,602 cut streams</td></tr>
<tr><td class="small">parallel calls return as N separate user records</td><td class="mono">${fmtNum(VER.invariants.I10_parallel_results.checked)}</td><td class="mono">${VER.invariants.I10_parallel_results.compliance}</td><td class="small">3,200 of 3,202 (2 partially answered = interrupts); never one-record-N-blocks</td></tr>
<tr><td class="small">file-order turn segmentation = chain-derived membership</td><td class="mono">${fmtNum(VER.invariants.I11_turn_equiv.checked)}</td><td class="mono">${VER.invariants.I11_turn_equiv.compliance}</td><td class="small">50 mismatches (branch edges)</td></tr>
<tr><td class="small">Checkpoint.messageId resolves in-tape</td><td class="mono">${fmtNum(VER.invariants.I12_fhs_target.checked)}</td><td class="mono">${VER.invariants.I12_fhs_target.compliance}</td><td class="small">targets: prompt records 78%, assistant records 21% (= exactly the isSnapshotUpdate set - updates key to the file-mutating record), 1.1% not in tape</td></tr>
<tr><td class="small">FloatingState records never carry uuid/parentUuid</td><td class="mono">${fmtNum(VER.invariants.I13_float_no_uuid.checked)}</td><td class="mono">${VER.invariants.I13_float_no_uuid.compliance}</td><td class="small">structurally cannot break the chain</td></tr>
<tr><td class="small">sidecar meta.toolUseId matches an in-tape tool_use id</td><td class="mono">${fmtNum(VER.invariants.I14_spawn_link.checked)}</td><td class="mono">${VER.invariants.I14_spawn_link.compliance}</td><td class="small">18 orphan metas (fork-by-copy left sidecars behind)</td></tr>
</tbody></table>
<div class="note win"><b>Sidecar identity, corrected by inspection.</b> A subagent tape is NOT an independent session: its records carry the <b>parent's</b> <code>sessionId</code>, <code>isSidechain: true</code>, and an <code>agentId</code> - it is an out-of-file <em>sidechain</em> of the parent session with its own root, uuid space and promptIds, in the same record grammar. <code>started</code>/<code>result</code> lifecycle records appear only on workflow spawns; plain Agent spawns return solely through the parent's tool_result. The fractal claim survives with that precision: one L2 cycle can contain a whole child transcript - identified as (parent sessionId, agentId), not a new sessionId.</div>` : ''}` : ''}

<h3>turns per session</h3>
<table><tbody>${tpsRows}</tbody></table>` : ''}

<h2><span class="n">5</span>Tool calls - all client, nothing hosted</h2>
<div class="stat">
<div><b>${fmtNum(T.uses)}</b><span>tool_use blocks</span></div>
<div><b>${fmtNum(T.results)}</b><span>tool_result blocks</span></div>
<div><b>${unanswered}</b><span>never answered (interrupts)</span></div>
<div><b>${pct(T.errorResults, T.results)}</b><span>error results</span></div>
<div><b>${fmtBytes(T.resultBytes)}</b><span>inline result bytes</span></div>
<div><b>${fmtBytes(T.maxResultBytes)}</b><span>largest single result</span></div>
</div>
<div class="grid2">
<div><table><thead><tr><th>built-in tool</th><th>calls</th><th>share</th></tr></thead><tbody>${toolRows}</tbody></table></div>
<div>
<table><thead><tr><th>MCP server</th><th>calls</th></tr></thead><tbody>${mcpRows}</tbody></table>
<p class="small">${fmtNum(mcpTotal)} MCP calls (${pct(mcpTotal, T.uses)} of all tool use), names <code>mcp__server__tool</code>. Since 2.1.157 assistant records also carry <code>attributionMcpServer/Tool</code>.</p>
</div>
</div>
<div class="note win"><b>Results are persisted twice.</b> Every completed call yields a user record with the raw API <code>tool_result</code> block <em>and</em> an app-level <code>toolUseResult</code> field - a parsed, tool-specific object (<code>stdout/stderr</code> for Bash, <code>filenames</code> for Glob, <code>structuredPatch</code> for Edit…). Shapes seen: object ${fmtNum(T.toolUseResultShapes.object)}, string ${fmtNum(T.toolUseResultShapes.string)} (exactly the ${fmtNum(T.errorResults)} error results - errors persist as bare strings), array ${fmtNum(T.toolUseResultShapes.array)}. The raw block feeds the next API call; the parsed twin feeds the UI without re-parsing.</div>
${TX ? `<h3>the interface, measured</h3>
<p class="lede">Every <code>tool_use.input</code> across main AND subagent tapes: ${fmtNum(TX.totals.calls)} calls, ${fmtNum(TX.totals.paramFills)} parameter fills (${ifaceTotals.argsPerCall} args/call). Per tool: which parameters actually get filled, and what lives in them.</p>
<div class="tgrid">${ifaceCards(['Bash', 'Read', 'Edit', 'Grep', 'Write', 'Glob', 'WebFetch', 'WebSearch', 'TaskUpdate', 'AskUserQuestion'])}</div>
<div class="note win"><b>The impedance map.</b>
<b>5 tools carry ${ifaceTotals.top5} of all calls</b>, 9 carry ${ifaceTotals.top9} - and their combined <em>load-bearing</em> surface is ~15 parameters. Fill ≠ signal: <code>Edit.replace_all</code> is filled ${pct(TX.iface.Edit.params.replace_all.n, TX.iface.Edit.n)} of the time but means something (true) in only ${pct(TX.iface.Edit.params.replace_all.vals?.true || 0, TX.iface.Edit.n)}; <code>Bash.description</code> (${pct(TX.iface.Bash.params.description.n, TX.iface.Bash.n)}) is pure UI annotation. Real signal hides elsewhere: <b>Read pagination is heavily exercised</b> (limit ${pct(TX.iface.Read.params.limit.n, TX.iface.Read.n)}, offset ${pct(TX.iface.Read.params.offset.n, TX.iface.Read.n)}), and Grep is the only tool whose rich flag surface genuinely earns its keep (output_mode ${pct(TX.iface.Grep.params.output_mode.n, TX.iface.Grep.n)}, -n ${pct(TX.iface.Grep.params['-n'].n, TX.iface.Grep.n)}, head_limit ${pct(TX.iface.Grep.params.head_limit.n, TX.iface.Grep.n)}, small-integer -C/-A/-B, file-type filters).</div>
<div class="grid2">
<div class="note"><b>Interface quality, read from error rates.</b> WebFetch ${pct(TX.iface.WebFetch.errN, TX.iface.WebFetch.n)} (network + robots), Edit ${pct(TX.iface.Edit.errN, TX.iface.Edit.n)} (the old_string uniqueness contract is the hardest constraint the model faces), Bash ${pct(TX.iface.Bash.errN, TX.iface.Bash.n)}, Read ${pct(TX.iface.Read.errN, TX.iface.Read.n)}, Grep ${pct(TX.iface.Grep.errN, TX.iface.Grep.n)} (nearly error-free). Cross-tool confusion exists but is negligible: ~25 stray fills (grep-style params passed to Bash) in 64k calls - schema validation absorbs it.</div>
<div class="note"><b>Result-size economics.</b> Read returns ${fmtBytes(Math.round(TX.iface.Read.resBytes / TX.iface.Read.n))} on average × ${fmtNum(TX.iface.Read.n)} calls = <b>${fmtBytes(TX.iface.Read.resBytes)}</b> - the single largest context bill in the corpus, dwarfing WebFetch (${fmtBytes(TX.iface.WebFetch.resBytes)}) and Bash (${fmtBytes(TX.iface.Bash.resBytes)}). An interface priority list that ignores result-side budgeting optimizes the wrong half of the contract.</div>
</div>
<div class="note"><b>Support order for lowest AI impedance</b> (usage-weighted, from this corpus): <b>Tier 1</b> - Read(file_path, offset, limit) · Edit(file_path, old_string, new_string, replace_all) · Bash(command, description, timeout, run_in_background) · Write(file_path, content) · Grep(pattern, output_mode, path, -n, head_limit, -C, type, glob, -i). <b>Tier 2</b> - Glob(pattern, path) · WebFetch(url, prompt) · WebSearch(query) · Agent(prompt, description, subagent_type, run_in_background) · AskUserQuestion(questions[]). <b>Tier 3</b> - task/todo CRUD, ToolSearch, Skill, ExitPlanMode. Everything else is single-digit usage. The tier-1 surface is 5 tools × ~3 hot params each - <b>a weekend of schema work covers ${ifaceTotals.top5} of real agentic traffic.</b></div>` : ''}

${TX && S3 ? `<h3>the tool contracts - input → two outputs, as TypeScript</h3>
<p class="lede">Every call produces the result <b>twice</b>: the <b>WIRE copy</b> is the <code>tool_result</code> block inside <code>message.content</code> - it goes back to the API verbatim on every later turn (context-bearing, token-costing). The <b>PARSED copy</b> is the <code>toolUseResult</code> field on the record envelope - app-only, never re-sent, structured for rendering. They are not mirrors; each tool splits its information differently:</p>
<table><thead><tr><th>tool</th><th>results</th><th>wire shape</th><th>wire avg</th><th>parsed avg</th><th>parsed/wire</th><th>what diverges</th></tr></thead><tbody>${copyDivergence()}</tbody></table>
<div class="note win"><b>The split is a design, not a mirror.</b> Edit sends the model a ${fmtBytes(Math.round((S3.user.turPerTool.Edit?.wire.len || 0) / (S3.user.turPerTool.Edit?.wire.n || 1)))} confirmation but keeps <b>${(S3.user.turPerTool.Edit ? (S3.user.turPerTool.Edit.parsedLen / Math.max(1, S3.user.turPerTool.Edit.wire.len)) : 0).toFixed(0)}x that</b> app-side (originalFile, structuredPatch, userModified) - the model gets the ack, the UI gets the diff. Write is ${(S3.user.turPerTool.Write ? (S3.user.turPerTool.Write.parsedLen / Math.max(1, S3.user.turPerTool.Write.wire.len)) : 0).toFixed(0)}x. Read is the counter-example: full 1:1 duplication, the single biggest storage-waste in the format. The lesson for a re-implementation: <b>decide per-tool which copy is load-bearing, and derive the other</b>.</div>
<pre class="ts">${['Bash', 'Read', 'Edit', 'Write', 'Grep', 'Agent'].map(toolContract).join('')}</pre>` : ''}

<div class="note"><b>No hosted/server tools, ever.</b> <code>server_tool_use</code> count: <b>${Object.keys(T.server).length ? JSON.stringify(T.server) : '0'}</b> across the whole corpus. Claude Code's WebSearch/WebFetch are persisted as plain client tools - contrast with the sibling report (aix-anthropic-eviscerate), where hosted blocks dominate the wire: <b>the CLI keeps its tape provider-neutral by executing everything client-side.</b></div>

<h2><span class="n">6</span>What is persisted vs discarded</h2>
<div class="stat">
<div><b>${fmtNum(U.out)}</b><span>output tokens persisted</span></div>
<div><b>${(U.cacheRead / 1e9).toFixed(2)}B</b><span>cache-read tokens</span></div>
<div><b>${(U.cacheCreate / 1e6).toFixed(0)}M</b><span>cache-write tokens</span></div>
<div><b>${fmtNum(U.in)}</b><span>uncached input tokens</span></div>
<div><b>${fmtNum(c.thinking.blocks)}</b><span>thinking blocks (all signed)</span></div>
<div><b>${fmtBytes(c.thinking.sigChars)}</b><span>signature bytes</span></div>
</div>
<p><b>Kept, verbatim:</b> every content block incl. full <code>thinking</code> text + its signature (${fmtBytes(c.thinking.sigChars)} of base64 vs ${fmtBytes(c.thinking.chars)} of actual thought - the signatures outweigh the thinking ${(c.thinking.sigChars / Math.max(1, c.thinking.chars)).toFixed(0)}×, they are what lets history replay to the API), per-message <code>usage</code> and <code>requestId</code>, aborted half-messages, denied calls (<code>toolDenialKind</code>), and the interrupt marker <code>[Request interrupted by user]</code> as a real user record.</p>
<p><b>Never written:</b> the system prompt, tool definitions, MCP catalogs, skill bodies - the request side of the conversation is reconstructed at load; only its <em>observable output</em> is journaled. Also gone: nothing by deletion - the format has no delete operation at all. Even <code>file-history-snapshot</code> (${fmtNum(c.types['file-history-snapshot'])} records) only points into <code>~/.claude/file-history</code> (${fmtBytes((c.claudeHomeDirs.find(d => d.path === 'file-history')?.kb || 0) * 1024)}), and the brand-new <code>file-history-delta</code> (first seen ${day(eras['record:file-history-delta']?.firstTs)}) makes checkpoints incremental.</p>
<p><b>Byte budget:</b> user records are ${pct(c.typeBytes['user'], totalTypeBytes)} of all bytes (tool results counted twice does that); assistant ${pct(c.typeBytes['assistant'], totalTypeBytes)}; the retired <code>progress</code> duplication still owns ${pct(c.typeBytes['progress'], totalTypeBytes)} of the corpus.</p>

<h2><span class="n">7</span>Subagents - three eras of the same idea</h2>
<table><thead><tr><th>era</th><th>mechanism</th><th>window</th><th>evidence</th></tr></thead><tbody>
<tr><td><b>1 · inline</b></td><td><code>isSidechain: true</code> records interleaved in the main tape, own root, <code>agentId</code> field</td><td class="mono small">${era('inline isSidechain record')}</td><td class="mono small">${fmtNum(t.sidechainRecords)} records, ${t.tapesWithInlineSidechains} tapes</td></tr>
<tr><td><b>2 · progress</b></td><td><code>progress</code> records duplicate each subagent message inline, linked by <code>toolUseID/parentToolUseID</code></td><td class="mono small">${era('record:progress')}</td><td class="mono small">${fmtNum(c.types['progress'])} records, ${fmtBytes(c.typeBytes['progress'])}</td></tr>
<tr><td><b>3 · sidecar</b></td><td>own tapes in <code>&lt;session&gt;/subagents/agent-*.jsonl</code> + <code>.meta.json</code> (agentType, toolUseId, spawnDepth); lifecycle records <code>started/result</code> with a resume <code>key</code></td><td class="mono small">2026-03-30 → today</td><td class="mono small">${fmtNum(S.subagentTapes)} tapes, ${fmtNum(S.subagentMetas)} metas</td></tr>
</tbody></table>
<div class="grid2">
<div><table><thead><tr><th>agentType</th><th>spawned</th></tr></thead><tbody>${agentRows}</tbody></table></div>
<div class="note"><b>Sidecar tapes are out-of-file sidechains, not new sessions.</b> Same record grammar (${fmtNum(c.subagentTypes['user'] + c.subagentTypes['assistant'])} user/assistant records), but stamped with the PARENT's <code>sessionId</code> + <code>isSidechain: true</code> + <code>agentId</code> - identity stays with the spawning session. <code>started</code>/<code>result</code> lifecycle records appear on workflow spawns; plain Agent spawns return through the parent's tool_result. Spawn depth reaches ${Math.max(...Object.keys(S.spawnDepths).filter(k => k !== '?').map(Number))} (agents spawning agents). Workflows nest deeper: <code>subagents/workflows/wf_*/agent-*.jsonl</code>, scripts under <code>workflows/scripts/</code>. Also in the sidecar: <code>tool-results/</code> (${fmtNum(S.toolResultFiles)} files, ${fmtBytes(S.toolResultBytes)} - full outputs offloaded out-of-tape, not referenced by any record) and <code>workflows/</code> state (${fmtNum(S.workflowFiles)} files).</div>
</div>
${TX ? `<h3>the spawn interface - what goes in</h3>
<div class="grid2">
<div>
<table><thead><tr><th>Agent/Task input</th><th>fills</th><th>share</th><th>shape</th></tr></thead><tbody>
<tr><td class="mono">prompt</td><td class="mono">${fmtNum(TX.agent.inputKeys.prompt)}</td><td class="mono small">100%</td><td class="small">free-form task brief · avg ${fmtNum(Math.round(TX.agent.promptLen.sum / TX.agent.n))}c · max ${fmtNum(TX.agent.promptLen.max)}c</td></tr>
<tr><td class="mono">description</td><td class="mono">${fmtNum(TX.agent.inputKeys.description)}</td><td class="mono small">100%</td><td class="small">3-5 word display label</td></tr>
<tr><td class="mono">subagent_type</td><td class="mono">${fmtNum(TX.agent.inputKeys.subagent_type)}</td><td class="mono small">${pct(TX.agent.inputKeys.subagent_type, TX.agent.n)}</td><td class="small">${Object.keys(TX.agent.spawnTypes).length} distinct types (census below)</td></tr>
<tr><td class="mono">run_in_background</td><td class="mono">${fmtNum(TX.agent.inputKeys.run_in_background)}</td><td class="mono small">${pct(TX.agent.inputKeys.run_in_background, TX.agent.n)}</td><td class="small">async spawns - ties into the L7 notification loop</td></tr>
<tr><td class="mono">model / max_turns / resume</td><td class="mono">${fmtNum((TX.agent.inputKeys.model || 0) + (TX.agent.inputKeys.max_turns || 0) + (TX.agent.inputKeys.resume || 0))}</td><td class="mono small">&lt;2%</td><td class="small">rare overrides - the defaults win</td></tr>
</tbody></table>
</div>
<div>
<table><thead><tr><th>prompt length</th><th>spawns</th></tr></thead><tbody>
${['<200c', '200-1k', '1k-4k', '4k-12k', '12k+'].map(k => `<tr><td class="mono">${k}</td><td>${bar(TX.agent.promptLen.buckets[k] || 0, Math.max(...Object.values(TX.agent.promptLen.buckets)))}</td></tr>`).join('')}
</tbody></table>
<p class="small">The mode is a 1-4k-char brief: enough for objective + constraints + return-format instructions. The interface is essentially <b>three fields</b> - prompt, label, type.</p>
</div>
</div>

<h3>what comes back - two output channels</h3>
<div class="grid2">
<div class="note"><b>Channel 1: the parent's <code>toolUseResult</code></b> (Agent tool). Always: <code>status, agentId, prompt</code>. Synchronous completions (${fmtNum(TX.agent.parentResultKeys.content)}) add <code>content</code> (the child's final text) + <code>totalDurationMs, totalTokens, totalToolUseCount, usage, toolStats</code>. Background spawns (${fmtNum(TX.agent.isAsync.true || 0)}, all <code>isAsync: true</code>) return an <code>outputFile</code> pointer instead and complete via the notification loop. Avg child bill: <b>${fmtNum(Math.round(TX.agent.totalTokensSum / Math.max(1, TX.agent.totalTokensN)))} tokens</b>.</div>
<div class="note"><b>Channel 2: the sidecar <code>result</code> record</b> (workflow subagents). ${fmtNum((TX.subTypes['workflow-subagent'] || {}).resObj || 0)} structured objects vs ${fmtNum((TX.subTypes['workflow-subagent'] || {}).resStr || 0)} strings, produced via a dedicated <code>StructuredOutput</code> tool (${fmtNum((TX.subTypes['workflow-subagent'] || {}).tools?.StructuredOutput || 0)} uses) that schema-validates the child's answer at the tool layer. <b>The output schema is caller-defined per spawn</b> - verdict/scores/keyFiles/findings vocabularies dictated by the parent's prompt, not fixed by the platform.</div>
</div>

<h3>per-type execution profiles</h3>
<table><thead><tr><th>agentType</th><th>tapes</th><th>msgs/tape</th><th>out tokens/tape</th><th>active min/tape</th><th>tool mix (top)</th></tr></thead><tbody>
${Object.entries(TX.subTypes).filter(([k, v]) => v.tapes >= 10 && k !== '?').sort((a, b) => b[1].tapes - a[1].tapes).map(([k, v]) =>
  `<tr><td class="mono">${esc(k)}</td><td class="mono">${fmtNum(v.tapes)}</td><td class="mono">${(v.msgs / v.tapes).toFixed(1)}</td><td class="mono">${fmtNum(Math.round(v.outTok / v.tapes))}</td><td class="mono">${(v.durMin / v.tapes).toFixed(1)}</td><td class="mono small">${sortDesc(v.tools).slice(0, 4).map(([t, n]) => `${esc(t)} ${fmtNum(n)}`).join(' · ')}</td></tr>`).join('')}
</tbody></table>
<div class="note win"><b>Types are tool-mix presets, and the mix proves the design.</b> Explore is read-only in practice (Read/Bash/Grep/Glob, zero Writes), general-purpose adds the web pair, workflow subagents add StructuredOutput. The profiles differ 2x in output tokens (8.2k vs 18k per tape) - <b>type selection is a budget decision as much as a capability one</b>. Relation to the loop ladder: ${fmtNum(TX.agent.parallelMsgs)} messages fan out 2+ spawns at once (L2 parallelism), children spawn children to depth 3 (840 spawn calls total vs 281 delegating main-tape turns), and the ${fmtNum(TX.agent.isAsync.true || 0)} background spawns are exactly where L3 turns hand work to the L7 daemon loop.</div>` : ''}

${trees?.fan ? `<h3>heaviest spawner: one session, ${trees.fan.agents.length} subagent tapes</h3>
<p class="lede">${esc(trees.fan.title || trees.fan.session.slice(0, 8))} · ${esc(trees.fan.project.replace(/^-Users-[^-]+-?/, '~/').replace(/-/g, '/'))} - each chip is one sidecar tape, sized by bytes.</p>
${fanChips(trees.fan)}` : ''}

<h2><span class="n">8</span>Format evolution, dated by the corpus</h2>
<p class="lede">Every record self-stamps <code>version</code>, so features date themselves. ✝ = not seen in 45+ days (retired).</p>
<table><thead><tr><th>feature</th><th>first seen</th><th>last seen</th><th>records</th><th>note</th></tr></thead><tbody>${evoRows}</tbody></table>
<h3>corpus volume by month</h3>
<table><tbody>${monthRows}</tbody></table>

<h2><span class="n">9</span>The mental model</h2>
<table><thead><tr><th>question</th><th>answer</th></tr></thead><tbody>
<tr><td><b>unit of storage</b></td><td>append-only JSONL tape per session; every line a self-describing envelope</td></tr>
<tr><td><b>logical structure</b></td><td>forest: trees via <code>parentUuid</code>; multiple roots per file (clear/compaction/copy); floating state records live outside the tree</td></tr>
<tr><td><b>branching</b></td><td>real and preserved: ${fmtNum(t.forkNodes)} forks from edits/retries/interrupts; the UI renders one path, the file keeps all</td></tr>
<tr><td><b>assistant message</b></td><td>exploded: one content block per record, reassembled by <code>message.id</code>; usage/stop_reason ride the last record</td></tr>
<tr><td><b>the loop</b></td><td><code>promptId</code> groups prompt → (thinking → text → tool_use → tool_result)* → end_turn; pairing via block ids + <code>sourceToolAssistantUUID</code></td></tr>
<tr><td><b>tool calls</b></td><td>100% client-side in the tape; results persisted twice (raw + parsed); hosted/server blocks: zero</td></tr>
<tr><td><b>persistence policy</b></td><td>journal the response side verbatim (incl. signatures); never persist the request side (system prompt/tools); never delete, only append</td></tr>
<tr><td><b>fork/resume</b></td><td>copy history into the new tape (<code>forkedFrom</code>), keep original sessionIds; self-contained files, ~0 dangling pointers</td></tr>
<tr><td><b>compaction</b></td><td>new root + <code>logicalParentUuid</code> seam + summary-as-user-record; old tree stays</td></tr>
<tr><td><b>subagents</b></td><td>own sidecar tapes with lifecycle records; historically inline (isSidechain) then duplicated (progress) - the format's most-churned area</td></tr>
</tbody></table>


<div class="foot">Local read-only census · generated ${day(c.scannedAt)} by <code>tools/develop/alx-claude-code-eviscerate/</code> (re-run: <code>node scan.mjs && node trees.mjs && node turn.mjs && node turns.mjs && node toolsx.mjs && node schema.mjs && node report.mjs</code>) · every count measured from your local ~/.claude/projects; exemplar JSON truncated for privacy - treat the generated report as private · sibling: aix-anthropic-eviscerate (live wire probes of the same loop, from the API side).</div>
</div>`;

fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'report.html'), html);
console.log('wrote report.html (' + html.length + ' bytes)');
