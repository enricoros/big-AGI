// turns.mjs - classify every turn in the corpus by measurable shape, attribute
// mid-turn pauses, and collect the evidence for the containment ladder.
// Output: out/turns.json
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS, saveJson, bump } from './lib.mjs';

const g = {
  turns: 0,
  kinds: {},              // kind -> {n, msgs: sum, dur: sum, durN, pauses, maxMsgs}
  flags: { pause2m: 0, pause30m: 0, apiError: 0, denial: 0, spawn: 0, auq: 0, bgSession: 0, taskCreate: 0 },
  pauseWaitedOn: {},      // attribution of the longest >2min gap per turn
  endStates: {},          // how turns end
  promptSources: {},      // promptSource census on initiators
  topPauses: [],          // longest pauses, for flavor
  // ladder evidence
  ladder: {
    sessions: 0, sessionsBg: 0, sessionsSdk: 0,
    turnsPerSession: {},  // bucketed
    taskNotifTurns: 0, commandTurns: 0, queuedTurns: 0,
    tapesWithForkedFrom: 0, tapesWithCompactSeam: 0,
  },
};

const bucketTps = n => n <= 1 ? '1' : n <= 3 ? '2-3' : n <= 10 ? '4-10' : n <= 30 ? '11-30' : '31+';

function classify(turn) {
  const t0 = turn.initText || '';
  if (t0.startsWith('<task-notification>')) return 'task-notification continuation';
  if (t0.startsWith('<command-')) return 'slash command';
  if (turn.promptSource === 'queued') return 'queued auto-run';
  if (turn.promptSource === 'system' || turn.promptSource === 'sdk') return 'system/sdk-injected';
  if (turn.interrupted) return 'interrupted';
  if (turn.auq) return 'interactive (asks the user)';
  if (turn.spawn) return 'delegating (spawns agents)';
  if (turn.tools > 0) return 'tool loop';
  return 'no-tool chat';
}

