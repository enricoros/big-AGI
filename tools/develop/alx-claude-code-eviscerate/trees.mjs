// trees.mjs - extract renderable structures from exemplar sessions:
// condensed parentUuid trees, tape barcodes, marathon-turn rhythm, subagent fan.
// Auto-picks exemplars: most forks, max siblings, compaction seam, marathon loop, typical linear.
// Output: out/trees.json
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS, saveJson, contentSnippet, walkFiles } from './lib.mjs';

// salient single-char code per record (drives barcode colors + tree node kinds)
// P prompt · K compact summary · r tool_result · a text · t thinking · c tool_use
// C compact boundary · s system · p progress · f file-history · o other/floating
function codeOf(j) {
  const t = j.type;
  if (t === 'user') {
    if (j.isCompactSummary) return 'K';
    const c = j.message?.content;
    if (typeof c === 'string') return j.isMeta ? 'o' : 'P';
    if (Array.isArray(c)) {
      if (c.some(b => b?.type === 'tool_result')) return 'r';
      return j.isMeta ? 'o' : 'P';
    }
    return 'o';
  }
  if (t === 'assistant') {
    const c = j.message?.content;
    const b = Array.isArray(c) && c[0];
    if (b && b.type === 'tool_use') return 'c';
    if (b && b.type === 'thinking') return 't';
    return 'a';
  }
  if (t === 'system') return j.subtype === 'compact_boundary' ? 'C' : 's';
  if (t === 'progress') return 'p';
  if (t && t.startsWith('file-history')) return 'f';
  return 'o';
}

// conversational codes: structure-bearing user/assistant records
const CONV = new Set(['P', 'K', 'r', 'a', 'c', 't']);

// ---- pass 1: parse every session tape into minimal records ------------------

