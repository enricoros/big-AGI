// noinspection JSUnusedLocalSymbols

import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixTools_ToolDefinition, AixTools_ToolsPolicy } from '../../../api/aix.wiretypes';

import { BedrockConverseWire_API } from '../../wiretypes/bedrock-converse.wiretypes';

import { aixSpillShallFlush, aixSpillSystemToUser, approxDocPart_To_String, approxInReferenceTo_To_XMLString } from './adapters.common';


type TRequest = BedrockConverseWire_API.Request;


export function aixToBedrockConverse(model: AixAPI_Model, _chatGenerate: AixAPIChatGenerate_Request): TRequest {

  // Pre-process CGR - spill images from system to user message
  const chatGenerate = aixSpillSystemToUser(_chatGenerate);

  // Convert the system message
  let systemContent: TRequest['system'] = undefined;
  if (chatGenerate.systemMessage?.parts.length) {
    const systemParts: NonNullable<TRequest['system']> = [];
    for (const part of chatGenerate.systemMessage.parts) {
      switch (part.pt) {

        case 'text':
          systemParts.push({ text: part.text });
          break;

        case 'doc':
          systemParts.push({ text: approxDocPart_To_String(part) });
          break;

        case 'inline_image':
          // images have been spilled to user messages already
          throw new Error('Bedrock Converse: images cannot be in system messages');

        case 'meta_cache_control':
          // Converse API does not support cache control - skip
          break;

        default:
          const _exhaustiveCheck: never = part;
          throw new Error(`Unsupported part type in System message: ${(part as any).pt}`);
      }
    }
    if (systemParts.length)
      systemContent = systemParts;
  }

  // Transform chat messages
  const chatMessages: TRequest['messages'] = [];
  let currentMessage: TRequest['messages'][number] | null = null;
  for (const aixMessage of chatGenerate.chatSequence) {
    for (const convPart of _generateConverseContentBlocks(aixMessage)) {
      const { role, content } = convPart;
      if (!currentMessage || currentMessage.role !== role) {
        if (currentMessage)
          chatMessages.push(currentMessage);
        currentMessage = { role, content: [] };
      }
      currentMessage.content.push(content);
    }

    // Flush: interrupt batching and finalize the current message
    if (aixSpillShallFlush(aixMessage) && currentMessage) {
      chatMessages.push(currentMessage);
      currentMessage = null;
    }
  }
  if (currentMessage)
    chatMessages.push(currentMessage);

  // Build inference configuration
  const inferenceConfig: NonNullable<TRequest['inferenceConfig']> = {};
  if (model.maxTokens !== undefined)
    inferenceConfig.maxTokens = model.maxTokens;
  if (model.temperature !== undefined && model.temperature !== null)
    inferenceConfig.temperature = model.temperature;
  if (model.topP !== undefined)
    inferenceConfig.topP = model.topP;

  // Build tool configuration
  let toolConfig: TRequest['toolConfig'] = undefined;
  if (chatGenerate.tools?.length) {
    const tools = _toConverseTools(chatGenerate.tools);
    if (tools.length) {
      toolConfig = { tools };
      if (chatGenerate.toolsPolicy)
        toolConfig.toolChoice = _toConverseToolChoice(chatGenerate.toolsPolicy);
    }
  }

  // Assemble request
  return {
    ...(systemContent ? { system: systemContent } : {}),
    messages: chatMessages,
    ...(Object.keys(inferenceConfig).length ? { inferenceConfig } : {}),
    ...(toolConfig ? { toolConfig } : {}),
  };
}


