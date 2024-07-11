import type { IntakeChatGenerateRequest, IntakeModel } from '../../intake/schemas.intake.api';
import type { IntakeToolDefinition, IntakeToolsPolicy } from '../../intake/schemas.intake.tools';
import { anthropicWire_ImageBlock, AnthropicWire_MessageCreate, anthropicWire_MessageCreate_Schema, anthropicWire_TextBlock, anthropicWire_ToolResultBlock, anthropicWire_ToolUseBlock } from './anthropic.wiretypes';

const DEFAULT_MAX_TOKENS = 4096;


export function intakeToAnthropicMessageCreate(model: IntakeModel, chatGenerate: IntakeChatGenerateRequest, stream: boolean, conversionWarnings: string[]): AnthropicWire_MessageCreate {

  // Construct the request payload
  const { chatMessages, systemMessage } = _intakeToAnthropicMessages(chatGenerate.systemMessage, chatGenerate.chat, conversionWarnings);
  const payload: AnthropicWire_MessageCreate = {
    max_tokens: model.maxTokens ? model.maxTokens : DEFAULT_MAX_TOKENS,
    model: model.id,
    system: systemMessage,
    messages: chatMessages,
    tools: chatGenerate.tools && _intakeToAnthropicTools(chatGenerate.tools),
    tool_choice: chatGenerate.toolsPolicy && _intakeToAnthropicToolChoice(chatGenerate.toolsPolicy),
    // metadata: { user_id: ... }
    // stop_sequences: undefined,
    stream: stream,
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


function _intakeToAnthropicMessages(ism: IntakeChatGenerateRequest['systemMessage'], icms: IntakeChatGenerateRequest['chat'], conversionWarnings: string[]) {

  // fixes we apply
  const hotFixImagePartsFirst = true;

  // Convert the system message
  let systemMessage: AnthropicWire_MessageCreate['system'] = ism?.parts.length
    ? ism.parts.map((part) => anthropicWire_TextBlock(part.text))
    : undefined;

  // Transform the chat messages into Anthropic's format
  const chatMessages: AnthropicWire_MessageCreate['messages'] = icms.reduce((acc, im) => {

    // skip empty messages
    if (im.parts.length < 1) return acc;

    const imRole = im.role;
    const messageRole: AnthropicWire_MessageCreate['messages'][number]['role'] = (im.role === 'user' || im.role === 'tool') ? 'user' : 'assistant';
    const lastMessage: AnthropicWire_MessageCreate['messages'][number] | undefined = acc[acc.length - 1];
    const lastMessageRole = lastMessage?.role;

    // If the last message was from the same role, fuse this message with the last one
    let messageContent: AnthropicWire_MessageCreate['messages'][number]['content'];
    if (messageRole === lastMessageRole) {
      messageContent = lastMessage.content;
    } else {
      messageContent = [];
      acc.push({ role: messageRole, content: messageContent });
    }

    switch (im.role) {

      case 'user':
        // Claude works best when images come before text.
        // - https://docs.anthropic.com/en/docs/build-with-claude/vision

        // move 'inline_image' parts to the front
        const upfrontImageParts = [...im.parts];
        if (hotFixImagePartsFirst) {
          upfrontImageParts.sort((a, b) => {
            if (a.pt === 'inline_image' && b.pt !== 'inline_image') return -1;
            if (a.pt !== 'inline_image' && b.pt === 'inline_image') return 1;
            return 0;
          });
        }

        for (const userPart of upfrontImageParts) {
          switch (userPart.pt) {
            case 'text':
              messageContent.push(anthropicWire_TextBlock(userPart.text));
              break;
            case 'inline_image':
              messageContent.push(anthropicWire_ImageBlock(userPart.mimeType, userPart.base64));
              break;
            case 'doc':
              messageContent.push(anthropicWire_TextBlock(
                '```' + (userPart.ref || '') + '\n' + userPart.data.text + '\n```\n',
              ));
              break;
            case 'meta_reply_to':
              messageContent.push(anthropicWire_TextBlock(
                `<context>The user is referring to: ${userPart.replyTo}</context>`,
              ));
              break;
          }
        }
        break;

      case 'model':
        for (const modelPart of im.parts) {
          switch (modelPart.pt) {
            case 'text':
              messageContent.push(anthropicWire_TextBlock(modelPart.text));
              break;
            case 'inline_image':
              const modelGenImageBlock = anthropicWire_ImageBlock(modelPart.mimeType, modelPart.base64);
              // [Fixup] Anthropic: Bad Request - messages.N.content: all 'assistant' content blocks should be text
              // TODO....
              messageContent.push(modelGenImageBlock);
              break;
            case 'tool_call':
              messageContent.push(anthropicWire_ToolUseBlock(
                modelPart.id,
                modelPart.name,
                modelPart.args,
              ));
              break;
          }
        }
        break;

      case 'tool':
        for (let toolResponsePart of im.parts) {
          switch (toolResponsePart.pt) {
            case 'tool_response':
              // Notes:
              // - tool.name is not used (id only)
              // - content could support arrays of text and images, but we only pass a single string
              // - content may not even be present for a tool that just executed without output
              const responseContent = toolResponsePart.response ? [anthropicWire_TextBlock(toolResponsePart.response)] : [];
              messageContent.push(anthropicWire_ToolResultBlock(
                toolResponsePart.id,
                responseContent,
                toolResponsePart.isError,
              ));
              break;
          }
        }
        break;
    }

    return acc;
  }, [] as AnthropicWire_MessageCreate['messages']);

  return { chatMessages, systemMessage };
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
