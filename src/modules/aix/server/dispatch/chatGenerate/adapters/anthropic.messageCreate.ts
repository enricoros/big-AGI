import { escapeXml } from '~/server/wire';

import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixParts_MetaInReferenceToPart, AixTools_ToolDefinition, AixTools_ToolsPolicy } from '../../../api/aix.wiretypes';
import { AnthropicWire_API_Message_Create, AnthropicWire_Blocks } from '../../wiretypes/anthropic.wiretypes';


// configuration
const hotFixImagePartsFirst = true;
const hotFixMapModelImagesToUser = true;

// former fixes, now removed
// const hackyHotFixStartWithUser = false; // 2024-10-22: no longer required


type TRequest = AnthropicWire_API_Message_Create.Request;

export function aixToAnthropicMessageCreate(model: AixAPI_Model, chatGenerate: AixAPIChatGenerate_Request, streaming: boolean): TRequest {

  // Convert the system message
  let systemMessage: TRequest['system'] = undefined;
  if (chatGenerate.systemMessage?.parts.length) {
    systemMessage = chatGenerate.systemMessage.parts.reduce((acc, part) => {
      switch (part.pt) {
        case 'meta_cache_control':
          if (!acc.length)
            console.warn('Anthropic: cache_control without a message to attach to');
          else if (part.control !== 'anthropic-ephemeral')
            console.warn('Anthropic: cache_control with an unsupported value:', part.control);
          else
            AnthropicWire_Blocks.blockSetCacheControl(acc[acc.length - 1], 'ephemeral');
          break;
        case 'text':
          acc.push(AnthropicWire_Blocks.TextBlock(part.text));
          break;
      }
      return acc;
    }, [] as Exclude<TRequest['system'], undefined>);
  }

  // Transform the chat messages into Anthropic's format
  const chatMessages: TRequest['messages'] = [];
  let currentMessage: TRequest['messages'][number] | null = null;
  for (const aixMessage of chatGenerate.chatSequence) {
    for (const antPart of _generateAnthropicMessagesContentBlocks(aixMessage)) {
      // apply cache_control to the current head block of the current message
      if ('set_cache_control' in antPart) {
        if (currentMessage && currentMessage.content.length)
          AnthropicWire_Blocks.blockSetCacheControl(currentMessage.content[currentMessage.content.length - 1], 'ephemeral');
        else
          console.warn('Anthropic: cache_control without a message to attach to');
        continue;
      }
      // create a new message if the role changes, otherwise append as a new content block
      const { role, content } = antPart;
      if (!currentMessage || currentMessage.role !== role) {
        if (currentMessage)
          chatMessages.push(currentMessage);
        currentMessage = { role, content: [] };
      }
      currentMessage.content.push(content);
    }
  }
  if (currentMessage)
    chatMessages.push(currentMessage);

  // If the first (user) message is missing, copy the first line of the system message
  // [Anthropic] October 8th, 2024 release notes: "...we no longer require the first input message to be a user message."
  // if (hackyHotFixStartWithUser && chatMessages.length && chatMessages[0].role !== 'user' && systemMessage?.length) {
  //   const hackSystemMessageFirstLine = (systemMessage[0]?.text || '').split('\n')[0];
  //   chatMessages.unshift({ role: 'user', content: [AnthropicWire_Blocks.TextBlock(hackSystemMessageFirstLine)] });
  //   console.log(`Anthropic: hotFixStartWithUser (${chatMessages.length} messages) - ${hackSystemMessageFirstLine}`);
  // }

  // Construct the request payload
  const payload: TRequest = {
    max_tokens: model.maxTokens !== undefined ? model.maxTokens
      : (model.id.includes('3-5-sonnet') ? 8192 : 4096), // see `max-tokens-3-5-sonnet-2024-07-15`, and [2024-10-22] max from https://docs.anthropic.com/en/docs/about-claude/models
    model: model.id,
    system: systemMessage,
    messages: chatMessages,
    tools: chatGenerate.tools && _toAnthropicTools(chatGenerate.tools),
    tool_choice: chatGenerate.toolsPolicy && _toAnthropicToolChoice(chatGenerate.toolsPolicy),
    // metadata: { user_id: ... }
    // stop_sequences: undefined,
    stream: streaming,
    temperature: model.temperature !== undefined ? model.temperature : undefined,
    // top_k: undefined,
    // top_p: undefined,
  };

  // Top-P instead of temperature
  if (model.topP !== undefined) {
    payload.top_p = model.topP;
    delete payload.temperature
  }

  // Preemptive error detection with server-side payload validation before sending it upstream
  const validated = AnthropicWire_API_Message_Create.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.error('Anthropic: invalid messageCreate payload. Error:', validated.error.message);
    throw new Error(`Invalid sequence for Anthropic models: ${validated.error.errors?.[0]?.message || validated.error.message || validated.error}.`);
  }

  return validated.data;
}


