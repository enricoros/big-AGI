import { safeErrorString } from '~/server/wire';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from './IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';

import { AnthropicWire_API_Message_Create } from '../../wiretypes/anthropic.wiretypes';
import { RequestRetryError } from '../chatGenerate.retrier';


// configuration
const ANTHROPIC_DEBUG_EVENT_SEQUENCE = false; // true: shows the sequence of events


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
 * - 'citations_delta': Citations that stream incrementally for text blocks.
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
  let needsTextSeparator = false; // insert text separator when text follows server tool

  return function(pt: IParticleTransmitter, eventData: string, eventName?: string, context?: { retriesAvailable: boolean }): void {

    // Time to first event
    if (timeToFirstEvent === undefined)
      timeToFirstEvent = Date.now() - parserCreationTimestamp;

    // if we've errored, we should not be receiving more data
    if (hasErrored)
      console.log('Anthropic stream has errored already, but received more data:', eventData);

    switch (eventName) {
      // Ignore pings
      case 'ping':
        if (ANTHROPIC_DEBUG_EVENT_SEQUENCE) console.log('ant ping');
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

        // -> Container metadata (for Skills)
        if (responseMessage.container) {
          // TODO: [PRIORITY] Accumulate in DMessage.sessionMetadata:
          //   pt.setSessionMetadata('anthropic.container.id', container.id)
          //   pt.setSessionMetadata('anthropic.container.expiresAt', Date.parse(container.expires_at))
          // Request builder will find latest values and reuse container across turns for file access.

          console.log('[Anthropic] Container active:', {
            id: responseMessage.container.id,
            expires_at: responseMessage.container.expires_at,
            skills: responseMessage.container.skills,
          });
        }

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

        if (ANTHROPIC_DEBUG_EVENT_SEQUENCE) console.log(`ant message_start: model=${responseMessage.model}, TIn=${chatInTokens || 0}, container=${responseMessage.container?.id || 'none'}`);
        break;

      // M2. Initialize content block if needed
      case 'content_block_start': {
        if (!responseMessage)
          throw new Error('Unexpected content_block_start');

        const { index, content_block } = AnthropicWire_API_Message_Create.event_ContentBlockStart_schema.parse(JSON.parse(eventData));
        if (responseMessage.content[index] !== undefined)
          throw new Error(`Unexpected content block start location (${index})`);
        responseMessage.content[index] = content_block;

        if (ANTHROPIC_DEBUG_EVENT_SEQUENCE) {
          const debugInfo = content_block.type === 'tool_use' ? `tool=${content_block.name}`
            : content_block.type === 'server_tool_use' ? `server_tool=${content_block.name}`
              : content_block.type === 'text' ? `text_len=${content_block.text.length}`
                : content_block.type === 'thinking' ? `thinking_len=${content_block.thinking.length}`
                  : content_block.type === 'container_upload' ? `file_id=${content_block.file_id}`
                    : content_block.type;
          console.log(`ant content_block_start[${index}]: type=${content_block.type}, ${debugInfo}`);
        }

        switch (content_block.type) { // .content_block_start.type
          case 'text':
            // add separator when text follows server tool execution
            pt.appendText(!needsTextSeparator ? content_block.text : '\n\n' + content_block.text);
            needsTextSeparator = false;
            // Note: In streaming mode, citations arrive via citations_delta events, not on content_block_start
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

            // [Anthropic, 2025-11-24] Programmatic Tool Calling - detect if called from code execution
            const isProgrammaticCall = content_block.caller?.type === 'code_execution_20250825';
            if (isProgrammaticCall && ANTHROPIC_DEBUG_EVENT_SEQUENCE)
              console.log(`[Anthropic] Programmatic tool call: ${content_block.name} called from code_execution (tool_id: ${content_block.caller?.type === 'code_execution_20250825' ? content_block.caller.tool_id : 'n/a'})`);

            pt.startFunctionCallInvocation(content_block.id, content_block.name, 'incr_str', content_block.input! ?? null);
            break;

          case 'server_tool_use':
            // Server-side tool execution (e.g., web_search, web_fetch, Skills API tools)
            // NOTE: We don't create tool invocations for server tools - just show placeholders
            if (content_block && typeof content_block.input === 'object' && Object.keys(content_block.input).length === 0)
              content_block.input = null;

            // Show placeholder for known server tools
            switch (content_block.name) { // .server_tool_use.name
              case 'web_search':
                pt.sendVoidPlaceholder('search-web', 'Searching the web...');
                break;
              case 'web_fetch':
                pt.sendVoidPlaceholder('search-web', 'Fetching web content...');
                break;
              // Skills API tools (server-side execution)
              case 'bash_code_execution':
                pt.sendVoidPlaceholder('code-exec', '⚡ Running bash script...');
                break;
              case 'text_editor_code_execution':
                pt.sendVoidPlaceholder('code-exec', '⚡ Executing code...');
                break;
              // [Anthropic, 2025-11-24] Tool Search Tool
              case 'tool_search_tool_regex':
              case 'tool_search_tool_bm25':
                pt.sendVoidPlaceholder('code-exec', '🔍 Searching available tools...');
                break;
              default:
                // For unknown server tools (e.g., future Skills), show a generic placeholder instead of throwing
                console.warn(`[Anthropic Parser] Unknown server tool: ${content_block.name}`);
                pt.sendVoidPlaceholder('code-exec', `⚡ Using ${content_block.name}...`);
                break;
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
                content_block.content.retrieved_at ? Date.parse(content_block.content.retrieved_at) : undefined,
              );
            } else if (content_block.content.type === 'web_fetch_tool_result_error') {
              // Error during web fetch
              pt.sendVoidPlaceholder('search-web', `Fetch error: ${content_block.content.error_code}`);
            }
            break;

          case 'code_execution_tool_result':
            // Code execution result from Skills container - extract file IDs from output
            if (content_block.content.type === 'code_execution_result') {
              // Success - check for generated files in content array
              const fileIds: string[] = [];
              if (Array.isArray(content_block.content.content)) {
                for (const outputBlock of content_block.content.content) {
                  if (outputBlock.type === 'code_execution_output' && outputBlock.file_id) {
                    fileIds.push(outputBlock.file_id);
                  }
                }
              }

              // Build text message describing execution result
              let resultText = '\n\n⚡ Code executed by Skill';
              if (fileIds.length > 0) {
                resultText += '\n';
                for (const fileId of fileIds) {
                  resultText += `\n📎 File: \`${fileId}\``;
                }
              } else {
                resultText += ' (no files generated)';
              }
              resultText += '\n';
              pt.appendText(resultText);

              // Log for debugging
              console.log('[Anthropic] Code execution result:', {
                return_code: content_block.content.return_code,
                file_count: fileIds.length,
                file_ids: fileIds,
              });
            } else if (content_block.content.type === 'code_execution_tool_result_error') {
              // Error during code execution
              pt.appendText(`\n\n⚠️ Skill execution error: ${content_block.content.error_code}\n`);
            }
            break;

          case 'bash_code_execution_tool_result':
            // Bash code execution result from Skills container - extract file IDs from output
            if (content_block.content.type === 'bash_code_execution_result') {
              // Success - check for generated files in content array
              const fileIds: string[] = [];
              if (Array.isArray(content_block.content.content)) {
                for (const outputBlock of content_block.content.content) {
                  if (outputBlock.type === 'bash_code_execution_output' && outputBlock.file_id) {
                    fileIds.push(outputBlock.file_id);
                  }
                }
              }

              // Build text message describing execution result
              let resultText = '\n\n⚡ Bash executed by Skill';
              if (fileIds.length > 0) {
                resultText += '\n';
                for (const fileId of fileIds) {
                  resultText += `\n📎 File: \`${fileId}\``;
                }
              } else {
                resultText += ' (no files generated)';
              }
              resultText += '\n';
              pt.appendText(resultText);

              // Log for debugging
              console.log('[Anthropic] Bash code execution result:', {
                return_code: content_block.content.return_code,
                file_count: fileIds.length,
                file_ids: fileIds,
              });
            } else if (content_block.content.type === 'bash_code_execution_tool_result_error') {
              // Error during bash execution
              pt.appendText(`\n\n⚠️ Bash execution error: ${content_block.content.error_code}\n`);
            }
            break;

          case 'text_editor_code_execution_tool_result':
            // Text editor code execution result from Skills container
            pt.sendVoidPlaceholder('code-exec', '⚡ Text editor code executed by Skill');

            // Log for debugging
            console.log('[Anthropic] Text editor code execution result from Skills');
            break;

          case 'mcp_tool_use':
            throw new Error(`Server tool type 'mcp_tool_use' is not yet implemented. Please report this to request support.`);

          case 'mcp_tool_result':
            throw new Error(`Server tool type 'mcp_tool_result' is not yet implemented. Please report this to request support.`);

          case 'container_upload':
            // Container upload - this is when a Skill has generated a file
            // The file_id can be used with the Files API to download the file
            pt.sendVoidPlaceholder('code-exec', `📎 File generated (ID: ${content_block.file_id})`);

            // Log for debugging
            console.log('[Anthropic] Container upload:', {
              file_id: content_block.file_id,
              container: responseMessage.container?.id,
            });

            // TODO: Future enhancement - could trigger automatic file download here
            // using the Files API with content_block.file_id
            break;

          case 'tool_result': // [Anthropic, 2025-11-24] Tool Search Tool - The actual tool definitions are auto-expanded by Anthropic's API
            if (Array.isArray(content_block.content)) {
              // success
              const toolNames = content_block.content.map((ref: { type: string; tool_name: string }) => ref.tool_name);
              pt.sendVoidPlaceholder('code-exec', `🔍 Discovered ${toolNames.length} tool(s): ${toolNames.join(', ')}`);
              // Log for future debugging
              console.log('[Anthropic] Tool search discovered:', { tools: toolNames });
            } else if (content_block.content?.type === 'tool_search_tool_result_error') {
              // error during tool search
              pt.sendVoidPlaceholder('code-exec', `🔍 Tool search error: ${content_block.content.error_code}`);
            }
            break;

          default:
            const _exhaustiveCheck: never = content_block;
            throw new Error(`Unexpected content block type: ${(content_block as any).type}`);
        }

        // set separator flag when server tools complete (text after tools needs visual separation)
        if (content_block.type.includes('tool_use') || content_block.type.includes('tool_result'))
          needsTextSeparator = true;

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

        if (ANTHROPIC_DEBUG_EVENT_SEQUENCE) {
          const debugInfo = delta.type === 'text_delta' ? `len=${delta.text.length}`
            : delta.type === 'input_json_delta' ? `json_len=${delta.partial_json.length}`
              : delta.type === 'thinking_delta' ? `len=${delta.thinking.length}`
                : delta.type === 'signature_delta' ? `sig=${delta.signature}`
                  : delta.type === 'citations_delta' ? `citation_type=${delta.citation.type}`
                    : (delta as any)?.type;
          console.log(`ant content_block_delta[${index}]: type=${delta.type}, ${debugInfo}`);
        }

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

          case 'citations_delta':
            // Citations arrive incrementally during streaming - add to current text block
            if (contentBlock.type === 'text') {
              const citation = delta.citation;
              if (citation.type === 'web_search_result_location') {
                // Web search citation from server-side search
                pt.appendUrlCitation(
                  citation.title || citation.url,
                  citation.url,
                  undefined, // citationNumber
                  undefined, // startIndex
                  undefined, // endIndex
                  citation.cited_text, // textSnippet
                  undefined, // pubTs
                );
              }
              // TODO: Handle other citation types (char_location, page_location, content_block_location, search_result_location)
            } else
              throw new Error('Unexpected citations_delta on non-text block');
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

        if (ANTHROPIC_DEBUG_EVENT_SEQUENCE) console.log(`ant content_block_stop[${index}]: type=${responseMessage.content[index].type}`);

        // Signal that the tool is ready? (if it is...)
        pt.endMessagePart();
        break;
      }

      // Optionally handle top-level message changes. Example: updating stop_reason
      case 'message_delta': {
        if (!responseMessage) throw new Error('Unexpected message_delta');

        const { delta, usage } = AnthropicWire_API_Message_Create.event_MessageDelta_schema.parse(JSON.parse(eventData));

        Object.assign(responseMessage, delta);

        // -> Token Stop Reason
        const tokenStopReason = _fromAnthropicStopReason(delta.stop_reason);
        if (tokenStopReason !== null)
          pt.setTokenStopReason(tokenStopReason);

        // NOTE: we have more fields we're not parsing yet - https://platform.claude.com/docs/en/api/typescript/messages#message_delta_usage
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

        if (ANTHROPIC_DEBUG_EVENT_SEQUENCE) console.log(`ant message_delta: stop_reason=${delta.stop_reason || 'none'}, TOut=${usage?.output_tokens || 'none'}`);
        break;
      }

      // We can now close the message
      case 'message_stop':
        AnthropicWire_API_Message_Create.event_MessageStop_schema.parse(JSON.parse(eventData));
        if (ANTHROPIC_DEBUG_EVENT_SEQUENCE) console.log('ant message_stop');
        return pt.setEnded('done-dialect');

      // UNDOCUMENTED - Occasionally, the server will send errors, such as {'type': 'error', 'error': {'type': 'overloaded_error', 'message': 'Overloaded'}}
      case 'error':
        hasErrored = true;
        const { error } = JSON.parse(eventData);
        const errorText = (error.type && error.message) ? `${error.type}: ${error.message}` : safeErrorString(error);
        if (ANTHROPIC_DEBUG_EVENT_SEQUENCE) console.log(`ant error: ${errorText}`);

        // Errors documented by Anthropic - these follow a 200 HTTP response, so they're sent as JSON
        // https://docs.claude.com/en/api/errors
        //
        // 400 - invalid_request_error (bad input)
        // 401 - authentication_error (api key issue)
        // 403 - permission_error (api key lacks permissions)
        // 404 - not_found_error
        // 413 - request_too_large (> 32MB for standard streaming)
        // 429* - rate_limit_error (account hit limits)
        // 500* - api_error (anthropic systems internal unexpected error)
        // 529* - overloaded_error: The API is temporarily overloaded.
        // *: retryable errors
        const isRetryableError = ['overloaded_error', 'rate_limit_error', 'api_error'].includes(error.type);

        // Throw retryable error to instruct the correct ancestor to restart (only if retries available
        if (isRetryableError) {
          if (context?.retriesAvailable) {
            console.log(`[Aix.Anthropic] Can retry error '${errorText}'`);
            // map error types to HTTP status codes for diagnostics
            const errorTypeToHttpStatus: Record<string, number> = {
              'rate_limit_error': 429,
              'api_error': 500,
              'overloaded_error': 529,
            };
            // request a retry by unwinding to the retrier
            throw new RequestRetryError(`retrying Anthropic: ${errorText}`, {
              causeHttp: errorTypeToHttpStatus[error.type],
              causeConn: error.type,
            });
          } else
            console.log(`[Aix.Anthropic] ⛔ No retries available for error '${errorText}'`);
        }

        // Non-retryable errors (or no retries left): show to user
        return pt.setDialectTerminatingIssue(errorText || 'unknown server issue.', IssueSymbols.Generic, 'srv-warn');

      default:
        if (ANTHROPIC_DEBUG_EVENT_SEQUENCE) console.log(`ant unknown event: ${eventName}`);
        throw new Error(`Unexpected event name: ${eventName}`);
    }
  };
}


