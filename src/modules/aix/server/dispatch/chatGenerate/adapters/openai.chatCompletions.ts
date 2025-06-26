import type { OpenAIDialects } from '~/modules/llms/server/openai/openai.router';

import { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixMessages_SystemMessage, AixParts_DocPart, AixParts_InlineAudioPart, AixParts_MetaInReferenceToPart, AixTools_ToolDefinition, AixTools_ToolsPolicy } from '../../../api/aix.wiretypes';
import { OpenAIWire_API_Chat_Completions, OpenAIWire_ContentParts, OpenAIWire_Messages } from '../../wiretypes/openai.wiretypes';

import { approxDocPart_To_String } from './anthropic.messageCreate';


//
// OpenAI API - Chat Adapter - Implementation Notes
//
// - only supports N=1, mainly because the whole ecosystem downstream only supports N=1
// - not implemented: top_p, parallel_tool_calls, seed, stop, user
// - fully ignored at the moment: frequency_penalty, presence_penalty, logit_bias, logprobs, top_logprobs, service_tier
// - impedence mismatch: see the notes in the message conversion function for additional decisions, including:
//   - doc parts embedded as markdown text
//   - image parts embedded as base64 data URLs
//   - all tool calls embedded as function calls, and multiple will be batched together
//

// configuration
const hotFixOnlySupportN1 = true;
const hotFixPreferArrayUserContent = true;
const hotFixForceImageContentPartOpenAIDetail: 'auto' | 'low' | 'high' = 'high';
const hotFixSquashTextSeparator = '\n\n\n---\n\n\n';
const approxSystemMessageJoiner = '\n\n---\n\n';


type TRequest = OpenAIWire_API_Chat_Completions.Request;
type TRequestMessages = TRequest['messages'];

