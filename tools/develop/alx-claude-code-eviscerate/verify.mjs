// verify.mjs - the reconstruction contract, verified: corpus-wide invariant checks for
// every rule the grouped/serialized representations assume. Each invariant reports
// checked-count and violation-count, so the ladder reconstruction can be ported with
// known compliance rates instead of assumptions.
// Output: out/verify.json
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS, saveJson, bump } from './lib.mjs';

const V = {};
const inv = (id, desc) => V[id] = { desc, checked: 0, violations: 0, notes: {} };

inv('I1_single_block', 'AssistantRecord.message.content has exactly one block');
inv('I2_msg_contiguous', 'records of one message.id are contiguous among assistant records (never resume after another mid)');
inv('I3_msg_chain', 'within one message.id, record k+1.parentUuid === record k.uuid (linear chain)');
inv('I4_result_srclink', 'UserRecord(tool_result).sourceToolAssistantUUID === uuid of the AssistantRecord carrying the matching tool_use block');
inv('I5_adjacent_parent', 'tree record parentUuid === uuid of the immediately-previous tree record (file order ~ chain order; violations = forks/branch points)');
inv('I6_attachment_chain', 'AttachmentRecord is a chain LINK (some record has parentUuid === attachment.uuid) vs a leaf');
inv('I7_promptid_on_results', 'tool_result UserRecord.promptId === promptId of its chain-ancestor prompt');
inv('I8_pairing', 'every tool_use id has exactly one tool_result with that tool_use_id in the same tape');
inv('I9_stop_tool_use', 'the record carrying a tool_use block has message.stop_reason === "tool_use"');
inv('I10_parallel_results', 'when one message has N>1 tool_use blocks, results arrive as N separate user records (vs one record with N blocks)');
inv('I11_turn_equiv', 'file-order turn segmentation === chain-derived turn membership (walk parentUuid to nearest prompt)');
inv('I12_fhs_target', 'file-history-snapshot.messageId resolves to a user PROMPT record uuid in the same tape');
inv('I13_float_no_uuid', 'floating records never carry uuid/parentUuid (cannot break the chain)');
inv('I14_spawn_link', 'Agent/Task tool_use id === sidecar subagents/*.meta.json toolUseId (per spawn with a sidecar)');

const FLOATING = new Set(['last-prompt', 'ai-title', 'custom-title', 'agent-name', 'permission-mode', 'mode', 'queue-operation', 'summary', 'frame-link', 'file-history-snapshot', 'file-history-delta']);
const isPromptRec = j => j.type === 'user' && !j.isMeta && !(Array.isArray(j.message?.content) && j.message.content.some(b => b?.type === 'tool_result'));

