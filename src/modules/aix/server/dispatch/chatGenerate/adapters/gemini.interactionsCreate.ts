import type * as z from 'zod/v4';

import type { AixAPI_Model, AixAPIChatGenerate_Request } from '../../../api/aix.wiretypes';
import { GeminiInteractionsWire_API_Interactions } from '../../wiretypes/gemini.interactions.wiretypes';

import { approxDocPart_To_String, approxInReferenceTo_To_XMLString, aixSpillSystemToUser } from './adapters.common';


type TRequestBody = z.infer<typeof GeminiInteractionsWire_API_Interactions.RequestBody_schema>;
type TTurn = z.infer<typeof GeminiInteractionsWire_API_Interactions.Turn_schema>;


/**
 * MINIMAL - Build the POST /v1beta/interactions body for Deep Research agents.
 *
 * Scope:
 *  - Stateless multi-turn: the full `chatSequence` is flattened to role-tagged turns and sent as `input`.
 *  - `systemMessage` text (if any) is prepended to the first user turn, since the Interactions API for
 *    background agents does not accept a dedicated `system_instruction`.
 *  - Text-only content: doc parts are rendered via `approxDocPart_To_String`; in-reference-to XML is prepended to the user turn.
 *  - Model messages containing only tool invocations/responses/aux (no text) are dropped.
 *  - Non-text user parts (images, audio, cache-control) are silently dropped.
 */
export function aixToGeminiInteractionsCreate(model: AixAPI_Model, chatGenerateRaw: AixAPIChatGenerate_Request): TRequestBody {

  // Normalize: move any 'spillable' system parts (e.g. images) into a synthetic user message up front
  const chatGenerate = aixSpillSystemToUser(chatGenerateRaw);

  // Extract leftover system text (to be prepended to the first user turn)
  const systemPrefix = _collectSystemText(chatGenerate.systemMessage);

  // Walk chatSequence -> turns
  const turns: TTurn[] = [];
  for (const msg of chatGenerate.chatSequence) {
    if (msg.role === 'user') {
      const content = _flattenUserParts(msg.parts);
      if (content) turns.push({ role: 'user', content });
    } else if (msg.role === 'model') {
      const content = _flattenModelParts(msg.parts);
      if (content) turns.push({ role: 'model', content });
    }
  }

  if (!turns.length)
    throw new Error('Gemini Interactions: no usable turns (Deep Research agents require at least one user message)');

  // Prepend system prefix to the FIRST user turn (skip if none exists)
  if (systemPrefix) {
    const firstUserIdx = turns.findIndex(t => t.role === 'user');
    if (firstUserIdx >= 0)
      turns[firstUserIdx] = { role: 'user', content: `${systemPrefix}\n\n${turns[firstUserIdx].content}` };
  }

  // Sanity: the API expects the last turn to be 'user' (we're asking the model to respond)
  if (turns[turns.length - 1].role !== 'user')
    throw new Error('Gemini Interactions: last turn must be from user (chat sequence ended with a model message)');

  // Simplify single-turn to string form (matches the Python/JS SDK convenience shape)
  const input: TRequestBody['input'] = (turns.length === 1 && turns[0].role === 'user')
    ? turns[0].content
    : turns;

  // The API expects a bare agent id (no 'models/' prefix)
  const agent = model.id.startsWith('models/') ? model.id.slice('models/'.length) : model.id;

  return {
    agent,
    input,
    background: true,
    store: true, // API rejects store=false with background=true; the poller issues DELETE after terminal status
  };
}


// -- part flattening --

function _collectSystemText(systemMessage: AixAPIChatGenerate_Request['systemMessage']): string {
  if (!systemMessage?.parts?.length) return '';
  const chunks: string[] = [];
  for (const part of systemMessage.parts) {
    switch (part.pt) {
      case 'text':
        chunks.push(part.text);
        break;
      case 'doc':
        chunks.push(approxDocPart_To_String(part));
        break;
      case 'inline_image':
      case 'meta_cache_control':
        break; // silently drop
      default:
        const _exhaustive: never = part;
    }
  }
  return chunks.join('\n').trim();
}

function _flattenUserParts(parts: Extract<AixAPIChatGenerate_Request['chatSequence'][number], { role: 'user' }>['parts']): string {
  const chunks: string[] = [];
  const prefixChunks: string[] = []; // in-reference-to goes before body

  for (const part of parts) {
    switch (part.pt) {
      case 'text':
        chunks.push(part.text);
        break;
      case 'doc':
        chunks.push(approxDocPart_To_String(part));
        break;
      case 'meta_in_reference_to':
        const irt = approxInReferenceTo_To_XMLString(part);
        if (irt) prefixChunks.push(irt);
        break;
      case 'inline_image':
      case 'meta_cache_control':
        break; // unsupported here; dropped
      default:
        const _exhaustive: never = part;
    }
  }

  return [...prefixChunks, ...chunks].join('\n\n').trim();
}

function _flattenModelParts(parts: Extract<AixAPIChatGenerate_Request['chatSequence'][number], { role: 'model' }>['parts']): string {
  const chunks: string[] = [];
  for (const part of parts) {
    switch (part.pt) {
      case 'text':
        chunks.push(part.text);
        break;
      case 'inline_audio':
      case 'inline_image':
      case 'tool_invocation':
      case 'tool_response':
      case 'ma': // model aux (reasoning, etc.)
      case 'meta_cache_control':
        break; // drop non-text model output for Deep Research replays
      default:
        const _exhaustive: never = part;
    }
  }
  return chunks.join('\n\n').trim();
}
