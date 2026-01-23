import * as z from 'zod/v4';

import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixMessages_SystemMessage, AixTools_ToolDefinition, AixTools_ToolsPolicy } from '../../../api/aix.wiretypes';
import { XAIWire_API_Responses, XAIWire_Responses_Tools } from '../../wiretypes/xai.wiretypes';

import { aixDocPart_to_OpenAITextContent, aixMetaRef_to_OpenAIText, aixTexts_to_OpenAIInstructionText } from './openai.chatCompletions';
import { aixSpillShallFlush, aixSpillSystemToUser, approxDocPart_To_String } from './adapters.common';


// configuration
const AIX_XAI_ADD_ENCRYPTED_REASONING = false;
// const AIX_XAI_ADD_INLINE_CITATIONS = true; // yes but we don't know how yet


//
// xAI Responses API Adapter
//
// Key differences from OpenAI Responses API:
// - No 'instructions' field - system content goes into a system role message
// - Uses 'system' role for system messages (only one allowed, must be first)
// - Different hosted tools: web_search, x_search, code_execution
// - Tool calls come in single chunks (not incremental)
//


type TRequest = XAIWire_API_Responses.Request;


/**
 * xAI Responses API request adapter
 *
 * Transforms AIX requests into xAI Responses API format with xAI-specific
 * tools and the instructions workaround (prepend to first user message).
 */
export function aixToXAIResponses(
  model: AixAPI_Model,
  _chatGenerate: AixAPIChatGenerate_Request,
  streaming: boolean,
  enableResumability: boolean,
): TRequest {

  // Pre-process CGR - approximate spill of System to User message
  const chatGenerate = aixSpillSystemToUser(_chatGenerate);

  // Build input with system content prepended to first user message (xAI workaround)
  const requestInput = _toXAIResponsesInput(chatGenerate.systemMessage, chatGenerate.chatSequence);

  // Build xAI-native tools
  const requestTools = _buildXAITools(model, chatGenerate.tools);

  // Construct the request payload
  const payload: TRequest = {

    // Model configuration
    model: model.id,
    max_output_tokens: model.maxTokens ?? undefined,
    temperature: model.temperature ?? undefined,
    // top_p: model.topP ?? undefined, // below

    // Input - NO instructions field in xAI
    input: requestInput,

    // Tools
    tools: requestTools.length ? requestTools : undefined,
    tool_choice: chatGenerate.toolsPolicy && requestTools.length ? _toXAIToolChoice(chatGenerate.toolsPolicy) : undefined,

    // Reasoning configuration
    // 2026-01-22: does not seem to be supported by newer models anymore - so we don't set it
    // reasoning: { ... }

    // Text output configuration
    text: model.strictJsonOutput ? {
      format: {
        type: 'json_schema',
        name: model.strictJsonOutput.name || 'response',
        description: model.strictJsonOutput.description,
        schema: model.strictJsonOutput.schema,
        strict: true,
      },
    } : undefined,

    // State management
    store: enableResumability ?? false,

    // API options
    stream: streaming,
    // truncation: undefined, // use API default

  };

  // Top-P instead of temperature
  if (model.topP !== undefined) {
    delete payload.temperature;
    payload.top_p = model.topP;
  }

  // Add include options for reasoning and specialized for tool sources
  if (AIX_XAI_ADD_ENCRYPTED_REASONING)
    payload.include = [...(payload.include || []), 'reasoning.encrypted_content'];
  if (model.vndXaiCodeExecution === 'auto')
    payload.include = [...(payload.include || []), 'code_interpreter_call.outputs'];


  // validate the payload against xAI schema (client-side check before sending
  const validated = XAIWire_API_Responses.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.warn('[DEV] xAI: invalid Responses request payload. Error:', { valError: validated.error });
    throw new Error(`Invalid request for XAI models: ${z.prettifyError(validated.error)}`);
  }

  return validated.data;
}


/**
 * Build xAI input with system message as the first item.
 *
 * xAI Responses API does not support the 'instructions' field, so we need to:
 * 1. Extract system message content
 * 2. Add it as a system role message at the start of the input
 */