export function createAnthropicMessageParserNS(): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();
  let needsTextSeparator = false; // insert text separator when text follows server tool

  return function(pt: IParticleTransmitter, fullData: string /*, eventName?: string, context?: { retriesAvailable: boolean } */): void {

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
      switch (contentBlock.type) { // .content_block (non-streaming)
        case 'text':
          // add separator when text follows server tool execution
          pt.appendText(!needsTextSeparator ? contentBlock.text : '\n\n' + contentBlock.text);
          needsTextSeparator = false;
          // Handle citations if present (non-streaming mode has all citations attached)
          if (contentBlock.citations && Array.isArray(contentBlock.citations)) {
            for (const citation of contentBlock.citations) {
              if (citation.type === 'web_search_result_location') {
                pt.appendUrlCitation(
                  citation.title || citation.url,
                  citation.url,
                  undefined, // citationNumber
                  undefined, // startIndex
                  undefined, // endIndex
                  citation.cited_text, // textSnippet
                  undefined, // pubTs
                );
              }
              // TODO: Handle other citation types (char_location, page_location, content_block_location, search_result_location)
            }
          }
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

          // [Anthropic, 2025-11-24] Programmatic Tool Calling - detect if called from code execution
          const isProgrammaticCallNS = contentBlock.caller?.type === 'code_execution_20250825';
          if (isProgrammaticCallNS)
            console.log(`[Anthropic] Programmatic tool call (non-streaming): ${contentBlock.name} called from code_execution (tool_id: ${contentBlock.caller?.type === 'code_execution_20250825' ? contentBlock.caller.tool_id : 'n/a'})`);

          pt.startFunctionCallInvocation(contentBlock.id, contentBlock.name, 'json_object', (contentBlock.input as object) || null);
          pt.endMessagePart();
          break;

        case 'server_tool_use':
          // Server tool use in non-streaming mode
          // NOTE: We don't create tool invocations for server tools - just show placeholders
          switch (contentBlock.name) { // .server_tool_use.name
            case 'web_search':
              pt.sendVoidPlaceholder('search-web', 'Searching the web...');
              break;
            case 'web_fetch':
              pt.sendVoidPlaceholder('search-web', 'Fetching web content...');
              break;
            case 'bash_code_execution':
              pt.sendVoidPlaceholder('code-exec', '⚡ Running bash script...');
              break;
            case 'text_editor_code_execution':
              pt.sendVoidPlaceholder('code-exec', '⚡ Executing code...');
              break;
            // [Anthropic, 2025-11-24] Tool Search Tool
            case 'tool_search_tool_regex':
            case 'tool_search_tool_bm25':
              pt.sendVoidPlaceholder('code-exec', '🔍 Searching available tools...');
              break;
            default:
              console.warn(`[Anthropic Parser] Unknown server tool (non-streaming): ${contentBlock.name}`);
              pt.sendVoidPlaceholder('code-exec', `⚡ Using ${contentBlock.name}...`);
              break;
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
              contentBlock.content.retrieved_at ? Date.parse(contentBlock.content.retrieved_at) : undefined,
            );
          } else if (contentBlock.content.type === 'web_fetch_tool_result_error') {
            // Error during web fetch
            pt.sendVoidPlaceholder('search-web', `Fetch error: ${contentBlock.content.error_code}`);
          }
          // pt.endMessagePart(); // Not needed for placeholders
          break;

        case 'code_execution_tool_result':
          // Code execution result from Skills container (non-streaming)
          if (contentBlock.content.type === 'code_execution_result') {
            // Success - check for generated files in content array
            const fileIds: string[] = [];
            if (Array.isArray(contentBlock.content.content)) {
              for (const outputBlock of contentBlock.content.content) {
                if (outputBlock.type === 'code_execution_output' && outputBlock.file_id) {
                  fileIds.push(outputBlock.file_id);
                }
              }
            }

            // Build text message describing execution result
            let resultText = '\n\n⚡ Code executed by Skill';
            if (fileIds.length > 0) {
              resultText += '\n';
              for (const fileId of fileIds) {
                resultText += `\n📎 File: \`${fileId}\``;
              }
            } else {
              resultText += ' (no files generated)';
            }
            resultText += '\n';
            pt.appendText(resultText);

            // Log for debugging
            console.log('[Anthropic] Code execution result (non-streaming):', {
              return_code: contentBlock.content.return_code,
              file_count: fileIds.length,
              file_ids: fileIds,
            });
          } else if (contentBlock.content.type === 'code_execution_tool_result_error') {
            // Error during code execution
            pt.appendText(`\n\n⚠️ Skill execution error: ${contentBlock.content.error_code}\n`);
          }
          break;

        case 'bash_code_execution_tool_result':
          // Bash code execution result from Skills container (non-streaming)
          if (contentBlock.content.type === 'bash_code_execution_result') {
            // Success - check for generated files in content array
            const fileIds: string[] = [];
            if (Array.isArray(contentBlock.content.content)) {
              for (const outputBlock of contentBlock.content.content) {
                if (outputBlock.type === 'bash_code_execution_output' && outputBlock.file_id) {
                  fileIds.push(outputBlock.file_id);
                }
              }
            }

            // Build text message describing execution result
            let resultText = '\n\n⚡ Bash executed by Skill';
            if (fileIds.length > 0) {
              resultText += '\n';
              for (const fileId of fileIds) {
                resultText += `\n📎 File: \`${fileId}\``;
              }
            } else {
              resultText += ' (no files generated)';
            }
            resultText += '\n';
            pt.appendText(resultText);

            // Log for debugging
            console.log('[Anthropic] Bash code execution result (non-streaming):', {
              return_code: contentBlock.content.return_code,
              file_count: fileIds.length,
              file_ids: fileIds,
            });
          } else if (contentBlock.content.type === 'bash_code_execution_tool_result_error') {
            // Error during bash execution
            pt.appendText(`\n\n⚠️ Bash execution error: ${contentBlock.content.error_code}\n`);
          }
          break;

        case 'text_editor_code_execution_tool_result':
          // Text editor code execution result from Skills container (non-streaming)
          pt.sendVoidPlaceholder('code-exec', '⚡ Text editor code executed by Skill');
          console.log('[Anthropic] Text editor code execution result from Skills (non-streaming)');
          break;

        case 'mcp_tool_use':
          throw new Error(`Server tool 'mcp_tool_use' is not yet implemented. Please report this issue to request support.`);

        case 'mcp_tool_result':
          throw new Error(`Server tool 'mcp_tool_result' is not yet implemented. Please report this issue to request support.`);

        case 'container_upload':
          // Container upload - this is when a Skill has generated a file
          pt.sendVoidPlaceholder('code-exec', `📎 File generated (ID: ${contentBlock.file_id})`);

          // Log for debugging
          console.log('[Anthropic] Container upload (non-streaming):', {
            file_id: contentBlock.file_id,
          });
          break;

        case 'tool_result': // [Anthropic, 2025-11-24] Tool Search Tool - The actual tool definitions are auto-expanded by Anthropic's API
          if (Array.isArray(contentBlock.content)) {
            // success
            const toolNames = contentBlock.content.map((ref: { type: string; tool_name: string }) => ref.tool_name);
            pt.sendVoidPlaceholder('code-exec', `🔍 Discovered ${toolNames.length} tool(s): ${toolNames.join(', ')}`);
            // Log for future debugging
            console.log('[Anthropic] Tool search discovered (non-streaming):', { tools: toolNames });
          } else if ((contentBlock.content as any)?.type === 'tool_search_tool_result_error') {
            // error during tool search
            pt.sendVoidPlaceholder('code-exec', `🔍 Tool search error: ${(contentBlock.content as any).error_code}`);
          }
          break;

        default:
          const _exhaustiveCheck: never = contentBlock;
          throw new Error(`Unexpected content block type: ${(contentBlock as any).type}`);
      }

      // set separator flag when server tools complete (text after tools needs visual separation)
      if (contentBlock.type.includes('tool_use') || contentBlock.type.includes('tool_result'))
        needsTextSeparator = true;
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
