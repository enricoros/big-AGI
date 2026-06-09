import type { DMessageContentFragment, DMessageFragmentVendorState, DMessageVoidFragment } from '~/common/stores/chat/chat.fragments';

import type { ProbeOutcome } from './probe.types';


const SAMPLE_LEN = 200;


export interface InspectedFragments {
  emittedSequence: string[];      // short labels in exact emission order (one per fragment)
  firstFunctionCall?: { id: string; name: string; args: string; vendorState?: DMessageFragmentVendorState };
  firstCodeExecution?: { language: string; code: string };
  firstError?: string;
  concatenatedText: string;
}


export function inspectFragments(fragments: readonly (DMessageContentFragment | DMessageVoidFragment)[]): InspectedFragments {
  const emittedSequence: string[] = [];
  let firstFunctionCall: InspectedFragments['firstFunctionCall'];
  let firstCodeExecution: { language: string; code: string } | undefined;
  let firstError: string | undefined;
  const textChunks: string[] = [];

  for (const frag of fragments) {
    if (frag.ft === 'content') {
      const part = frag.part;
      switch (part.pt) {
        case 'text':
          emittedSequence.push('text');
          textChunks.push(part.text);
          break;
        case 'tool_invocation':
          if (part.invocation.type === 'function_call') {
            emittedSequence.push('fn');
            if (!firstFunctionCall) firstFunctionCall = { id: part.id, name: part.invocation.name, args: part.invocation.args || '', vendorState: frag.vendorState };
          } else if (part.invocation.type === 'code_execution') {
            emittedSequence.push('code');
            if (!firstCodeExecution) firstCodeExecution = { language: part.invocation.language, code: part.invocation.code };
          }
          break;
        case 'tool_response':
          emittedSequence.push('tres');
          break;
        case 'image_ref':
          emittedSequence.push('img');
          break;
        case 'reference':
          emittedSequence.push('ref');
          break;
        case 'hosted_resource':
          emittedSequence.push('host');
          break;
        case 'error':
          emittedSequence.push('err');
          if (!firstError) firstError = part.error;
          break;
        default:
          emittedSequence.push('?');
      }
    } else if (frag.ft === 'void') {
      const part = frag.part;
      switch (part.pt) {
        case 'ma':
          emittedSequence.push('think');
          break;
        case 'annotations':
          emittedSequence.push('cite');
          break;
        case 'ph':
          emittedSequence.push('ph');
          break;
        default:
          emittedSequence.push('?');
      }
    }
  }

  return {
    emittedSequence,
    firstFunctionCall,
    firstCodeExecution,
    firstError,
    concatenatedText: textChunks.join('').trim(),
  };
}


/**
 * Determine the outcome of a probe from the inspected fragments plus the expected function name.
 * Caller handles higher-level outcomes (aborted, not_configured) before reaching here.
 */
export function classifyOutcome(inspected: InspectedFragments, expectedFunctionName: string): ProbeOutcome {
  if (inspected.firstError && !inspected.firstFunctionCall)
    return 'error';
  if (inspected.firstFunctionCall) {
    return inspected.firstFunctionCall.name === expectedFunctionName
      ? 'function_call_ok'
      : 'function_call_wrong_name';
  }
  if (inspected.firstCodeExecution)
    return 'code_execution';
  if (inspected.concatenatedText.length > 0)
    return 'no_tool_text_only';
  return 'empty';
}


/** Take first N chars, with ellipsis if truncated. */
export function sample(s: string | undefined, n: number = SAMPLE_LEN): string | undefined {
  if (!s) return undefined;
  return s.length <= n ? s : s.slice(0, n) + '...';
}