function _toXAIResponsesInput(
  systemMessage: AixMessages_SystemMessage | null,
  chatSequence: AixMessages_ChatMessage[],
): TRequest['input'] {

  type TInputItem = TRequest['input'][number];
  const inputItems: TInputItem[] = [];

  // Extract system content for the developer message
  const systemParts: string[] = [];
  systemMessage?.parts.forEach((part) => {
    switch (part.pt) {
      case 'text':
        systemParts.push(part.text);
        break;
      case 'doc':
        systemParts.push(aixDocPart_to_OpenAITextContent(part).text);
        break;
      case 'inline_image':
        throw new Error('xAI Responses: images must be in user messages, not in system message');
      case 'meta_cache_control':
        // ignored
        break;
      default:
        const _exhaustiveCheck: never = part;
        throw new Error(`Unsupported part type in System message: ${(part as any).pt}`);
    }
  });

  // Add system message if we have system content (must be first in xAI)
  if (systemParts.length) {
    inputItems.push({
      type: 'message',
      role: 'system',
      content: [{
        type: 'input_text',
        text: aixTexts_to_OpenAIInstructionText(systemParts),
      }],
    });
  }

  // Process chat messages
  let allowUserAppend = true;

  function getUserMessage() {
    const lastItem = inputItems.length ? inputItems[inputItems.length - 1] : undefined;
    if (allowUserAppend && lastItem && lastItem.type === 'message' && lastItem.role === 'user')
      return lastItem;
    const newMessage = {
      type: 'message' as const,
      role: 'user' as const,
      content: [] as { type: 'input_text'; text: string }[],
    };
    inputItems.push(newMessage);
    allowUserAppend = true;
    return newMessage;
  }

  function getModelMessage() {
    const lastItem = inputItems.length ? inputItems[inputItems.length - 1] : undefined;
    if (lastItem && lastItem.type === 'message' && lastItem.role === 'assistant')
      return lastItem;
    const newMessage = {
      type: 'message' as const,
      role: 'assistant' as const,
      content: [] as { type: 'output_text'; text: string }[],
    };
    inputItems.push(newMessage);
    return newMessage;
  }

  function newFunctionCallItem(callId: string, name: string, args: string) {
    inputItems.push({
      type: 'function_call' as const,
      call_id: callId,
      name: name,
      arguments: args,
    });
  }

  function newFunctionCallOutputItem(callId: string, output: string) {
    inputItems.push({
      type: 'function_call_output' as const,
      call_id: callId,
      output: output,
    });
  }

  for (const aixMessage of chatSequence) {
    const { role: messageRole, parts: messageParts } = aixMessage;

    switch (messageRole) {
      case 'user':
        for (const part of messageParts) {
          const uPt = part.pt;
          switch (uPt) {
            case 'text':
              getUserMessage().content.push({
                type: 'input_text',
                text: part.text,
              });
              break;

            case 'doc':
              const docText = part.data.text.startsWith('```') ? part.data.text : approxDocPart_To_String(part);
              getUserMessage().content.push({
                type: 'input_text',
                text: docText,
              });
              break;

            case 'inline_image':
              // xAI supports images via data URL
              const { mimeType, base64 } = part;
              const base64DataUrl = `data:${mimeType};base64,${base64}`;
              (getUserMessage().content as any[]).push({
                type: 'input_image',
                detail: 'high',
                image_url: base64DataUrl,
              });
              break;

            case 'meta_in_reference_to':
              getUserMessage().content.push({
                type: 'input_text',
                text: aixMetaRef_to_OpenAIText(part),
              });
              break;

            case 'meta_cache_control':
              // ignored
              break;

            default:
              const _exhaustiveCheck: never = uPt;
              throw new Error(`Unsupported part type in User message: ${uPt}`);
          }
        }
        allowUserAppend = !aixSpillShallFlush(aixMessage);
        break;

      case 'model':
        for (const part of messageParts) {
          const mPt = part.pt;
          switch (mPt) {
            case 'text':
              getModelMessage().content.push({
                type: 'output_text',
                text: part.text,
              });
              break;

            case 'inline_audio':
              // Convert audio to user file input (workaround)
              const audioBase64DataUrl = `data:${part.mimeType};base64,${part.base64}`;
              (getUserMessage().content as any[]).push({
                type: 'input_file',
                file_data: audioBase64DataUrl,
              });
              break;

            case 'inline_image':
              // Convert model image to user input (workaround)
              const imageBase64DataUrl = `data:${part.mimeType};base64,${part.base64}`;
              (getUserMessage().content as any[]).push({
                type: 'input_image',
                detail: 'high',
                image_url: imageBase64DataUrl,
              });
              break;

            case 'tool_invocation':
              const invocation = part.invocation;
              switch (invocation.type) {
                case 'function_call':
                  newFunctionCallItem(part.id, invocation.name, invocation.args || '');
                  break;
                case 'code_execution':
                  newFunctionCallItem(part.id, 'execute_code', invocation.code || '');
                  break;
                default:
                  const _check: never = invocation;
                  throw new Error(`Unsupported tool call type in Model message: ${mPt}`);
              }
              break;

            case 'ma':
              // reasoning/thinking block - ignored for input
              break;

            case 'meta_cache_control':
              // ignored
              break;

            default:
              const _exhaustiveCheck: never = mPt;
              throw new Error(`Unsupported part type in Model message: ${mPt}`);
          }
        }
        break;

      case 'tool':
        for (const part of messageParts) {
          const tPt = part.pt;
          switch (tPt) {
            case 'tool_response':
              const responseType = part.response.type;
              switch (responseType) {
                case 'function_call':
                case 'code_execution':
                  newFunctionCallOutputItem(part.id, part.response.result);
                  break;
                default:
                  const _check: never = responseType;
                  throw new Error(`Unsupported tool response type: ${tPt}/${responseType}`);
              }
              break;

            case 'meta_cache_control':
              // ignored
              break;

            default:
              const _exhaustiveCheck: never = tPt;
              throw new Error(`Unsupported part type in Tool message: ${tPt}`);
          }
        }
        break;

      default:
        const _exhaustiveCheck: never = messageRole;
        break;
    }
  }

  return inputItems;
}


