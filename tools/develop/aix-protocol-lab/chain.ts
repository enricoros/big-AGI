/**
 * Chain fidelity: does the assistant turn we send back on the NEXT request match the turn the vendor generated?
 *
 * Turn 1 is a lab capture (production adapter, live call, raw bytes). This module then runs the production CLIENT
 * path over it - ContentReassembler to fragments, as the app persists them - and rebuilds turn 2 through the
 * production converter and adapter (build only). The assistant turn inside the turn-2 body is aligned block by
 * block against the vendor's canonical turn-1 content: exact, changed (fields named), dropped, added.
 *
 * Why it matters: preserved thinking (Anthropic) binds every thinking block to the bytes before it in its turn;
 * OpenAI and Gemini bind reasoning to their items and signatures. Any divergence here is reasoning lost on turn 2.
 *
 * Needs the client graph, so run lab commands that use it with the stub preload (see stub-preload.cjs).
 */

import { ContentReassembler } from '~/modules/aix/client/ContentReassembler';
import { aixCGR_ChatSequence_FromDMessagesOrThrow } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { createDMessageFromFragments, DMessage, DMessageGenerator } from '~/common/stores/chat/chat.message';
import { create_FunctionCallResponse_ContentFragment, createTextContentFragment, DMessageFragment } from '~/common/stores/chat/chat.fragments';
import { createChatGenerateDispatch } from '~/modules/aix/server/dispatch/chatGenerate/chatGenerate.dispatch';
import type { AixAPI_Access, AixAPI_Model, AixAPIChatGenerate_Request, AixWire_Particles } from '~/modules/aix/server/api/aix.wiretypes';

import type { CompiledScenario } from './scenarios';
import type { LabFlavor, LabRun, LabSegment } from './trace';


// -- Step 1: reassemble turn 1 as the app would persist it --

export interface ReassembledTurn {
  fragments: DMessageFragment[];
  generator: DMessageGenerator;
}

export async function reassembleRun(run: LabRun): Promise<ReassembledTurn> {
  const rz = new ContentReassembler({ mgt: 'named', name: run.meta.modelId }, undefined, undefined, [], true);
  for (const particle of run.finalParticles)
    rz.enqueueWireParticle(particle);
  await rz.waitForWireComplete();
  const { fragments, generator } = rz.finalizeReassembly();
  return { fragments: [...fragments], generator };
}


// -- Step 2: rebuild turn 2 through the production client converter and adapter (build only) --

export interface NextTurn {
  model: AixAPI_Model;
  chatGenerate: AixAPIChatGenerate_Request;
  body: Record<string, unknown>;
}

export interface NextTurnOptions {
  stripReasoning?: boolean;
  /** answer every unanswered client tool call with a synthetic result, appended to the assistant message as the tool loop does */
  answerTools?: boolean;
  /** text appended to the system message on turn 2: a prefix edit (our system prompt carries the clock, so every hour is one) */
  systemEdit?: string;
}

/**
 * `access` and `compiled` are the TARGET of turn 2: pass another flavor's to replay across providers.
 * `followupText` null sends no user text after the assistant turn (a tool loop iteration: the tool results are the follow-up).
 */