export function aixToOpenAIChatCompletions(openAIDialect: OpenAIDialects, model: AixAPI_Model, chatGenerate: AixAPIChatGenerate_Request, jsonOutput: boolean, streaming: boolean): TRequest {

  // Dialect incompatibilities -> Hotfixes
  const hotFixAlternateUserAssistantRoles = openAIDialect === 'deepseek' || openAIDialect === 'perplexity';
  const hotFixRemoveEmptyMessages = openAIDialect === 'perplexity';
  const hotFixRemoveStreamOptions = openAIDialect === 'azure' || openAIDialect === 'mistral';
  const hotFixSquashMultiPartText = openAIDialect === 'deepseek';
  const hotFixThrowCannotFC = openAIDialect === 'openrouter' /* OpenRouter FC support is not good (as of 2024-07-15) */ || openAIDialect === 'perplexity';
  const hotFixVndORIncludeReasoning = openAIDialect === 'openrouter'; // [OpenRouter, 2025-01-24] has a special `include_reasoning` field to show the chain of thought

  // Model incompatibilities -> Hotfixes

  // [OpenAI] - o1 models
  // - o1 models don't support system messages, we could hotfix this here once and for all, but we want to transfer the responsibility to the UI for better messaging to the user
  // - o1 models also use the new 'max_completion_tokens' rather than 'max_tokens', breaking API compatibility, so we have to address it here
  const hotFixOpenAIOFamily = (openAIDialect === 'openai' || openAIDialect === 'azure') && (
    model.id === 'o1' || model.id.startsWith('o1-') ||
    model.id === 'o3' || model.id.startsWith('o3-') ||
    model.id === 'o4' || model.id.startsWith('o4-') ||
    model.id === 'o5' || model.id.startsWith('o5-')
  );

  // Throw if function support is needed but missing
  if (chatGenerate.tools?.length && hotFixThrowCannotFC)
    throw new Error('This service does not support function calls');

  // Convert the chat messages to the OpenAI 4-Messages format
  let chatMessages = _toOpenAIMessages(chatGenerate.systemMessage, chatGenerate.chatSequence, hotFixOpenAIOFamily);

  // Apply hotfixes
  if (hotFixSquashMultiPartText)
    chatMessages = _fixSquashMultiPartText(chatMessages);

  if (hotFixRemoveEmptyMessages)
    chatMessages = _fixRemoveEmptyMessages(chatMessages);

  if (hotFixAlternateUserAssistantRoles)
    chatMessages = _fixAlternateUserAssistantRoles(chatMessages);


  // Construct the request payload
  let payload: TRequest = {
    model: model.id,
    messages: chatMessages,
    tools: chatGenerate.tools && _toOpenAITools(chatGenerate.tools),
    tool_choice: chatGenerate.toolsPolicy && _toOpenAIToolChoice(openAIDialect, chatGenerate.toolsPolicy),
    parallel_tool_calls: undefined,
    max_tokens: model.maxTokens !== undefined ? model.maxTokens : undefined,
    ...(model.temperature !== null ? { temperature: model.temperature !== undefined ? model.temperature : undefined } : {}),
    top_p: undefined,
    n: hotFixOnlySupportN1 ? undefined : 0, // NOTE: we choose to not support this at the API level - most downstram ecosystem supports 1 only, which is the default
    stream: streaming,
    stream_options: streaming ? { include_usage: true } : undefined,
    response_format: jsonOutput ? { type: 'json_object' } : undefined,
    seed: undefined,
    stop: undefined,
    user: undefined,
  };

  // [OpenRouter, 2025-01-24]
  if (hotFixVndORIncludeReasoning)
    payload.include_reasoning = true;

  // Top-P instead of temperature
  if (model.topP !== undefined) {
    delete payload.temperature;
    payload.top_p = model.topP;
  }

  // [OpenAI] Vendor-specific reasoning effort, for o1 models only as of 2024-12-24
  if (model.vndOaiReasoningEffort) {
    payload.reasoning_effort = model.vndOaiReasoningEffort;
  }
  // [OpenAI] Vendor-specific restore markdown, for newer o1 models
  if (model.vndOaiRestoreMarkdown) {
    _fixVndOaiRestoreMarkdown_Inline(payload);
  }
  // [OpenAI] Vendor-specific web search context and/or geolocation
  if (model.vndOaiWebSearchContext || model.userGeolocation) {
    payload.web_search_options = {};
    if (model.vndOaiWebSearchContext)
      payload.web_search_options.search_context_size = model.vndOaiWebSearchContext;
    if (model.userGeolocation)
      payload.web_search_options.user_location = {
        type: 'approximate',
        approximate: {
          ...model.userGeolocation,
        },
      };
  }

  // [Perplexity] Vendor-specific extensions for search models
  if (openAIDialect === 'perplexity') {
    // Reasoning effort (reuses OpenAI parameter)
    if (model.vndOaiReasoningEffort) {
      payload.reasoning_effort = model.vndOaiReasoningEffort;
    }

    // Search mode (academic filter)
    if (model.vndPerplexitySearchMode && model.vndPerplexitySearchMode !== 'default') {
      payload.search_mode = model.vndPerplexitySearchMode;
    }

    // Date range filter
    if (model.vndPerplexityDateFilter && model.vndPerplexityDateFilter !== 'unfiltered') {
      const filter = _convertPerplexityDateFilter(model.vndPerplexityDateFilter);
      if (filter) payload.search_after_date_filter = filter;
    }
  }

  // [OpenRouter] -> [Anthropic] via OpenAI API - https://openrouter.ai/docs/use-cases/reasoning-tokens
  if (openAIDialect === 'openrouter' && model.vndAntThinkingBudget !== undefined) {

    // vndAntThinkingBudget's presence indicates a user preference:
    // - [x] a number, which is the budget in tokens
    // - [ ] null: shall disable thinking, but openrouter does not support this?
    if (model.vndAntThinkingBudget === null) {
      // simply not setting the reasoning field downgrades this to a non-thinking model
      // console.warn('OpenRouter does not support disabling thinking of Anthropic models. Using default.');
    } else {
      payload.reasoning = {
        max_tokens: model.vndAntThinkingBudget || 1024,
      };
    }
  }

  if (hotFixOpenAIOFamily)
    payload = _fixRequestForOpenAIO1_maxCompletionTokens(payload);

  if (hotFixRemoveStreamOptions)
    payload = _fixRemoveStreamOptions(payload);

  // Preemptive error detection with server-side payload validation before sending it upstream
  const validated = OpenAIWire_API_Chat_Completions.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.warn('OpenAI: invalid chatCompletions payload. Error:', validated.error);
    throw new Error(`Invalid sequence for OpenAI models: ${validated.error.issues?.[0]?.message || validated.error.message || validated.error}.`);
  }

  // if (hotFixUseDeprecatedFunctionCalls)
  //   validated.data = _fixUseDeprecatedFunctionCalls(validated.data);

  return validated.data;
}


