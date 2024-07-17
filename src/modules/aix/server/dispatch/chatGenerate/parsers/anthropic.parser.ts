import { safeErrorString } from '~/server/wire';

import type { ChatGenerateMessageAction, ChatGenerateParseFunction } from './parsers.types';
import { AnthropicWire_API_Message_Create } from '../../wiretypes/anthropic.wiretypes';
import { ISSUE_SYMBOL, TEXT_SYMBOL_MAX_TOKENS } from '../chatGenerate.config';


export function createAnthropicMessageParser(): ChatGenerateParseFunction {
  let responseMessage: AnthropicWire_API_Message_Create.Response;
  let hasErrored = false;
  let messageStartTime: number | undefined = undefined;
  let chatInTokens: number | undefined = undefined;

  // Note: at this stage, the parser only returns the text content as text, which is streamed as text
  //       to the client. It is however building in parallel the responseMessage object, which is not
  //       yet used, but contains token counts, for instance.
  return function* (eventData: string, eventName?: string): Generator<ChatGenerateMessageAction> {

    // if we've errored, we should not be receiving more data
    if (hasErrored)
      console.log('Anthropic stream has errored already, but received more data:', eventData);

    switch (eventName) {
      // Ignore pings
      case 'ping':
        break;

      // M1. Initialize the message content for a new message
      case 'message_start':
        messageStartTime = Date.now();
        const isFirstMessage = !responseMessage;
        responseMessage = AnthropicWire_API_Message_Create.event_MessageStart_schema.parse(JSON.parse(eventData)).message;

        // -> Model
        if (isFirstMessage && responseMessage.model)
          yield { op: 'set', value: { model: responseMessage.model } };
        if (responseMessage.usage) {
          chatInTokens = responseMessage.usage.input_tokens;
          yield { op: 'set', value: { stats: { chatInTokens: chatInTokens, chatOutTokens: responseMessage.usage.output_tokens } } };
        }
        break;

      // M2. Initialize content block if needed
      case 'content_block_start':
        if (responseMessage) {
          const { index, content_block } = AnthropicWire_API_Message_Create.event_ContentBlockStart_schema.parse(JSON.parse(eventData));
          if (responseMessage.content[index] !== undefined)
            throw new Error(`Unexpected content block start location (${index})`);
          responseMessage.content[index] = content_block;

          switch (content_block.type) {
            case 'text':
              yield { op: 'text', text: content_block.text };
              break;
            case 'tool_use':
              yield { op: 'text', text: `TODO: [Tool Use] ${content_block.id} ${content_block.name} ${content_block.input}` };
              break;
          }
        } else
          throw new Error('Unexpected content_block_start');
        break;

      // M3+. Append delta text to the current message content
      case 'content_block_delta':
        if (responseMessage) {
          const { index, delta } = AnthropicWire_API_Message_Create.event_ContentBlockDelta_schema.parse(JSON.parse(eventData));
          if (responseMessage.content[index] === undefined)
            throw new Error(`Unexpected content block delta location (${index})`);

          switch (delta.type) {
            case 'text_delta':
              if (responseMessage.content[index].type === 'text') {
                responseMessage.content[index].text += delta.text;
                yield { op: 'text', text: delta.text };
              }
              break;

            case 'input_json_delta':
              if (responseMessage.content[index].type === 'tool_use') {
                responseMessage.content[index].input += delta.partial_json;
                yield { op: 'text', text: `[${delta.partial_json}]` };
              }
              break;

            default:
              throw new Error(`Unexpected content block delta type: ${(delta as any).type}`);
          }
        } else
          throw new Error('Unexpected content_block_delta');
        break;

      // Finalize content block if needed.
      case 'content_block_stop':
        if (responseMessage) {
          const { index } = AnthropicWire_API_Message_Create.event_ContentBlockStop_schema.parse(JSON.parse(eventData));
          if (responseMessage.content[index] === undefined)
            throw new Error(`Unexpected content block stop location (${index})`);

          // Signal that the tool is ready? (if it is...)
        } else
          throw new Error('Unexpected content_block_stop');
        break;

      // Optionally handle top-level message changes. Example: updating stop_reason
      case 'message_delta':
        if (responseMessage) {
          const { delta, usage } = AnthropicWire_API_Message_Create.event_MessageDelta_schema.parse(JSON.parse(eventData));
          Object.assign(responseMessage, delta);
          if (usage?.output_tokens && messageStartTime) {
            const elapsedTimeSeconds = (Date.now() - messageStartTime) / 1000;
            const chatOutRate = elapsedTimeSeconds > 0 ? usage.output_tokens / elapsedTimeSeconds : 0;
            yield {
              op: 'set', value: {
                stats: {
                  chatInTokens: chatInTokens !== null ? chatInTokens : -1,
                  chatOutTokens: usage.output_tokens,
                  chatOutRate: Math.round(chatOutRate * 100) / 100, // Round to 2 decimal places
                  timeInner: elapsedTimeSeconds,
                },
              },
            };
          }
        } else
          throw new Error('Unexpected message_delta');
        break;

      // We can now close the message
      case 'message_stop':
        AnthropicWire_API_Message_Create.event_MessageStop_schema.parse(JSON.parse(eventData));
        return yield { op: 'parser-close' };

      // UNDOCUMENTED - Occasionaly, the server will send errors, such as {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}
      case 'error':
        hasErrored = true;
        const { error } = JSON.parse(eventData);
        const errorText = (error.type && error.message) ? `${error.type}: ${error.message}` : safeErrorString(error);
        yield { op: 'issue', issue: errorText || 'unknown server issue.', symbol: ISSUE_SYMBOL };
        return yield { op: 'parser-close' };

      default:
        throw new Error(`Unexpected event name: ${eventName}`);
    }
  };
}


export function createAnthropicMessageParserNS(): ChatGenerateParseFunction {
  let messageStartTime: number = Date.now();

  return function* (fullData: string): Generator<ChatGenerateMessageAction> {

    // parse with validation (e.g. type: 'message' && role: 'assistant')
    const {
      model,
      content,
      stop_reason,
      usage,
    } = AnthropicWire_API_Message_Create.Response_schema.parse(JSON.parse(fullData));

    // -> Model
    if (model)
      yield { op: 'set', value: { model } };

    // -> Content Blocks
    for (let i = 0; i < content.length; i++) {
      const contentBlock = content[i];
      const isLastBlock = i === content.length - 1;
      switch (contentBlock.type) {
        case 'text':
          const hitMaxTokens = (isLastBlock && stop_reason === 'max_tokens') ? ` ${TEXT_SYMBOL_MAX_TOKENS}` : '';
          yield { op: 'text', text: contentBlock.text + hitMaxTokens };
          break;
        case 'tool_use':
          yield { op: 'text', text: `TODO: [Tool Use] ${contentBlock.id} ${contentBlock.name} ${JSON.stringify(contentBlock.input)}` };
          break;
        default:
          throw new Error(`Unexpected content block type: ${(contentBlock as any).type}`);
      }
    }

    // -> Stats
    if (usage) {
      const elapsedTimeSeconds = (Date.now() - messageStartTime) / 1000;
      const chatOutRate = elapsedTimeSeconds > 0 ? usage.output_tokens / elapsedTimeSeconds : 0;
      yield {
        op: 'set', value: {
          stats: {
            chatInTokens: usage.input_tokens,
            chatOutTokens: usage.output_tokens,
            chatOutRate: Math.round(chatOutRate * 100) / 100, // Round to 2 decimal places
            timeInner: elapsedTimeSeconds,
          },
        },
      };
    }
  };
}
