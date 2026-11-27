import type { AnthropicHostedFeatures } from '~/modules/llms/server/anthropic/anthropic.access';

import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage } from '../../../api/aix.wiretypes';
import { type AnthropicWire_API_Message_Create, AnthropicWire_Blocks } from '../../wiretypes/anthropic.wiretypes';

import { aixToAnthropicMessageCreate } from './anthropic.messageCreate';


/**
 * [DeepSeek Messages] DeepSeek on its Anthropic-compatible wire, POST /anthropic/v1/messages.
 *
 * The request is the Anthropic adapter's, prepared before and rewritten after: no DeepSeek rule lives in that adapter,
 * and nothing it adds for Anthropic alone reaches DeepSeek. Each rule here was measured on api.deepseek.com
 * (2026-11-25), with the vendor's error where there is one: kb/modules/LLM-deepseek-messages.md
 */

type TAntRequest = AnthropicWire_API_Message_Create.Request;
type TAntMessages = TAntRequest['messages'];

/** The body sent: the fields DeepSeek reads, built key by key so that an Anthropic-only one cannot ride along */
export type DeepseekMessagesRequest = {
  model: string,
  system?: TAntRequest['system'],
  messages: TAntMessages,
  tools?: (DeepseekMessagesWebTool | DeepseekMessagesClientTool)[],
  tool_choice?: TAntRequest['tool_choice'],
  max_tokens?: number, // unset takes the vendor's limit, which follows model, thinking and effort
  temperature?: number,
  top_p?: number,
  thinking?: { type: 'disabled' }, // on is the vendor default, and is not sent
  output_config?: { effort: DeepseekEffort },
  stream: boolean,
};

/** A client tool carries no `type` here: 'custom' is a 422 ("unknown variant `custom`") */
type DeepseekMessagesClientTool = { name: string, description?: string, input_schema: object };

/** Run by the vendor, the model deciding when: DeepSeek's web tools (deepseek-flash only, a 400 on deepseek-v4-pro), or the standard search */
type DeepseekMessagesWebTool =
  | { type: 'deepseek_web_search', name: 'deepseek_web_search' }
  | { type: 'deepseek_read_url', name: 'deepseek_read_url' }
  | { type: 'web_search_20250305', name: 'web_search' };

type DeepseekEffort = 'low' | 'high' | 'max';

// the vendor's own table (guides/thinking_mode): the wire takes the three levels on the right
const _EFFORT: Record<Exclude<NonNullable<AixAPI_Model['reasoningEffort']>, 'none'>, DeepseekEffort> = {
  minimal: 'low', low: 'low', medium: 'high', high: 'high', xhigh: 'high', max: 'max',
};

// no Anthropic hosted tool, container or beta: each is a 422 or is ignored here
const _NO_HOSTED_FEATURES: AnthropicHostedFeatures = { disableAllHostedTools: true };

/**
 * The standard `web_search`, which this wire serves too: result lists, no citations, no pages. For a model that lists it,
 * and in place of DeepSeek's own search next to client tools. Measured 2026-11-27: there the own search ran in 37 of 72
 * requests, and is a 400 with thinking off ("client tools can only be used together with `deepseek_web_search` in
 * thinking mode"); this one ran in 80 of 80, thinking on or off. The two kinds are a 400 together.
 */
const _STANDARD_SEARCH: DeepseekMessagesWebTool = { type: 'web_search_20250305', name: 'web_search' };