function _fixAlternateUserAssistantRoles(chatMessages: TRequestMessages): TRequestMessages {

  // [Perplexity, 2025-06-23] HotFix: if there's only 1 message from the system, treat it as a user message
  if (chatMessages.length === 1 && chatMessages[0].role === 'system')
    return [{ ...chatMessages[0], role: 'user' }];

  // [Perplexity, 2025-06-23] HotFix: if an assistant message comes before the first user message, we prepend an empty user message
  const firstUserIndex = chatMessages.findIndex(message => message.role === 'user');
  const firstAssistantIndex = chatMessages.findIndex(message => message.role === 'assistant');
  if (firstAssistantIndex !== -1 && firstAssistantIndex < firstUserIndex)
    chatMessages.splice(firstAssistantIndex, 0, { role: 'user', content: [{ type: 'text', text: '' }] });

  return chatMessages.reduce((acc, historyItem) => {

    // treat intermediate system messages as user messages
    if (acc.length > 0 && historyItem.role === 'system') {
      historyItem = {
        ...historyItem,
        role: 'user',
      };
    }

    // if the current item has the same role as the last item, concatenate their content
    if (acc.length > 0) {
      const lastItem = acc[acc.length - 1];
      if (lastItem.role === historyItem.role) {
        if (lastItem.role === 'assistant') {
          lastItem.content += hotFixSquashTextSeparator + historyItem.content;
        } else if (lastItem.role === 'user') {
          lastItem.content = [
            ...(Array.isArray(lastItem.content) ? lastItem.content : [OpenAIWire_ContentParts.TextContentPart(lastItem.content)]),
            ...(Array.isArray(historyItem.content) ? historyItem.content : historyItem.content ? [OpenAIWire_ContentParts.TextContentPart(historyItem.content)] : []),
          ];
        }
        return acc;
      }
    }

    // if it's not a case for concatenation, just push the current item to the accumulator
    acc.push(historyItem);
    return acc;
  }, [] as TRequestMessages);
}

function _fixRemoveEmptyMessages(chatMessages: TRequestMessages): TRequestMessages {
  return chatMessages.filter(message => message.content !== null && message.content !== '');
}

function _fixRequestForOpenAIO1_maxCompletionTokens(payload: TRequest): TRequest {

  // Remove temperature and top_p controls
  const { max_tokens, temperature: _removeTemperature, top_p: _removeTopP, ...rest } = payload;

  // Change max_tokens to max_completion_tokens:
  // - pre-o1: max_tokens is the output amount
  // - o1: max_completion_tokens is the output amount + reasoning amount
  if (max_tokens)
    rest.max_completion_tokens = max_tokens;

  return rest;
}

function _fixRemoveStreamOptions(payload: TRequest): TRequest {
  const { stream_options, parallel_tool_calls, ...rest } = payload;
  return rest;
}

function _fixSquashMultiPartText(chatMessages: TRequestMessages): TRequestMessages {
  // Convert multi-part text messages to single strings for older OpenAI dialects
  return chatMessages.reduce((acc, message) => {
    if (message.role === 'user' && Array.isArray(message.content))
      acc.push({ role: message.role, content: message.content.filter(part => part.type === 'text').map(textPart => textPart.text).filter(text => !!text).join(hotFixSquashTextSeparator) });
    else
      acc.push(message);
    return acc;
  }, [] as TRequestMessages);
}

function _fixVndOaiRestoreMarkdown_Inline(payload: TRequest) {

  // OpenAI - https://platform.openai.com/docs/guides/reasoning/advice-on-prompting#advice-on-prompting
  //
  // As of 2025-01-12, OpenAI states: << Markdown formatting: Starting with o1-2024-12-17,
  // o1 models in the API will avoid generating responses with markdown formatting.
  // To signal to the model when you do want markdown formatting in the response,
  // include the string Formatting re-enabled on the first line of your developer message. >>
  //
  // This function prepends "Formatting re-enabled" to the first user message, if not already present
  if (payload.messages?.length) {
    const firstMessage = payload.messages[0];
    const isDevOrSystem = firstMessage.role === 'developer' || firstMessage.role === 'system';

    // update the text of the developer message
    if (isDevOrSystem && firstMessage.content && !firstMessage.content.split('\n')[0].includes('Formatting re-enabled')) {
      firstMessage.content = 'Formatting re-enabled\n' + firstMessage.content;
    }
    // if the developer message is missing, add it altogether
    else if (!isDevOrSystem) {
      // prepend to the first user message
      payload.messages.unshift({ role: 'developer', content: 'Formatting re-enabled' });
    }
  }

}