/**
 * Build xAI-native tools array from model parameters and custom tools.
 */
function _buildXAITools(
  model: AixAPI_Model,
  customTools: AixTools_ToolDefinition[] | undefined,
): XAIWire_Responses_Tools.Tool[] {

  const tools: XAIWire_Responses_Tools.Tool[] = [];


  // -- Client Tool definitions --

  const { strictToolInvocations } = model;

  if (customTools?.length) {
    for (const tool of customTools) {
      if (tool.type === 'function_call') {
        const { name, description, input_schema } = tool.function_call;
        tools.push({
          type: 'function',
          name: name,
          description: description,
          parameters: input_schema ? {
            type: 'object',
            properties: input_schema.properties ?? {},
            required: input_schema.required,
          } : undefined,
          ...(strictToolInvocations ? { strict: true } : {}),
        });
      }
      // code_execution type is handled via vndXaiCodeExecution parameter
    }
  }


  // -- Hosted Tools --

  const { vndXaiCodeExecution, vndXaiSearchInterval, vndXaiWebSearch, vndXaiXSearch, vndXaiXSearchHandles } = model;

  // Code Execution
  if (vndXaiCodeExecution === 'auto')
    tools.push({
      type: 'code_interpreter',
    });

  // Web Search
  if (vndXaiWebSearch === 'auto')
    tools.push({
      type: 'web_search',
      // enable_image_understanding: true, // future param, default false, true may be useful
    });

  // X Search
  if (vndXaiXSearch === 'auto') {
    const xSearchTool: Extract<XAIWire_Responses_Tools.Tool, { type: 'x_search' }> = {
      type: 'x_search',
    };

    if (vndXaiXSearchHandles) {
      const handles = vndXaiXSearchHandles
        .split(',')
        .map(h => h.trim())
        .filter(h => !!h)
        .map(h => h.startsWith('@') ? h.slice(1) : h); // Remove @ prefix if present
      if (handles.length)
        xSearchTool.allowed_x_handles = handles.slice(0, 10); // Max 10 handles
    }

    if (vndXaiSearchInterval && vndXaiSearchInterval !== 'unfiltered') {
      const fromDate = _convertSearchIntervalToISO(vndXaiSearchInterval);
      if (fromDate)
        xSearchTool.from_date = fromDate;
    }

    tools.push(xSearchTool);
  }

  return tools;
}


function _toXAIToolChoice(policy: AixTools_ToolsPolicy): XAIWire_Responses_Tools.ToolChoice {
  switch (policy.type) {
    case 'auto':
      return 'auto';
    case 'any':
      return 'required';
    case 'function_call':
      return { type: 'function', name: policy.function_call.name };
    default:
      const _exhaustiveCheck: never = policy;
      throw new Error(`Unsupported XAI tools policy type: ${(policy as any).type}`);
  }
}


function _convertSearchIntervalToISO(filter: '1d' | '1w' | '1m' | '6m' | '1y'): string {
  const now = new Date();
  switch (filter) {
    case '1d':
      now.setDate(now.getDate() - 1);
      break;
    case '1w':
      now.setDate(now.getDate() - 7);
      break;
    case '1m':
      now.setMonth(now.getMonth() - 1);
      break;
    case '6m':
      now.setMonth(now.getMonth() - 6);
      break;
    case '1y':
      now.setFullYear(now.getFullYear() - 1);
      break;
  }
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}