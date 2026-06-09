import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import { aixCGR_FromSimpleText, aixCGR_SystemMessageText } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { aixChatGenerateContent_DMessage_orThrow, aixCreateChatGenerateContext } from '~/modules/aix/client/aix.client';

import { classifyOutcome, inspectFragments, sample } from './probe.inspector';
import type { ProbeOutcome, ProbeResult, ProbeScenario } from './probe.types';


type _Metrics = { $c?: number; $code?: string; TIn?: number; TOut?: number; TOutR?: number } | undefined;


/** Merge 1-2 AIX metrics objects into ProbeResult cost/token fields (summed). */
function _metricsFields(...ms: _Metrics[]) {
  let cents: number | undefined;
  let costStatus: string | undefined;
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let tokensReasoning: number | undefined;
  for (const m of ms) {
    if (!m) continue;
    if (m.$c !== undefined) cents = (cents ?? 0) + m.$c;
    if (m.$code) costStatus = m.$code;
    if (m.TIn !== undefined) tokensIn = (tokensIn ?? 0) + m.TIn;
    if (m.TOut !== undefined) tokensOut = (tokensOut ?? 0) + m.TOut;
    if (m.TOutR !== undefined) tokensReasoning = (tokensReasoning ?? 0) + m.TOutR;
  }
  return {
    costUsd: cents !== undefined ? cents / 100 : undefined,
    costStatus,
    tokensIn,
    tokensOut,
    tokensReasoning,
  };
}


/**
 * Run a single probe against a single model.
 * - non-streaming (deterministic, simpler to classify)
 * - per-probe AbortController with timeout
 * - if `outerSignal` aborts, the probe aborts too
 * - never throws: returns a ProbeResult with outcome='error'/'aborted'/'not_configured' on failure
 */