export function aixToDeepseekMessageCreate(model: AixAPI_Model, chatGenerate: AixAPIChatGenerate_Request, streaming: boolean): DeepseekMessagesRequest {

  // only the fields both vendors read: effort is mapped below (the Anthropic adapter throws on 'none'), and the
  // Anthropic-only ones reach every dialect (vndAntContainerId comes from the chat history, whatever the model)
  const antModel: AixAPI_Model = {
    id: model.id,
    acceptsOutputs: model.acceptsOutputs,
    ...(model.temperature !== undefined ? { temperature: model.temperature } : {}),
    ...(model.maxTokens !== undefined ? { maxTokens: model.maxTokens } : {}),
    ...(model.topP !== undefined ? { topP: model.topP } : {}),
  };
  const { chatSequence, reasoningByCallId } = _takeReasoning(chatGenerate.chatSequence);

  const ant = aixToAnthropicMessageCreate('deepseek', antModel, { ...chatGenerate, chatSequence }, streaming, _NO_HOSTED_FEATURES);

  // Thinking is on unless disabled. A forced call is a 400 while it is on ("Thinking mode does not support this
  // tool_choice"): off, as on the Chat Completions wire - the callers that force a tool need the call, not the reasoning
  const forcedCall = ant.tool_choice?.type === 'any' || ant.tool_choice?.type === 'tool';
  const thinkingOff = model.reasoningEffort === 'none' || forcedCall;
  const effort = (!thinkingOff && model.reasoningEffort) ? _EFFORT[model.reasoningEffort as keyof typeof _EFFORT] : undefined;

  const clientTools = ant.tools?.flatMap(_toClientTool) ?? [];
  const standardSearch = model.vndAntWebSearch === 'auto' || (model.vndDeepseekWebSearch === 'auto' && clientTools.length > 0);
  // a forced call is for a client tool: no search then
  const webTools = forcedCall ? [] : standardSearch ? [_STANDARD_SEARCH] : _webTools(model);
  const tools = [...webTools, ...clientTools];

  return {
    model: ant.model,
    ...(ant.system?.length ? { system: ant.system } : {}),
    messages: _returnReasoningOnToolTurns(ant.messages, reasoningByCallId),
    ...(tools.length ? { tools } : {}),
    ...(ant.tool_choice ? { tool_choice: ant.tool_choice } : {}),
    // the Anthropic adapter defaults max_tokens to 8192, a cap this wire would then apply to every inference step
    ...(model.maxTokens !== undefined ? { max_tokens: model.maxTokens } : {}),
    // temperature and top_p are read with thinking off only: not sent inert
    ...(thinkingOff ? {
      ...(ant.temperature !== undefined ? { temperature: ant.temperature } : {}),
      ...(ant.top_p !== undefined ? { top_p: ant.top_p } : {}),
      thinking: { type: 'disabled' },
    } : effort ? {
      output_config: { effort },
    } : {}),
    stream: streaming,
  };
}


/**
 * Reasoning leaves the request, and returns on tool turns only (_returnReasoningOnToolTurns): as on DeepSeek's Chat
 * Completions wire, whatever wire or vendor wrote it. The text of a step, up to its tool calls, is kept under each
 * call id. The Anthropic adapter would send signed blocks alone, signature and all, on every turn.
 *
 * Model audio leaves too: the Anthropic adapter throws on it.
 */
function _takeReasoning(chatSequence: AixAPIChatGenerate_Request['chatSequence']): { chatSequence: AixMessages_ChatMessage[], reasoningByCallId: Map<string, string> } {
  const reasoningByCallId = new Map<string, string>();
  const kept: AixMessages_ChatMessage[] = [];
  for (const message of chatSequence) {
    if (message.role !== 'model') {
      kept.push(message);
      continue;
    }
    let stepReasoning = '';
    const parts = message.parts.filter(part => {
      switch (part.pt) {
        case 'ma':
          stepReasoning += part.aText;
          return false;
        case 'tool_invocation':
          reasoningByCallId.set(part.id, stepReasoning);
          return true;
        case 'tool_response':
          stepReasoning = ''; // the step is over: the next one reasons anew
          return true;
        case 'inline_audio':
          return false;
        default:
          return true;
      }
    });
    if (parts.length)
      kept.push({ ...message, parts });
  }
  return { chatSequence: kept, reasoningByCallId };
}

/**
 * With thinking on, an assistant turn that calls tools must carry its thinking, or the request is a 400 ("The
 * `content[].thinking` in the thinking mode must be passed back to the API."). Any text passes, the empty one too, and
 * the signature is not checked: each such turn is headed by its step's reasoning, '' when there is none (a call written
 * by a model that does not think), unsigned. Sent with thinking off as well, where it is accepted: the history then
 * reads the same whatever this request's effort, and the cached prefix holds.
 */
function _returnReasoningOnToolTurns(messages: TAntMessages, reasoningByCallId: Map<string, string>): TAntMessages {
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const firstCall = message.content.find(block => block.type === 'tool_use');
    if (firstCall)
      message.content.unshift(AnthropicWire_Blocks.ThinkingBlock(reasoningByCallId.get(firstCall.id) ?? '', ''));
  }
  return messages;
}

/** Search works in two modes, by thinking: off, one round of queries; on, several steps that search, open pages and find text in them */
function _webTools(model: AixAPI_Model): DeepseekMessagesWebTool[] {
  const tools: DeepseekMessagesWebTool[] = [];
  if (model.vndDeepseekWebSearch === 'auto') tools.push({ type: 'deepseek_web_search', name: 'deepseek_web_search' });
  if (model.vndDeepseekReadUrl === 'auto') tools.push({ type: 'deepseek_read_url', name: 'deepseek_read_url' });
  return tools;
}

function _toClientTool(tool: NonNullable<TAntRequest['tools']>[number]): DeepseekMessagesClientTool[] {
  return tool.type !== 'custom' ? [] : [{
    name: tool.name,
    ...(tool.description ? { description: tool.description } : {}),
    input_schema: tool.input_schema,
  }];
}