/*function _fixUseDeprecatedFunctionCalls(payload: OpenaiWire_ChatCompletionRequest): OpenaiWire_ChatCompletionRequest {
  // Hack the request to rename the parameters - without checking or anything - real hack
  const { tools, tool_choice, ...rest } = payload;
  if (tools?.length)
    (rest as any).functions = tools.map(tool => {
      if (tool.type !== 'function')
        throw new Error('Unsupported tool type');
      return { ...tool.function };
    });
  if (tool_choice)
    (rest as any).function_call = tool_choice === 'none' ? 'none' : typeof tool_choice === 'object' ? { name: tool_choice.function.name } : 'auto';
  console.log('HACKED:', rest, tools, tool_choice);
  return rest;
}*/


function _toOpenAIMessages(systemMessage: AixMessages_SystemMessage | null, chatSequence: AixMessages_ChatMessage[], hotFixOpenAIo1Family: boolean): TRequestMessages {

  // Transform the chat messages into OpenAI's format (an array of 'system', 'user', 'assistant', and 'tool' messages)
  const chatMessages: TRequestMessages = [];

  // Convert the system message - single-part stay as-is and multi-part (text or doc) are flattened to a string
  const msg0TextParts: OpenAIWire_ContentParts.TextContentPart[] = [];
  systemMessage?.parts.forEach((part) => {
    switch (part.pt) {
      case 'text':
        msg0TextParts.push(OpenAIWire_ContentParts.TextContentPart(part.text));
        break;

      case 'doc':
        msg0TextParts.push(aixDocPart_to_OpenAITextContent(part));
        break;

      case 'meta_cache_control':
        // ignore this breakpoint hint - Anthropic only
        break;

      default:
        const _exhaustiveCheck: never = part;
        throw new Error(`Unsupported part type in System message: ${(part as any).pt}`);
    }
  });

  // Add the system message
  if (msg0TextParts.length)
    chatMessages.push({
      /**
       * Notes:
       * o1Family in this case is not o1-preview as it's sporting the Sys0ToUsr0 hotfix
       * o3-mini accepts both system and developer roles, and they seem to have the same effects
       */
      role: !hotFixOpenAIo1Family ? 'system' : 'developer',
      content: aixTexts_to_OpenAIInstructionText(msg0TextParts.map(text => text.text)),
    });


  // Convert the messages
  for (const { parts, role } of chatSequence) {
    switch (role) {

      case 'user':
        for (const part of parts) {
          const currentMessage = chatMessages[chatMessages.length - 1];
          switch (part.pt) {

            case 'text':
              const textContentPart = OpenAIWire_ContentParts.TextContentPart(part.text);

              // Append to existing content[], or new message
              if (currentMessage?.role === 'user' && Array.isArray(currentMessage.content))
                currentMessage.content.push(textContentPart);
              else
                chatMessages.push({ role: 'user', content: hotFixPreferArrayUserContent ? [textContentPart] : textContentPart.text });
              break;

            case 'doc':
              const docContentPart = aixDocPart_to_OpenAITextContent(part);

              // Append to existing content[], or new message
              if (currentMessage?.role === 'user' && Array.isArray(currentMessage.content))
                currentMessage.content.push(docContentPart);
              else
                chatMessages.push({ role: 'user', content: hotFixPreferArrayUserContent ? [docContentPart] : docContentPart.text });
              break;

            case 'inline_image':
              // create a new OpenAIWire_ImageContentPart
              const { mimeType, base64 } = part;
              const base64DataUrl = `data:${mimeType};base64,${base64}`;
              const imageContentPart = OpenAIWire_ContentParts.ImageContentPart(base64DataUrl, hotFixForceImageContentPartOpenAIDetail);

              // Append to existing content[], or new message
              if (currentMessage?.role === 'user' && Array.isArray(currentMessage.content))
                currentMessage.content.push(imageContentPart);
              else
                chatMessages.push({ role: 'user', content: [imageContentPart] });
              break;

            case 'meta_cache_control':
              // ignore this breakpoint hint - Anthropic only
              break;

            case 'meta_in_reference_to':
              chatMessages.push({
                role: !hotFixOpenAIo1Family ? 'system' : 'user', // NOTE: o1Family does not support system messages for this, we downcast to 'user'
                content: aixMetaRef_to_OpenAIText(part),
              });
              break;

            default:
              const _exhaustiveCheck: never = part;
              throw new Error(`Unsupported part type in User message: ${(part as any).pt}`);
          }
        }
        break;

      case 'model':
        for (const part of parts) {
          const currentMessage = chatMessages[chatMessages.length - 1];
          switch (part.pt) {

            case 'text':
              // create a new OpenAIWire_AssistantMessage
              chatMessages.push({ role: 'assistant', content: part.text });
              break;

            case 'inline_audio':
              // Implementation notes
              // - audio parts are not supported on the assistant side, but on the user side, so we
              //   create a user part instead

              // create a new OpenAI_AudioContentPart of type User
              const audioFormat = aixAudioPart_to_OpenAIAudioFormat(part);
              const audioBase64DataUrl = `data:${part.mimeType};base64,${part.base64}`;
              const audioContentPart = OpenAIWire_ContentParts.OpenAI_AudioContentPart(audioBase64DataUrl, audioFormat);

              // Append to existing content[], or new message
              if (currentMessage?.role === 'user' && Array.isArray(currentMessage.content))
                currentMessage.content.push(audioContentPart);
              else
                chatMessages.push({ role: 'user', content: [audioContentPart] });
              break;

            case 'inline_image':
              // Implementation notes
              // - image parts are not supported on the assistant side, but on the user side, so we
              //   create a user part instead
              // - we use the 'high' detail level for the image content part (how to expose to the user?)

              // create a new OpenAIWire_ImageContentPart of type User
              const imageBase64DataUrl = `data:${part.mimeType};base64,${part.base64}`;
              const imageContentPart = OpenAIWire_ContentParts.ImageContentPart(imageBase64DataUrl, hotFixForceImageContentPartOpenAIDetail);

              // Append to existing content[], or new message
              if (currentMessage?.role === 'user' && Array.isArray(currentMessage.content))
                currentMessage.content.push(imageContentPart);
              else
                chatMessages.push({ role: 'user', content: [imageContentPart] });
              break;

            case 'tool_invocation':
              // Implementation notes
              // - the assistant called the tool (this is the invocation params) without text beforehand
              // - we will append to an existing assistant message, if there's space for a tool invocation
              // - otherwise we'll add an assistant message with null message

              // create a new OpenAIWire_ToolCall (specialized to function)
              const invocation = part.invocation;
              let toolCallPart;
              switch (invocation.type) {
                case 'function_call':
                  toolCallPart = OpenAIWire_ContentParts.PredictedFunctionCall(part.id, invocation.name, invocation.args || '');
                  break;
                case 'code_execution':
                  toolCallPart = OpenAIWire_ContentParts.PredictedFunctionCall(part.id, 'execute_code' /* suboptimal */, invocation.code || '');
                  break;
                default:
                  const _exhaustiveCheck: never = invocation;
                  throw new Error(`Unsupported tool call type in Model message: ${(part as any).pt}`);
              }

              // Append to existing content[], or new message
              if (currentMessage?.role === 'assistant') {
                if (!Array.isArray(currentMessage.tool_calls))
                  currentMessage.tool_calls = [toolCallPart];
                else
                  currentMessage.tool_calls.push(toolCallPart);
              } else
                chatMessages.push({ role: 'assistant', content: null, tool_calls: [toolCallPart] });
              break;

            case 'ma':
              // ignore this thinking block - Anthropic only
              break;

            case 'meta_cache_control':
              // ignore this breakpoint hint - Anthropic only
              break;

            default:
              const _exhaustiveCheck: never = part;
              throw new Error(`Unsupported part type in Model message: ${(part as any).pt}`);
          }

        }
        break;

      case 'tool':
        for (const part of parts) {
          switch (part.pt) {

            case 'tool_response':
              const toolErrorPrefix = part.error ? (typeof part.error === 'string' ? `[ERROR] ${part.error} - ` : '[ERROR] ') : '';
              if (part.response.type === 'function_call' || part.response.type === 'code_execution')
                chatMessages.push(OpenAIWire_Messages.ToolMessage(part.id, toolErrorPrefix + part.response.result));
              else
                throw new Error(`Unsupported tool response type in Tool message: ${(part as any).pt}`);
              break;

            case 'meta_cache_control':
              // ignore this breakpoint hint - Anthropic only
              break;

            default:
              const _exhaustiveCheck: never = part;
              throw new Error(`Unsupported part type in Tool message: ${(part as any).pt}`);
          }
        }
        break;
    }
  }

  return chatMessages;
}