export async function buildNextTurn(access: AixAPI_Access, compiled: CompiledScenario, turn1: ReassembledTurn, followupText: string | null, streaming: boolean, options?: NextTurnOptions): Promise<NextTurn> {

  // the assistant message the app would have stored, then the follow-up
  let fragments = options?.stripReasoning ? turn1.fragments.filter(f => !(f.ft === 'void' && f.part.pt === 'ma')) : turn1.fragments;
  if (options?.answerTools)
    fragments = [...fragments, ...syntheticToolResponses(fragments)];
  const assistant: DMessage = { ...createDMessageFromFragments('assistant', fragments), generator: turn1.generator };
  const history: DMessage[] = followupText === null ? [assistant] : [assistant, createDMessageFromFragments('user', [createTextContentFragment(followupText)])];

  // the converter the app uses. The hosted build also applies send-time block policies before it (dev only); for a
  // one-turn history they keep the last assistant turn's reasoning, so the chain skips them and runs on both branches
  const tail = await aixCGR_ChatSequence_FromDMessagesOrThrow(history);

  const systemMessage = options?.systemEdit
    ? { parts: [...(compiled.chatGenerate.systemMessage?.parts ?? []), { pt: 'text' as const, text: options.systemEdit }] }
    : compiled.chatGenerate.systemMessage;
  const chatGenerate: AixAPIChatGenerate_Request = {
    ...compiled.chatGenerate,
    systemMessage,
    chatSequence: [...compiled.chatGenerate.chatSequence, ...tail],
  };

  // cross-turn container reuse, as the app does it
  const model: AixAPI_Model = { ...compiled.model };
  const uc = turn1.generator.upstreamContainer;
  if (uc?.uct === 'vnd.ant.container')
    model.vndAntContainerId = uc.containerId;
  else if (uc?.uct === 'vnd.oai.container')
    model.vndOaiContainerId = uc.containerId;
  else if (uc?.uct === 'vnd.gem.interactions')
    model.vndGeminiEnvironmentId = uc.envId;

  const dispatch = await createChatGenerateDispatch(access, model, chatGenerate, streaming, undefined, false);
  if (!('body' in dispatch.request) || !dispatch.request.body || typeof dispatch.request.body !== 'object')
    throw new Error('chain: the dispatch carries no JSON body');
  return { model, chatGenerate, body: dispatch.request.body as Record<string, unknown> };
}


/** One canned result per client function call left unanswered in the turn, in the tool loop's shape (client environment). */
export function syntheticToolResponses(fragments: DMessageFragment[]): DMessageFragment[] {
  const answered = new Set<string>();
  for (const f of fragments)
    if (f.ft === 'content' && f.part.pt === 'tool_response')
      answered.add(f.part.id);
  const responses: DMessageFragment[] = [];
  for (const f of fragments) {
    if (f.ft !== 'content' || f.part.pt !== 'tool_invocation' || f.part.invocation.type !== 'function_call' || answered.has(f.part.id)) continue;
    responses.push(create_FunctionCallResponse_ContentFragment(f.part.id, false, f.part.invocation.name, JSON.stringify({ ok: true, source: 'protocol lab chain: synthetic tool result' }), 'client'));
  }
  return responses;
}

/** Cross-provider view: what the stored turn holds, by fragment kind, against what the target body carries, by block kind. */
export function emissionSummary(fragments: DMessageFragment[], replayed: unknown[]): { held: Record<string, number>; emitted: Record<string, number> } {
  const held: Record<string, number> = {};
  for (const f of fragments) {
    const k = 'part' in f ? f.part.pt : f.ft;
    held[k] = (held[k] ?? 0) + 1;
  }
  const emitted: Record<string, number> = {};
  for (const b of replayed) {
    const k = _kindOf(b);
    emitted[k] = (emitted[k] ?? 0) + 1;
  }
  return { held, emitted };
}


// -- Step 3: the vendor's canonical turn-1 content, from the raw bytes --

export interface CanonicalTurn {
  blocks: unknown[];
  /** how the blocks were obtained - streamed vendors have no single canonical form for split text, so we say so */
  source: 'ns-body' | 'sse-accumulated' | 'output_item.done' | 'gemini-aggregated' | 'unsupported';
}

function _segmentText(segment: LabSegment): string {
  return Buffer.concat((segment.rawChunks ?? []).map(c => Buffer.from(c.b64, 'base64'))).toString('utf8');
}

function* _sseEvents(text: string): Generator<{ event: string | undefined; data: any }> {
  for (const chunk of text.split(/\r?\n\r?\n/)) {
    const lines = chunk.split(/\r?\n/);
    const event = lines.find(l => l.startsWith('event:'))?.slice(6).trim();
    const dataLines = lines.filter(l => l.startsWith('data:')).map(l => l.slice(5).trim());
    if (!dataLines.length) continue;
    const data = dataLines.join('\n');
    if (data === '[DONE]') continue;
    try {
      yield { event, data: JSON.parse(data) };
    } catch {
      // non-JSON keepalives
    }
  }
}

