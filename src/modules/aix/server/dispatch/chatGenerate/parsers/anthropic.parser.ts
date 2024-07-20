import { safeErrorString } from '~/server/wire';

import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import { IssueSymbols, PartTransmitter } from '../../../api/PartTransmitter';

import { AnthropicWire_API_Message_Create } from '../../wiretypes/anthropic.wiretypes';


export function createAnthropicMessageParser(): ChatGenerateParseFunction {
  let responseMessage: AnthropicWire_API_Message_Create.Response;
  let hasErrored = false;
  let messageStartTime: number | undefined = undefined;
  let chatInTokens: number | undefined = undefined;

  // Note: at this stage, the parser only returns the text content as text, which is streamed as text
  //       to the client. It is however building in parallel the responseMessage object, which is not
  //       yet used, but contains token counts, for instance.
  return function(pt: PartTransmitter, eventData: string, eventName?: string): void {

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

        // state validation
        responseMessage = AnthropicWire_API_Message_Create.event_MessageStart_schema.parse(JSON.parse(eventData)).message;
        if (responseMessage.content.length)
          throw new Error('Unexpected content blocks at message start');
        if (responseMessage.role !== 'assistant')
          throw new Error(`Unexpected role at message start: ${responseMessage.role}`);
        if (!responseMessage.model)
          throw new Error('Model name missing at message start');

        // -> Model
        if (isFirstMessage)
          pt.setModelName(responseMessage.model);
        if (responseMessage.usage) {
          chatInTokens = responseMessage.usage.input_tokens;
          pt.setCounters({ chatIn: chatInTokens, chatOut: responseMessage.usage.output_tokens });
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
              pt.appendText(content_block.text);
              break;
            case 'tool_use':
              pt.startFunctionToolCall(content_block.id, content_block.name, 'incr_str', (content_block.input as string) || '');
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
                pt.appendText(delta.text);
              } else
                throw new Error('Unexpected text delta');
              break;

            case 'input_json_delta':
              if (responseMessage.content[index].type === 'tool_use') {
                responseMessage.content[index].input += delta.partial_json;
                pt.appendFunctionToolCallArgsIStr(responseMessage.content[index].id, delta.partial_json);
              } else
                throw new Error('Unexpected input_json_delta');
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
          pt.endPart();
        } else
          throw new Error('Unexpected content_block_stop');
        break;

      // Optionally handle top-level message changes. Example: updating stop_reason
      case 'message_delta':
        if (responseMessage) {
          const { delta, usage } = AnthropicWire_API_Message_Create.event_MessageDelta_schema.parse(JSON.parse(eventData));

          Object.assign(responseMessage, delta);

          // Unused for now
          // if (delta.stop_reason) {
          //   switch (delta.stop_reason) {
          //     case 'end_turn':
          //       break;
          //     case 'max_tokens':
          //       break;
          //     case 'stop_sequence':
          //       break;
          //     case'tool_use':
          //       break;
          //   }
          // }

          if (usage?.output_tokens && messageStartTime) {
            const elapsedTimeSeconds = (Date.now() - messageStartTime) / 1000;
            const chatOutRate = elapsedTimeSeconds > 0 ? usage.output_tokens / elapsedTimeSeconds : 0;
            pt.setCounters({
              chatIn: chatInTokens !== undefined ? chatInTokens : -1,
              chatOut: usage.output_tokens,
              chatOutRate: Math.round(chatOutRate * 100) / 100, // Round to 2 decimal places
              chatTimeInner: elapsedTimeSeconds,
            });
          }
        } else
          throw new Error('Unexpected message_delta');
        break;

      // We can now close the message
      case 'message_stop':
        AnthropicWire_API_Message_Create.event_MessageStop_schema.parse(JSON.parse(eventData));
        return pt.terminateParser('message-stop');

      // UNDOCUMENTED - Occasionaly, the server will send errors, such as {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}
      case 'error':
        hasErrored = true;
        const { error } = JSON.parse(eventData);
        const errorText = (error.type && error.message) ? `${error.type}: ${error.message}` : safeErrorString(error);
        return pt.terminatingDialectIssue(errorText || 'unknown server issue.', IssueSymbols.Generic);

      default:
        throw new Error(`Unexpected event name: ${eventName}`);
    }
  };
}


export function createAnthropicMessageParserNS(): ChatGenerateParseFunction {
  let messageStartTime: number = Date.now();

  return function(pt: PartTransmitter, fullData: string): void {

    // parse with validation (e.g. type: 'message' && role: 'assistant')
    const {
      model,
      content,
      stop_reason,
      usage,
    } = AnthropicWire_API_Message_Create.Response_schema.parse(JSON.parse(fullData));

    // -> Model
    if (model)
      pt.setModelName(model);

    // -> Content Blocks
    for (let i = 0; i < content.length; i++) {
      const contentBlock = content[i];
      const isLastBlock = i === content.length - 1;
      switch (contentBlock.type) {
        case 'text':
          const hitMaxTokens = (isLastBlock && stop_reason === 'max_tokens') ? ` ${IssueSymbols.GenMaxTokens}` : '';
          pt.appendText(contentBlock.text + hitMaxTokens);
          break;
        case 'tool_use':
          // NOTE: this gets parsed as an object, not string deltas of a json!
          pt.startFunctionToolCall(contentBlock.id, contentBlock.name, 'json_object', (contentBlock.input as object) || '');
          pt.endPart();
          break;
        default:
          throw new Error(`Unexpected content block type: ${(contentBlock as any).type}`);
      }
    }

    // -> Stats
    if (usage) {
      const elapsedTimeSeconds = (Date.now() - messageStartTime) / 1000;
      const chatOutRate = elapsedTimeSeconds > 0 ? usage.output_tokens / elapsedTimeSeconds : 0;
      pt.setCounters({
        chatIn: usage.input_tokens,
        chatOut: usage.output_tokens,
        chatOutRate: Math.round(chatOutRate * 100) / 100, // Round to 2 decimal places
        chatTimeInner: elapsedTimeSeconds,
      });
    }
  };
}
