import type * as z from 'zod/v4';

import type { AixAPI_Model, AixAPIChatGenerate_Request } from '../../../api/aix.wiretypes';
import { GeminiInteractionsWire_API_Interactions } from '../../wiretypes/gemini.interactions.wiretypes';

import { approxDocPart_To_String, approxInReferenceTo_To_XMLString, aixSpillSystemToUser } from './adapters.common';


// configuration
const hotFixDeepResearchSystemPrompt = true;
const sanityEnsureLastUserMessage = true;


type TRequestBody = z.infer<typeof GeminiInteractionsWire_API_Interactions.RequestBody_schema>;
type TInputStep = z.infer<typeof GeminiInteractionsWire_API_Interactions.InputStep_schema>;
type TInputPart = z.infer<typeof GeminiInteractionsWire_API_Interactions.InputContentPart_schema>;


/**
 * Build the POST /v1beta/interactions body for managed agents (Deep Research, Antigravity, ...).
 *
 * Scope:
 *  - Stateless multi-turn: `chatSequence` is flattened to typed input steps (`user_input` / `model_output`)
 *    and sent as `input` (single user turn -> bare `array(Content)`; multi-turn -> the `Step[]` array).
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
 *  - Multimodal: each turn's content is always a content-part array (`{type:'text'|'image', ...}`), text
 *    first then images. We do NOT collapse a text-only turn to a bare `input: "..."` string (the SDK
 *    convenience shape) - it breaks some agent paths; see `_bareSingleTurn` (kept commented for reference).
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

  // Walk chatSequence -> typed input steps. Content is always a content-part array here
  const steps: TInputStep[] = [];
  for (const msg of chatGenerate.chatSequence) {
    if (msg.role === 'user') {
      const content = _buildUserContent(msg.parts);
      if (content.length) steps.push({ type: 'user_input', content });
    } else if (msg.role === 'model') {
      const content = _buildModelContent(msg.parts);
      if (content.length) steps.push({ type: 'model_output', content });
    }
  }
  if (!steps.length)
    throw new Error('Gemini Interactions: no usable steps (Deep Research agents require at least one user message)');


  // DR only: prepend system text into the first user step (native `system_instruction` rejected)
  if (hotFixDeepResearchSystemPrompt && isDeepResearch && systemText) {
    const firstUserIdx = steps.findIndex(s => s.type === 'user_input');
    if (firstUserIdx >= 0)
      steps[firstUserIdx] = { type: 'user_input', content: _prependSystemText(steps[firstUserIdx].content, systemText) };
  }

  // Sanity: the API expects the last step to be a user turn (we're asking the model to respond)
  if (sanityEnsureLastUserMessage && steps[steps.length - 1].type !== 'user_input')
    throw new Error('Gemini Interactions: last turn must be from user (chat sequence ended with a model message)');


  // Single user turn -> the content-part array (the `array(Content)` input arm). Multi-turn -> the typed
  // step array as-is (the steps schema replaced the legacy `{role, content}` turn shape)
  const input: TRequestBody['input'] = (steps.length === 1 && steps[0].type === 'user_input')
    ? steps[0].content
    : steps;

  return {
    agent,
    input,
    stream: true, // SSE streaming - upstream returns event-stream (interaction.created, step.start/delta/stop, interaction.completed). Required for live thought_summary deltas.
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
      // the same sandbox with whatever files/state intervening steps left behind. Tools default
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

function _buildUserContent(parts: Extract<AixAPIChatGenerate_Request['chatSequence'][number], { role: 'user' }>['parts']): TInputPart[] {
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

  // Emit as a content-part array (text first, then images); the single-turn string convenience is
  // applied later by _bareSingleTurn. An empty array (no text, no images) is filtered by the caller.
  const contentParts: TInputPart[] = [];
  if (text) contentParts.push({ type: 'text', text });
  contentParts.push(...images);
  return contentParts;
}

function _buildModelContent(parts: Extract<AixAPIChatGenerate_Request['chatSequence'][number], { role: 'model' }>['parts']): TInputPart[] {
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

  const contentParts: TInputPart[] = [];
  if (text) contentParts.push({ type: 'text', text });
  contentParts.push(...images);
  return contentParts;
}


// -- helpers --

function _prependSystemText(content: TInputPart[], systemPrefix: string): TInputPart[] {
  // fold into the leading text part if present, else inject a text part at the front
  if (content.length > 0 && content[0].type === 'text')
    return [{ type: 'text', text: `${systemPrefix}\n\n${content[0].text}` }, ...content.slice(1)];
  return [{ type: 'text', text: systemPrefix }, ...content];
}

// NOTE: bare-string single-turn convenience - intentionally NOT used (left here for reference). Collapsing
// a text-only single turn to a plain `input: "..."` string is syntactic sugar that breaks some agent paths,
// so the adapter always sends the content-part array (the `array(Content)` input arm) instead.
// function _bareSingleTurn(content: TInputPart[]): string | TInputPart[] {
//   return (content.length === 1 && content[0].type === 'text') ? content[0].text : content;
// }
