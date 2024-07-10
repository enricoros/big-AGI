import { OpenAIModelSchema } from '~/modules/llms/server/openai/openai.router';
import { AnthropicWireMessageCreate, anthropicWireMessageCreateSchema } from '~/modules/aix/server/dispatch/anthropic/anthropic.wiretypes';
import type { IntakeChatGenerateRequest } from '../../intake/schemas.intake.api';

const DEFAULT_MAX_TOKENS = 1024;

export function NEWanthropicMessagesPayloadOrThrow(model: OpenAIModelSchema, chatGenerate: IntakeChatGenerateRequest, stream: boolean): AnthropicWireMessageCreate {
  // Extract system message
  const systemMessage = chatGenerate.systemMessage?.parts.find(part => part.pt === 'text')?.text;

  // Transform the chat messages into Anthropic's format
  const messages: AnthropicWireMessageCreate['messages'] = chatGenerate.chat.reduce((acc, message) => {
    const anthropicRole = message.role === 'model' ? 'assistant' : 'user';
    const content = message.parts.map(part => {
      switch (part.pt) {
        case 'text':
          return { type: 'text' as const, text: part.text };
        case 'inline_image':
          return {
            type: 'image' as const,
            source: {
              type: 'base64',
              media_type: part.mimeType,
              data: part.base64,
            },
          };
        case 'tool_call':
        case 'tool_response':
          // These might need special handling depending on Anthropic's API
          console.warn('Tool calls and results are not directly supported in this conversion');
          return null;
        default:
          console.warn(`Unsupported part type: ${(part as any).pt}`);
          return null;
      }
    }).filter(Boolean);

    if (content.length > 0) {
      acc.push({ role: anthropicRole, content: content as any  /*FIXME*/ });
    }
    return acc;
  }, [] as AnthropicWireMessageCreate['messages']);

  // Ensure the first message is from the user
  if (messages.length === 0 || messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: [{ type: 'text', text: systemMessage || '' }] });
  }

  // Construct the request payload
  const payload: AnthropicWireMessageCreate = {
    model: model.id,
    messages,
    max_tokens: model.maxTokens || DEFAULT_MAX_TOKENS,
    stream,
    ...(model.temperature !== undefined && { temperature: model.temperature }),
    ...(systemMessage && { system: [{ type: 'text', text: systemMessage }] }),
  };

  // // Handle tools and tool policy
  // if (chatGenerate.tools && chatGenerate.tools.length > 0) {
  //   payload.tools = chatGenerate.tools.map(tool => ({
  //     name: tool.name,
  //     description: tool.description,
  //     input_schema: {
  //       type: 'object',
  //       properties: tool.parameters.properties,
  //       required: tool.parameters.required,
  //     },
  //   }));
  //
  //   if (chatGenerate.toolsPolicy) {
  //     switch (chatGenerate.toolsPolicy.type) {
  //       case 'auto':
  //         payload.tool_choice = { type: 'auto' };
  //         break;
  //       case 'any':
  //         payload.tool_choice = { type: 'any' };
  //         break;
  //       case 'force':
  //         payload.tool_choice = { type: 'tool', name: chatGenerate.toolsPolicy.name };
  //         break;
  //     }
  //   }
  // }

  // Validate the payload against the schema to ensure correctness
  const validated = anthropicWireMessageCreateSchema.safeParse(payload);
  if (!validated.success)
    throw new Error(`Invalid message sequence for Anthropic models: ${validated.error.errors?.[0]?.message || validated.error}`);

  return validated.data;
}