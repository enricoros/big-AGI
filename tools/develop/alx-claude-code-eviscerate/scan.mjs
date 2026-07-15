// scan.mjs - full local census of ~/.claude/projects session tapes + sidecar dirs.
// No network, read-only. Output: out/census.json, out/exemplars.json
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { CLAUDE_HOME, PROJECTS, saveJson, truncDeep, contentSnippet, bump, walkFiles } from './lib.mjs';

const g = {
  scannedAt: new Date().toISOString(),
  claudeHomeDirs: [],                 // du -sk of ~/.claude/* for context
  corpus: { projects: 0, sessionTapes: 0, subagentTapes: 0, bytes: 0, lines: 0, parseErrors: 0, firstTs: null, lastTs: null },
  projects: {},                       // dirName -> { sessions, bytes, lines, firstTs, lastTs }
  versions: {},                       // version -> count of records
  entrypoints: {}, userTypes: {},
  // record taxonomy (session tapes only; subagent tapes counted apart)
  types: {}, typeBytes: {}, fieldsByType: {},
  systemSubtypes: {}, progressDataTypes: {},
  subagentTypes: {},                  // record types inside subagent tapes
  // content blocks
  blocks: { user: {}, assistant: {} },
  blockBytes: {},
  thinking: { blocks: 0, chars: 0, withSig: 0, sigChars: 0, redacted: 0 },
  tools: {
    client: {}, mcp: {}, server: {},  // name -> count (tool_use blocks)
    inputBytes: 0, uses: 0,
    results: 0, resultBytes: 0, errorResults: 0, maxResultBytes: 0,
    toolUseResultRecords: 0, toolUseResultKeys: {}, toolUseResultShapes: {},
  },
  // assistant message reconstruction
  models: {}, stopReasons: {},
  explosion: { apiMessages: 0, records: 0, hist: {} },   // records per unique message.id
  usage: { apiMessages: 0, in: 0, out: 0, cacheRead: 0, cacheCreate: 0 },
  // topology
  topology: {
    tapes: 0, linearTapes: 0, tapesWithForks: 0,
    nodes: 0, roots: 0, multiRootTapes: 0, maxRootsInTape: 0,
    forkNodes: 0, maxConvChildren: 0, auxFanoutNodes: 0, orphanParents: 0,
    forkChildTypes: {}, branchExemplars: [],
    sidechainRecords: 0, sidechainRoots: 0, tapesWithInlineSidechains: 0,
    foreignSessionIdTapes: 0, foreignSessionIdRecords: 0,
  },
  // turns / agentic loop: a turn = one user prompt + everything until the next prompt
  loops: {
    turns: 0, recordsWithPromptId: 0,
    hist: {},                          // assistant API msgs per turn, bucketed
    msgsWithToolUse: 0, msgsMultiToolUse: 0, maxParallelToolUse: 0,
    multiBlockAssistantRecords: 0,
    finalStopReasons: {},              // stop_reason on the last record of each API message
    top: [],                           // longest turns
  },
  monthly: {},                         // YYYY-MM -> records
  // level-2 subtype censuses (session tapes only)
  sub: {
    user: {}, assistant: {}, fhs: {}, lastPrompt: {},
    summaryLeaf: {}, permissionModes: {}, modes: {},
  },
  // record-sequence anatomy (file order, session tapes only)
  seq: {
    transitions: {},                   // 'prev>cur' -> count
    augNext: {},                       // augmented label (system/sub, queue/op) -> {nextType: count}
    augPrev: {},                       // augmented label -> {prevType: count}
    envelope: {},                      // type -> {n, uuid, parent, ts}
    attachmentTypes: {},               // attachment.type -> count
    queueOps: {},                      // operation -> count
    queueDeltas: {},                   // enqueue->dequeue wait bucket -> count
    queuePaired: 0,
    snapshotNextIsItsUser: 0, snapshotNextOther: 0, snapshotUpdates: 0,
    floatingCadence: {},               // type -> {tapes, records}
  },
  compaction: {
    boundaries: 0, triggers: {}, preTokensMax: 0, preTokensSum: 0,
    logicalParentInFile: 0, logicalParentMissing: 0,
    compactSummaryRecords: 0, compactSummaryChars: 0,
    summaryRecords: 0,
  },
  features: {},                        // feature -> {count, firstTs, firstV, lastTs, lastV}
  sidecars: {
    sessionDirs: 0, subagentTapes: 0, subagentMetas: 0,
    agentTypes: {}, spawnDepths: {},
    toolResultFiles: 0, toolResultBytes: 0,
    workflowFiles: 0, workflowBytes: 0,
    memoryDirs: 0, memoryFiles: 0, memoryBytes: 0,
    otherFiles: {},
  },
};
// fields whose first/last appearance dates the format evolution
const FEATURE_FIELDS = ['promptId', 'logicalParentUuid', 'toolUseResult', 'forkedFrom', 'sourceToolAssistantUUID', 'sourceToolUseID', 'todos', 'thinkingMetadata', 'slug', 'sessionKind', 'attributionMcpServer', 'attributionSkill', 'attributionPlugin', 'isApiErrorMessage', 'interruptedMessageId', 'queuePriority', 'promptSource', 'origin', 'agentId', 'mcpMeta', 'permissionMode', 'isMeta', 'isVisibleInTranscriptOnly', 'toolDenialKind', 'imagePasteIds'];
const exemplars = {};   // key -> truncated record/block