/** Anthropic streaming: rebuild the content blocks the way the API documents the deltas (independent of our parser). */
function _accumulateAnthropic(text: string): unknown[] {
  const blocks: any[] = [];
  const partialJson = new Map<number, string>();
  for (const { event, data } of _sseEvents(text)) {
    switch (event) {
      case 'content_block_start':
        blocks[data.index] = structuredClone(data.content_block);
        if (typeof blocks[data.index]?.input === 'object')
          partialJson.set(data.index, '');
        break;
      case 'content_block_delta': {
        const block = blocks[data.index];
        const delta = data.delta;
        if (!block || !delta) break;
        switch (delta.type) {
          case 'text_delta': block.text = (block.text ?? '') + delta.text; break;
          case 'thinking_delta': block.thinking = (block.thinking ?? '') + delta.thinking; break;
          case 'signature_delta': block.signature = delta.signature; break;
          case 'input_json_delta': partialJson.set(data.index, (partialJson.get(data.index) ?? '') + delta.partial_json); break;
          case 'citations_delta': (block.citations ??= []).push(delta.citation); break;
        }
        break;
      }
      case 'content_block_stop': {
        // an input supplied whole at block start (PTC tool_use, nested server_tool_use) has no deltas: keep it
        const json = partialJson.get(data.index);
        if (json)
          blocks[data.index].input = JSON.parse(json);
        partialJson.delete(data.index);
        break;
      }
    }
  }
  return blocks.filter(b => b !== undefined);
}

/**
 * OpenAI Responses streaming: the items as each `response.output_item.done` delivered them, in output order. The
 * terminal `response.completed` carries the same items re-encrypted (measured 2026-09-24: every reasoning item's
 * encrypted_content differs between the two events, same id), so the per-item event is the form a client can replay.
 */
function _completedResponsesOutput(text: string): unknown[] {
  const done: { index: number; item: unknown }[] = [];
  let completed: unknown[] | undefined;
  for (const { data } of _sseEvents(text)) {
    if (data?.type === 'response.output_item.done' && data.item)
      done.push({ index: data.output_index ?? done.length, item: data.item });
    else if (data?.type === 'response.completed')
      completed = data.response?.output ?? [];
  }
  return done.length ? done.sort((a, b) => a.index - b.index).map(d => d.item) : completed ?? [];
}

/** Gemini streaming: parts arrive split across chunks; adjacent text parts of the same kind are joined. */
function _aggregateGeminiParts(text: string): unknown[] {
  const parts: any[] = [];
  for (const { data } of _sseEvents(text)) {
    for (const part of data?.candidates?.[0]?.content?.parts ?? []) {
      const last = parts[parts.length - 1];
      const joinable = last && typeof last.text === 'string' && typeof part.text === 'string' && !!last.thought === !!part.thought && !part.thoughtSignature;
      if (joinable) last.text += part.text;
      else parts.push(structuredClone(part));
    }
  }
  return parts;
}

export function canonicalTurn(run: LabRun): CanonicalTurn {
  const texts = run.segments.map(_segmentText);
  const flavor = run.meta.flavor;
  if (!run.meta.streaming) {
    // one JSON body per segment; a pause_turn continuation appends its content
    const bodies = texts.map(t => JSON.parse(t));
    switch (flavor) {
      case 'anthropic-messages': return { blocks: bodies.flatMap(b => b.content ?? []), source: 'ns-body' };
      case 'openai-responses':
      case 'metaai-responses': return { blocks: bodies.flatMap(b => b.output ?? []), source: 'ns-body' };
      case 'gemini-generate': return { blocks: bodies.flatMap(b => b.candidates?.[0]?.content?.parts ?? []), source: 'ns-body' };
      default: return { blocks: [], source: 'unsupported' };
    }
  }
  switch (flavor) {
    case 'anthropic-messages': return { blocks: texts.flatMap(_accumulateAnthropic), source: 'sse-accumulated' };
    case 'openai-responses':
    case 'metaai-responses': return { blocks: texts.flatMap(_completedResponsesOutput), source: 'output_item.done' };
    case 'gemini-generate': return { blocks: texts.flatMap(_aggregateGeminiParts), source: 'gemini-aggregated' };
    default: return { blocks: [], source: 'unsupported' };
  }
}


