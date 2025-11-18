import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixTools_ToolDefinition, AixTools_ToolsPolicy } from '../../../api/aix.wiretypes';
import { AnthropicWire_API_Message_Create, AnthropicWire_Blocks } from '../../wiretypes/anthropic.wiretypes';

import { aixSpillShallFlush, aixSpillSystemToUser, approxDocPart_To_String, approxInReferenceTo_To_XMLString } from './adapters.common';


// configuration
const hotFixImagePartsFirst = true;
const hotFixMapModelImagesToUser = true;
const hotFixDisableThinkingWhenToolsForced = true; // "Thinking may not be enabled when tool_choice forces tool use."

// former fixes, now removed
// const hackyHotFixStartWithUser = false; // 2024-10-22: no longer required


type TRequest = AnthropicWire_API_Message_Create.Request;

export function aixToAnthropicMessageCreate(model: AixAPI_Model, _chatGenerate: AixAPIChatGenerate_Request, streaming: boolean): TRequest {

  // Pre-process CGR - approximate spill of System to User message
  const chatGenerate = aixSpillSystemToUser(_chatGenerate);

  // Convert the system message
  let systemMessage: TRequest['system'] = undefined;
  if (chatGenerate.systemMessage?.parts.length) {
    systemMessage = chatGenerate.systemMessage.parts.reduce((acc, part) => {
      switch (part.pt) {

        case 'text':
          acc.push(AnthropicWire_Blocks.TextBlock(part.text));
          break;

        case 'doc':
          acc.push(AnthropicWire_Blocks.TextBlock(approxDocPart_To_String(part)));
          break;

        case 'inline_image':
          // we have already removed image parts from the system message
          throw new Error('Anthropic: images have to be in user messages, not in system message');

        case 'meta_cache_control':
          if (!acc.length)
            console.warn('Anthropic: cache_control without a message to attach to');
          else if (part.control !== 'anthropic-ephemeral')
            console.warn('Anthropic: cache_control with an unsupported value:', part.control);
          else
            AnthropicWire_Blocks.blockSetCacheControl(acc[acc.length - 1], 'ephemeral');
          break;

        default:
          const _exhaustiveCheck: never = part;
          throw new Error(`Unsupported part type in System message: ${(part as any).pt}`);
      }
      return acc;
    }, [] as Exclude<TRequest['system'], undefined>);

    // unset system message if empty
    if (!systemMessage.length)
      systemMessage = undefined;
  }

  // Transform the chat messages into Anthropic's format
  const chatMessages: TRequest['messages'] = [];
  let currentMessage: TRequest['messages'][number] | null = null;
  for (const aixMessage of chatGenerate.chatSequence) {
    for (const antPart of _generateAnthropicMessagesContentBlocks(aixMessage)) {
      // apply cache_control to the current head block of the current message
      if ('set_cache_control' in antPart) {
        if (currentMessage && currentMessage.content.length) {
          const lastBlock = currentMessage.content[currentMessage.content.length - 1];
          if (lastBlock.type !== 'thinking' && lastBlock.type !== 'redacted_thinking')
            AnthropicWire_Blocks.blockSetCacheControl(lastBlock, 'ephemeral');
          else
            console.warn('Anthropic: cache_control on a thinking block - not allowed');
        } else
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

    // Flush: interrupt batching within the same-role and finalize the current message
    if (aixSpillShallFlush(aixMessage) && currentMessage) {
      chatMessages.push(currentMessage);
      currentMessage = null;
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
    max_tokens: model.maxTokens !== undefined ? model.maxTokens : 8192,
    model: model.id,
    system: systemMessage,
    messages: chatMessages,
    tools: chatGenerate.tools && _toAnthropicTools(chatGenerate.tools),
    tool_choice: chatGenerate.toolsPolicy && _toAnthropicToolChoice(chatGenerate.toolsPolicy),
    // metadata: { user_id: ... }
    // stop_sequences: undefined,
    stream: streaming,
    ...(model.temperature !== null ? { temperature: model.temperature !== undefined ? model.temperature : undefined } : {}),
    // top_k: undefined,
    // top_p: undefined,
  };

  // Top-P instead of temperature
  if (model.topP !== undefined) {
    payload.top_p = model.topP;
    delete payload.temperature;
  }

  // [Anthropic] Thinking Budget
  const areToolCallsRequired = payload.tool_choice && typeof payload.tool_choice === 'object' && (payload.tool_choice.type === 'any' || payload.tool_choice.type === 'tool');
  const canUseThinking = !areToolCallsRequired || !hotFixDisableThinkingWhenToolsForced;
  if (model.vndAntThinkingBudget !== undefined && canUseThinking) {
    payload.thinking = model.vndAntThinkingBudget !== null ? {
      type: 'enabled',
      budget_tokens: model.vndAntThinkingBudget < payload.max_tokens ? model.vndAntThinkingBudget : payload.max_tokens - 1,
    } : {
      type: 'disabled',
    };
    delete payload.temperature;
  }

  // --- Tools ---

  // Allow/deny auto-adding hosted tools when custom tools are present
  const hasCustomTools = chatGenerate.tools?.some(t => t.type === 'function_call');
  const hasRestrictivePolicy = chatGenerate.toolsPolicy?.type === 'any' || chatGenerate.toolsPolicy?.type === 'function_call';
  const skipHostedToolsDueToCustomTools = hasCustomTools && hasRestrictivePolicy;

  // Hosted tools
  if (!skipHostedToolsDueToCustomTools) {
    const hostedTools: NonNullable<TRequest['tools']> = [];

    // Web Search Tool
    if (model.vndAntWebSearch === 'auto') {
      hostedTools.push({
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 10, // Allow up to 10 progressive searches // FIXME: HARDCODED
      });
    }

    // Web Fetch Tool
    if (model.vndAntWebFetch === 'auto') {
      hostedTools.push({
        type: 'web_fetch_20250910',
        name: 'web_fetch',
        max_uses: 5, // Allow up to 5 fetches
        citations: { enabled: true }, // Enable citations
      });
    }

    // Merge hosted tools with custom tools
    if (hostedTools.length > 0) {
      payload.tools = payload.tools ? [...payload.tools, ...hostedTools] : hostedTools;
    }
  }

  // --- Skills Container ---

  // Add Skills container if enabled (non-empty string)
  if (model.vndAntSkills) {

    // Parse comma-separated string and convert to Anthropic format
    const skillIds = model.vndAntSkills.split(',').map((s: string) => s.trim()).filter((s: string) => s);

    if (skillIds.length > 0) {

      // request a container with those selected skills
      payload.container = {
        skills: skillIds.map((skillId: string) => ({
          type: 'anthropic' as const,
          skill_id: skillId,
          version: 'latest',
        })),
      };

      // also require the code_execution tool (required by Skills)
      if (!payload.tools?.length)
        payload.tools = [];

      if (!payload.tools.some(t => t.type === 'code_execution_20250825'))
        payload.tools.push({ type: 'code_execution_20250825', name: 'code_execution' });
    }
  }


  // Preemptive error detection with server-side payload validation before sending it upstream
  const validated = AnthropicWire_API_Message_Create.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.error('Anthropic: invalid messageCreate payload. Error:', validated.error.message);
    throw new Error(`Invalid sequence for Anthropic models: ${validated.error.issues?.[0]?.message || validated.error.message || validated.error}.`);
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
            yield { role: 'user', content: AnthropicWire_Blocks.TextBlock(approxDocPart_To_String(part)) };
            break;

          case 'meta_in_reference_to':
            const irtXMLString = approxInReferenceTo_To_XMLString(part);
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

          case 'inline_audio':
            // Anthropic does not support inline audio, if we got to this point, we should throw an error
            throw new Error('Model-generated inline audio is not supported by Anthropic yet');

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
                const _exhaustiveCheck: never = part.invocation;
                throw new Error(`Unsupported tool call type in Model message: ${(part.invocation as any).type}`);
            }
            yield { role: 'assistant', content: toolUseBlock };
            break;

          case 'ma':
            if (!part.aText && !part.textSignature && !part.redactedData)
              throw new Error('Extended Thinking data is missing');
            if (part.aText && part.textSignature)
              yield { role: 'assistant', content: AnthropicWire_Blocks.ThinkingBlock(part.aText, part.textSignature) };
            for (const redactedData of part.redactedData || [])
              yield { role: 'assistant', content: AnthropicWire_Blocks.RedactedThinkingBlock(redactedData) };
            break;

          case 'meta_cache_control':
            yield { set_cache_control: part.control };
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