function* _generateAnthropicMessagesContentBlocks({ parts, role }: AixMessages_ChatMessage): Generator<{
  role: 'user' | 'assistant',
  content: TRequest['messages'][number]['content'][number]
} | {
  set_cache_control: 'anthropic-ephemeral'
}> {
  if (parts.length < 1) return; // skip empty messages

  if (hotFixImagePartsFirst) {
    parts.sort((a, b) => {
      if (a.pt === 'inline_image' && b.pt !== 'inline_image') return -1;
      if (a.pt !== 'inline_image' && b.pt === 'inline_image') return 1;
      return 0;
    });
  }

  switch (role) {

    case 'user':
      for (const part of parts) {
        switch (part.pt) {

          case 'text':
            yield { role: 'user', content: AnthropicWire_Blocks.TextBlock(part.text) };
            break;

          case 'inline_image':
            yield { role: 'user', content: AnthropicWire_Blocks.ImageBlock(part.mimeType, part.base64) };
            break;

          case 'doc':
            yield { role: 'user', content: AnthropicWire_Blocks.TextBlock('```' + (part.ref || '') + '\n' + part.data.text + '\n```\n') };
            break;

          case 'meta_in_reference_to':
            const irtXMLString = inReferenceTo_To_XMLString(part);
            if (irtXMLString)
              yield { role: 'user', content: AnthropicWire_Blocks.TextBlock(irtXMLString) };
            break;

          case 'meta_cache_control':
            yield { set_cache_control: part.control };
            break;

          default:
            throw new Error(`Unsupported part type in User message: ${(part as any).pt}`);
        }
      }
      break;

    case 'model':
      for (const part of parts) {
        switch (part.pt) {

          case 'text':
            yield { role: 'assistant', content: AnthropicWire_Blocks.TextBlock(part.text) };
            break;

          case 'inline_image':
            // Example of mapping a model-generated image (even from other vendors, not just Anthropic) to a user message
            if (hotFixMapModelImagesToUser) {
              yield { role: 'user', content: AnthropicWire_Blocks.ImageBlock(part.mimeType, part.base64) };
            } else
              throw new Error('Model-generated images are not supported by Anthropic yet');
            break;

          case 'tool_invocation':
            let toolUseBlock;
            switch (part.invocation.type) {
              case 'function_call':
                toolUseBlock = AnthropicWire_Blocks.ToolUseBlock(part.id, part.invocation.name, part.invocation.args);
                break;
              case 'code_execution':
                toolUseBlock = AnthropicWire_Blocks.ToolUseBlock(part.id, 'execute_code' /* suboptimal */, part.invocation.code);
                break;
              default:
                throw new Error(`Unsupported tool call type in Model message: ${(part.invocation as any).type}`);
            }
            yield { role: 'assistant', content: toolUseBlock };
            break;

          case 'meta_cache_control':
            yield { set_cache_control: part.control };
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
            const toolErrorPrefix = part.error ? (typeof part.error === 'string' ? `[ERROR] ${part.error} - ` : '[ERROR] ') : '';
            switch (part.response.type) {
              case 'function_call':
                const fcTextParts = [AnthropicWire_Blocks.TextBlock(toolErrorPrefix + part.response.result)];
                yield { role: 'user', content: AnthropicWire_Blocks.ToolResultBlock(part.id, fcTextParts, part.error ? true : undefined) };
                break;
              case 'code_execution':
                const ceTextParts = [AnthropicWire_Blocks.TextBlock(toolErrorPrefix + part.response.result)];
                yield { role: 'user', content: AnthropicWire_Blocks.ToolResultBlock(part.id, ceTextParts, part.error ? true : undefined) };
                break;
              default:
                throw new Error(`Unsupported tool response type in Tool message: ${(part as any).pt}`);
            }
            break;

          default:
            throw new Error(`Unsupported part type in Tool message: ${(part as any).pt}`);
        }
      }
      break;
  }
}

function _toAnthropicTools(itds: AixTools_ToolDefinition[]): NonNullable<TRequest['tools']> {
  return itds.map(itd => {
    switch (itd.type) {

      case 'function_call':
        const { name, description, input_schema } = itd.function_call;
        return {
          type: 'custom', // we could not set it, but it helps our typesystem with discrimination
          name,
          description,
          input_schema: {
            type: 'object',
            properties: input_schema?.properties || null, // Anthropic valid values for input_schema.properties are 'object' or 'null' (null is used to declare functions with no inputs)
            required: input_schema?.required,
          },
        };

      case 'code_execution':
        throw new Error('Gemini code interpreter is not supported');

    }
  });
}

function _toAnthropicToolChoice(itp: AixTools_ToolsPolicy): NonNullable<TRequest['tool_choice']> {
  switch (itp.type) {
    case 'auto':
      return { type: 'auto' as const };
    case 'any':
      return { type: 'any' as const };
    case 'function_call':
      return { type: 'tool' as const, name: itp.function_call.name };
  }
}

export function inReferenceTo_To_XMLString(irt: AixParts_MetaInReferenceToPart): string | null {
  const refs = irt.referTo.map(r => escapeXml(r.mText));
  if (!refs.length)
    return null; // `<context>User provides no specific references</context>`;
  return refs.length === 1
    ? `<context>User refers to this in particular:<ref>${refs[0]}</ref></context>`
    : `<context>User refers to ${refs.length} items:<ref>${refs.join('</ref><ref>')}</ref></context>`;
}
