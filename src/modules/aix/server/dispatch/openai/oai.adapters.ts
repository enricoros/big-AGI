import { OpenAIDialects } from '~/modules/llms/server/openai/openai.router';

import type { Intake_ChatGenerateRequest, Intake_Model } from '../../intake/schemas.intake.api';
import type { Intake_ChatMessage, Intake_SystemMessage } from '../../intake/schemas.intake.messages';
import type { Intake_ToolDefinition, Intake_ToolsPolicy } from '../../intake/schemas.intake.tools';

import { OpenaiWire_ChatCompletionRequest, openaiWire_chatCompletionRequest_Schema, openaiWire_ImageContentPart, openaiWire_PredictedFunctionCall, openaiWire_TextContentPart } from './oai.wiretypes';

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


export function intakeToOpenAIMessageCreate(openAIDialect: OpenAIDialects, model: Intake_Model, chatGenerate: Intake_ChatGenerateRequest, jsonOutput: boolean, streaming: boolean): OpenaiWire_ChatCompletionRequest {

  // Dialect incompatibilities -> Hotfixes
  const hotFixAlternateUserAssistantRoles = openAIDialect === 'perplexity';
  const hotFixRemoveEmptyMessages = openAIDialect === 'perplexity';
  const hotFixRemoveStreamOptions = openAIDialect === 'azure' || openAIDialect === 'mistral';
  const hotFixSquashMultiPartText = openAIDialect === 'deepseek';
  const hotFixThrowCannotFC = openAIDialect === 'deepseek';


  // Throw if function support is needed but missing
  if (chatGenerate.tools?.length && hotFixThrowCannotFC)
    throw new Error('This service does not support function calls');

  // Convert the chat messages to the OpenAI 4-Messages format
  let chatMessages = _intakeToOpenAIMessages(chatGenerate.systemMessage, chatGenerate.chatSequence);

  // Apply hotfixes
  if (hotFixSquashMultiPartText)
    chatMessages = _fixSquashMultiPartText(chatMessages);

  if (hotFixRemoveEmptyMessages)
    chatMessages = _fixRemoveEmptyMessages(chatMessages);

  if (hotFixAlternateUserAssistantRoles)
    chatMessages = _fixAlternateUserAssistantRoles(chatMessages);


  // Construct the request payload
  let payload: OpenaiWire_ChatCompletionRequest = {
    model: model.id,
    messages: chatMessages,
    tools: chatGenerate.tools && _intakeToOpenAITools(chatGenerate.tools),
    tool_choice: chatGenerate.toolsPolicy && _intakeToOpenAIToolChoice(chatGenerate.toolsPolicy),
    parallel_tool_calls: undefined,
    max_tokens: model.maxTokens !== undefined ? model.maxTokens : undefined,
    temperature: model.temperature !== undefined ? model.temperature : undefined,
    top_p: undefined,
    n: hotFixOnlySupportN1 ? undefined : 0, // NOTE: we choose to not support this at the API level - most downstram ecosystem supports 1 only, which is the default
    stream: streaming,
    stream_options: streaming ? { include_usage: true } : undefined,
    response_format: jsonOutput ? { type: 'json_object' } : undefined,
    seed: undefined,
    stop: undefined,
    user: undefined,
  };

  if (hotFixRemoveStreamOptions)
    payload = _fixRemoveStreamOptions(payload);

  // Preemptive error detection with server-side payload validation before sending it upstream
  const validated = openaiWire_chatCompletionRequest_Schema.safeParse(payload);
  if (!validated.success)
    throw new Error(`Invalid message sequence for OpenAI models: ${validated.error.errors?.[0]?.message || validated.error.message || validated.error}`);

  // if (hotFixUseDeprecatedFunctionCalls)
  //   validated.data = _fixUseDeprecatedFunctionCalls(validated.data);

  return validated.data;
}

function _fixAlternateUserAssistantRoles(chatMessages: OpenaiWire_ChatCompletionRequest['messages']): OpenaiWire_ChatCompletionRequest['messages'] {
  return chatMessages.reduce((acc, historyItem) => {

    // treat intermediate system messages as user messages
    if (acc.length > 0 && historyItem.role === 'system') {
      historyItem = {
        role: 'user',
        content: historyItem.content,
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
            ...(Array.isArray(lastItem.content) ? lastItem.content : [openaiWire_TextContentPart(lastItem.content)]),
            ...(Array.isArray(historyItem.content) ? historyItem.content : historyItem.content ? [openaiWire_TextContentPart(historyItem.content)] : []),
          ];
        }
        return acc;
      }
    }

    // if it's not a case for concatenation, just push the current item to the accumulator
    acc.push(historyItem);
    return acc;
  }, [] as OpenaiWire_ChatCompletionRequest['messages']);
}

function _fixRemoveEmptyMessages(chatMessages: OpenaiWire_ChatCompletionRequest['messages']): OpenaiWire_ChatCompletionRequest['messages'] {
  return chatMessages.filter(message => message.content !== null && message.content !== '');
}

function _fixRemoveStreamOptions(payload: OpenaiWire_ChatCompletionRequest): OpenaiWire_ChatCompletionRequest {
  const { stream_options, ...rest } = payload;
  return rest;
}

