import type * as z from 'zod/v4';

import type { AixAPI_Model, AixAPIChatGenerate_Request } from '../../../api/aix.wiretypes';
import { GeminiInteractionsWire_API_Interactions } from '../../wiretypes/gemini.interactions.wiretypes';

import { approxDocPart_To_String, approxInReferenceTo_To_XMLString, aixSpillSystemToUser } from './adapters.common';


type TRequestBody = z.infer<typeof GeminiInteractionsWire_API_Interactions.RequestBody_schema>;
type TTurn = z.infer<typeof GeminiInteractionsWire_API_Interactions.Turn_schema>;
type TTurnContent = TTurn['content']; // string | InputContentPart[]
type TInputPart = z.infer<typeof GeminiInteractionsWire_API_Interactions.InputContentPart_schema>;


/**
 * Build the POST /v1beta/interactions body for managed agents (Deep Research, Antigravity, ...).
 *
 * Scope:
 *  - Stateless multi-turn: `chatSequence` is flattened to role-tagged turns and sent as `input`.
 *  - `systemMessage` text: routing differs by agent type
 *    - deep-research agents REJECT the top-level `system_instruction` field (tested 2026-04-23,
 *      API error: "not supported for the deep-research-* agent. Please include any specific
 *      instructions in the input prompt instead"), so we prepend the system text into the first
 *      user turn.
 *    - non-DR agents (Antigravity, future MCP/Computer Use) use the native `system_instruction`
 *      field, matching the gemini.generateContent.ts convention for clean separation.
 *  - Per-agent runtime flags:
 *    - deep-research: `background: true` (REQUIRED per DR guide), plus `agent_config` with
 *      thinking_summaries / visualization.
 *    - antigravity (antigravity-preview-05-2026): `background` MUST NOT be true (upstream rejects
 *      it: 'Agent does not support using background=True and requires store=True'), so we omit it
 *      and let the API default to false (sync streaming). `environment: "remote"` selects a fresh
 *      Google-hosted Linux sandbox; default tool set (code_execution, google_search, url_context,
 *      filesystem) is enabled implicitly. Powered by Gemini 3.5 Flash.
 *  - Multimodal: user and model turns carry images as content-part arrays when any image is present,
 *    otherwise stay as plain strings (preserves the API's convenience shape).
 *  - Doc parts render as text via `approxDocPart_To_String`; in-reference-to XML is prepended to the user turn.
 *  - Model messages containing only tool invocations/responses/aux (no text or images) are dropped.
 *  - Audio and cache-control parts are silently dropped (unsupported on this path).
 */
