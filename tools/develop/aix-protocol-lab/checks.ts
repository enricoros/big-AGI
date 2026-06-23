/**
 * AIX Protocol Lab - differential checks.
 *
 * Four independent perspectives on a captured run:
 *  1. Wire grammar: per-protocol lifecycle invariants computed from the wire events alone
 *     (an observer independent of the parser - cross-checks the parser's own console warnings).
 *  2. Event coverage: re-demux the raw bytes and compare with the events the pipeline actually
 *     parsed - surfaces dropped/skipped wire events (e.g. post-termination arrivals).
 *  3. Translation loss: wire-side content atoms vs particle-side representation - quantifies
 *     what the decode layer forwards, ellipsizes, or discards.
 *  4. Projection diff: folds particle streams into logical parts for run-vs-run comparison
 *     (streaming vs NS twin: structural; streaming vs oracle/replay: exact).
 */

import type { AixWire_Particles } from '~/modules/aix/server/api/aix.wiretypes';
import { AixDemuxers } from '~/modules/aix/server/dispatch/stream.demuxers';

import type { LabEvent, LabRun } from './trace';


// -- Findings --

export interface LabFinding {
  severity: 'error' | 'warn' | 'info';
  code: string;
  where?: string; // e.g. 'seg0 ev#12'
  text: string;
}

const _f = (severity: LabFinding['severity'], code: string, text: string, where?: string): LabFinding => ({ severity, code, text, ...(where ? { where } : {}) });


// -- 1. Wire grammar invariants --

export function checkWireGrammar(run: LabRun): LabFinding[] {
  if (!run.meta.streaming) return []; // NS bodies have no event grammar
  switch (run.meta.flavor) {
    case 'anthropic-messages':
      return run.segments.flatMap((seg, si) => _grammarAnthropic(seg.events, `seg${si}`));
    case 'openai-responses':
      return run.segments.flatMap((seg, si) => _grammarOpenAIResponses(seg.events, `seg${si}`));
    case 'openai-chat':
      return run.segments.flatMap((seg, si) => _grammarOpenAIChat(seg.events, `seg${si}`));
    case 'gemini-generate':
      return run.segments.flatMap((seg, si) => _grammarGeminiGenerate(seg.events, `seg${si}`));
    case 'gemini-interactions':
      return run.segments.flatMap((seg, si) => _grammarGeminiInteractions(seg.events, `seg${si}`));
  }
}

function _grammarAnthropic(events: LabEvent[], where: string): LabFinding[] {
  const findings: LabFinding[] = [];
  const open = new Set<number>();
  const occupied = new Set<number>();
  let started = false, ended = false;
  for (const ev of events) {
    const at = `${where} ev#${ev.i}`;
    const d = ev.data as any;
    if (ended && ev.name !== 'ping')
      findings.push(_f('error', 'ant-event-after-stop', `'${ev.name}' after message_stop`, at));
    switch (ev.name) {
      case 'ping':
        break;
      case 'message_start':
        if (started) findings.push(_f('error', 'ant-double-start', 'second message_start', at));
        started = true;
        break;
      case 'content_block_start': {
        const index = d?.index;
        if (!started) findings.push(_f('error', 'ant-orphan-block', 'content_block_start before message_start', at));
        if (occupied.has(index)) findings.push(_f('error', 'ant-index-reuse', `content_block_start on occupied index ${index} (block type '${d?.content_block?.type}')`, at));
        open.add(index);
        occupied.add(index);
        break;
      }
      case 'content_block_delta':
        if (!open.has(d?.index)) findings.push(_f('error', 'ant-delta-unopened', `delta '${d?.delta?.type}' on unopened index ${d?.index}`, at));
        break;
      case 'content_block_stop':
        if (!open.has(d?.index)) findings.push(_f('error', 'ant-stop-unopened', `stop on unopened index ${d?.index}`, at));
        open.delete(d?.index);
        break;
      case 'message_delta':
        if (!started) findings.push(_f('error', 'ant-orphan-delta', 'message_delta before message_start', at));
        break;
      case 'message_stop':
        ended = true;
        if (open.size) findings.push(_f('error', 'ant-unclosed-blocks', `message_stop with open block indices: ${[...open].join(', ')}`, at));
        break;
      case 'error':
        findings.push(_f('info', 'ant-wire-error', `wire error event: ${JSON.stringify(d?.error)}`, at));
        break;
      default:
        findings.push(_f('warn', 'ant-unknown-event', `unknown event name '${ev.name}'`, at));
    }
  }
  if (started && !ended)
    findings.push(_f('warn', 'ant-no-stop', 'stream ended without message_stop (truncation or continuation segment)', where));
  return findings;
}