function seeFeature(name, ts, v) {
  const f = g.features[name] || (g.features[name] = { count: 0, firstTs: null, firstV: null, lastTs: null, lastV: null });
  f.count++;
  if (ts && (!f.firstTs || ts < f.firstTs)) { f.firstTs = ts; f.firstV = v || f.firstV; }
  if (ts && (!f.lastTs || ts > f.lastTs)) { f.lastTs = ts; f.lastV = v || f.lastV; }
}

function exemplar(key, obj) {
  if (!exemplars[key]) exemplars[key] = truncDeep(obj);
}

const bucketTurn = n => n <= 1 ? '1' : n <= 2 ? '2' : n <= 5 ? '3-5' : n <= 10 ? '6-10' : n <= 20 ? '11-20' : n <= 50 ? '21-50' : n <= 100 ? '51-100' : '100+';

// ---- per-tape analysis ------------------------------------------------------

function analyzeBlocks(rec, role, ts, v) {
  const content = rec.message?.content;
  if (typeof content === 'string') { bump(g.blocks[role], '(string)'); return; }
  if (!Array.isArray(content)) return;
  for (const b of content) {
    if (!b || !b.type) continue;
    bump(g.blocks[role], b.type);
    bump(g.blockBytes, b.type, JSON.stringify(b).length);
    exemplar('block:' + b.type, b);
    if (b.type === 'tool_use') {
      g.tools.uses++;
      g.tools.inputBytes += JSON.stringify(b.input || {}).length;
      const name = b.name || '?';
      bump(name.startsWith('mcp__') ? g.tools.mcp : g.tools.client, name);
    } else if (b.type === 'server_tool_use') {
      bump(g.tools.server, b.name || '?');
      seeFeature('server_tool_use block', ts, v);
    } else if (b.type === 'tool_result') {
      g.tools.results++;
      const sz = JSON.stringify(b.content ?? '').length;
      g.tools.resultBytes += sz;
      if (sz > g.tools.maxResultBytes) g.tools.maxResultBytes = sz;
      if (b.is_error) g.tools.errorResults++;
    } else if (b.type === 'thinking') {
      g.thinking.blocks++;
      g.thinking.chars += (b.thinking || '').length;
      if (b.signature) { g.thinking.withSig++; g.thinking.sigChars += b.signature.length; }
      seeFeature('thinking block', ts, v);
    } else if (b.type === 'redacted_thinking') {
      g.thinking.redacted++;
    }
  }
}