function _fixSquashMultiPartText(chatMessages: OpenaiWire_ChatCompletionRequest['messages']): OpenaiWire_ChatCompletionRequest['messages'] {
  // Convert multi-part text messages to single strings for older OpenAI dialects
  return chatMessages.reduce((acc, message) => {
    if (message.role === 'user' && Array.isArray(message.content))
      acc.push({ role: message.role, content: message.content.filter(part => part.type === 'text').map(textPart => textPart.text).filter(text => !!text).join(hotFixSquashTextSeparator) });
    else
      acc.push(message);
    return acc;
  }, [] as OpenaiWire_ChatCompletionRequest['messages']);
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


function _intakeToOpenAIMessages(systemMessage: Intake_SystemMessage | undefined, chatSequence: Intake_ChatMessage[]): OpenaiWire_ChatCompletionRequest['messages'] {

  // Transform the chat messages into OpenAI's format (an array of 'system', 'user', 'assistant', and 'tool' messages)
  const chatMessages: OpenaiWire_ChatCompletionRequest['messages'] = [];

  // Convert the system message
  systemMessage?.parts.forEach(({ text }) => {
    chatMessages.push({ role: 'system', content: text /*, name: _optionalParticipantName */ });
  });

  // Convert the messages
  for (const { parts, role } of chatSequence) {
    switch (role) {

      case 'user':
        for (const part of parts) {
          const currentMessage = chatMessages[chatMessages.length - 1];
          switch (part.pt) {

            case 'doc':
            case 'text':
              // Implementation notes:
              // - doc is rendered as a simple text part, but enclosed in a markdow block
              // - TODO: consider better representation - we use the 'legacy' markdown encoding here,
              //    but we may as well support different ones (e.g. XML) in the future
              const textContentString = part.pt === 'text'
                ? part.text
                : /* doc */ part.data.text.startsWith('```')
                  ? `\`\`\`${part.ref || ''}\n${part.data.text}\n\`\`\`\n`
                  : part.data.text;

              const textContentPart = openaiWire_TextContentPart(textContentString);

              // Append to existing content[], or new message
              if (currentMessage?.role === 'user' && Array.isArray(currentMessage.content))
                currentMessage.content.push(textContentPart);
              else
                chatMessages.push({ role: 'user', content: hotFixPreferArrayUserContent ? [textContentPart] : textContentPart.text });
              break;

            case 'inline_image':
              // create a new OpenAIWire_ImageContentPart
              const { mimeType, base64 } = part;
              const base64DataUrl = `data:${mimeType};base64,${base64}`;
              const imageContentPart = openaiWire_ImageContentPart(base64DataUrl, hotFixForceImageContentPartOpenAIDetail);

              // Append to existing content[], or new message
              if (currentMessage?.role === 'user' && Array.isArray(currentMessage.content))
                currentMessage.content.push(imageContentPart);
              else
                chatMessages.push({ role: 'user', content: [imageContentPart] });
              break;

            case 'meta_reply_to':
              const context = `The user is referring to this in particular:\n{{ReplyToText}}`.replace('{{ReplyToText}}', part.replyTo);
              chatMessages.push({ role: 'system', content: context });
              break;

            default:
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

            case 'inline_image':
              // Implementation notes
              // - image parts are not supported on the assistant side, but on the user side, so we
              //   create a user part instead
              // - we use the 'high' detail level for the image content part (how to expose to the user?)

              // create a new OpenAIWire_ImageContentPart of type User
              const { mimeType, base64 } = part;
              const base64DataUrl = `data:${mimeType};base64,${base64}`;
              const imageContentPart = openaiWire_ImageContentPart(base64DataUrl, hotFixForceImageContentPartOpenAIDetail);

              // Append to existing content[], or new message
              if (currentMessage?.role === 'user' && Array.isArray(currentMessage.content))
                currentMessage.content.push(imageContentPart);
              else
                chatMessages.push({ role: 'user', content: [imageContentPart] });
              break;

            case 'tool_call':
              // Implementation notes
              // - the assistant called the tool (this is the invocation params) with out without text beforehand
              // - we will append to an existing assistant message, if there's space for a tool invocation
              // - otherwise we'll add an assistant message with null message

              // create a new OpenAIWire_ToolCall (specialized to function)
              const toolCallPart = openaiWire_PredictedFunctionCall(part.id, part.name, JSON.stringify(part.args));


              // Append to existing content[], or new message
              if (currentMessage?.role === 'assistant') {
                if (!Array.isArray(currentMessage.tool_calls))
                  currentMessage.tool_calls = [toolCallPart];
                else
                  currentMessage.tool_calls.push(toolCallPart);
              } else
                chatMessages.push({ role: 'assistant', content: null, tool_calls: [toolCallPart] });
              break;

            default:
              throw new Error(`Unsupported part type in Model message: ${(part as any).pt}`);
          }

        }
        break;

      case 'tool':
        for (const part of parts) {
          switch (part.pt) {

            case 'tool_response':
              chatMessages.push({ role: 'tool', tool_call_id: part.id, content: part.isError ? '[ERROR]' + (part.response || '') : (part.response || '') });
              break;

            default:
              throw new Error(`Unsupported part type in Tool message: ${(part as any).pt}`);
          }
        }
        break;
    }
  }

  return chatMessages;
}


function _intakeToOpenAITools(itds: Intake_ToolDefinition[]): NonNullable<OpenaiWire_ChatCompletionRequest['tools']> {
  return itds.map(itd => {
    switch (itd.type) {
      case 'function_call':
        const { name, description, input_schema } = itd.function_call;
        return {
          type: 'function',
          function: {
            name: name,
            description: description,
            parameters: {
              type: 'object',
              properties: input_schema?.properties ? input_schema.properties : {},
              required: input_schema?.required,
            },
          },
        };
      case 'gemini_code_interpreter':
        throw new Error('Gemini code interpreter is not supported');
      case 'preprocessor':
        throw new Error('Preprocessors are not supported yet');
    }
  });
}

function _intakeToOpenAIToolChoice(itp: Intake_ToolsPolicy): NonNullable<OpenaiWire_ChatCompletionRequest['tool_choice']> {
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