for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue;
  const pdir = path.join(PROJECTS, proj.name);
  for (const e of fs.readdirSync(pdir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
    let txt;
    try { txt = fs.readFileSync(path.join(pdir, e.name), 'utf8'); } catch { continue; }
    g.ladder.sessions++;
    let title = null, isBg = false, isSdk = false, hasFork = false, hasSeam = false;
    let cur = null, seg = 0, nTurnsHere = 0;
    const turns = [];
    const finish = () => { if (cur) { turns.push(cur); cur = null; } };

    for (const l of txt.split('\n')) {
      if (!l) continue;
      let j; try { j = JSON.parse(l); } catch { continue; }
      if (j.type === 'custom-title') { title = j.customTitle; continue; }
      if (j.type === 'agent-name' && !title) { title = j.agentName; continue; }
      if (j.sessionKind === 'bg') isBg = true;
      if (j.entrypoint === 'sdk-cli') isSdk = true;
      if (j.forkedFrom) hasFork = true;
      if (j.type === 'system' && j.subtype === 'compact_boundary') hasSeam = true;
      if (j.isSidechain) continue;
      const ts = j.timestamp ? Date.parse(j.timestamp) : null;

      const content = j.message?.content;
      const isToolResult = Array.isArray(content) && content.some(b => b?.type === 'tool_result');
      const initText = typeof content === 'string' ? content : Array.isArray(content) ? (content.find(b => b?.type === 'text')?.text || '') : '';

      // turn boundary
      if (j.type === 'user' && !isToolResult && !j.isMeta && !j.isCompactSummary && (j.promptId || initText)) {
        if (!(j.promptId && cur && cur.pid === j.promptId)) {
          finish();
          nTurnsHere++;
          cur = {
            pid: j.promptId || 's' + (++seg), initText: initText.slice(0, 80),
            promptSource: j.promptSource || null,
            msgIds: new Set(), tools: 0, spawn: false, auq: false, taskCreate: false,
            interrupted: initText.startsWith('[Request interrupted') ? true : false,
            apiError: false, denial: false,
            useNames: {}, openUses: new Set(),
            first: ts, last: ts, prevTs: ts,
            maxGap: 0, gapWaitedOn: null, lastStop: null,
          };
        }
      }
      if (!cur) continue;
      // records belonging to the open turn (until next initiator)
      if (ts) {
        if (cur.prevTs && ts - cur.prevTs > cur.maxGap) {
          cur.maxGap = ts - cur.prevTs;
          // attribute: what record ended the wait?
          let waited = j.type;
          if (j.type === 'user' && isToolResult) {
            const rid = content.find(b => b?.type === 'tool_result')?.tool_use_id;
            waited = cur.useNames[rid] === 'AskUserQuestion' ? 'answer to AskUserQuestion' : `tool_result (${cur.useNames[rid] || 'tool'} - run/permission wait)`;
          } else if (j.type === 'user') waited = 'next user input (steering/injection)';
          else if (j.type === 'assistant') waited = 'assistant (api latency/retry)';
          else waited = j.type + (j.subtype ? '/' + j.subtype : '');
          cur.gapWaitedOn = waited;
        }
        cur.prevTs = ts;
        if (!cur.first || ts < cur.first) cur.first = ts;
        if (!cur.last || ts > cur.last) cur.last = ts;
      }
      if (j.type === 'assistant' && j.message) {
        if (j.message.id) { cur.msgIds.add(j.message.id); cur.lastStop = j.message.stop_reason ?? cur.lastStop; }
        if (j.isApiErrorMessage) cur.apiError = true;
        if (Array.isArray(content)) for (const b of content) {
          if (b?.type !== 'tool_use') continue;
          cur.tools++;
          cur.useNames[b.id] = b.name;
          cur.openUses.add(b.id);
          if (b.name === 'Agent' || b.name === 'Task') cur.spawn = true;
          if (b.name === 'AskUserQuestion') cur.auq = true;
          if (b.name === 'TaskCreate') cur.taskCreate = true;
        }
      }
      if (j.type === 'user') {
        if (j.toolDenialKind) cur.denial = true;
        if (initText.startsWith('[Request interrupted')) cur.interrupted = true;
        if (Array.isArray(content)) for (const b of content) if (b?.type === 'tool_result') cur.openUses.delete(b.tool_use_id);
      }
      if (j.type === 'system' && j.subtype === 'api_error') cur.apiError = true;
    }
    finish();

    if (isBg) g.ladder.sessionsBg++;
    if (isSdk) g.ladder.sessionsSdk++;
    if (hasFork) g.ladder.tapesWithForkedFrom++;
    if (hasSeam) g.ladder.tapesWithCompactSeam++;
    bump(g.ladder.turnsPerSession, bucketTps(nTurnsHere));

    for (const t of turns) {
      g.turns++;
      const kind = classify(t);
      const K = g.kinds[kind] = g.kinds[kind] || { n: 0, msgs: 0, durMin: 0, durN: 0, pauses: 0, maxMsgs: 0 };
      K.n++; K.msgs += t.msgIds.size; if (t.msgIds.size > K.maxMsgs) K.maxMsgs = t.msgIds.size;
      const dur = t.first && t.last ? (t.last - t.first) / 60000 : null;
      if (dur != null) { K.durMin += dur; K.durN++; }
      const gapMin = t.maxGap / 60000;
      if (gapMin > 2) {
        g.flags.pause2m++; K.pauses++;
        bump(g.pauseWaitedOn, t.gapWaitedOn || '?');
        if (gapMin > 30) g.flags.pause30m++;
        g.topPauses.push({ title, kind, gapMin: Math.round(gapMin), waitedOn: t.gapWaitedOn, msgs: t.msgIds.size });
        g.topPauses.sort((a, b) => b.gapMin - a.gapMin);
        if (g.topPauses.length > 10) g.topPauses.length = 10;
      }
      if (t.apiError) g.flags.apiError++;
      if (t.denial) g.flags.denial++;
      if (t.spawn) g.flags.spawn++;
      if (t.auq) g.flags.auq++;
      if (t.taskCreate) g.flags.taskCreate++;
      if (t.promptSource) bump(g.promptSources, t.promptSource);
      if (kind === 'task-notification continuation') g.ladder.taskNotifTurns++;
      if (kind === 'slash command') g.ladder.commandTurns++;
      if (kind === 'queued auto-run') g.ladder.queuedTurns++;
      // end state
      const end = t.interrupted ? 'interrupted (marker)' :
        t.openUses.size ? 'dangling tool_use (aborted mid-loop)' :
          t.lastStop === 'end_turn' ? 'end_turn (clean)' :
            t.lastStop === null || t.lastStop === 'null' ? 'stream cut (stop_reason null)' :
              t.lastStop || 'no assistant reply';
      bump(g.endStates, String(end));
    }
  }
}

saveJson('turns', g);
console.log(`turns: ${g.turns} · kinds:`, Object.fromEntries(Object.entries(g.kinds).map(([k, v]) => [k, v.n])));