function analyzeTape(file, kind /* 'session' | 'subagent' */, projKey) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return; }
  const lines = txt.split('\n');
  const basename = path.basename(file, '.jsonl');

  // per-tape state
  const nodes = new Map();            // uuid -> { children, type, sidechain }
  const parents = [];                 // [uuid, parentUuid, type, sidechain, ts]
  const msgRecords = new Map();       // message.id -> record count
  const msgUsage = new Map();         // message.id -> last usage
  const msgStop = new Map();          // message.id -> last stop_reason
  const msgToolUses = new Map();      // message.id -> tool_use blocks
  const turns = new Map();            // turn key -> stats
  const sessionIds = new Set();
  let tapeLines = 0, tapeBytes = 0, customTitle = null, firstUserSnippet = null;
  let hadInlineSidechain = false, curTurn = null, segCounter = 0;
  // sequence-anatomy state
  let prevType = null, prevAugLabel = null, pendingSnapshotMsgId = null;
  const queueFifo = [];               // pending enqueue timestamps
  const floatingHere = {};            // floating type -> count in this tape
  const summaryLeafIds = [];          // summary.leafUuid values, resolved at fold

  for (const l of lines) {
    if (!l) continue;
    tapeLines++; tapeBytes += l.length + 1;
    let j;
    try { j = JSON.parse(l); } catch { g.corpus.parseErrors++; continue; }
    const t = j.type || '(untyped)';
    const ts = j.timestamp || null;
    const v = j.version || null;

    if (kind === 'subagent') {
      bump(g.subagentTypes, t);
      // subagent tapes share the record grammar; keep their deep census out of the main tables
      if (t !== 'user' && t !== 'assistant') exemplar('subagent:' + t, j);
      continue;
    }

    bump(g.types, t);
    bump(g.typeBytes, t, l.length);
    const fc = g.fieldsByType[t] || (g.fieldsByType[t] = {});
    for (const k of Object.keys(j)) bump(fc, k);
    exemplar('type:' + t, j);
    if (v) bump(g.versions, v);
    if (j.entrypoint) bump(g.entrypoints, j.entrypoint);
    if (j.userType) bump(g.userTypes, j.userType);
    if (ts) {
      if (!g.corpus.firstTs || ts < g.corpus.firstTs) g.corpus.firstTs = ts;
      if (!g.corpus.lastTs || ts > g.corpus.lastTs) g.corpus.lastTs = ts;
      const p = g.projects[projKey];
      if (!p.firstTs || ts < p.firstTs) p.firstTs = ts;
      if (!p.lastTs || ts > p.lastTs) p.lastTs = ts;
    }
    if (j.sessionId) sessionIds.add(j.sessionId);
    if (t === 'custom-title') customTitle = j.customTitle;
    if (t === 'agent-name' && !customTitle) customTitle = j.agentName;

    // --- sequence anatomy: transitions, augmented neighborhoods, envelope, mechanics ---
    const SEQ = g.seq;
    const augLabel = t === 'system' ? 'system/' + (j.subtype || '?') : t === 'queue-operation' ? 'queue/' + (j.operation || '?') : t;
    if (prevType) bump(SEQ.transitions, prevType + '>' + t);
    if (prevType) bump(SEQ.augPrev[augLabel] = SEQ.augPrev[augLabel] || {}, prevType);
    if (prevAugLabel) bump(SEQ.augNext[prevAugLabel] = SEQ.augNext[prevAugLabel] || {}, t);
    const env = SEQ.envelope[t] = SEQ.envelope[t] || { n: 0, uuid: 0, parent: 0, ts: 0 };
    env.n++; if (j.uuid) env.uuid++; if (j.parentUuid) env.parent++; if (ts) env.ts++;
    if (t === 'attachment' && j.attachment?.type) bump(SEQ.attachmentTypes, j.attachment.type);
    if (t === 'queue-operation') {
      bump(SEQ.queueOps, j.operation || '?');
      if (j.operation === 'enqueue') queueFifo.push(ts ? Date.parse(ts) : null);
      else if (j.operation === 'dequeue') {
        const enq = queueFifo.shift();
        if (enq && ts) {
          const s = (Date.parse(ts) - enq) / 1000;
          bump(SEQ.queueDeltas, s < 1 ? '<1s' : s < 10 ? '1-10s' : s < 60 ? '10-60s' : s < 600 ? '1-10m' : s < 3600 ? '10-60m' : '>1h');
          SEQ.queuePaired++;
        }
      } else if (j.operation === 'popAll') queueFifo.length = 0;
    }
    if (pendingSnapshotMsgId) {
      if (j.uuid === pendingSnapshotMsgId) SEQ.snapshotNextIsItsUser++; else SEQ.snapshotNextOther++;
      pendingSnapshotMsgId = null;
    }
    if (t === 'file-history-snapshot') {
      pendingSnapshotMsgId = j.messageId || null;
      if (j.isSnapshotUpdate) SEQ.snapshotUpdates++;
      bump(g.sub.fhs, (j.isSnapshotUpdate ? 'update' : 'initial') + (Object.keys(j.snapshot?.trackedFileBackups || {}).length ? ' · tracking files' : ' · empty'));
    }
    if (t === 'last-prompt') bump(g.sub.lastPrompt, j.leafUuid ? 'with leafUuid anchor' : 'no anchor (pre-anchor era)');
    if (t === 'permission-mode') bump(g.sub.permissionModes, j.permissionMode || '?');
    if (t === 'mode') bump(g.sub.modes, j.mode || '?');
    if (t === 'summary' && j.leafUuid) summaryLeafIds.push(j.leafUuid);
    if (!j.uuid) bump(floatingHere, t);
    prevType = t; prevAugLabel = augLabel;

    // features: record-type + field first/last sightings (evolution timeline)
    seeFeature('record:' + t, ts, v);
    for (const k of FEATURE_FIELDS) if (j[k] !== undefined && j[k] !== false && j[k] !== null) seeFeature('field:' + k, ts, v);
    if (j.isSidechain === true) seeFeature('inline isSidechain record', ts, v);
    if (ts) bump(g.monthly, ts.slice(0, 7));

    // topology graph (records that participate in the uuid tree)
    if (j.uuid) {
      nodes.set(j.uuid, { children: 0, type: t, sidechain: !!j.isSidechain });
      parents.push([j.uuid, j.parentUuid || null, t, !!j.isSidechain, ts, j]);
      if (j.isSidechain === true) { g.topology.sidechainRecords++; hadInlineSidechain = true; }
    }

    // system subtypes / progress data types / targeted exemplars
    if (t === 'system' && j.subtype) { bump(g.systemSubtypes, j.subtype); exemplar('system:' + j.subtype, j); }
    if (t === 'progress' && j.data?.type) { bump(g.progressDataTypes, j.data.type); exemplar('progress:' + j.data.type, j); }
    if (t === 'queue-operation' && j.operation) exemplar('queue:' + j.operation, j);
    if (t === 'attachment' && j.attachment?.type) exemplar('attachment:' + j.attachment.type, j);
    if (t === 'file-history-snapshot' && j.snapshot?.trackedFileBackups && Object.keys(j.snapshot.trackedFileBackups).length) exemplar('fhs:non-empty', j);

    // compaction
    if (t === 'system' && j.subtype === 'compact_boundary') {
      g.compaction.boundaries++;
      const m = j.compactMetadata || {};
      bump(g.compaction.triggers, m.trigger || '?');
      if (m.preTokens) { g.compaction.preTokensSum += m.preTokens; if (m.preTokens > g.compaction.preTokensMax) g.compaction.preTokensMax = m.preTokens; }
      if (j.logicalParentUuid) (nodes.has(j.logicalParentUuid) ? g.compaction.logicalParentInFile++ : g.compaction.logicalParentMissing++);
      seeFeature('compact_boundary record', ts, v);
    }
    if (j.isCompactSummary) {
      g.compaction.compactSummaryRecords++;
      const c = j.message?.content;
      g.compaction.compactSummaryChars += typeof c === 'string' ? c.length : JSON.stringify(c || '').length;
    }
    if (t === 'summary') g.compaction.summaryRecords++;

    // message-bearing records
    if (t === 'user' || t === 'assistant') {
      analyzeBlocks(j, t, ts, v);
      const content = j.message?.content;
      const hasToolResult = Array.isArray(content) && content.some(b => b?.type === 'tool_result');
      // level-2 classification
      if (t === 'user') {
        if (j.isCompactSummary) bump(g.sub.user, 'compact summary (isCompactSummary)');
        else if (hasToolResult) bump(g.sub.user, 'tool_result carrier');
        else if (j.isMeta) bump(g.sub.user, 'meta (isMeta - caveats, notices)');
        else {
          const txt = typeof content === 'string' ? content : Array.isArray(content) ? (content.find(b => b?.type === 'text')?.text || '') : '';
          if (txt.startsWith('[Request interrupted')) bump(g.sub.user, 'interrupt marker');
          else if (typeof content === 'string') bump(g.sub.user, 'prompt · plain string');
          else if (Array.isArray(content) && content.some(b => b?.type === 'image')) bump(g.sub.user, 'prompt · with image(s)');
          else bump(g.sub.user, 'prompt · rich blocks');
        }
      } else if (t === 'assistant') {
        if (j.isApiErrorMessage) bump(g.sub.assistant, 'api-error synthetic');
        else bump(g.sub.assistant, (Array.isArray(content) && content[0]?.type ? content[0].type : '?') + ' record');
      }
      if (t === 'user') {
        if (j.toolUseResult !== undefined) {
          g.tools.toolUseResultRecords++;
          const tur = j.toolUseResult;
          bump(g.tools.toolUseResultShapes, Array.isArray(tur) ? 'array' : typeof tur);
          if (tur && !Array.isArray(tur) && typeof tur === 'object') for (const k of Object.keys(tur)) bump(g.tools.toolUseResultKeys, k);
        }
        if (!firstUserSnippet && !j.isMeta && typeof content === 'string') firstUserSnippet = contentSnippet(content);
      }
      if (t === 'assistant' && j.message) {
        const m = j.message;
        if (m.model) bump(g.models, m.model);
        bump(g.stopReasons, String(m.stop_reason));
        const nBlocks = Array.isArray(m.content) ? m.content.length : 0;
        if (nBlocks > 1) g.loops.multiBlockAssistantRecords++;
        if (m.id) {
          msgRecords.set(m.id, (msgRecords.get(m.id) || 0) + 1);
          if (m.usage) msgUsage.set(m.id, m.usage);
          msgStop.set(m.id, String(m.stop_reason));
          const nTools = Array.isArray(m.content) ? m.content.filter(b => b?.type === 'tool_use').length : 0;
          if (nTools) msgToolUses.set(m.id, (msgToolUses.get(m.id) || 0) + nTools);
        }
      }
      // turn segmentation: a user record with a fresh promptId opens a turn; pre-promptId
      // era falls back to "any non-tool-result, non-meta user message opens a segment"
      if (j.promptId) g.loops.recordsWithPromptId++;
      if (!j.isSidechain) {
        if (t === 'user') {
          if (j.promptId) { if (j.promptId !== curTurn) curTurn = j.promptId; }
          else if (!hasToolResult && !j.isMeta) curTurn = 'seg_' + (++segCounter);
        }
        if (curTurn) {
          const tu = turns.get(curTurn) || { msgIds: new Set(), toolUses: 0, toolResults: 0, first: ts, last: ts, snippet: null };
          if (ts) { if (!tu.first || ts < tu.first) tu.first = ts; if (!tu.last || ts > tu.last) tu.last = ts; }
          if (t === 'assistant' && j.message?.id) tu.msgIds.add(j.message.id);
          if (Array.isArray(content)) for (const b of content) {
            if (b?.type === 'tool_use') tu.toolUses++;
            else if (b?.type === 'tool_result') tu.toolResults++;
          }
          if (t === 'user' && !tu.snippet && !j.isMeta && !hasToolResult) tu.snippet = contentSnippet(content);
          turns.set(curTurn, tu);
        }
      }
    }
  }

  // summary leafUuid resolution fold
  for (const id of summaryLeafIds) bump(g.sub.summaryLeaf, nodes.has(id) ? 'leaf in same file' : 'leaf elsewhere (cross-session resume anchor)');

  // floating-record cadence fold
  for (const [ft, n] of Object.entries(floatingHere)) {
    const fc = g.seq.floatingCadence[ft] = g.seq.floatingCadence[ft] || { tapes: 0, records: 0 };
    fc.tapes++; fc.records += n;
  }

  // fold tape aggregates
  g.corpus.lines += tapeLines; g.corpus.bytes += tapeBytes;
  const p = g.projects[projKey];
  p.bytes += tapeBytes; p.lines += tapeLines;

  if (kind === 'subagent') { g.corpus.subagentTapes++; return; }
  g.corpus.sessionTapes++; p.sessions++;

  // topology fold
  const topo = g.topology;
  topo.tapes++;
  let roots = 0, orphans = 0;
  for (const [, parent, , sidechain] of parents) {
    if (!parent) {
      roots++;
      if (sidechain) topo.sidechainRoots++;
    } else if (nodes.has(parent)) {
      const pn = nodes.get(parent);
      pn.children++;
      if (sidechain && !pn.sidechain) topo.sidechainRoots++;
    } else {
      orphans++;
    }
  }
  topo.nodes += parents.length;
  topo.roots += roots;
  topo.orphanParents += orphans;
  if (roots > 1) topo.multiRootTapes++;
  if (roots > topo.maxRootsInTape) topo.maxRootsInTape = roots;
  if (hadInlineSidechain) topo.tapesWithInlineSidechains++;

  // fork census: only user/assistant children count as conversational forks;
  // progress/system records sharing a parent are auxiliary fan-out, not branches
  let forkNodesHere = 0;
  const childrenOf = new Map();
  for (const [uuid, parent, type, sidechain, ts, j] of parents) {
    if (parent && nodes.has(parent)) {
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent).push([uuid, type, sidechain, ts, j]);
    }
  }
  for (const [parent, kids] of childrenOf) {
    const mainKids = kids.filter(k => !k[2]);
    if (mainKids.length <= 1) continue;
    const convKids = mainKids.filter(k => k[1] === 'user' || k[1] === 'assistant');
    if (convKids.length > 1) {
      forkNodesHere++;
      if (convKids.length > topo.maxConvChildren) topo.maxConvChildren = convKids.length;
      bump(topo.forkChildTypes, convKids.map(k => k[1]).sort().join('+'));
      if (topo.branchExemplars.length < 3 && convKids.every(k => k[1] === 'user')) {
        topo.branchExemplars.push({
          file: path.join(projKey, basename + '.jsonl'),
          parentType: nodes.get(parent)?.type,
          children: convKids.slice(0, 4).map(k => ({ type: k[1], ts: k[3], snippet: contentSnippet(k[4]?.message?.content, 60) })),
        });
      }
    } else {
      topo.auxFanoutNodes++;
    }
  }
  topo.forkNodes += forkNodesHere;
  if (forkNodesHere > 0) topo.tapesWithForks++; else topo.linearTapes++;

  // foreign sessionIds (fork/resume evidence)
  const foreign = [...sessionIds].filter(s => s !== basename);
  if (foreign.length) { topo.foreignSessionIdTapes++; topo.foreignSessionIdRecords += foreign.length; }

  // explosion + usage (once per API message id, last usage wins)
  for (const [, cnt] of msgRecords) {
    g.explosion.apiMessages++;
    g.explosion.records += cnt;
    bump(g.explosion.hist, cnt >= 6 ? '6+' : String(cnt));
  }
  for (const [, u] of msgUsage) {
    g.usage.apiMessages++;
    g.usage.in += u.input_tokens || 0;
    g.usage.out += u.output_tokens || 0;
    g.usage.cacheRead += u.cache_read_input_tokens || 0;
    g.usage.cacheCreate += u.cache_creation_input_tokens || 0;
  }
  for (const [, s] of msgStop) bump(g.loops.finalStopReasons, s);
  for (const [, n] of msgToolUses) {
    g.loops.msgsWithToolUse++;
    if (n >= 2) g.loops.msgsMultiToolUse++;
    if (n > g.loops.maxParallelToolUse) g.loops.maxParallelToolUse = n;
  }

  // turns fold
  for (const [, tu] of turns) {
    g.loops.turns++;
    const n = tu.msgIds.size;
    bump(g.loops.hist, bucketTurn(n));
    if (n >= 2) {
      g.loops.top.push({
        project: projKey, session: basename.slice(0, 8), title: customTitle,
        snippet: tu.snippet || firstUserSnippet, apiMsgs: n, toolUses: tu.toolUses, toolResults: tu.toolResults,
        first: tu.first, last: tu.last,
        minutes: tu.first && tu.last ? Math.round((new Date(tu.last) - new Date(tu.first)) / 60000) : null,
      });
      g.loops.top.sort((a, b) => b.apiMsgs - a.apiMsgs);
      if (g.loops.top.length > 20) g.loops.top.length = 20;
    }
  }
}