export async function runProbe(
  llmId: DLLMId,
  scenario: ProbeScenario,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<ProbeResult> {

  const ts0 = Date.now();
  const base = {
    scenarioId: scenario.id,
    llmId,
    ts: ts0,
  };

  // per-probe abort: either outer signal or timeout aborts the inner call
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onOuterAbort = () => controller.abort('outer-abort');
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort('outer-abort');
    else outerSignal.addEventListener('abort', onOuterAbort, { once: true });
  }

  try {
    const aixChatGenerate: AixAPIChatGenerate_Request = {
      ...aixCGR_FromSimpleText(scenario.systemMessage, [{ role: 'user', text: scenario.userMessage }]),
      tools: scenario.tools,
      toolsPolicy: scenario.toolsPolicy,
    };

    const { fragments, outcome, generator } = await aixChatGenerateContent_DMessage_orThrow(
      llmId,
      aixChatGenerate,
      aixCreateChatGenerateContext('_DEV_', `llm_cap_probe_${scenario.id}`),
      false /* non-streaming */,
      { abortSignal: controller.signal },
    );

    const m1 = generator.metrics as _Metrics;
    const inspected = inspectFragments(fragments);

    if (outcome === 'aborted') {
      return {
        ...base,
        durationMs: Date.now() - ts0,
        outcome: 'aborted',
        emittedSequence: inspected.emittedSequence,
        errorMessage: controller.signal.reason === 'timeout' ? `timed out after ${timeoutMs}ms` : 'aborted',
        ..._metricsFields(m1),
      };
    }

    const turn1Outcome: ProbeOutcome = outcome === 'failed' && !inspected.firstFunctionCall
      ? 'error'
      : classifyOutcome(inspected, scenario.expectedFunctionName);

    // Single-turn scenarios, or turn 1 didn't pass: return now
    if (!scenario.roundtrip || turn1Outcome !== 'function_call_ok') {
      return {
        ...base,
        durationMs: Date.now() - ts0,
        outcome: turn1Outcome,
        emittedSequence: inspected.emittedSequence,
        functionName: inspected.firstFunctionCall?.name,
        argsSample: sample(inspected.firstFunctionCall?.args),
        textSample: sample(inspected.concatenatedText),
        errorMessage: inspected.firstError,
        ..._metricsFields(m1),
      };
    }

    // Turn 2: roundtrip. Echo turn 1's tool call (preserving gemini thoughtSignature) + inject canned tool result.
    const fc = inspected.firstFunctionCall!;
    const gem = fc.vendorState?.gemini;
    const turn2Request: AixAPIChatGenerate_Request = {
      systemMessage: aixCGR_SystemMessageText(scenario.systemMessage),
      chatSequence: [
        { role: 'user', parts: [{ pt: 'text', text: scenario.userMessage }] },
        {
          role: 'model',
          parts: [
            {
              pt: 'tool_invocation',
              id: fc.id,
              invocation: { type: 'function_call', name: fc.name, args: fc.args || '{}' },
              ...(gem ? { _vnd: { gemini: gem } } : {}),
            },
            {
              pt: 'tool_response',
              id: fc.id,
              response: { type: 'function_call', name: fc.name, result: scenario.roundtrip.cannedResult },
            },
          ],
        },
      ],
      tools: scenario.tools,
      toolsPolicy: scenario.toolsPolicy,
    };

    const turn2 = await aixChatGenerateContent_DMessage_orThrow(
      llmId,
      turn2Request,
      aixCreateChatGenerateContext('_DEV_', `llm_cap_probe_${scenario.id}_t2`),
      false,
      { abortSignal: controller.signal },
    );

    const m2 = turn2.generator.metrics as _Metrics;
    const t2Inspected = inspectFragments(turn2.fragments);
    const combinedSequence = [...inspected.emittedSequence, 'inj', ...t2Inspected.emittedSequence];

    let t2Outcome: ProbeOutcome;
    let errorMessage: string | undefined;
    if (turn2.outcome === 'aborted') {
      t2Outcome = 'aborted';
      errorMessage = controller.signal.reason === 'timeout' ? `turn 2 timed out after ${timeoutMs}ms` : 'aborted';
    } else if (t2Inspected.firstFunctionCall) {
      t2Outcome = 'roundtrip_loop';
      errorMessage = `turn 2 re-emitted fn call: ${t2Inspected.firstFunctionCall.name}`;
    } else if (t2Inspected.firstError && !t2Inspected.concatenatedText) {
      t2Outcome = 'error';
      errorMessage = t2Inspected.firstError;
    } else if (!t2Inspected.concatenatedText) {
      t2Outcome = 'empty';
      errorMessage = 'turn 2 emitted no text';
    } else {
      const lower = t2Inspected.concatenatedText.toLowerCase();
      const hasSignal = scenario.roundtrip.signalTokens.some(tok => lower.includes(tok.toLowerCase()));
      if (hasSignal) {
        t2Outcome = 'function_call_ok';
      } else {
        t2Outcome = 'roundtrip_no_signal';
        errorMessage = `turn 2 missing tokens: [${scenario.roundtrip.signalTokens.join(',')}]`;
      }
    }

    return {
      ...base,
      durationMs: Date.now() - ts0,
      outcome: t2Outcome,
      emittedSequence: combinedSequence,
      functionName: fc.name,
      argsSample: sample(fc.args),
      textSample: sample(t2Inspected.concatenatedText),
      errorMessage,
      ..._metricsFields(m1, m2),
    };

  } catch (error: any) {
    // Pre-LL errors (missing service/access/model, assembly errors) surface as thrown exceptions here.
    const message = error?.message || String(error) || 'unknown error';
    // if we or the outer signal were aborted, classify as aborted rather than error
    if (controller.signal.aborted || outerSignal?.aborted) {
      return {
        ...base,
        durationMs: Date.now() - ts0,
        outcome: 'aborted',
        emittedSequence: [],
        errorMessage: controller.signal.reason === 'timeout' ? `timed out after ${timeoutMs}ms` : message,
      };
    }
    // heuristic: classify "not found" / "no vendor" / "no access" as not_configured
    const isNotConfigured = /not found|no vendor|no access|not configured|missing/i.test(message);
    return {
      ...base,
      durationMs: Date.now() - ts0,
      outcome: isNotConfigured ? 'not_configured' : 'error',
      emittedSequence: [],
      errorMessage: message,
    };
  } finally {
    clearTimeout(timerId);
    if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
  }
}


// --- Concurrency pool ---

export interface RunPlanItem {
  llmId: DLLMId;
  scenario: ProbeScenario;
}

export interface RunProgress {
  completed: number;
  total: number;
  lastResult?: ProbeResult;
}

/**
 * Run a batch of probes with a bounded concurrency, reporting progress as each probe finishes.
 * Returns when all probes complete (or are skipped due to outer abort).
 *
 * Semantics on abort:
 * - already-running probes will abort and return outcome='aborted'
 * - pending probes will never start (caller tracks skipped items via completed < total)
 */
export async function runPlan(
  items: RunPlanItem[],
  concurrency: number,
  timeoutMs: number,
  outerSignal: AbortSignal,
  onResult: (result: ProbeResult) => void,
  onProgress?: (progress: RunProgress) => void,
): Promise<void> {

  const total = items.length;
  let completed = 0;
  let nextIdx = 0;

  const workerCount = Math.max(1, Math.min(concurrency, total));

  async function worker(): Promise<void> {
    while (!outerSignal.aborted) {
      const idx = nextIdx++;
      if (idx >= total) return;
      const { llmId, scenario } = items[idx];
      const result = await runProbe(llmId, scenario, timeoutMs, outerSignal);
      completed++;
      onResult(result);
      onProgress?.({ completed, total, lastResult: result });
    }
  }

  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
}
