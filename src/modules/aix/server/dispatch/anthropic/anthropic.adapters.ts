import type { IntakeChatGenerateRequest, IntakeModel } from '../../intake/schemas.intake.api';
import type { IntakeChatMessage } from '../../intake/schemas.intake.parts';
import type { IntakeToolDefinition, IntakeToolsPolicy } from '../../intake/schemas.intake.tools';

import { anthropicWire_ImageBlock, AnthropicWire_MessageCreate, anthropicWire_MessageCreate_Schema, anthropicWire_TextBlock, anthropicWire_ToolResultBlock, anthropicWire_ToolUseBlock } from './anthropic.wiretypes';


// configuration
const hotFixImagePartsFirst = true;
const hotFixMapModelImagesToUser = true;

const DEFAULT_MAX_TOKENS = 4096;


export function intakeToAnthropicMessageCreate(model: IntakeModel, chatGenerate: IntakeChatGenerateRequest, streaming: boolean): AnthropicWire_MessageCreate {

  // Convert the system message
  const systemMessage: AnthropicWire_MessageCreate['system'] = chatGenerate.systemMessage?.parts.length
    ? chatGenerate.systemMessage.parts.map((part) => anthropicWire_TextBlock(part.text))
    : undefined;

  // Transform the chat messages into Anthropic's format
  const chatMessages: AnthropicWire_MessageCreate['messages'] = [];
  let currentMessage: AnthropicWire_MessageCreate['messages'][number] | null = null;
  for (const intakeChatMessage of chatGenerate.chatSequence) {
    for (const { role, content } of _generateAnthropicMessagesContentBlocks(intakeChatMessage)) {
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

  // Construct the request payload
  const payload: AnthropicWire_MessageCreate = {
    max_tokens: model.maxTokens ? model.maxTokens : DEFAULT_MAX_TOKENS,
    model: model.id,
    system: systemMessage,
    messages: chatMessages,
    tools: chatGenerate.tools && _intakeToAnthropicTools(chatGenerate.tools),
    tool_choice: chatGenerate.toolsPolicy && _intakeToAnthropicToolChoice(chatGenerate.toolsPolicy),
    // metadata: { user_id: ... }
    // stop_sequences: undefined,
    stream: streaming,
    temperature: model.temperature !== undefined ? model.temperature : undefined,
    // top_k: undefined,
    // top_p: undefined,
  };

  // Validate the payload on the server rathen than upstream, to catch issues early
  const validated = anthropicWire_MessageCreate_Schema.safeParse(payload);
  if (!validated.success)
    throw new Error(`Invalid message sequence for Anthropic models: ${validated.error.errors?.[0]?.message || validated.error}`);

  return validated.data;
}


function* _generateAnthropicMessagesContentBlocks({ parts, role }: IntakeChatMessage): Generator<{
  role: 'user' | 'assistant',
  content: AnthropicWire_MessageCreate['messages'][number]['content'][number]
}> {
  if (parts.length < 1) return; // skip empty messages

  if (hotFixImagePartsFirst) {
    parts.sort((a, b) => {
      if (a.pt === 'inline_image' && b.pt !== 'inline_image') return -1;
      if (a.pt !== 'inline_image' && b.pt === 'inline_image') return 1;
      return 0;
    });
  }

  for (const part of parts) {
    switch (role) {
      case 'user':
        switch (part.pt) {
          case 'text':
            yield { role: 'user', content: anthropicWire_TextBlock(part.text) };
            break;
          case 'inline_image':
            yield { role: 'user', content: anthropicWire_ImageBlock(part.mimeType, part.base64) };
            break;
          case 'doc':
            yield { role: 'user', content: anthropicWire_TextBlock('```' + (part.ref || '') + '\n' + part.data.text + '\n```\n') };
            break;
          case 'meta_reply_to':
            yield { role: 'user', content: anthropicWire_TextBlock(`<context>The user is referring to: ${part.replyTo}</context>`) };
            break;
          default:
            throw new Error(`Unsupported part type in User message: ${part.pt}`);
        }
        break;

      case 'model':
        switch (part.pt) {
          case 'text':
            yield { role: 'assistant', content: anthropicWire_TextBlock(part.text) };
            break;
          case 'inline_image':
            // Example of mapping a model-generated image to a user message
            if (hotFixMapModelImagesToUser) {
              yield { role: 'user', content: anthropicWire_ImageBlock(part.mimeType, part.base64) };
            } else
              throw new Error('Model-generated images are not supported by Anthropic yet');
            break;
          case 'tool_call':
            yield { role: 'assistant', content: anthropicWire_ToolUseBlock(part.id, part.name, part.args) };
            break;
          default:
            throw new Error(`Unsupported part type in Model message: ${part.pt}`);
        }
        break;

      case 'tool':
        switch (part.pt) {
          case 'tool_response':
            const responseContent = part.response ? [anthropicWire_TextBlock(part.response)] : [];
            yield { role: 'user', content: anthropicWire_ToolResultBlock(part.id, responseContent, part.isError) };
            break;
          default:
            throw new Error(`Unsupported part type in Tool message: ${part.pt}`);
        }
        break;
    }
  }
}

function _intakeToAnthropicTools(itds: IntakeToolDefinition[]): NonNullable<AnthropicWire_MessageCreate['tools']> {
  return itds.map(itd => {
    switch (itd.type) {
      case 'function_call':
        const { name, description, input_schema } = itd.function_call;
        return {
          name,
          description,
          input_schema: {
            type: 'object',
            properties: input_schema?.properties,
            required: input_schema?.required,
          },
        };
      case 'gemini_code_interpreter':
        throw new Error('Gemini code interpreter is not supported by Anthropic');
      case 'preprocessor':
        throw new Error('Preprocessors are not supported by Anthropic yet');
    }
  });
}

function _intakeToAnthropicToolChoice(itp: IntakeToolsPolicy): NonNullable<AnthropicWire_MessageCreate['tool_choice']> {
  switch (itp.type) {
    case 'auto':
      return { type: 'auto' as const };
    case 'any':
      return { type: 'any' as const };
    case 'function_call':
      return { type: 'tool' as const, name: itp.function_call.name };
  }
}
