import { safeErrorString } from '~/server/wire';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from '../IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';

import { AnthropicWire_API_Message_Create } from '../../wiretypes/anthropic.wiretypes';


/**
 * Anthropic Streaming Completions - Messages Architecture
 *
 * Anthropic uses a events-based, chunk-based streaming protocol for its chat completions:
 * 1. 'message_start': Initializes a new message with metadata (id, model, usage) and empty content.
 * 2. 'content_block_start': Begins a new content block (text or tool_use).
 * 3. 'content_block_delta': Streams incremental updates to the current content block.
 * 4. 'content_block_stop': Signals the end of the current content block.
 * 5. 'message_delta': Provides updates to message-level information (e.g., stop_reason, usage).
 * 6. 'message_stop': Indicates the end of the entire message.
 * 7. 'ping': Keepalive event that may occur at any time during the stream.
 * 8. 'error': Communicates errors (e.g., overloaded_error) during streaming.
 *
 * Delta Types:
 * - 'text_delta': Incremental text updates for text blocks.
 * - 'input_json_delta': Partial JSON strings for tool_use inputs.
 *
 * Assumptions:
 * - Content blocks are indexed and streamed sequentially, with no gaps, 'index' is 0-based and reliable.
 * - 'text' parts are incremental and meant to be concatenated via 'text_delta'
 * - 'tool_use' parts are only function calls, and meant to have arguments as an incremental string via 'input_json_delta'
 * - There could be multiple messages, but we only handle 1 at this time, with multiple parts.
 * - Message Deltas will provide a 'stop reason' on the message
 * - Begin/End are explicit
 */
export function createAnthropicMessageParser(): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();
  let responseMessage: AnthropicWire_API_Message_Create.Response;
  let hasErrored = false;
  let timeToFirstEvent: number;
  let messageStartTime: number | undefined = undefined;
  let chatInTokens: number | undefined = undefined;

  return function(pt: IParticleTransmitter, eventData: string, eventName?: string): void {

    // Time to first event
    if (timeToFirstEvent === undefined)
      timeToFirstEvent = Date.now() - parserCreationTimestamp;

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
        if (!isFirstMessage)
          throw new Error('Unexpected second message - we only support 1 Antrhopic message at a time');

        // Throws on malformed event data, or even role != 'assistant'
        responseMessage = AnthropicWire_API_Message_Create.event_MessageStart_schema.parse(JSON.parse(eventData)).message;

        // state validation
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
          const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
            TIn: chatInTokens,
            TOut: responseMessage.usage.output_tokens,
            dtStart: timeToFirstEvent,
          };
          if (responseMessage.usage.cache_read_input_tokens || responseMessage.usage.cache_creation_input_tokens) {
            if (responseMessage.usage.cache_read_input_tokens !== undefined)
              metricsUpdate.TCacheRead = responseMessage.usage.cache_read_input_tokens;
            if (responseMessage.usage.cache_creation_input_tokens !== undefined)
              metricsUpdate.TCacheWrite = responseMessage.usage.cache_creation_input_tokens;
          }
          pt.updateMetrics(metricsUpdate);
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
              // [Anthropic] Note: .input={} and is parsed as an object - if that's the case, we zap it to ''
              if (content_block && typeof content_block.input === 'object' && Object.keys(content_block.input).length === 0)
                content_block.input = null;
              pt.startFunctionCallInvocation(content_block.id, content_block.name, 'incr_str', content_block.input! ?? null);
              break;
            default:
              throw new Error(`Unexpected content block type: ${(content_block as any).type}`);
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
                pt.appendFunctionCallInvocationArgs(responseMessage.content[index].id, delta.partial_json);
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
          pt.endMessagePart();
        } else
          throw new Error('Unexpected content_block_stop');
        break;

      // Optionally handle top-level message changes. Example: updating stop_reason
      case 'message_delta':
        if (responseMessage) {
          const { delta, usage } = AnthropicWire_API_Message_Create.event_MessageDelta_schema.parse(JSON.parse(eventData));

          Object.assign(responseMessage, delta);

          // -> Token Stop Reason
          const tokenStopReason = _fromAnthropicStopReason(delta.stop_reason);
          if (tokenStopReason !== null)
            pt.setTokenStopReason(tokenStopReason);

          if (usage?.output_tokens && messageStartTime) {
            const elapsedTimeMilliseconds = Date.now() - messageStartTime;
            const elapsedTimeSeconds = elapsedTimeMilliseconds / 1000;
            const chatOutRate = elapsedTimeSeconds > 0 ? usage.output_tokens / elapsedTimeSeconds : 0;
            pt.updateMetrics({
              TIn: chatInTokens !== undefined ? chatInTokens : -1,
              TOut: usage.output_tokens,
              vTOutInner: Math.round(chatOutRate * 100) / 100, // Round to 2 decimal places
              dtStart: timeToFirstEvent,
              dtInner: elapsedTimeMilliseconds,
              dtAll: Date.now() - parserCreationTimestamp,
            });
          }
        } else
          throw new Error('Unexpected message_delta');
        break;

      // We can now close the message
      case 'message_stop':
        AnthropicWire_API_Message_Create.event_MessageStop_schema.parse(JSON.parse(eventData));
        return pt.setEnded('done-dialect');

      // UNDOCUMENTED - Occasionaly, the server will send errors, such as {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}
      case 'error':
        hasErrored = true;
        const { error } = JSON.parse(eventData);
        const errorText = (error.type && error.message) ? `${error.type}: ${error.message}` : safeErrorString(error);
        return pt.setDialectTerminatingIssue(errorText || 'unknown server issue.', IssueSymbols.Generic);

      default:
        throw new Error(`Unexpected event name: ${eventName}`);
    }
  };
}