// -- Step 4: the assistant turn as the turn-2 body carries it --

const _isResponsesUser = (item: any) => item?.type === 'message' && item?.role === 'user';
/** Responses items that belong to the user side after the assistant turn: tool results and the follow-up */
const _isResponsesTail = (item: any) => _isResponsesUser(item) || item?.type === 'function_call_output';

export function replayedTurn(flavor: LabFlavor, body: Record<string, unknown>): unknown[] {
  switch (flavor) {
    case 'anthropic-messages': {
      // every assistant message after the first user turn; tool results and the follow-up are user messages and stay out
      const messages = (body.messages as any[]) ?? [];
      return messages.slice(1).filter(m => m.role === 'assistant').flatMap(m => typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content);
    }
    case 'openai-responses':
    case 'metaai-responses': {
      const input = body.input;
      if (!Array.isArray(input)) return [];
      const first = input.findIndex(_isResponsesUser);
      return first < 0 ? [] : input.slice(first + 1).filter(item => !_isResponsesTail(item));
    }
    case 'gemini-generate': {
      const contents = (body.contents as any[]) ?? [];
      return contents.filter(c => c.role === 'model').flatMap(c => c.parts ?? []);
    }
    case 'openai-chat': {
      const messages = (body.messages as any[]) ?? [];
      return messages.filter(m => m.role === 'assistant').flatMap(m => [
        ...(typeof m.content === 'string' && m.content ? [{ type: 'text', text: m.content }] : Array.isArray(m.content) ? m.content : []),
        ...(m.tool_calls ?? []).map((tc: any) => ({ type: 'tool_call', ...tc })),
      ]);
    }
    default:
      return [];
  }
}


/**
 * The turn-2 body with the vendor's canonical turn-1 content spliced in verbatim, in place of the rebuilt assistant
 * turn: what an exact snapshot replay would send, the upper bound the rebuilt turn is measured against.
 * Anthropic and Gemini keep the first user turn and the trailing follow-up only, so a client-tool scenario (tool_result
 * user message in between) is not replayed this way.
 */
export function verbatimBody(flavor: LabFlavor, body: Record<string, unknown>, canonical: unknown[]): Record<string, unknown> {
  switch (flavor) {
    case 'anthropic-messages': {
      // the first user turn, the canonical assistant turn, then every non-assistant message the rebuild produced (tool results, follow-up)
      const messages = (body.messages as any[]) ?? [];
      return { ...body, messages: [messages[0], { role: 'assistant', content: canonical }, ...messages.slice(1).filter(m => m.role !== 'assistant')] };
    }
    case 'openai-responses':
    case 'metaai-responses': {
      const input = body.input as any[];
      const first = input.findIndex(_isResponsesUser);
      return { ...body, input: [...input.slice(0, first + 1), ...canonical, ...input.slice(first + 1).filter(_isResponsesTail)] };
    }
    case 'gemini-generate': {
      const contents = (body.contents as any[]) ?? [];
      return { ...body, contents: [contents[0], { role: 'model', parts: canonical }, ...contents.slice(1).filter(c => c.role !== 'model')] };
    }
    default:
      throw new Error(`verbatim replay is not implemented for ${flavor}`);
  }
}


// -- Step 5: alignment and verdicts --

export interface FidelityRow {
  index: number;
  kind: string;
  verdict: 'exact' | 'changed' | 'dropped' | 'added';
  /** top-level fields that differ, for 'changed' */
  fields?: string[];
  note?: string;
}

export interface FidelityReport {
  rows: FidelityRow[];
  exact: number;
  changed: number;
  dropped: number;
  added: number;
  /** canonical index of the first non-exact block, -1 when the turn is byte-exact */
  firstDivergence: number;
  /** reasoning blocks at or after the first divergence: what preserved thinking would drop on Anthropic */
  reasoningAtRisk: number;
}

