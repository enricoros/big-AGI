import type { Intake_ChatGenerateRequest, Intake_Model } from '../../../intake/schemas.intake.api';
import type { Intake_ChatMessage } from '../../../intake/schemas.intake.messages';
import type { Intake_ToolDefinition, Intake_ToolsPolicy } from '../../../intake/schemas.intake.tools';
import { AnthropicWire_API_Message_Create, AnthropicWire_Blocks } from '~/modules/aix/server/dispatch/wiretypes/anthropic.wiretypes';


// configuration
const hotFixImagePartsFirst = true;
const hotFixMapModelImagesToUser = true;
const hotFixMissingTokens = 4096; // [2024-07-12] max from https://docs.anthropic.com/en/docs/about-claude/models


type TRequest = AnthropicWire_API_Message_Create.Request;

export function intakeToAnthropicMessageCreate(model: Intake_Model, chatGenerate: Intake_ChatGenerateRequest, streaming: boolean): TRequest {

  // Convert the system message
  const systemMessage: TRequest['system'] = chatGenerate.systemMessage?.parts.length
    ? chatGenerate.systemMessage.parts.map((part) => AnthropicWire_Blocks.TextBlock(part.text))
    : undefined;

  // Transform the chat messages into Anthropic's format
  const chatMessages: TRequest['messages'] = [];
  let currentMessage: TRequest['messages'][number] | null = null;
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
  const payload: TRequest = {
    max_tokens: model.maxTokens !== undefined ? model.maxTokens : hotFixMissingTokens,
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

  // Preemptive error detection with server-side payload validation before sending it upstream
  const validated = AnthropicWire_API_Message_Create.Request_schema.safeParse(payload);
  if (!validated.success)
    throw new Error(`Invalid message sequence for Anthropic models: ${validated.error.errors?.[0]?.message || validated.error.message || validated.error}`);

  return validated.data;
}


function* _generateAnthropicMessagesContentBlocks({ parts, role }: Intake_ChatMessage): Generator<{
  role: 'user' | 'assistant',
  content: TRequest['messages'][number]['content'][number]
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
          case 'meta_reply_to':
            yield { role: 'user', content: AnthropicWire_Blocks.TextBlock(`<context>The user is referring to: ${part.replyTo}</context>`) };
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
            // Example of mapping a model-generated image to a user message
            if (hotFixMapModelImagesToUser) {
              yield { role: 'user', content: AnthropicWire_Blocks.ImageBlock(part.mimeType, part.base64) };
            } else
              throw new Error('Model-generated images are not supported by Anthropic yet');
            break;
          case 'tool_call':
            yield { role: 'assistant', content: AnthropicWire_Blocks.ToolUseBlock(part.id, part.name, part.args) };
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
            const responseContent = part.response ? [AnthropicWire_Blocks.TextBlock(part.response)] : [];
            yield { role: 'user', content: AnthropicWire_Blocks.ToolResultBlock(part.id, responseContent, part.isError) };
            break;
          default:
            throw new Error(`Unsupported part type in Tool message: ${(part as any).pt}`);
        }
      }
      break;
  }
}

function _intakeToAnthropicTools(itds: Intake_ToolDefinition[]): NonNullable<TRequest['tools']> {
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
        throw new Error('Gemini code interpreter is not supported');
      case 'preprocessor':
        throw new Error('Preprocessors are not supported yet');
    }
  });
}

function _intakeToAnthropicToolChoice(itp: Intake_ToolsPolicy): NonNullable<TRequest['tool_choice']> {
  switch (itp.type) {
    case 'auto':
      return { type: 'auto' as const };
    case 'any':
      return { type: 'any' as const };
    case 'function_call':
      return { type: 'tool' as const, name: itp.function_call.name };
  }
}