function _toOpenAITools(itds: AixTools_ToolDefinition[]): NonNullable<TRequest['tools']> {
  return itds.map(itd => {
    const itdType = itd.type;
    switch (itdType) {

      case 'function_call':
        const { name, description, input_schema } = itd.function_call;
        return {
          type: 'function',
          function: {
            name: name,
            description: description,
            parameters: {
              type: 'object',
              properties: input_schema?.properties ?? {},
              required: input_schema?.required,
            },
          },
        };

      case 'code_execution':
        throw new Error('Gemini code interpreter is not supported');

      default:
        // const _exhaustiveCheck: never = itdType;
        throw new Error(`OpenAI (classic API) unsupported tool: ${itdType}`);

    }
  });
}

function _toOpenAIToolChoice(openAIDialect: OpenAIDialects, itp: AixTools_ToolsPolicy): NonNullable<TRequest['tool_choice']> {
  // [Mistral] - supports 'auto', 'none', 'any'
  if (openAIDialect === 'mistral' && itp.type !== 'auto') {
    // Note: we tried adding the 'any' model, but don't feel comfortable with altering our good parsers
    // to allow for Mistral's deviation from the de-facto norm set by the OpenAI protocol.
    throw new Error('We only support automatic tool selection for Mistral models');
  }

  // NOTE: OpenAI has an additional policy 'none', which we don't have as it behaves like passing no tools at all.
  //       Passing no tools is mandated instead of 'none'.
  switch (itp.type) {
    case 'auto':
      return 'auto';
    case 'any':
      return 'required';
    case 'function_call':
      return { type: 'function' as const, function: { name: itp.function_call.name } };
  }
}