/**
 * canonical JSON: sorted keys; null, undefined and empty arrays dropped (Anthropic treats a stripped null as absent -
 * verified; OpenAI items carry `content: []` and `annotations: []` that a replay omits). A non-empty array that goes
 * missing still shows as a change.
 */
export function canon(v: any): any {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).filter(k => v[k] !== null && v[k] !== undefined && !(Array.isArray(v[k]) && !v[k].length)).sort().map(k => [k, canon(v[k])]));
  return v;
}

const _kindOf = (block: any): string => block?.type ?? (block?.thought ? 'thought' : typeof block?.text === 'string' ? 'text' : block?.functionCall ? 'functionCall' : block?.functionResponse ? 'functionResponse' : block?.executableCode ? 'executableCode' : block?.codeExecutionResult ? 'codeExecutionResult' : block?.toolCall ? 'toolCall' : block?.toolResponse ? 'toolResponse' : block?.inlineData ? 'inlineData' : 'part');

/** A stable identity for blocks that carry one: ids, call ids, signatures; text blocks have none and align by position. */
const _keyOf = (block: any): string | undefined => {
  const kind = _kindOf(block);
  const id = block?.id ?? block?.call_id ?? block?.tool_use_id;
  if (typeof id === 'string') return `${kind}:${id}`;
  if (typeof block?.signature === 'string') return `${kind}:sig:${block.signature.slice(0, 40)}`;
  if (typeof block?.encrypted_content === 'string') return `${kind}:enc:${block.encrypted_content.slice(0, 40)}`;
  if (typeof block?.thoughtSignature === 'string' && !block?.text) return `${kind}:tsig:${block.thoughtSignature.slice(0, 40)}`;
  return undefined;
};
const _isReasoning = (kind: string) => kind === 'thinking' || kind === 'redacted_thinking' || kind === 'reasoning' || kind === 'thought';

function _diffFields(a: any, b: any): string[] {
  const ca = canon(a) ?? {}, cb = canon(b) ?? {};
  const keys = new Set([...Object.keys(ca), ...Object.keys(cb)]);
  return [...keys].filter(k => JSON.stringify(ca[k]) !== JSON.stringify(cb[k])).sort();
}

function _sameKindAhead(blocks: unknown[], from: number, kind: string): boolean {
  for (let i = from; i < blocks.length; i++)
    if (_kindOf(blocks[i]) === kind) return true;
  return false;
}