function* _generateConverseContentBlocks({ parts, role }: AixMessages_ChatMessage): Generator<{
  role: 'user' | 'assistant',
  content: NonNullable<TRequest['messages'][number]['content'][number]>
}> {
  if (parts.length < 1) return;

  switch (role) {

    case 'user':
      for (const part of parts) {
        switch (part.pt) {

          case 'text':
            yield { role: 'user', content: { text: part.text } };
            break;

          case 'inline_image': {
            const format = _mimeToConverseFormat(part.mimeType);
            yield { role: 'user', content: { image: { format, source: { bytes: part.base64 } } } };
            break;
          }

          case 'doc':
            yield { role: 'user', content: { text: approxDocPart_To_String(part) } };
            break;

          case 'meta_in_reference_to':
            const irtXMLString = approxInReferenceTo_To_XMLString(part);
            if (irtXMLString)
              yield { role: 'user', content: { text: irtXMLString } };
            break;

          case 'meta_cache_control':
            // Converse API does not support cache control - skip
            break;

          default:
            const _exhaustiveCheck: never = part;
            throw new Error(`Unsupported part type in User message: ${(part as any).pt}`);
        }
      }
      break;

    case 'model':
      for (const part of parts) {
        switch (part.pt) {

          case 'text':
            yield { role: 'assistant', content: { text: part.text } };
            break;

          case 'inline_audio':
            // Converse API does not support inline audio in messages
            console.log('[DEV] [Bedrock Converse] Skipping inline audio part in model message');
            break;

          case 'inline_image':
            // Model-generated images: skip (Converse doesn't support images in assistant messages)
            console.log('[DEV] [Bedrock Converse] Skipping inline image part in model message');
            break;

          case 'tool_invocation':
            switch (part.invocation.type) {
              case 'function_call':
                let inputObj: object;
                try {
                  inputObj = part.invocation.args ? JSON.parse(part.invocation.args) : {};
                } catch {
                  inputObj = {};
                }
                yield { role: 'assistant', content: { toolUse: { toolUseId: part.id, name: part.invocation.name, input: inputObj } } };
                break;
              case 'code_execution':
                // Converse API does not have native code execution - skip
                break;
              default:
                const _exhaustiveCheck: never = part.invocation;
                throw new Error(`Unsupported tool call type: ${(part.invocation as any).type}`);
            }
            break;

          case 'ma':
            // Extended thinking / reasoning - Converse API does not support thinking blocks, skip
            break;

          case 'meta_cache_control':
            // Converse API does not support cache control - skip
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
            switch (part.response.type) {
              case 'function_call':
              case 'code_execution':
                yield {
                  role: 'user', content: {
                    toolResult: {
                      toolUseId: part.id,
                      content: [{ text: toolErrorPrefix + part.response.result }],
                      ...(part.error ? { status: 'error' as const } : {}),
                    },
                  },
                };
                break;
              default:
                const _exhaustiveCheck: never = part.response;
                throw new Error(`Unsupported tool response type: ${(part as any).pt}`);
            }
            break;

          case 'meta_cache_control':
            // ignored in tools
            break;

          default:
            const _exhaustiveCheck: never = part;
            throw new Error(`Unsupported part type in Tool message: ${(part as any).pt}`);
        }
      }
      break;
  }
}


function _toConverseTools(itds: AixTools_ToolDefinition[]): NonNullable<TRequest['toolConfig']>['tools'] {
  return itds.reduce((acc, itd) => {
    switch (itd.type) {
      case 'function_call':
        const { name, description, input_schema } = itd.function_call;
        acc.push({
          toolSpec: {
            name,
            ...(description ? { description } : {}),
            inputSchema: {
              json: {
                type: 'object',
                properties: input_schema?.properties || {},
                ...(input_schema?.required ? { required: input_schema.required } : {}),
              },
            },
          },
        });
        break;

      case 'code_execution':
        // Converse API does not support code execution tools - skip
        console.log('[DEV] [Bedrock Converse] Skipping code execution tool definition');
        break;
    }
    return acc;
  }, [] as NonNullable<TRequest['toolConfig']>['tools']);
}

function _toConverseToolChoice(itp: AixTools_ToolsPolicy): NonNullable<NonNullable<TRequest['toolConfig']>['toolChoice']> {
  switch (itp.type) {
    case 'auto':
      return { auto: {} };
    case 'any':
      return { any: {} };
    case 'function_call':
      return { tool: { name: itp.function_call.name } };
  }
}

function _mimeToConverseFormat(mimeType: string): 'png' | 'jpeg' | 'gif' | 'webp' {
  const sub = mimeType.split('/')[1];
  switch (sub) {
    case 'png':
      return 'png';
    case 'jpeg':
    case 'jpg':
      return 'jpeg';
    case 'gif':
      return 'gif';
    case 'webp':
      return 'webp';
    default:
      return 'jpeg'; // fallback
  }
}