function _grammarOpenAIResponses(events: LabEvent[], where: string): LabFinding[] {
  const findings: LabFinding[] = [];
  let expectedSeq: number | null = null;
  let sealed = false;
  let lastActiveOutputIndex: number | null = null;
  const items = new Map<number, { type: string; id?: string; done: boolean }>();
  for (const ev of events) {
    const at = `${where} ev#${ev.i}`;
    const d = ev.data as any;
    const type: string = d?.type ?? '(untyped)';

    // total order: sequence_number must be contiguous
    if (typeof d?.sequence_number === 'number') {
      if (expectedSeq !== null && d.sequence_number !== expectedSeq)
        findings.push(_f('error', 'oai-seq-gap', `sequence_number ${d.sequence_number}, expected ${expectedSeq} (type ${type})`, at));
      expectedSeq = d.sequence_number + 1;
    }

    if (sealed && !['error'].includes(type))
      findings.push(_f('error', 'oai-event-after-seal', `'${type}' after response sealed`, at));

    if (type === 'response.output_item.added') {
      if (items.has(d.output_index))
        findings.push(_f('error', 'oai-item-reuse', `output_index ${d.output_index} re-added (was '${items.get(d.output_index)?.type}', now '${d.item?.type}')`, at));
      items.set(d.output_index, { type: d.item?.type, id: d.item?.id, done: false });
      lastActiveOutputIndex = d.output_index;
    } else if (type === 'response.output_item.done') {
      const item = items.get(d.output_index);
      if (!item) findings.push(_f('error', 'oai-done-unknown', `output_item.done for unknown output_index ${d.output_index}`, at));
      else item.done = true;
    } else if (typeof d?.output_index === 'number') {
      // any per-item event: detect cross-item interleaving (the empirical out-of-order question)
      const item = items.get(d.output_index);
      if (!item)
        findings.push(_f('error', 'oai-event-before-added', `'${type}' targets output_index ${d.output_index} before output_item.added`, at));
      else if (item.done)
        findings.push(_f('warn', 'oai-event-after-done', `'${type}' targets output_index ${d.output_index} after its output_item.done`, at));
      if (lastActiveOutputIndex !== null && d.output_index !== lastActiveOutputIndex && item && !item.done && items.get(lastActiveOutputIndex) && !items.get(lastActiveOutputIndex)!.done)
        findings.push(_f('info', 'oai-interleaved', `'${type}' on output_index ${d.output_index} while output_index ${lastActiveOutputIndex} is still open - cross-item interleaving observed`, at));
      if (item && !item.done) lastActiveOutputIndex = d.output_index;
    }

    if (['response.completed', 'response.failed', 'response.incomplete'].includes(type))
      sealed = true;
  }
  const undone = [...items.entries()].filter(([, v]) => !v.done);
  if (undone.length)
    findings.push(_f('warn', 'oai-items-unclosed', `items never done: ${undone.map(([k, v]) => `#${k}(${v.type})`).join(', ')}`, where));
  if (!sealed && events.length)
    findings.push(_f('warn', 'oai-not-sealed', 'stream ended without response.completed/failed/incomplete', where));
  return findings;
}

function _grammarOpenAIChat(events: LabEvent[], where: string): LabFinding[] {
  const findings: LabFinding[] = [];
  let finishCount = 0;
  for (const ev of events) {
    const d = ev.data as any;
    if (!d || typeof d !== 'object')
      findings.push(_f('error', 'cc-bad-json', 'chunk is not a JSON object', `${where} ev#${ev.i}`));
    else if (d.choices?.[0]?.finish_reason)
      finishCount++;
  }
  if (finishCount > 1)
    findings.push(_f('warn', 'cc-multi-finish', `${finishCount} chunks carried finish_reason`, where));
  return findings;
}

function _grammarGeminiGenerate(events: LabEvent[], where: string): LabFinding[] {
  const findings: LabFinding[] = [];
  let finishCount = 0, lastHadFinish = false;
  for (const ev of events) {
    const d = ev.data as any;
    if (!d || typeof d !== 'object') {
      findings.push(_f('error', 'gem-bad-json', 'chunk is not a JSON object', `${where} ev#${ev.i}`));
      continue;
    }
    lastHadFinish = !!d.candidates?.[0]?.finishReason;
    if (lastHadFinish) finishCount++;
  }
  if (events.length && !lastHadFinish)
    findings.push(_f('warn', 'gem-no-final-finish', 'last chunk has no finishReason', where));
  if (finishCount > 1)
    findings.push(_f('info', 'gem-multi-finish', `${finishCount} chunks carried finishReason (tool loops do this legitimately)`, where));
  return findings;
}

function _grammarGeminiInteractions(events: LabEvent[], where: string): LabFinding[] {
  // the grammar is young and still shifting upstream: report the shape rather than asserting it
  const findings: LabFinding[] = [];
  const histogram = new Map<string, number>();
  for (const ev of events) {
    const type = (ev.data as any)?.event_type ?? ev.name ?? '(unnamed)';
    histogram.set(type, (histogram.get(type) ?? 0) + 1);
  }
  findings.push(_f('info', 'gemint-event-histogram', [...histogram.entries()].map(([k, v]) => `${k}:${v}`).join(' '), where));
  return findings;
}


// -- 1b. Deep OpenAI Responses sequencing analysis --
//
// The triple-check for the out-of-order question, fully algorithmic, using the protocol's own
// redundancy as oracles:
//  a. sequence_number must form a strict +1 chain (total order)
//  b. item lifecycle per output_index AND item id; every cross-item activity switch is recorded
//  c. every `.delta` family has a `.done` event carrying the CANONICAL aggregate - the
//     concatenation of deltas must equal it exactly (text, function args, code, reasoning summaries)
//  d. `response.completed` carries the full final output[] - the in-stream oracle: item order,
//     types, ids and contents accumulated from the stream must reproduce it

interface _OaiItemAcc {
  id?: string;
  callId?: string;
  type: string;
  addedAtEvent: number;
  doneAtEvent?: number;
  doneItem?: any;
  textDelta: string;
  textDone?: string;
  argsDelta: string;
  argsDone?: string;
  codeDelta: string;
  codeDone?: string;
  summaries: Map<number, { delta: string; done?: string }>;
}

export function analyzeOaiSequencing(run: LabRun): LabFinding[] {
  if (run.meta.flavor !== 'openai-responses' || !run.meta.streaming) return [];
  const findings: LabFinding[] = [];

  run.segments.forEach((seg, si) => {
    const where = `seg${si}`;
    const datas = seg.events.map(e => e.data as any);

    // a. sequence_number strict chain
    let firstSeq: number | null = null, lastSeq: number | null = null, numbered = 0, seqIssues = 0;
    datas.forEach((d, i) => {
      const s = d?.sequence_number;
      if (typeof s !== 'number') return;
      numbered++;
      if (firstSeq === null) firstSeq = s;
      if (lastSeq !== null && s !== lastSeq + 1) {
        findings.push(_f('error', 'oai-deep-seq', `event #${i} ('${d?.type}'): sequence_number ${s} after ${lastSeq} (${s <= lastSeq ? 'REGRESSION/DUPLICATE' : `gap of ${s - lastSeq - 1}`})`, where));
        seqIssues++;
      }
      lastSeq = s;
    });
    if (!seqIssues && numbered)
      findings.push(_f('info', 'oai-deep-seq-ok', `sequence_number strictly contiguous: ${firstSeq}..${lastSeq} over ${numbered} events`, where));

    // b. item registry, lifecycle, and cross-item activity switches
    const items = new Map<number, _OaiItemAcc>();
    let activeIndex: number | null = null;
    const switches: string[] = [];
    const trackActivity = (eventIndex: number, type: string, oi: number) => {
      if (activeIndex !== null && oi !== activeIndex && items.get(activeIndex) && items.get(activeIndex)!.doneAtEvent === undefined)
        switches.push(`#${eventIndex} '${type}' -> item ${oi} while item ${activeIndex} (${items.get(activeIndex)!.type}) still open`);
      activeIndex = oi;
    };

    datas.forEach((d, i) => {
      const t: string | undefined = d?.type;
      const oi: number | undefined = d?.output_index;
      if (!t || typeof oi !== 'number') return;

      if (t === 'response.output_item.added') {
        trackActivity(i, t, oi);
        items.set(oi, {
          id: d.item?.id, callId: d.item?.call_id, type: d.item?.type ?? '?', addedAtEvent: i,
          textDelta: '', argsDelta: '', codeDelta: '', summaries: new Map(),
        });
        return;
      }
      const item = items.get(oi);
      if (!item) {
        findings.push(_f('error', 'oai-deep-orphan', `event #${i} '${t}' targets output_index ${oi} never added`, where));
        return;
      }
      trackActivity(i, t, oi);
      switch (t) {
        case 'response.output_item.done':
          item.doneAtEvent = i;
          item.doneItem = d.item;
          if (d.item?.id && item.id && d.item.id !== item.id)
            findings.push(_f('error', 'oai-deep-id-flip', `output_index ${oi}: item id changed ${item.id} -> ${d.item.id}`, where));
          break;
        case 'response.output_text.delta':
          item.textDelta += d.delta ?? '';
          break;
        case 'response.output_text.done':
          item.textDone = (item.textDone ?? '') + (d.text ?? ''); // concat across content parts
          break;
        case 'response.function_call_arguments.delta':
          item.argsDelta += d.delta ?? '';
          break;
        case 'response.function_call_arguments.done':
          item.argsDone = d.arguments ?? '';
          break;
        case 'response.code_interpreter_call_code.delta':
          item.codeDelta += d.delta ?? '';
          break;
        case 'response.code_interpreter_call_code.done':
          item.codeDone = d.code ?? '';
          break;
        case 'response.reasoning_summary_text.delta': {
          const s = item.summaries.get(d.summary_index) ?? { delta: '' };
          s.delta += d.delta ?? '';
          item.summaries.set(d.summary_index, s);
          break;
        }
        case 'response.reasoning_summary_text.done': {
          const s = item.summaries.get(d.summary_index) ?? { delta: '' };
          s.done = d.text ?? '';
          item.summaries.set(d.summary_index, s);
          break;
        }
      }
    });

    if (switches.length)
      findings.push(_f('warn', 'oai-deep-interleave', `${switches.length} cross-item activity switch(es) while another item was open:\n  ` + switches.slice(0, 8).join('\n  '), where));
    else if (items.size > 1)
      findings.push(_f('info', 'oai-deep-serial-ok', `${items.size} items, zero cross-item interleaving: every item fully closed before the next opened`, where));

    // c. delta-concat vs .done canonical aggregates
    let aggChecks = 0, aggFails = 0;
    for (const [oi, item] of items) {
      const cmp = (label: string, delta: string, done: string | undefined) => {
        if (done === undefined) return;
        aggChecks++;
        if (delta !== done) {
          aggFails++;
          findings.push(_f('error', 'oai-deep-agg', `item ${oi} (${item.type}) ${label}: delta-concat ${delta.length} chars != .done aggregate ${done.length} chars`, where));
        }
      };
      cmp('text', item.textDelta, item.textDone);
      cmp('arguments', item.argsDelta, item.argsDone);
      cmp('code', item.codeDelta, item.codeDone);
      for (const [sIdx, s] of item.summaries)
        cmp(`summary[${sIdx}]`, s.delta, s.done);
    }
    if (aggChecks && !aggFails)
      findings.push(_f('info', 'oai-deep-agg-ok', `${aggChecks} delta-stream(s) reproduce their .done canonical aggregates exactly`, where));

    // d. stream accumulation vs the response.completed output[] (the in-stream oracle)
    const completed = datas.find(d => d?.type === 'response.completed')?.response;
    if (completed?.output && Array.isArray(completed.output)) {
      const sortedIndices = [...items.keys()].sort((a, b) => a - b);
      if (completed.output.length !== sortedIndices.length)
        findings.push(_f('error', 'oai-deep-final-count', `response.completed has ${completed.output.length} output items, stream produced ${sortedIndices.length}`, where));
      let finalChecks = 0, finalFails = 0;
      completed.output.forEach((finalItem: any, k: number) => {
        const item = items.get(sortedIndices[k]);
        if (!item) return;
        const fail = (what: string) => {
          finalFails++;
          findings.push(_f('error', 'oai-deep-final', `final output[${k}] (${finalItem?.type}) ${what}`, where));
        };
        finalChecks++;
        if (finalItem?.type !== item.type) fail(`type mismatch: stream had '${item.type}'`);
        if (finalItem?.id && item.id && finalItem.id !== item.id) fail(`id mismatch: stream had '${item.id}'`);
        switch (finalItem?.type) {
          case 'message': {
            const finalText = (finalItem.content ?? []).map((p: any) => p?.text ?? '').join('');
            if (finalText !== item.textDelta) fail(`text: final ${finalText.length} chars vs stream-accumulated ${item.textDelta.length}`);
            break;
          }
          case 'function_call':
            if ((finalItem.arguments ?? '') !== item.argsDelta) fail(`arguments: final ${(finalItem.arguments ?? '').length} chars vs stream ${item.argsDelta.length}`);
            if (finalItem.call_id && item.callId && finalItem.call_id !== item.callId) fail(`call_id mismatch`);
            break;
          case 'reasoning': {
            const finalSummary = (finalItem.summary ?? []).map((s: any) => s?.text ?? '').join('');
            const streamSummary = [...item.summaries.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s.delta).join('');
            if (finalSummary !== streamSummary) fail(`summary: final ${finalSummary.length} chars vs stream ${streamSummary.length}`);
            break;
          }
          case 'code_interpreter_call':
            if ((finalItem.code ?? '') !== item.codeDelta && item.codeDelta) fail(`code: final ${(finalItem.code ?? '').length} chars vs stream ${item.codeDelta.length}`);
            break;
        }
      });
      if (finalChecks && !finalFails)
        findings.push(_f('info', 'oai-deep-final-ok', `stream accumulation reproduces response.completed.output exactly (${finalChecks} items: order, types, ids, contents)`, where));
    }
  });

  return findings;
}


// -- 2. Event coverage: independent re-demux of the raw bytes vs events the pipeline parsed --

export function checkEventCoverage(run: LabRun): LabFinding[] {
  const findings: LabFinding[] = [];
  if (!run.meta.streaming || !run.meta.demuxerFormat) return findings;

  run.segments.forEach((segment, si) => {
    if (!segment.rawChunks?.length) return;
    const demuxer = AixDemuxers.createStreamDemuxer(run.meta.demuxerFormat!);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const wireEvents: { name?: string; data: string }[] = [];
    for (const chunk of segment.rawChunks)
      for (const item of demuxer.demux(decoder.decode(Buffer.from(chunk.b64, 'base64'), { stream: true })))
        if (item.type === 'event') wireEvents.push({ name: item.name, data: item.data });
    for (const item of demuxer.flushRemaining())
      if (item.type === 'event') wireEvents.push({ name: item.name, data: item.data });

    const parsed = segment.events;
    if (wireEvents.length === parsed.length) return;

    // find which wire events never reached the parser (executor-level drops: '[DONE]', post-termination)
    let pi = 0;
    const dropped: string[] = [];
    for (const we of wireEvents) {
      if (pi < parsed.length && parsed[pi].size === we.data.length && (parsed[pi].name ?? undefined) === (we.name ?? undefined))
        pi++;
      else
        dropped.push(we.data === '[DONE]' ? '[DONE]' : `${we.name ?? (() => {
          try {
            return JSON.parse(we.data)?.type;
          } catch {
            return undefined;
          }
        })() ?? 'event'}(${we.data.length}ch)`);
    }
    const benign = dropped.every(d => d === '[DONE]');
    findings.push(_f(benign ? 'info' : 'warn', 'coverage-dropped', `seg${si}: ${wireEvents.length} wire events, ${parsed.length} parsed - not parsed: ${dropped.slice(0, 12).join(', ')}${dropped.length > 12 ? ` (+${dropped.length - 12} more)` : ''}`, `seg${si}`));
  });
  return findings;
}


// -- 3. Translation loss: wire atoms vs particle representation --

export interface LossRow {
  category: string;
  wire: string; // human summary of what the wire carried
  particles: string; // human summary of what the particles carry
  verdict: 'full' | 'partial' | 'dropped' | 'extra' | 'n/a';
  note?: string;
}

interface _WireAtoms {
  textChars: number;
  reasoningChars: number;
  reasoningSigs: number;
  redactedParcels: number;
  fnCalls: Map<string, { name: string; argChars: number }>;
  serverTools: Map<string, { name: string; inputChars: number }>;
  toolResults: Map<string, { type: string; payloadChars: number }>;
  citations: number;
  images: number;
}

const _newAtoms = (): _WireAtoms => ({ textChars: 0, reasoningChars: 0, reasoningSigs: 0, redactedParcels: 0, fnCalls: new Map(), serverTools: new Map(), toolResults: new Map(), citations: 0, images: 0 });

/**
 * Char count of an Anthropic tool `input` entering the accumulator: empty `{}` -> 0 (args stream via
 * input_json_delta), pre-populated object (PTC) -> its JSON string length, string -> as-is. (Counting
 * `{}` as the literal "{}" was the lab's own 2-char-per-tool over-count, false-flagging full streams.)
 * INTENTIONALLY re-derives the parser's rule (`_antStreamingToolInputToString`) rather than importing
 * it: the wire side is a differential oracle, so independence is what catches a future divergence.
 */
function _antInputChars(input: unknown): number {
  if (typeof input === 'object' && input !== null)
    return Object.keys(input).length === 0 ? 0 : JSON.stringify(input).length;
  return String(input ?? '').length;
}

function _wireAtoms(run: LabRun): _WireAtoms | null {
  const atoms = _newAtoms();
  const events = run.segments.flatMap(s => s.events);
  switch (run.meta.flavor) {

    case 'anthropic-messages': {
      const blockTypes = new Map<number, { type: string; id?: string }>();
      const addBlock = (block: any, index: number) => {
        blockTypes.set(index, { type: block?.type, id: block?.id ?? block?.tool_use_id });
        switch (block?.type) {
          case 'text':
            atoms.textChars += block.text?.length ?? 0;
            for (const _c of block.citations ?? []) atoms.citations++;
            break;
          case 'thinking':
            atoms.reasoningChars += block.thinking?.length ?? 0;
            if (block.signature) atoms.reasoningSigs++;
            break;
          case 'redacted_thinking':
            atoms.redactedParcels++;
            break;
          case 'tool_use':
            atoms.fnCalls.set(block.id, { name: block.name, argChars: _antInputChars(block.input) });
            break;
          case 'server_tool_use':
            atoms.serverTools.set(block.id, { name: block.name, inputChars: _antInputChars(block.input) });
            break;
          default:
            if (typeof block?.type === 'string' && block.type.endsWith('_tool_result'))
              atoms.toolResults.set(block.tool_use_id ?? `idx${index}`, { type: block.type, payloadChars: JSON.stringify(block.content ?? null).length });
        }
      };
      if (!run.meta.streaming) {
        const body = events[0]?.data as any;
        (body?.content ?? []).forEach((block: any, i: number) => addBlock(block, i));
      } else for (const ev of events) {
        const d = ev.data as any;
        switch (ev.name) {
          case 'content_block_start':
            addBlock(d?.content_block, d?.index);
            break;
          case 'content_block_delta': {
            const delta = d?.delta;
            const block = blockTypes.get(d?.index);
            if (delta?.type === 'text_delta') atoms.textChars += delta.text?.length ?? 0;
            else if (delta?.type === 'thinking_delta') atoms.reasoningChars += delta.thinking?.length ?? 0;
            else if (delta?.type === 'signature_delta') atoms.reasoningSigs++;
            else if (delta?.type === 'citations_delta') atoms.citations++;
            else if (delta?.type === 'input_json_delta') {
              const chars = delta.partial_json?.length ?? 0;
              if (block?.type === 'tool_use' && block.id) atoms.fnCalls.get(block.id)!.argChars += chars;
              else if (block?.type === 'server_tool_use' && block.id) atoms.serverTools.get(block.id)!.inputChars += chars;
            }
            break;
          }
        }
      }
      return atoms;
    }

    case 'openai-responses': {
      const itemsByIndex = new Map<number, { type: string; id?: string }>();
      const addFullItem = (item: any, index: number) => {
        itemsByIndex.set(index, { type: item?.type, id: item?.id });
        switch (item?.type) {
          case 'message':
            for (const part of item.content ?? []) {
              atoms.textChars += part?.text?.length ?? 0;
              atoms.citations += (part?.annotations ?? []).length;
            }
            break;
          case 'reasoning':
            for (const s of item.summary ?? []) atoms.reasoningChars += s?.text?.length ?? 0;
            if (item.encrypted_content) atoms.reasoningSigs++;
            break;
          case 'function_call':
            atoms.fnCalls.set(item.call_id ?? item.id, { name: item.name, argChars: (item.arguments ?? '').length });
            break;
          case 'web_search_call':
          case 'code_interpreter_call':
          case 'image_generation_call':
            atoms.serverTools.set(item.id ?? `idx${index}`, { name: item.type, inputChars: JSON.stringify(item.action ?? item.code ?? null).length });
            if (item.type === 'code_interpreter_call' && item.outputs)
              atoms.toolResults.set(item.id ?? `idx${index}`, { type: 'code_interpreter_outputs', payloadChars: JSON.stringify(item.outputs).length });
            if (item.type === 'image_generation_call' && item.result) atoms.images++;
            break;
        }
      };
      if (!run.meta.streaming) {
        const body = events[0]?.data as any;
        const response = body?.response ?? body;
        (response?.output ?? []).forEach((item: any, i: number) => addFullItem(item, i));
      } else for (const ev of events) {
        const d = ev.data as any;
        switch (d?.type) {
          case 'response.output_text.delta':
            atoms.textChars += d.delta?.length ?? 0;
            break;
          case 'response.reasoning_summary_text.delta':
            atoms.reasoningChars += d.delta?.length ?? 0;
            break;
          case 'response.function_call_arguments.delta': {
            const item = itemsByIndex.get(d.output_index);
            const entry = item?.id && atoms.fnCalls.get(item.id);
            if (entry) entry.argChars += d.delta?.length ?? 0;
            break;
          }
          case 'response.code_interpreter_call_code.delta': {
            const item = itemsByIndex.get(d.output_index);
            const entry = item?.id && atoms.serverTools.get(item.id);
            if (entry) entry.inputChars += d.delta?.length ?? 0;
            break;
          }
          case 'response.output_text.annotation.added':
            atoms.citations++;
            break;
          case 'response.output_item.added': {
            const item = d.item;
            itemsByIndex.set(d.output_index, { type: item?.type, id: item?.call_id ?? item?.id });
            if (item?.type === 'function_call') atoms.fnCalls.set(item.call_id ?? item.id, { name: item.name, argChars: (item.arguments ?? '').length });
            if (['web_search_call', 'code_interpreter_call', 'image_generation_call'].includes(item?.type)) atoms.serverTools.set(item.id, { name: item.type, inputChars: 0 });
            break;
          }
          case 'response.output_item.done':
            if (d.item?.type === 'reasoning' && d.item.encrypted_content) atoms.reasoningSigs++;
            if (d.item?.type === 'web_search_call' && d.item.action)
              atoms.serverTools.get(d.item.id) && (atoms.serverTools.get(d.item.id)!.inputChars = JSON.stringify(d.item.action).length);
            if (d.item?.type === 'code_interpreter_call' && d.item.outputs)
              atoms.toolResults.set(d.item.id, { type: 'code_interpreter_outputs', payloadChars: JSON.stringify(d.item.outputs).length });
            if (d.item?.type === 'image_generation_call' && d.item.result) atoms.images++;
            break;
        }
      }
      return atoms;
    }

    case 'openai-chat': {
      if (!run.meta.streaming) {
        const body = events[0]?.data as any;
        const message = body?.choices?.[0]?.message;
        atoms.textChars += message?.content?.length ?? 0;
        for (const tc of message?.tool_calls ?? [])
          atoms.fnCalls.set(tc.id, { name: tc.function?.name, argChars: (tc.function?.arguments ?? '').length });
      } else for (const ev of events) {
        const delta = (ev.data as any)?.choices?.[0]?.delta;
        atoms.textChars += delta?.content?.length ?? 0;
        atoms.reasoningChars += delta?.reasoning_content?.length ?? 0;
        for (const tc of delta?.tool_calls ?? []) {
          if (tc.id && tc.function?.name) atoms.fnCalls.set(tc.id, { name: tc.function.name, argChars: 0 });
          const last = [...atoms.fnCalls.values()].pop();
          if (last && tc.function?.arguments) last.argChars += tc.function.arguments.length;
        }
      }
      return atoms;
    }

    case 'gemini-generate': {
      const walk = (data: any) => {
        for (const part of data?.candidates?.[0]?.content?.parts ?? []) {
          if (typeof part.text === 'string') {
            if (part.thought) atoms.reasoningChars += part.text.length;
            else atoms.textChars += part.text.length;
          }
          if (part.thoughtSignature) atoms.reasoningSigs++;
          if (part.functionCall) {
            const key = `fc${atoms.fnCalls.size}`;
            atoms.fnCalls.set(key, { name: part.functionCall.name, argChars: JSON.stringify(part.functionCall.args ?? {}).length });
          }
          if (part.executableCode) atoms.serverTools.set(`code${atoms.serverTools.size}`, { name: 'executableCode', inputChars: (part.executableCode.code ?? '').length });
          if (part.codeExecutionResult) atoms.toolResults.set(`cer${atoms.toolResults.size}`, { type: 'codeExecutionResult', payloadChars: (part.codeExecutionResult.output ?? '').length });
          if (part.inlineData) atoms.images++;
        }
        const gm = data?.candidates?.[0]?.groundingMetadata;
        if (gm?.groundingChunks) atoms.citations += gm.groundingChunks.length;
        const um = data?.candidates?.[0]?.urlContextMetadata?.urlMetadata;
        if (Array.isArray(um)) atoms.citations += um.length;
      };
      for (const ev of events) walk(ev.data);
      return atoms;
    }

    case 'gemini-interactions':
      return null; // step grammar still moving; ledger + histogram cover it for now
  }
}

function _particleAtoms(particles: AixWire_Particles.ChatGenerateOp[]): _WireAtoms & { opTexts: number } {
  const atoms = { ..._newAtoms(), opTexts: 0 };
  let lastFc: { name: string; argChars: number } | null = null;
  for (const p of particles) {
    if ('t' in p) {
      atoms.textChars += p.t.length;
    } else if ('p' in p) {
      switch (p.p) {
        case 'tr_':
          atoms.reasoningChars += p._t.length;
          break;
        case 'trs':
          atoms.reasoningSigs++;
          break;
        case 'trr_':
          atoms.redactedParcels++;
          break;
        case 'fci':
          lastFc = { name: p.name, argChars: (p.i_args ?? '').length };
          atoms.fnCalls.set(p.id, lastFc);
          break;
        case '_fci':
          if (lastFc) lastFc.argChars += p._args.length;
          break;
        case 'cei':
          atoms.serverTools.set(p.id, { name: 'code_execution', inputChars: p.code.length });
          break;
        case 'cer':
          atoms.toolResults.set(p.id, { type: 'code_execution_result', payloadChars: p.result.length });
          break;
        case 'vp':
          atoms.opTexts += (p.iTexts ?? []).join('').length + (p.oTexts ?? []).join('').length;
          break;
        case 'urlc':
          atoms.citations++;
          break;
        case 'ii':
          atoms.images++;
          break;
        case 'svs':
          // opaque continuity blobs ARE the signature representation for some vendors
          if ((p.vendor === 'gemini' && (p.state as any)?.thoughtSignature)
            || ((p.vendor === 'openai' || p.vendor === 'xai') && (p.state as any)?.reasoningItem?.encryptedContent))
            atoms.reasoningSigs++;
          break;
      }
    }
  }
  return atoms;
}

export function checkTranslationLoss(run: LabRun): LossRow[] {
  const wire = _wireAtoms(run);
  if (!wire) return [{ category: 'all', wire: 'n/a', particles: 'n/a', verdict: 'n/a', note: `no wire extractor for ${run.meta.flavor} yet` }];
  const part = _particleAtoms(run.finalParticles);
  const rows: LossRow[] = [];

  const charRow = (category: string, w: number, p: number, note?: string) => {
    if (!w && !p) return;
    const verdict: LossRow['verdict'] = !w ? 'extra' : !p ? 'dropped' : p >= w ? 'full' : p >= w * 0.95 ? 'full' : 'partial';
    rows.push({ category, wire: `${w.toLocaleString()} chars`, particles: `${p.toLocaleString()} chars`, verdict, ...(note ? { note } : {}) });
  };

  charRow('text', wire.textChars, part.textChars, part.textChars > wire.textChars ? 'particles exceed wire: separator/spacer injection' : undefined);
  charRow('reasoning', wire.reasoningChars, part.reasoningChars);
  if (wire.reasoningSigs || part.reasoningSigs)
    rows.push({ category: 'reasoning signatures', wire: String(wire.reasoningSigs), particles: String(part.reasoningSigs), verdict: part.reasoningSigs >= wire.reasoningSigs ? 'full' : 'partial' });
  if (wire.redactedParcels || part.redactedParcels)
    rows.push({ category: 'redacted reasoning', wire: String(wire.redactedParcels), particles: String(part.redactedParcels), verdict: part.redactedParcels >= wire.redactedParcels ? 'full' : 'partial' });

  const wireFnChars = [...wire.fnCalls.values()].reduce((a, v) => a + v.argChars, 0);
  const partFnChars = [...part.fnCalls.values()].reduce((a, v) => a + v.argChars, 0);
  if (wire.fnCalls.size || part.fnCalls.size)
    rows.push({
      category: 'function calls (client tools)',
      wire: `${wire.fnCalls.size} calls, ${wireFnChars.toLocaleString()} arg chars`,
      particles: `${part.fnCalls.size} calls, ${partFnChars.toLocaleString()} arg chars`,
      verdict: part.fnCalls.size >= wire.fnCalls.size && partFnChars >= wireFnChars * 0.95 ? 'full' : part.fnCalls.size ? 'partial' : 'dropped',
    });

  const wireSrvChars = [...wire.serverTools.values()].reduce((a, v) => a + v.inputChars, 0);
  const partSrvChars = [...part.serverTools.values()].reduce((a, v) => a + v.inputChars, 0);
  if (wire.serverTools.size || part.serverTools.size)
    rows.push({
      category: 'server tool inputs (code/search/fetch)',
      wire: `${wire.serverTools.size} invocations, ${wireSrvChars.toLocaleString()} input chars`,
      particles: `${part.serverTools.size} structured (cei) + op iTexts/oTexts ${part.opTexts.toLocaleString()} chars`,
      verdict: partSrvChars + part.opTexts >= wireSrvChars * 0.95 ? 'full' : partSrvChars + part.opTexts > 0 ? 'partial' : 'dropped',
      note: 'server tools currently surface as ellipsized op-state texts, not structured fragments (pre-ATOL)',
    });

  const wireResChars = [...wire.toolResults.values()].reduce((a, v) => a + v.payloadChars, 0);
  const partResChars = [...part.toolResults.values()].reduce((a, v) => a + v.payloadChars, 0);
  if (wire.toolResults.size || part.toolResults.size)
    rows.push({
      category: 'server tool results',
      wire: `${wire.toolResults.size} results, ${wireResChars.toLocaleString()} payload chars`,
      particles: `${part.toolResults.size} structured (cer), ${partResChars.toLocaleString()} chars (+op texts above)`,
      verdict: partResChars + part.opTexts >= wireResChars * 0.9 ? 'full' : partResChars + part.opTexts > 0 ? 'partial' : 'dropped',
      note: 'results downsample into op-state oTexts (URL lists, ellipsized stdout)',
    });

  if (wire.citations || part.citations)
    rows.push({
      category: 'citations',
      wire: String(wire.citations), particles: String(part.citations),
      verdict: part.citations >= wire.citations ? 'full' : part.citations ? 'partial' : 'dropped',
      note: wire.citations > part.citations ? 'bulk search-result citations are deliberately not forwarded (noise policy)' : undefined,
    });
  if (wire.images || part.images)
    rows.push({ category: 'images', wire: String(wire.images), particles: String(part.images), verdict: part.images >= wire.images ? 'full' : 'partial' });

  return rows;
}


// -- 4. Particle projection + run-vs-run diff --

export interface ProjPart {
  kind: 'text' | 'reasoning' | 'redacted' | 'fc' | 'cei' | 'cer' | 'image' | 'audio' | 'hres' | 'issue';
  text?: string; // text/reasoning content, fc args, issue text
  name?: string; // fc name
  sig?: boolean;
}

export interface Projection {
  model?: string;
  parts: ProjPart[];
  ops: { mot: string; finalText: string; finalState?: string; nested: boolean; iChars: number; oChars: number }[];
  citations: { url: string; title: string }[];
  endReason?: string;
  tokenStopReason?: string;
}

export function projectParticles(particles: AixWire_Particles.ChatGenerateOp[]): Projection {
  const proj: Projection = { parts: [], ops: [], citations: [] };
  const opsById = new Map<string, Projection['ops'][number]>();
  const last = () => proj.parts[proj.parts.length - 1];

  for (const p of particles) {
    if ('t' in p) {
      if (last()?.kind === 'text') last()!.text! += p.t;
      else proj.parts.push({ kind: 'text', text: p.t });
    } else if ('cg' in p) {
      switch (p.cg) {
        case 'set-model':
          proj.model = p.name;
          break;
        case 'end':
          proj.endReason = p.terminationReason;
          if (p.tokenStopReason) proj.tokenStopReason = p.tokenStopReason;
          break;
        case 'issue':
          proj.parts.push({ kind: 'issue', text: p.issueText });
          break;
      }
    } else if ('p' in p) {
      switch (p.p) {
        case 'tr_':
          if (!p.restart && last()?.kind === 'reasoning') last()!.text! += p._t;
          else proj.parts.push({ kind: 'reasoning', text: p._t });
          break;
        case 'trs':
          if (last()?.kind === 'reasoning') last()!.sig = true;
          break;
        case 'trr_':
          proj.parts.push({ kind: 'redacted' });
          break;
        case 'fci':
          proj.parts.push({ kind: 'fc', name: p.name, text: p.i_args ?? '' });
          break;
        case '_fci': {
          const fc = [...proj.parts].reverse().find(x => x.kind === 'fc');
          if (fc) fc.text! += p._args;
          break;
        }
        case 'cei':
          proj.parts.push({ kind: 'cei', text: p.code });
          break;
        case 'cer':
          proj.parts.push({ kind: 'cer', text: p.result });
          break;
        case 'ii':
          proj.parts.push({ kind: 'image' });
          break;
        case 'ia':
          proj.parts.push({ kind: 'audio' });
          break;
        case 'hres':
          proj.parts.push({ kind: 'hres' });
          break;
        case 'urlc':
          proj.citations.push({ url: p.url, title: p.title });
          break;
        case 'vp': {
          let op = opsById.get(p.opId);
          if (!op) {
            op = { mot: p.mot, finalText: p.text, nested: !!p.parentOpId, iChars: 0, oChars: 0 };
            opsById.set(p.opId, op);
            proj.ops.push(op);
          }
          op.finalText = p.text;
          if (p.state) op.finalState = p.state;
          if (p.parentOpId) op.nested = true;
          op.iChars = Math.max(op.iChars, (p.iTexts ?? []).join('').length);
          op.oChars = Math.max(op.oChars, (p.oTexts ?? []).join('').length);
          break;
        }
      }
    }
  }
  return proj;
}

/** Compact signature of the projected part sequence, e.g. "reasoning text fc(get_x) text". */
export function projectionSignature(proj: Projection): string {
  const partsSig = proj.parts.map(p => p.kind === 'fc' ? `fc(${p.name})` : p.kind).join(' → ') || '(empty)';
  const opsSig = proj.ops.map(o => `${o.mot}${o.nested ? '*' : ''}:${o.finalState ?? 'open'}`).join(', ');
  return partsSig + (opsSig ? `   [ops: ${opsSig}]` : '');
}

/**
 * Compares two runs at the projection level.
 * exact=true is for same-generation pairs (oracle, replay): contents must match.
 * exact=false is for twin pairs (separate S and NS generations): only structure is comparable.
 */
export function compareProjections(labelA: string, a: Projection, labelB: string, b: Projection, exact: boolean): LabFinding[] {
  const findings: LabFinding[] = [];

  const sigA = projectionSignature(a), sigB = projectionSignature(b);
  if (sigA !== sigB)
    findings.push(_f(exact ? 'error' : 'info', 'proj-structure', `part structure differs\n  ${labelA}: ${sigA}\n  ${labelB}: ${sigB}`));
  else
    findings.push(_f('info', 'proj-structure-match', `identical part structure: ${sigA}`));

  if ((a.tokenStopReason ?? '(none)') !== (b.tokenStopReason ?? '(none)'))
    findings.push(_f(exact ? 'error' : 'warn', 'proj-stop-reason', `tokenStopReason: ${labelA}=${a.tokenStopReason ?? '(none)'} vs ${labelB}=${b.tokenStopReason ?? '(none)'}`));

  if (exact) {
    const pairs = Math.min(a.parts.length, b.parts.length);
    for (let i = 0; i < pairs; i++) {
      const pa = a.parts[i], pb = b.parts[i];
      if (pa.kind !== pb.kind) break; // structural mismatch already reported
      if ((pa.text ?? '') === (pb.text ?? '')) continue;
      // tolerate parser-injected spacers between same-content parts
      const norm = (s: string) => s.replace(/\n{2,}/g, '\n').trim();
      if (norm(pa.text ?? '') === norm(pb.text ?? ''))
        findings.push(_f('info', 'proj-spacer-only', `part #${i} (${pa.kind}) differs only in whitespace/spacers`));
      else
        findings.push(_f('error', 'proj-content', `part #${i} (${pa.kind}) content differs: ${labelA}=${(pa.text ?? '').length} chars vs ${labelB}=${(pb.text ?? '').length} chars`));
    }
    const citA = new Set(a.citations.map(c => c.url)), citB = new Set(b.citations.map(c => c.url));
    const onlyA = [...citA].filter(u => !citB.has(u)), onlyB = [...citB].filter(u => !citA.has(u));
    if (onlyA.length || onlyB.length)
      findings.push(_f('warn', 'proj-citations', `citations differ: only-${labelA}=${onlyA.length}, only-${labelB}=${onlyB.length}`));
  } else {
    // structural advisory for twins
    const opCount = (p: Projection, mot: string) => p.ops.filter(o => o.mot === mot).length;
    for (const mot of ['search-web', 'code-exec', 'gen-image'])
      if (opCount(a, mot) !== opCount(b, mot))
        findings.push(_f('info', 'proj-op-count', `${mot} ops: ${labelA}=${opCount(a, mot)} vs ${labelB}=${opCount(b, mot)} (twin runs are separate generations - advisory only)`));
  }

  return findings;
}


// -- Aggregator --

export interface LabReport {
  grammar: LabFinding[];
  sequencing: LabFinding[]; // deep OpenAI Responses analysis (empty for other flavors)
  coverage: LabFinding[];
  loss: LossRow[];
  parserDiags: { warns: number; logs: number; samples: string[] };
  projection: Projection;
}

/**
 * Hunt-mode classifier: is this run worth keeping as evidence?
 * Notable = anything that deviates from the clean baseline, including the 'oai-interleaved'
 * info finding (it is the empirical out-of-order question, not noise).
 */
export function classifyNotable(run: LabRun, report: LabReport): { notable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const f of [...report.grammar, ...report.sequencing, ...report.coverage])
    if (f.severity !== 'info' || f.code === 'oai-interleaved')
      reasons.push(`${f.severity}:${f.code}`);
  if (report.parserDiags.warns > 0)
    reasons.push(`parser-warns:${report.parserDiags.warns}`);
  const parseErrors = run.segments.flatMap(s => s.events).filter(e => e.parseError && !e.parseError.startsWith('DispatchContinuationSignal') && !e.parseError.startsWith('OperationRetrySignal'));
  if (parseErrors.length)
    reasons.push(`parse-errors:${parseErrors.length}`);
  if (!run.outcome.ok)
    reasons.push(`outcome:${run.outcome.endReason ?? run.outcome.error ?? 'not-ok'}`);
  if (run.segments.length > 1)
    reasons.push(`segments:${run.segments.length}`); // continuations/retries are always worth keeping
  return { notable: reasons.length > 0, reasons: [...new Set(reasons)] };
}

export function runChecks(run: LabRun): LabReport {
  const allDiags = run.segments.flatMap(s => [...s.looseDiags, ...s.events.flatMap(e => e.diags)]);
  const warns = allDiags.filter(d => d.level !== 'log');
  return {
    grammar: checkWireGrammar(run),
    sequencing: analyzeOaiSequencing(run),
    coverage: checkEventCoverage(run),
    loss: checkTranslationLoss(run),
    parserDiags: {
      warns: warns.length,
      logs: allDiags.length - warns.length,
      samples: warns.slice(0, 10).map(d => d.text.slice(0, 240)),
    },
    projection: projectParticles(run.finalParticles),
  };
}