const tapes = [];  // { file, project, session, title, recs: [minimal], stats }
for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue;
  const pdir = path.join(PROJECTS, proj.name);
  for (const e of fs.readdirSync(pdir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
    const file = path.join(pdir, e.name);
    let txt;
    try { txt = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const recs = [];
    let title = null;
    for (const l of txt.split('\n')) {
      if (!l) continue;
      let j; try { j = JSON.parse(l); } catch { continue; }
      if (j.type === 'custom-title') { title = j.customTitle; continue; }
      if (j.type === 'agent-name' && !title) { title = j.agentName; continue; }
      const code = codeOf(j);
      const r = { u: j.uuid || null, p: j.parentUuid || null, c: code, ts: j.timestamp || null, sc: j.isSidechain ? 1 : 0 };
      if (code === 'P' || code === 'K') r.snip = contentSnippet(j.message?.content, 54);
      if (j.type === 'assistant' && j.message?.id) {
        r.mid = j.message.id;
        r.tn = Array.isArray(j.message.content) ? j.message.content.filter(b => b?.type === 'tool_use').length : 0;
      }
      if (j.type === 'user' && j.promptId) r.pid = j.promptId;
      if (code === 'C') { r.lp = j.logicalParentUuid || null; r.pre = j.compactMetadata?.preTokens || 0; }
      recs.push(r);
    }
    if (!recs.length) continue;

    // stats: forks / siblings / roots / compaction / longest turn
    const byId = new Map();
    for (const r of recs) if (r.u) byId.set(r.u, r);
    const convKids = new Map();
    let roots = 0;
    for (const r of recs) {
      if (!r.u || r.sc) continue;
      if (!r.p || !byId.has(r.p)) { roots++; continue; }
      if (CONV.has(r.c)) {
        if (!convKids.has(r.p)) convKids.set(r.p, []);
        convKids.get(r.p).push(r);
      }
    }
    let forks = 0, maxSiblings = 0;
    for (const [, kids] of convKids) if (kids.length > 1) { forks++; if (kids.length > maxSiblings) maxSiblings = kids.length; }

    // turn segmentation (same rules as scan.mjs)
    let curTurn = null, seg = 0;
    const turns = new Map();
    for (const r of recs) {
      if (r.sc) continue;
      if (r.c === 'P' || r.c === 'K') { curTurn = r.pid || ('seg_' + (++seg)); if (!turns.has(curTurn)) turns.set(curTurn, { msgs: new Map(), snip: r.snip }); }
      else if (r.c === 'r' && r.pid && turns.has(r.pid)) curTurn = r.pid;
      if (curTurn && r.mid) {
        const tu = turns.get(curTurn);
        if (!tu.msgs.has(r.mid)) tu.msgs.set(r.mid, { tools: 0, text: false, think: false });
        const m = tu.msgs.get(r.mid);
        if (r.tn) m.tools += r.tn;
        if (r.c === 'a') m.text = true;
        if (r.c === 't') m.think = true;
      }
    }
    let bestTurn = null;
    for (const [k, tu] of turns) if (!bestTurn || tu.msgs.size > bestTurn.msgs.size) bestTurn = { key: k, ...tu };

    tapes.push({
      file, project: proj.name, session: e.name.replace('.jsonl', ''), title, recs,
      stats: {
        records: recs.length, roots, forks, maxSiblings,
        prompts: recs.filter(r => r.c === 'P' && !r.sc).length,
        compactSeams: recs.filter(r => r.c === 'C').length,
        maxPre: Math.max(0, ...recs.filter(r => r.c === 'C').map(r => r.pre || 0)),
        longestTurnMsgs: bestTurn ? bestTurn.msgs.size : 0,
      },
      bestTurn,
    });
  }
}
console.log(`pass 1: ${tapes.length} tapes parsed`);

// ---- pick exemplars ----------------------------------------------------------

const picked = new Set();
function pick(label, scoreFn, filterFn = () => true) {
  const cands = tapes.filter(t => !picked.has(t.file) && filterFn(t));
  if (!cands.length) return null;
  cands.sort((a, b) => scoreFn(b) - scoreFn(a));
  picked.add(cands[0].file);
  return { label, tape: cands[0] };
}

const chosen = [
  pick('typical - a short linear session', t => Date.parse([...t.recs].reverse().find(r => r.ts)?.ts || 0) || 0,
    t => t.stats.forks === 0 && t.stats.roots === 1 && t.stats.records >= 60 && t.stats.records <= 300 && t.stats.prompts >= 3),
  pick('compaction - new root mid-file', t => t.stats.maxPre, t => t.stats.compactSeams > 0),
  pick('marathon - the longest agentic loop', t => t.stats.longestTurnMsgs),
  pick('most forked - edits & retries everywhere', t => t.stats.forks),
  pick('widest fork - sibling retries at one node', t => t.stats.maxSiblings),
].filter(Boolean);

// ---- condense a tape into a renderable tree ---------------------------------

function condense(tape, maxNodes = 400) {
  const all = tape.recs;
  const recs = [], posOf = new Map();
  for (let i = 0; i < all.length; i++) {
    const r = all[i];
    if (r.u && !r.sc) { recs.push(r); posOf.set(r.u, i); }
  }
  const byId = new Map(recs.map(r => [r.u, r]));
  const kidsOf = new Map();       // all tree children (chains thread through system/attachment records)
  const convKidsOf = new Map();   // conversational children only (forks)
  for (const r of recs) {
    if (!r.p || !byId.has(r.p)) continue;
    if (!kidsOf.has(r.p)) kidsOf.set(r.p, []);
    kidsOf.get(r.p).push(r);
    if (CONV.has(r.c)) {
      if (!convKidsOf.has(r.p)) convKidsOf.set(r.p, []);
      convKidsOf.get(r.p).push(r);
    }
  }
  const isRoot = r => !r.p || !byId.has(r.p);
  const isFork = r => (convKidsOf.get(r.u) || []).length > 1;
  const isLeaf = r => CONV.has(r.c) && !(kidsOf.get(r.u) || []).length;
  const keep = r => isRoot(r) || isFork(r) || isLeaf(r) || r.c === 'P' || r.c === 'K' || r.c === 'C';

  let kept = recs.filter(keep);
  const keptTotal = kept.length;
  const nearestKept = (r, keptSet) => {
    let cur = r.p, skip = 0;
    while (cur && byId.has(cur)) {
      if (keptSet.has(cur)) return { pid: cur, skip };
      skip++; cur = byId.get(cur).p;
    }
    return { pid: null, skip };
  };

  // over budget: first drop chain-tip leaves that don't hang off a fork (boring ends),
  // then fall back to a connectivity-guarded slice in tape order
  let pruned = false, truncated = false;
  if (kept.length > maxNodes) {
    const set0 = new Set(kept.map(r => r.u));
    kept = kept.filter(r => {
      if (!isLeaf(r) || isRoot(r) || r.c === 'P' || r.c === 'K') return true;
      const { pid } = nearestKept(r, set0);
      return pid ? isFork(byId.get(pid)) : true;
    });
    pruned = true;
  }
  if (kept.length > maxNodes) {
    const included = new Set();
    kept = kept.filter(r => {
      if (included.size >= maxNodes) return false;
      const { pid } = nearestKept(r, included);
      if (pid || isRoot(r) || !r.p) { included.add(r.u); return true; }
      return false;
    });
    truncated = true;
  }
  const keptSet = new Set(kept.map(r => r.u));

  const nodes = kept.map(r => {
    const { pid, skip } = nearestKept(r, keptSet);
    return {
      id: r.u.slice(0, 8), pid: pid ? pid.slice(0, 8) : null, skip,
      code: r.c, ts: r.ts, pos: posOf.get(r.u),
      fork: isFork(r) ? (convKidsOf.get(r.u) || []).length : 0,
      root: isRoot(r) ? 1 : 0, leaf: isLeaf(r) ? 1 : 0,
      snip: r.snip || null,
      lp: r.lp && keptSet.has(r.lp) ? r.lp.slice(0, 8) : null,
      pre: r.pre || 0,
    };
  });
  return { nodes, total: all.length, treeRecords: recs.length, keptTotal, pruned, truncated };
}

// ---- barcode: ≤1100 buckets, salient-type-wins ------------------------------

const PRIORITY = ['C', 'K', 'P', 'c', 'a', 't', 'r', 's', 'p', 'f', 'o'];
function barcode(tape, maxCols = 1100) {
  const codes = tape.recs.map(r => r.c);
  const scMask = tape.recs.map(r => r.sc);
  if (codes.length <= maxCols) return { codes: codes.join(''), sc: scMask.join(''), bucket: 1, n: codes.length };
  const bucket = Math.ceil(codes.length / maxCols);
  const out = [], outSc = [];
  for (let i = 0; i < codes.length; i += bucket) {
    const slice = codes.slice(i, i + bucket);
    out.push(PRIORITY.find(p => slice.includes(p)) || 'o');
    outSc.push(scMask.slice(i, i + bucket).every(Boolean) ? 1 : 0);
  }
  return { codes: out.join(''), sc: outSc.join(''), bucket, n: codes.length };
}

// ---- marathon rhythm ---------------------------------------------------------

const marathon = chosen.find(c => c.label.startsWith('marathon'));
let rhythm = null;
if (marathon && marathon.tape.bestTurn) {
  const bt = marathon.tape.bestTurn;
  rhythm = {
    snippet: bt.snip, msgs: [...bt.msgs.values()].map(m => ({ k: m.tools ? 'c' : m.text ? 'a' : 't', n: m.tools })),
    session: marathon.tape.session, title: marathon.tape.title,
  };
}

// ---- subagent fan: session dir with the most agent tapes ---------------------

let fan = null;
for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue;
  const pdir = path.join(PROJECTS, proj.name);
  for (const e of fs.readdirSync(pdir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'memory') continue;
    const sub = path.join(pdir, e.name, 'subagents');
    if (!fs.existsSync(sub)) continue;
    const agents = [];
    for (const f of walkFiles(sub)) {
      if (!f.endsWith('.jsonl')) continue;
      const meta = f.replace(/\.jsonl$/, '.meta.json');
      let type = path.relative(sub, f).startsWith('workflows/') ? 'workflow' : '?';
      try { type = JSON.parse(fs.readFileSync(meta, 'utf8')).agentType || type; } catch { /* keep */ }
      agents.push({ type, bytes: fs.statSync(f).size });
    }
    if (agents.length && (!fan || agents.length > fan.agents.length)) {
      const mainTape = tapes.find(t => t.session === e.name);
      fan = { project: proj.name, session: e.name, title: mainTape?.title || null, mainRecords: mainTape?.stats.records || 0, agents };
    }
  }
}

// ---- output -------------------------------------------------------------------

const out = {
  extractedAt: new Date().toISOString(),
  exemplars: chosen.map(({ label, tape }) => ({
    label, project: tape.project, session: tape.session, title: tape.title,
    stats: tape.stats,
    tree: condense(tape),
    barcode: barcode(tape),
  })),
  rhythm, fan,
};
saveJson('trees', out);
for (const e of out.exemplars) console.log(`  ${e.label}: ${e.session.slice(0, 8)} "${e.title || ''}" recs=${e.stats.records} forks=${e.stats.forks} kept=${e.tree.nodes.length}`);
if (fan) console.log(`  fan: ${fan.session.slice(0, 8)} agents=${fan.agents.length}`);