export function compareTurns(canonical: unknown[], replayed: unknown[]): FidelityReport {
  const rows: FidelityRow[] = [];

  // anchors: blocks with an identity pair up by key wherever they sit; the rest align by position and kind between anchors
  const replayedByKey = new Map<string, number[]>();
  replayed.forEach((b, j) => { const k = _keyOf(b); if (k) replayedByKey.set(k, [...(replayedByKey.get(k) ?? []), j]); });
  const anchorOfC = new Map<number, number>(), anchorOfR = new Map<number, number>();
  canonical.forEach((b, i) => {
    const k = _keyOf(b);
    const j = k ? replayedByKey.get(k)?.find(x => !anchorOfR.has(x)) : undefined;
    if (j !== undefined) { anchorOfC.set(i, j); anchorOfR.set(j, i); }
  });

  const pair = (i: number, j: number) => {
    const c = canonical[i], r = replayed[j], kind = _kindOf(c);
    const fields = _diffFields(c, r);
    rows.push(fields.length ? { index: i, kind, verdict: 'changed', fields, note: _changeNote(c, r, fields) } : { index: i, kind, verdict: 'exact' });
  };
  let i = 0, j = 0;
  while (i < canonical.length || j < replayed.length) {
    const ci = anchorOfC.get(i), rj = anchorOfR.get(j);
    if (i < canonical.length && j < replayed.length && ci === j) { pair(i, j); i++; j++; continue; }
    if (i < canonical.length && ci !== undefined && ci > j) { rows.push({ index: i, kind: _kindOf(replayed[j]), verdict: 'added', note: _preview(replayed[j]) }); j++; continue; }
    if (j < replayed.length && rj !== undefined && rj > i) { rows.push({ index: i, kind: _kindOf(canonical[i]), verdict: 'dropped' }); i++; continue; }
    if (i < canonical.length && j < replayed.length && ci === undefined && rj === undefined) {
      const ck = _kindOf(canonical[i]);
      if (ck === _kindOf(replayed[j])) { pair(i, j); i++; j++; }
      else if (!_sameKindAhead(replayed, j, ck)) { rows.push({ index: i, kind: ck, verdict: 'dropped' }); i++; }
      else { rows.push({ index: i, kind: _kindOf(replayed[j]), verdict: 'added', note: _preview(replayed[j]) }); j++; }
      continue;
    }
    if (i < canonical.length && (j >= replayed.length || ci === undefined)) { rows.push({ index: i, kind: _kindOf(canonical[i]), verdict: 'dropped' }); i++; continue; }
    rows.push({ index: i, kind: _kindOf(replayed[j]), verdict: 'added', note: _preview(replayed[j]) }); j++;
  }
  // Gemini sends the thought signature on a trailing empty text part; our client folds it into the preceding text.
  // Gemini checks signatures by presence, so this is a structural move, not a validated loss: say so on the rows.
  for (const row of rows) {
    if (row.verdict !== 'dropped') continue;
    const dropped: any = canonical[row.index];
    const prev = rows.find(r => r.index === row.index - 1);
    if (dropped?.text === '' && dropped?.thoughtSignature && prev?.verdict === 'changed' && prev.fields?.length === 1 && prev.fields[0] === 'thoughtSignature') {
      row.verdict = 'exact';
      row.note = 'empty part; its thoughtSignature folded into the preceding text (structural, Gemini validates presence only)';
      prev.verdict = 'exact';
      prev.note = 'carries the thoughtSignature of the following empty part';
      delete prev.fields;
    }
  }
  const count = (v: FidelityRow['verdict']) => rows.filter(r => r.verdict === v).length;
  const firstBad = rows.find(r => r.verdict !== 'exact');
  const firstDivergence = firstBad ? firstBad.index : -1;
  const reasoningAtRisk = firstDivergence < 0 ? 0 : canonical.filter((b, idx) => idx >= firstDivergence && _isReasoning(_kindOf(b))).length;
  return { rows, exact: count('exact'), changed: count('changed'), dropped: count('dropped'), added: count('added'), firstDivergence, reasoningAtRisk };
}

function _preview(block: any): string {
  const s = typeof block?.text === 'string' ? block.text : typeof block?.thinking === 'string' ? block.thinking : JSON.stringify(canon(block));
  return JSON.stringify(s.length > 60 ? s.slice(0, 57) + '...' : s);
}

function _changeNote(c: any, r: any, fields: string[]): string {
  return fields.map(f => {
    const a = c?.[f], b = r?.[f];
    if (typeof a === 'string' || typeof b === 'string')
      return `${f}: ${typeof a === 'string' ? a.length : 'none'} -> ${typeof b === 'string' ? b.length : 'none'} chars`;
    if (Array.isArray(a) || Array.isArray(b))
      return `${f}: ${Array.isArray(a) ? a.length : 'none'} -> ${Array.isArray(b) ? b.length : 'none'} items`;
    return `${f}: ${a === undefined ? 'none' : 'set'} -> ${b === undefined ? 'none' : 'set'}`;
  }).join('; ');
}


// -- Step 6 (optional): what the vendor said when turn 2 went out live --

export interface LiveVerdict {
  ok: boolean;
  endReason?: string;
  error?: string;
  /** Anthropic: input_transformations surfaced by the parser as notices - empty means the prefix was accepted as generated */
  inputTransforms: string[];
  /** the request's input side; the reasoning differential must use the total, since two sends of one request hit the cache differently */
  inputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalInputTokens?: number;
}