// ---- sidecar dirs -----------------------------------------------------------

function analyzeSidecarDir(dir, projKey) {
  // project-level memory/ dir (auto-memory), not a per-session sidecar
  if (path.basename(dir) === 'memory') {
    g.sidecars.memoryDirs++;
    for (const f of walkFiles(dir)) { g.sidecars.memoryFiles++; g.sidecars.memoryBytes += fs.statSync(f).size; }
    return;
  }
  g.sidecars.sessionDirs++;
  for (const f of walkFiles(dir)) {
    const rel = path.relative(dir, f);
    const sz = fs.statSync(f).size;
    if (rel.startsWith('subagents/')) {
      if (f.endsWith('.jsonl')) {
        g.sidecars.subagentTapes++;
        analyzeTape(f, 'subagent', projKey);
      } else if (f.endsWith('.meta.json')) {
        g.sidecars.subagentMetas++;
        try {
          const m = JSON.parse(fs.readFileSync(f, 'utf8'));
          bump(g.sidecars.agentTypes, m.agentType || '?');
          bump(g.sidecars.spawnDepths, String(m.spawnDepth ?? '?'));
          exemplar('sidecar:subagent-meta', m);
        } catch { /* ignore */ }
      }
    } else if (rel.startsWith('tool-results/')) {
      g.sidecars.toolResultFiles++; g.sidecars.toolResultBytes += sz;
    } else if (rel.startsWith('workflows/')) {
      g.sidecars.workflowFiles++; g.sidecars.workflowBytes += sz;
    } else {
      bump(g.sidecars.otherFiles, rel.split('/')[0]);
    }
  }
}