export function createAnthropicMessageParserNS(): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();

  return function(pt: IParticleTransmitter, fullData: string): void {

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
          pt.appendText(contentBlock.text);
          break;
        case 'tool_use':
          // NOTE: this gets parsed as an object, not string deltas of a json!
          pt.startFunctionCallInvocation(contentBlock.id, contentBlock.name, 'json_object', (contentBlock.input as object) || null);
          pt.endMessagePart();
          break;
        default:
          throw new Error(`Unexpected content block type: ${(contentBlock as any).type}`);
      }
    }

    // -> Token Stop Reason
    const tokenStopReason = _fromAnthropicStopReason(stop_reason);
    if (tokenStopReason !== null)
      pt.setTokenStopReason(tokenStopReason);

    // -> Stats
    if (usage) {
      const elapsedTimeMilliseconds = Date.now() - parserCreationTimestamp;
      // const elapsedTimeSeconds = elapsedTimeMilliseconds / 1000;
      // const chatOutRate = elapsedTimeSeconds > 0 ? usage.output_tokens / elapsedTimeSeconds : 0;
      const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
        TIn: usage.input_tokens,
        TOut: usage.output_tokens,
        // vTOutInner: Math.round(chatOutRate * 100) / 100, // Round to 2 decimal places
        // dtStart: // we don't know
        // dtInner: // we don't know
        dtAll: elapsedTimeMilliseconds,
      };
      if (usage.cache_read_input_tokens || usage.cache_creation_input_tokens) {
        if (usage.cache_read_input_tokens !== undefined)
          metricsUpdate.TCacheRead = usage.cache_read_input_tokens;
        if (usage.cache_creation_input_tokens !== undefined)
          metricsUpdate.TCacheWrite = usage.cache_creation_input_tokens;
      }
      pt.updateMetrics(metricsUpdate);
    }
  };
}


function _fromAnthropicStopReason(stopReason: AnthropicWire_API_Message_Create.Response['stop_reason']) {
  switch (stopReason) {

    case 'end_turn':
    case 'stop_sequence':
      return 'ok';

    case 'tool_use':
      return 'ok-tool_invocations';

    case 'max_tokens':
      return 'out-of-tokens';

    default:
      console.warn(`_fromAnthropicStopReason: unknown stop reason: ${stopReason}`);
      return null;
  }
}