export function liveVerdict(run: LabRun): LiveVerdict {
  const inputTransforms: string[] = [];
  let metrics: AixWire_Particles.CGSelectMetrics | undefined;
  // Anthropic reports every binding verdict on message_start (streaming) or the response body (NS), including the
  // 'allowed' kinds the parser does not turn into notices - read the wire, not the parser
  for (const segment of run.segments)
    for (const event of segment.events) {
      const data: any = event.data;
      const transforms: any[] | undefined = event.name === 'message_start' ? data?.message?.input_transformations : !event.name ? data?.input_transformations : undefined;
      for (const t of transforms ?? [])
        inputTransforms.push(`${t.type} at ${t.path} (${t.reason})`);
    }
  let issue: string | undefined;
  for (const particle of run.finalParticles) {
    if ('p' in particle && particle.p === 'vnt' && particle.nt === 'input-transform')
      inputTransforms.push(`parser notice: ${[particle.text, particle.detail].filter(Boolean).join(' - ')}`);
    else if ('cg' in particle && particle.cg === 'set-metrics')
      metrics = particle.metrics;
    else if ('cg' in particle && particle.cg === 'issue')
      issue ??= `${particle.issueId}: ${particle.issueText.replace(/\s+/g, ' ').slice(0, 400)}`;
  }
  // a refusal or a filter stop ends the dispatch cleanly: keep the token stop reason visible next to the end reason
  const stop = run.outcome.tokenStopReason && run.outcome.tokenStopReason !== 'ok' ? ` / ${run.outcome.tokenStopReason}` : '';
  return {
    ok: run.outcome.ok && !stop,
    endReason: `${run.outcome.endReason ?? 'unknown'}${stop}`,
    error: run.outcome.error ?? issue,
    inputTransforms,
    inputTokens: metrics?.TIn,
    cacheReadTokens: metrics?.TCacheRead,
    cacheWriteTokens: metrics?.TCacheWrite,
    totalInputTokens: metrics?.TIn === undefined ? undefined : metrics.TIn + (metrics.TCacheRead ?? 0) + (metrics.TCacheWrite ?? 0),
  };
}


// -- Rendering --

export function renderFidelityTerminal(flavor: LabFlavor, canonical: CanonicalTurn, report: FidelityReport): string {
  const lines: string[] = [];
  lines.push(`turn-1 canonical: ${canonical.blocks.length} blocks (${canonical.source})`);
  for (const row of report.rows) {
    const mark = row.verdict === 'exact' ? '=' : row.verdict === 'changed' ? '~' : row.verdict === 'dropped' ? '-' : '+';
    lines.push(`  ${mark} #${String(row.index).padStart(3)} ${row.kind.padEnd(28)} ${row.verdict.padEnd(8)}${row.fields ? ' ' + row.fields.join(',') : ''}${row.note ? '   ' + row.note : ''}`);
  }
  const verdict = report.firstDivergence < 0
    ? (report.rows.some(r => r.note) ? 'equivalent: structural moves only, noted above' : 'byte-exact: the vendor turn is replayed as generated')
    : `first divergence at #${report.firstDivergence}; ${report.reasoningAtRisk} reasoning block${report.reasoningAtRisk === 1 ? '' : 's'} at or after it${flavor === 'anthropic-messages' ? ' would be dropped by preserved thinking' : ''}`;
  lines.push(`fidelity: ${report.exact} exact, ${report.changed} changed, ${report.dropped} dropped, ${report.added} added - ${verdict}`);
  return lines.join('\n');
}

export function renderLiveTerminal(label: string, verdict: LiveVerdict): string {
  const parts = [`${label}: ${verdict.ok ? 'ok' : 'failed'}${verdict.endReason ? ` (${verdict.endReason})` : ''}${verdict.error ? ` error: ${verdict.error}` : ''}`];
  if (verdict.inputTokens !== undefined)
    parts.push(`  input ${verdict.totalInputTokens} tokens total (${verdict.inputTokens} fresh${verdict.cacheReadTokens !== undefined ? `, ${verdict.cacheReadTokens} cached` : ''}${verdict.cacheWriteTokens !== undefined ? `, ${verdict.cacheWriteTokens} written` : ''})`);
  parts.push(verdict.inputTransforms.length ? `  vendor input transforms:\n    ${verdict.inputTransforms.join('\n    ')}` : '  vendor input transforms: none');
  return parts.join('\n');
}