let tapes = 0;
for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue;
  const pdir = path.join(PROJECTS, proj.name);
  for (const e of fs.readdirSync(pdir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
    let txt;
    try { txt = fs.readFileSync(path.join(pdir, e.name), 'utf8'); } catch { continue; }
    const recs = [];
    for (const l of txt.split('\n')) { if (!l) continue; try { recs.push(JSON.parse(l)); } catch { /**/ } }
    if (!recs.length) continue;
    tapes++;
    const tree = recs.filter(r => r.uuid && !r.isSidechain);
    const byU = new Map(tree.map(r => [r.uuid, r]));
    const childCount = new Map();
    for (const r of tree) if (r.parentUuid) childCount.set(r.parentUuid, (childCount.get(r.parentUuid) || 0) + 1);

    // I13: floating records never carry uuid
    for (const r of recs) if (FLOATING.has(r.type)) { V.I13_float_no_uuid.checked++; if (r.uuid || r.parentUuid) V.I13_float_no_uuid.violations++; }

    // per-message grouping
    const useRecOf = new Map();       // toolu id -> assistant record
    const midRecs = new Map();        // mid -> [records in file order]
    for (const r of tree) {
      if (r.type !== 'assistant' || !r.message) continue;
      const blocks = Array.isArray(r.message.content) ? r.message.content : [];
      V.I1_single_block.checked++;
      if (blocks.length !== 1) { V.I1_single_block.violations++; bump(V.I1_single_block.notes, 'blocks=' + blocks.length); }
      for (const b of blocks) if (b?.type === 'tool_use') {
        useRecOf.set(b.id, r);
        V.I9_stop_tool_use.checked++;
        if (r.message.stop_reason !== 'tool_use') { V.I9_stop_tool_use.violations++; bump(V.I9_stop_tool_use.notes, String(r.message.stop_reason)); }
      }
      if (r.message.id) { if (!midRecs.has(r.message.id)) midRecs.set(r.message.id, []); midRecs.get(r.message.id).push(r); }
    }
    // I2 contiguity: order of first/last appearance among assistant records
    {
      const order = tree.filter(r => r.type === 'assistant' && r.message?.id);
      let prevMid = null; const closed = new Set();
      for (const r of order) {
        const m = r.message.id;
        V.I2_msg_contiguous.checked++;
        if (m !== prevMid) {
          if (closed.has(m)) V.I2_msg_contiguous.violations++;
          if (prevMid) closed.add(prevMid);
          prevMid = m;
        }
      }
    }
    // I3 within-message chain
    for (const [, rs] of midRecs) for (let k = 1; k < rs.length; k++) {
      V.I3_msg_chain.checked++;
      if (rs[k].parentUuid !== rs[k - 1].uuid) V.I3_msg_chain.violations++;
    }
    // I5 adjacency
    for (let k = 1; k < tree.length; k++) {
      if (!tree[k].parentUuid) continue;
      V.I5_adjacent_parent.checked++;
      if (tree[k].parentUuid !== tree[k - 1].uuid) V.I5_adjacent_parent.violations++;
    }
    // I6 attachment chain-link vs leaf
    for (const r of tree) if (r.type === 'attachment') {
      V.I6_attachment_chain.checked++;
      if (!childCount.has(r.uuid)) { V.I6_attachment_chain.violations++; bump(V.I6_attachment_chain.notes, 'leaf'); }
      else bump(V.I6_attachment_chain.notes, 'chain-link');
    }
    // walk to nearest prompt ancestor
    const promptAncestor = (r) => {
      let cur = r, hops = 0;
      while (cur && hops++ < 600) {
        if (isPromptRec(cur)) return cur;
        cur = cur.parentUuid ? byU.get(cur.parentUuid) : null;
      }
      return null;
    };
    // results: src link, promptId, pairing, parallel shape
    const resultRecsOf = new Map();   // toolu id -> [user records]
    for (const r of tree) {
      if (r.type !== 'user') continue;
      const blocks = Array.isArray(r.message?.content) ? r.message.content.filter(b => b?.type === 'tool_result') : [];
      if (!blocks.length) continue;
      for (const b of blocks) {
        if (!resultRecsOf.has(b.tool_use_id)) resultRecsOf.set(b.tool_use_id, []);
        resultRecsOf.get(b.tool_use_id).push(r);
      }
      if (r.sourceToolAssistantUUID && blocks[0]) {
        V.I4_result_srclink.checked++;
        const issuer = useRecOf.get(blocks[0].tool_use_id);
        if (!issuer || issuer.uuid !== r.sourceToolAssistantUUID) V.I4_result_srclink.violations++;
      }
      if (r.promptId) {
        const pa = promptAncestor(r);
        if (pa?.promptId) {
          V.I7_promptid_on_results.checked++;
          if (pa.promptId !== r.promptId) V.I7_promptid_on_results.violations++;
        }
      }
    }
    for (const [id] of useRecOf) {
      V.I8_pairing.checked++;
      const n = (resultRecsOf.get(id) || []).length;
      if (n !== 1) { V.I8_pairing.violations++; bump(V.I8_pairing.notes, 'results=' + n); }
    }
    // I10 parallel result shape
    for (const [, rs] of midRecs) {
      const uses = rs.flatMap(r => (r.message.content || []).filter(b => b?.type === 'tool_use'));
      if (uses.length < 2) continue;
      V.I10_parallel_results.checked++;
      const resRecs = new Set(uses.flatMap(u => (resultRecsOf.get(u.id) || []).map(rr => rr.uuid)));
      const answered = uses.filter(u => (resultRecsOf.get(u.id) || []).length).length;
      if (answered === uses.length && resRecs.size === uses.length) bump(V.I10_parallel_results.notes, 'N-records');
      else if (answered === uses.length && resRecs.size === 1) { bump(V.I10_parallel_results.notes, '1-record-N-blocks'); V.I10_parallel_results.violations++; }
      else bump(V.I10_parallel_results.notes, 'partial/' + answered + 'of' + uses.length);
    }
    // I11 turn equivalence: file-order segmentation vs chain-derived
    {
      let cur = null;
      for (const r of tree) {
        if (isPromptRec(r) && (r.promptId || typeof r.message?.content === 'string')) cur = r.promptId || 'seg';
        if (r.type !== 'assistant' || !cur || cur === 'seg') continue;
        const pa = promptAncestor(r);
        if (!pa?.promptId) continue;
        V.I11_turn_equiv.checked++;
        if (pa.promptId !== cur) V.I11_turn_equiv.violations++;
      }
    }
    // I12 fhs target
    for (const r of recs) if (r.type === 'file-history-snapshot' && r.messageId) {
      V.I12_fhs_target.checked++;
      const t = byU.get(r.messageId);
      if (!t) { V.I12_fhs_target.violations++; bump(V.I12_fhs_target.notes, 'not-in-tape'); }
      else bump(V.I12_fhs_target.notes, isPromptRec(t) ? 'prompt' : t.type);
    }
    // I14 spawn link
    const sideDir = path.join(pdir, e.name.replace('.jsonl', ''), 'subagents');
    if (fs.existsSync(sideDir)) {
      const metas = [];
      for (const f of fs.readdirSync(sideDir)) if (f.endsWith('.meta.json')) { try { metas.push(JSON.parse(fs.readFileSync(path.join(sideDir, f), 'utf8'))); } catch { /**/ } }
      for (const m of metas) if (m.toolUseId) {
        V.I14_spawn_link.checked++;
        if (!useRecOf.has(m.toolUseId)) V.I14_spawn_link.violations++;
      }
    }
  }
}

for (const v of Object.values(V)) v.compliance = v.checked ? (100 * (1 - v.violations / v.checked)).toFixed(2) + '%' : 'n/a';
saveJson('verify', { tapes, invariants: V });
for (const [id, v] of Object.entries(V)) console.log(id.padEnd(24), String(v.checked).padStart(7), 'viol', String(v.violations).padStart(6), v.compliance.padStart(8), Object.keys(v.notes).length ? JSON.stringify(v.notes).slice(0, 90) : '');