export function aixToGeminiInteractionsCreate(model: AixAPI_Model, chatGenerateRaw: AixAPIChatGenerate_Request): TRequestBody {

  // Normalize: move any 'spillable' system parts (e.g. images) into a synthetic user message up front
  const chatGenerate = aixSpillSystemToUser(chatGenerateRaw);

  // The API expects a bare agent id (no 'models/' prefix)
  const agent = model.id.startsWith('models/') ? model.id.slice('models/'.length) : model.id;

  // Agent-variant gates - keep mutually exclusive so accidental new agents fall through to defaults
  const isAntigravity = agent.includes('antigravity-');
  const isDeepResearch = agent.includes('deep-research');

  // Extract flattened system text (consumed below - DR: prepend to first user turn; else: native field)
  const systemText = _collectSystemText(chatGenerate.systemMessage);

  // Walk chatSequence -> turns
  const turns: TTurn[] = [];
  for (const msg of chatGenerate.chatSequence) {
    if (msg.role === 'user') {
      const content = _buildUserContent(msg.parts);
      if (_hasTurnContent(content)) turns.push({ role: 'user', content });
    } else if (msg.role === 'model') {
      const content = _buildModelContent(msg.parts);
      if (_hasTurnContent(content)) turns.push({ role: 'model', content });
    }
  }

  if (!turns.length)
    throw new Error('Gemini Interactions: no usable turns (Deep Research agents require at least one user message)');

  // DR only: prepend system text into the first user turn (native `system_instruction` rejected)
  if (isDeepResearch && systemText) {
    const firstUserIdx = turns.findIndex(t => t.role === 'user');
    if (firstUserIdx >= 0)
      turns[firstUserIdx] = { role: 'user', content: _prependSystemText(turns[firstUserIdx].content, systemText) };
  }

  // Sanity: the API expects the last turn to be 'user' (we're asking the model to respond)
  if (turns[turns.length - 1].role !== 'user')
    throw new Error('Gemini Interactions: last turn must be from user (chat sequence ended with a model message)');

  // Simplify single-turn to bare content form (matches the Python/JS SDK convenience shape)
  const input: TRequestBody['input'] = (turns.length === 1 && turns[0].role === 'user')
    ? turns[0].content
    : turns;

  return {
    agent,
    input,
    stream: true, // SSE streaming - upstream returns event-stream (interaction.start, content.start/delta/stop, interaction.complete, done). Required for live thought_summary deltas.
    // FIXME: we only support SSE streaming parsing - we used to support parsing of the final answer (with the GET) but not anymore
    store: true, // keep the interaction alive so clients can reattach via SSE replay within Gemini's retention window (1d free / 55d paid). Required by both DR and Antigravity agents.
    background: isDeepResearch, // DR REQUIRES true ('Agents are required to use background=true'); Antigravity REJECTS true ('does not support using background=True'); future agents default false.
    ...(isDeepResearch && {
      agent_config: {
        type: 'deep-research',
        thinking_summaries: 'auto', // Enable thought_summary blocks - without this the API would not emit summaries during streaming
        // visualization: forwarded only when the client explicitly opts out; 'auto' (default) is left unset so the agent may generate charts/images.
        ...(model.vndGeminiAgentViz === 'off' && { visualization: 'off' }),
      },
    }),
    ...(isAntigravity && {
      // Reuse the prior turn's sandbox via `upstreamContainer.uct === 'vnd.gem.interactions'` walk
      // (see aix.client.ts). `"remote"` (fresh sandbox) only when no prior env exists in history -
      // NOT a fallback on upstream rejection. If the env is invalidated upstream this POST fails
      // and the error surfaces; recovery happens on the next user turn (which re-walks history).
      // NOTE: the env is a MUTATING handle, not a snapshot - re-running an earlier turn rejoins
      // the same sandbox with whatever files/state intervening turns left behind. Tools default
      // set is enabled implicitly by omitting `tools` (code_execution, google_search, url_context, fs).
      environment: model.vndGeminiEnvironmentId || 'remote',
    }),
    // non-DR agents: use native system_instruction field (matches gemini.generateContent.ts convention)
    ...(!isDeepResearch && systemText && { system_instruction: systemText }),
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

function _buildUserContent(parts: Extract<AixAPIChatGenerate_Request['chatSequence'][number], { role: 'user' }>['parts']): TTurnContent {
  const textChunks: string[] = [];
  const prefixChunks: string[] = []; // in-reference-to goes before body
  const images: TInputPart[] = [];

  for (const part of parts) {
    switch (part.pt) {
      case 'text':
        textChunks.push(part.text);
        break;
      case 'doc':
        textChunks.push(approxDocPart_To_String(part));
        break;
      case 'meta_in_reference_to':
        const irt = approxInReferenceTo_To_XMLString(part);
        if (irt) prefixChunks.push(irt);
        break;
      case 'inline_image':
        images.push({ type: 'image', data: part.base64, mime_type: part.mimeType });
        break;
      case 'meta_cache_control':
        break; // unsupported here; dropped
      default:
        const _exhaustive: never = part;
    }
  }

  const text = [...prefixChunks, ...textChunks].join('\n\n').trim();

  // text-only turn: return string (API convenience shape)
  if (!images.length) return text;

  // multimodal turn: emit as content-parts array; text first, then images (matches generateContent convention)
  const contentParts: TInputPart[] = [];
  if (text) contentParts.push({ type: 'text', text });
  contentParts.push(...images);
  return contentParts;
}

function _buildModelContent(parts: Extract<AixAPIChatGenerate_Request['chatSequence'][number], { role: 'model' }>['parts']): TTurnContent {
  const textChunks: string[] = [];
  const images: TInputPart[] = [];

  for (const part of parts) {
    switch (part.pt) {
      case 'text':
        textChunks.push(part.text);
        break;
      case 'inline_image':
        // model-authored images (e.g. from a prior generation) - replay as context
        images.push({ type: 'image', data: part.base64, mime_type: part.mimeType });
        break;
      case 'inline_audio':
      case 'tool_invocation':
      case 'tool_response':
      case 'ma': // model aux (reasoning, etc.)
      case 'meta_cache_control':
        break; // drop non-text/image model output for Deep Research replays
      default:
        const _exhaustive: never = part;
    }
  }

  const text = textChunks.join('\n\n').trim();

  if (!images.length) return text;

  const contentParts: TInputPart[] = [];
  if (text) contentParts.push({ type: 'text', text });
  contentParts.push(...images);
  return contentParts;
}


// -- helpers --

function _hasTurnContent(content: TTurnContent): boolean {
  return typeof content === 'string' ? content.length > 0 : content.length > 0;
}

function _prependSystemText(content: TTurnContent, systemPrefix: string): TTurnContent {
  if (typeof content === 'string')
    return `${systemPrefix}\n\n${content}`;
  // multimodal: inject a text part at the front, or fold into the leading text part if present
  if (content.length > 0 && content[0].type === 'text')
    return [{ type: 'text', text: `${systemPrefix}\n\n${content[0].text}` }, ...content.slice(1)];
  return [{ type: 'text', text: systemPrefix }, ...content];
}