// Approximate conversions

export function aixAudioPart_to_OpenAIAudioFormat(part: AixParts_InlineAudioPart) {
  const audioMimeType = part.mimeType;
  switch (audioMimeType) {
    case 'audio/wav':
      return 'wav';
    case 'audio/mp3':
      return 'mp3';
    default:
      const _exhaustiveCheck: never = audioMimeType;
      throw new Error(`Unsupported inline audio format: ${audioMimeType}`);
  }
}

export function aixMetaRef_to_OpenAIText(irt: AixParts_MetaInReferenceToPart): string {
  // Get the item texts without roles
  const items = irt.referTo.map(r => r.mText);
  if (items.length === 0)
    return 'CONTEXT: The user provides no specific references.';

  const isShortItem = (text: string): boolean =>
    text.split('\n').length <= 3 && text.length <= 200;

  const formatItem = (text: string, index?: number): string => {
    if (isShortItem(text)) {
      const formatted = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      return index !== undefined ? `${index + 1}. "${formatted}"` : `"${formatted}"`;
    }
    return `${index !== undefined ? `ITEM ${index + 1}:\n` : ''}---\n${text}\n---`;
  };

  // Formerly: `The user is referring to this in particular:\n{{ReplyToText}}`.replace('{{ReplyToText}}', part.replyTo);
  if (items.length === 1)
    return `CONTEXT: The user is referring to this in particular:\n${formatItem(items[0])}`;

  const allShort = items.every(isShortItem);
  return `CONTEXT: The user is referring to these ${items.length} in particular:\n\n${
    items.map((text, index) => formatItem(text, index)).join(allShort ? '\n' : '\n\n')}`;
}

export function aixDocPart_to_OpenAITextContent(part: AixParts_DocPart): OpenAIWire_ContentParts.TextContentPart {

  // Corner case, low probability: if the content is already enclosed in triple-backticks, return it as-is
  if (part.data.text.startsWith('```'))
    return OpenAIWire_ContentParts.TextContentPart(part.data.text);

  return OpenAIWire_ContentParts.TextContentPart(approxDocPart_To_String(part));
}

export function aixTexts_to_OpenAIInstructionText(texts: string[]): string {
  return texts.join(approxSystemMessageJoiner);
}


// Vendor specific extensions

function _convertPerplexityDateFilter(filter: string): string {
  const now = new Date();
  switch (filter) {
    case '1m':
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toLocaleDateString('en-US');
    case '3m':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toLocaleDateString('en-US');
    case '6m':
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toLocaleDateString('en-US');
    case '1y':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toLocaleDateString('en-US');
    default:
      console.warn('[DEV] Perplexity date filter not recognized:', filter);
      return '';
  }
}