// ---- main -------------------------------------------------------------------

try {
  g.claudeHomeDirs = execSync(`du -sk ${CLAUDE_HOME}/* 2>/dev/null | sort -rn | head -14`, { encoding: 'utf8' })
    .trim().split('\n').map(l => { const [kb, p] = l.split('\t'); return { path: path.basename(p), kb: +kb }; });
} catch { /* fine */ }

const projDirs = fs.readdirSync(PROJECTS, { withFileTypes: true }).filter(e => e.isDirectory());
g.corpus.projects = projDirs.length;
let done = 0;
for (const pd of projDirs) {
  const projKey = pd.name;
  g.projects[projKey] = { sessions: 0, bytes: 0, lines: 0, firstTs: null, lastTs: null };
  const pdir = path.join(PROJECTS, projKey);
  for (const e of fs.readdirSync(pdir, { withFileTypes: true })) {
    const p = path.join(pdir, e.name);
    if (e.isFile() && e.name.endsWith('.jsonl')) analyzeTape(p, 'session', projKey);
    else if (e.isDirectory()) analyzeSidecarDir(p, projKey);
  }
  done++;
  process.stderr.write(`\r${done}/${projDirs.length} projects`);
}
process.stderr.write('\n');

saveJson('census', g);
saveJson('exemplars', exemplars);
console.log(`scanned ${g.corpus.sessionTapes} session tapes + ${g.corpus.subagentTapes} subagent tapes, ${(g.corpus.bytes / 1e6).toFixed(0)} MB, ${g.corpus.lines} records`);
