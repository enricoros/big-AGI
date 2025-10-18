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
 * 2. 'content_block_start': Begins a new content block (text, tool_use, server_tool_use, or tool results).
 * 3. 'content_block_delta': Streams incremental updates to the current content block.
 * 4. 'content_block_stop': Signals the end of the current content block.
 * 5. 'message_delta': Provides updates to message-level information (e.g., stop_reason, usage).
 * 6. 'message_stop': Indicates the end of the entire message.
 * 7. 'ping': Keepalive event that may occur at any time during the stream.
 * 8. 'error': Communicates errors (e.g., overloaded_error) during streaming.
 *
 * Delta Types:
 * - 'text_delta': Incremental text updates for text blocks.
 * - 'input_json_delta': Partial JSON strings for tool_use and server_tool_use inputs.
 * - 'thinking_delta': Incremental thinking content updates.
 * - 'signature_delta': Signature for thinking blocks.
 *
 * Client Tools vs Server Tools
 *
 * Client Tools: Traditional function calling where the model returns a `tool_use` block, the client
 *               executes the function, and returns results via `tool_result` in the next message.
 *
 * FIXME: we haven't decided yet at the AIX and DMessage/DMessageFragment level how to handle Server-side tools, Server/Client mixed tools, or even Client tools, incl client-driven MCP
 *        so for now we have a TEMPORARY IMPLEMENTATION: Server tools are currently handled with void placeholders rather than creating particles to build execution graphs.
 *
 * Server Tools: Tools executed by Anthropic's infrastructure. The model emits `server_tool_use`
 *               blocks and the server executes them internally, returning specialized result blocks
 *               like `web_search_tool_result` or `web_fetch_tool_result`. No client execution required.
 *
 * Assumptions:
 * - Content blocks are indexed and streamed sequentially, with no gaps, 'index' is 0-based and reliable.
 * - 'text' parts are incremental and meant to be concatenated via 'text_delta'
 * - 'tool_use' and 'server_tool_use' parts have arguments as an incremental string via 'input_json_delta'
 * - Server tool result blocks arrive fully formed in 'content_block_start' (no deltas)
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
          throw new Error('Unexpected second message - we only support 1 Anthropic message at a time');

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
            if (typeof responseMessage.usage.cache_read_input_tokens === 'number')
              metricsUpdate.TCacheRead = responseMessage.usage.cache_read_input_tokens;
            if (typeof responseMessage.usage.cache_creation_input_tokens === 'number')
              metricsUpdate.TCacheWrite = responseMessage.usage.cache_creation_input_tokens;
          }
          pt.updateMetrics(metricsUpdate);
        }
        break;

      // M2. Initialize content block if needed
      case 'content_block_start': {
        if (!responseMessage)
          throw new Error('Unexpected content_block_start');

        const { index, content_block } = AnthropicWire_API_Message_Create.event_ContentBlockStart_schema.parse(JSON.parse(eventData));
        if (responseMessage.content[index] !== undefined)
          throw new Error(`Unexpected content block start location (${index})`);
        responseMessage.content[index] = content_block;

        switch (content_block.type) {
          case 'text':
            pt.appendText(content_block.text);
            break;

          case 'thinking':
            pt.appendReasoningText(content_block.thinking);
            if (content_block.signature)
              pt.setReasoningSignature(content_block.signature);
            break;

          case 'redacted_thinking':
            pt.addReasoningRedactedData(content_block.data);
            break;

          case 'tool_use':
            // [Anthropic] Note: .input={} and is parsed as an object - if that's the case, we zap it to ''
            if (content_block && typeof content_block.input === 'object' && Object.keys(content_block.input).length === 0)
              content_block.input = null;
            pt.startFunctionCallInvocation(content_block.id, content_block.name, 'incr_str', content_block.input! ?? null);
            break;

          case 'server_tool_use':
            // Server-side tool execution (e.g., web_search, web_fetch)
            // NOTE: We don't create tool invocations for server tools - just show placeholders
            if (content_block && typeof content_block.input === 'object' && Object.keys(content_block.input).length === 0)
              content_block.input = null;

            // Show placeholder for known server tools
            switch (content_block.name) {
              case 'web_search':
                pt.sendVoidPlaceholder('search-web', 'Searching the web...');
                break;
              case 'web_fetch':
                pt.sendVoidPlaceholder('search-web', 'Fetching web content...');
                break;
              default:
                throw new Error(`Unknown server tool name: ${content_block.name}`);
            }

            // TODO: Store server tool invocation when we add executedBy:'server' support to DMessage tool_response parts
            // pt.startFunctionCallInvocation(content_block.id, content_block.name, 'incr_str', content_block.input! ?? null);
            break;

          case 'web_search_tool_result':
            // Web search results arrive fully formed (no deltas)
            // TODO: Store server tool result when we add executedBy:'server' support to DMessage tool_response parts
            if (Array.isArray(content_block.content)) {
              // Success - array of search results
              // NOTE: We don't add citations for bulk search results (too noisy - could be 20+ URLs)
              //       Only high-quality citations that appear in text annotations should be shown
              pt.sendVoidPlaceholder('search-web', `Search completed: ${content_block.content.length} results`);
            } else if (content_block.content.type === 'web_search_tool_result_error') {
              // Error during web search
              pt.sendVoidPlaceholder('search-web', `Search error: ${content_block.content.error_code}`);
            }
            break;

          case 'web_fetch_tool_result':
            // Web fetch results arrive fully formed (no deltas)
            // TODO: Store server tool result when we add executedBy:'server' support to DMessage tool_response parts
            if (content_block.content.type === 'web_fetch_result') {
              // Success - fetched a URL
              pt.sendVoidPlaceholder('search-web', `Retrieved ${content_block.content.url}`);

              // Add citation for the fetched content
              const fetchedContent = content_block.content.content;
              pt.appendUrlCitation(
                fetchedContent?.title || 'Web Content',
                content_block.content.url,
                undefined, // citationNumber
                undefined, // startIndex
                undefined, // endIndex
                undefined, // textSnippet
                content_block.content.retrieved_at ? Date.parse(content_block.content.retrieved_at) : undefined
              );
            } else if (content_block.content.type === 'web_fetch_tool_result_error') {
              // Error during web fetch
              pt.sendVoidPlaceholder('search-web', `Fetch error: ${content_block.content.error_code}`);
            }
            break;

          case 'code_execution_tool_result':
            throw new Error(`Server tool type 'code_execution_tool_result' is not yet implemented. Please report this to request support.`);

          case 'bash_code_execution_tool_result':
            throw new Error(`Server tool type 'bash_code_execution_tool_result' is not yet implemented. Please report this to request support.`);

          case 'text_editor_code_execution_tool_result':
            throw new Error(`Server tool type 'text_editor_code_execution_tool_result' is not yet implemented. Please report this to request support.`);

          case 'mcp_tool_use':
            throw new Error(`Server tool type 'mcp_tool_use' is not yet implemented. Please report this to request support.`);

          case 'mcp_tool_result':
            throw new Error(`Server tool type 'mcp_tool_result' is not yet implemented. Please report this to request support.`);

          case 'container_upload':
            throw new Error(`Server tool type 'container_upload' is not yet implemented. Please report this to request support.`);

          default:
            const _exhaustiveCheck: never = content_block;
            throw new Error(`Unexpected content block type: ${(content_block as any).type}`);
        }
        break;
      }

      // M3+. Append delta text to the current message content
      case 'content_block_delta': {
        if (!responseMessage)
          throw new Error('Unexpected content_block_delta');

        const { index, delta } = AnthropicWire_API_Message_Create.event_ContentBlockDelta_schema.parse(JSON.parse(eventData));
        const contentBlock = responseMessage.content[index];
        if (contentBlock === undefined)
          throw new Error(`Unexpected content block delta location (${index})`);

        switch (delta.type) {
          case 'text_delta':
            if (contentBlock.type === 'text') {
              contentBlock.text += delta.text;
              pt.appendText(delta.text);
            } else
              throw new Error('Unexpected text delta');
            break;

          case 'input_json_delta':
            if (contentBlock.type === 'tool_use') {
              contentBlock.input += delta.partial_json;
              pt.appendFunctionCallInvocationArgs(contentBlock.id, delta.partial_json);
            } else if (contentBlock.type === 'server_tool_use') {
              // Server tools also receive input_json_delta for their inputs
              contentBlock.input += delta.partial_json;
              // TODO: Stream server tool args when we add executedBy:'server' support to DMessage tool_response parts
              // pt.appendFunctionCallInvocationArgs(contentBlock.id, delta.partial_json);
            } else
              throw new Error('Unexpected input_json_delta');
            break;

          case 'thinking_delta':
            if (contentBlock.type === 'thinking') {
              contentBlock.thinking += delta.thinking;
              pt.appendReasoningText(delta.thinking);
            } else
              throw new Error('Unexpected thinking delta');
            break;

          case 'signature_delta':
            if (contentBlock.type === 'thinking') {
              contentBlock.signature = delta.signature;
              pt.setReasoningSignature(delta.signature);
            } else
              throw new Error('Unexpected signature delta');
            break;

          // note: redacted_thinking doesn't have deltas, only start (with payload) and stop

          default:
            const _exhaustiveCheck: never = delta;
            throw new Error(`Unexpected content block delta type: ${(delta as any).type}`);
        }
        break;
      }

      // Finalize content block if needed.
      case 'content_block_stop': {
        if (!responseMessage) throw new Error('Unexpected content_block_stop');

        const { index } = AnthropicWire_API_Message_Create.event_ContentBlockStop_schema.parse(JSON.parse(eventData));
        if (responseMessage.content[index] === undefined)
          throw new Error(`Unexpected content block stop location (${index})`);

        // Signal that the tool is ready? (if it is...)
        pt.endMessagePart();
        break;
      }

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

      // UNDOCUMENTED - Occasionally, the server will send errors, such as {'type': 'error', 'error': {'type': 'overloaded_error', 'message': 'Overloaded'}}
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

    // -> Content Blocks - Non-Streaming
    for (let i = 0; i < content.length; i++) {
      const contentBlock = content[i];
      const isLastBlock = i === content.length - 1;
      switch (contentBlock.type) {
        case 'text':
          pt.appendText(contentBlock.text);
          break;

        case 'thinking':
          pt.appendReasoningText(contentBlock.thinking);
          contentBlock.signature && pt.setReasoningSignature(contentBlock.signature);
          break;

        case 'redacted_thinking':
          pt.addReasoningRedactedData(contentBlock.data);
          break;

        case 'tool_use':
          // NOTE: this gets parsed as an object, not string deltas of a json!
          pt.startFunctionCallInvocation(contentBlock.id, contentBlock.name, 'json_object', (contentBlock.input as object) || null);
          pt.endMessagePart();
          break;

        case 'server_tool_use':
          // Server tool use in non-streaming mode
          // NOTE: We don't create tool invocations for server tools - just show placeholders
          if (contentBlock.name === 'web_search') {
            pt.sendVoidPlaceholder('search-web', 'Searching the web...');
          } else if (contentBlock.name === 'web_fetch') {
            pt.sendVoidPlaceholder('search-web', 'Fetching web content...');
          }
          // TODO: Store server tool invocation when we add executedBy:'server' support to DMessage tool_response parts
          // pt.startFunctionCallInvocation(contentBlock.id, contentBlock.name, 'json_object', (contentBlock.input as object) || null);
          // pt.endMessagePart();
          break;

        case 'web_search_tool_result':
          // Web search results in non-streaming mode
          // TODO: Store server tool result when we add executedBy:'server' support to DMessage tool_response parts
          if (Array.isArray(contentBlock.content)) {
            // Success - array of search results
            // NOTE: We don't add citations for bulk search results (too noisy - could be 20+ URLs)
            //       Only high-quality citations that appear in text annotations should be shown
            pt.sendVoidPlaceholder('search-web', `Search completed: ${contentBlock.content.length} results`);
          } else if (contentBlock.content.type === 'web_search_tool_result_error') {
            // Error during web search
            pt.sendVoidPlaceholder('search-web', `Search error: ${contentBlock.content.error_code}`);
          }
          // pt.endMessagePart(); // Not needed for placeholders
          break;

        case 'web_fetch_tool_result':
          // Web fetch results in non-streaming mode
          // TODO: Store server tool result when we add executedBy:'server' support to DMessage tool_response parts
          if (contentBlock.content.type === 'web_fetch_result') {
            // Success - fetched a URL
            pt.sendVoidPlaceholder('search-web', `Retrieved ${contentBlock.content.url}`);

            // Add citation for the fetched content
            const fetchedContent = contentBlock.content.content;
            pt.appendUrlCitation(
              fetchedContent?.title || 'Web Content',
              contentBlock.content.url,
              undefined, // citationNumber
              undefined, // startIndex
              undefined, // endIndex
              undefined, // textSnippet
              contentBlock.content.retrieved_at ? Date.parse(contentBlock.content.retrieved_at) : undefined
            );
          } else if (contentBlock.content.type === 'web_fetch_tool_result_error') {
            // Error during web fetch
            pt.sendVoidPlaceholder('search-web', `Fetch error: ${contentBlock.content.error_code}`);
          }
          // pt.endMessagePart(); // Not needed for placeholders
          break;

        case 'code_execution_tool_result':
          throw new Error(`Server tool 'code_execution_tool_result' is not yet implemented. Please report this issue to request support.`);

        case 'bash_code_execution_tool_result':
          throw new Error(`Server tool 'bash_code_execution_tool_result' is not yet implemented. Please report this issue to request support.`);

        case 'text_editor_code_execution_tool_result':
          throw new Error(`Server tool 'text_editor_code_execution_tool_result' is not yet implemented. Please report this issue to request support.`);

        case 'mcp_tool_use':
          throw new Error(`Server tool 'mcp_tool_use' is not yet implemented. Please report this issue to request support.`);

        case 'mcp_tool_result':
          throw new Error(`Server tool 'mcp_tool_result' is not yet implemented. Please report this issue to request support.`);

        case 'container_upload':
          throw new Error(`Server tool 'container_upload' is not yet implemented. Please report this issue to request support.`);

        default:
          const _exhaustiveCheck: never = contentBlock;
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
        if (typeof usage.cache_read_input_tokens === 'number')
          metricsUpdate.TCacheRead = usage.cache_read_input_tokens;
        if (typeof usage.cache_creation_input_tokens === 'number')
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

    /**
     * https://docs.claude.com/en/api/handling-stop-reasons#pause-turn
     * Used with server tools like web search when Claude needs to pause a long-running operation.
     */
    case 'pause_turn':
      return 'ok-pause_continue';

    case 'max_tokens':
      return 'out-of-tokens';

    case 'model_context_window_exceeded':
      return 'out-of-tokens'; // Best practice: Allows requesting maximum tokens without calculating input size

    case 'refusal':
      return 'filter-refusal'; // Safety concerns - refusal to answer

    default:
      console.warn(`_fromAnthropicStopReason: unknown stop reason: ${stopReason}`);
      return null;
  }
}
