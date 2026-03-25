import { safeErrorString } from '~/server/wire';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from './IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';
import { aixResilientUnknownValue } from '../../../api/aix.resilience';

import { AnthropicWire_API_Message_Create } from '../../wiretypes/anthropic.wiretypes';
import { DispatchContinuationSignal } from '../chatGenerate.continuation';
import { OperationRetrySignal } from '../chatGenerate.operation-retry';


// configuration
const ANTHROPIC_DEBUG_EVENT_SEQUENCE = false; // true: shows the sequence of events
// NOTE: the following weakens protocol validation - remove if possible. testing with web search active to see if blocks come out of order
// NOTE: 2026-03-23: disabled, not useful any longer
const ANTHROPIC_FIX_REUSED_BLOCK_INDEX = false; // [Anthropic, 2026-01-12] Block Start Index issue workaround

/**
 * [Anthropic, Opus-4.6] First text packet is '\n\n' - elide it
 *
 * NOTE: disabled because the sequence seems:
 * {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}
 * {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"\\n\\n"}
 * {"type":"content_block_stop","index":0 }
 */
const hotFixAntElideLeadingDoubleNewline = false;
/**
 * This was needed because tools and text were too close together
 * FIXME: check if this is still needed with 4.6
 */
const hotFixAntInjectToolsTextSpacer = true;

function _isPersistedHostedWebTool(name: string): boolean {
  return name === 'web_search' || name === 'web_fetch';
}

type TAnthropicWebSearchToolResultContent = Extract<AnthropicWire_API_Message_Create.Response['content'][number], { type: 'web_search_tool_result' }>['content'];
type TAnthropicWebFetchToolResultContent = Extract<AnthropicWire_API_Message_Create.Response['content'][number], { type: 'web_fetch_tool_result' }>['content'];

function _formatAnthropicWebSearchResult(content: TAnthropicWebSearchToolResultContent): { error: boolean | string, result: string } {
  if (Array.isArray(content)) {
    return {
      error: false,
      result: [
        `Results: ${content.length}`,
        '',
        ...content.map((item, index) => `${index + 1}. ${item.title}\n${item.url}${item.page_age ? `\nAge: ${item.page_age}` : ''}`),
      ].join('\n'),
    };
  }

  return {
    error: `Search error: ${content.error_code}`,
    result: `Search error: ${content.error_code}`,
  };
}

function _formatAnthropicWebFetchResult(content: TAnthropicWebFetchToolResultContent): { error: boolean | string, result: string } {
  if (content.type === 'web_fetch_result') {
    return {
      error: false,
      result: [
        `URL: ${content.url}`,
        ...(content.content?.title ? [`Title: ${content.content.title}`] : []),
        ...(content.retrieved_at ? [`Retrieved: ${content.retrieved_at}`] : []),
      ].join('\n'),
    };
  }

  return {
    error: `Fetch error: ${content.error_code}`,
    result: `Fetch error: ${content.error_code}`,
  };
}


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
  const backfilledEmptyToolUseIds = new Set<string>();

  let elideFirstTextBlock = hotFixAntElideLeadingDoubleNewline;
  const elisionCheck = (fullText: string) => {
    if (!elideFirstTextBlock) return false;
    elideFirstTextBlock = false;
    if (fullText !== '\n\n') return false;
    console.log('[DEV] Anthropic: 🔷 Eliding leading \\n\\n text block');
    return true;
  };

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

        const { index: requestedIndex, content_block } = AnthropicWire_API_Message_Create.event_ContentBlockStart_schema.parse(JSON.parse(eventData));

        // [Anthropic, 2026-01-12] Block Start Index issue
        let index = requestedIndex;
        if (responseMessage.content[index] !== undefined)
          if (ANTHROPIC_FIX_REUSED_BLOCK_INDEX) {
            // Workaround: Anthropic server tools reuse indices - promote to next available
            index = responseMessage.content.length;
            // Note: always on, because now this seems to have been fixed, so we need this warn if that's not the case
            console.log(`[Anthropic] ♨️ content_block_start: index ${requestedIndex} occupied, promoting to ${index}`);
          } else
            throw new Error(`Unexpected content block start location (${requestedIndex})`);
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
            // Hotfix Opus-4.6: elide first text block if it's '\n\n'
            if (elisionCheck(content_block.text)) break;
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
            // [Anthropic] Note: .input={} is parsed as an object - zap to '' for later string concatenation via input_json_delta
            if (content_block && content_block.input && typeof content_block.input === 'object' && Object.keys(content_block.input).length === 0)
              content_block.input = '';

            // [Anthropic, 2025-11-24] Programmatic Tool Calling - detect if called from code execution
            const isProgrammaticCall = content_block.caller?.type === 'code_execution_20250825' || content_block.caller?.type === 'code_execution_20260120';
            if (isProgrammaticCall && ANTHROPIC_DEBUG_EVENT_SEQUENCE)
              console.log(`[Anthropic] Programmatic tool call: ${content_block.name} called from ${content_block.caller!.type} (tool_id: ${content_block.caller!.type !== 'direct' ? content_block.caller!.tool_id : 'n/a'})`);

            pt.startFunctionCallInvocation(content_block.id, content_block.name, 'incr_str', content_block.input || null);
            break;

          case 'server_tool_use':
            // Server-side tool execution (e.g., web_search, web_fetch, Skills API tools)
            if (content_block && typeof content_block.input === 'object' && Object.keys(content_block.input).length === 0)
              content_block.input = null;

            if (_isPersistedHostedWebTool(content_block.name)) {
              pt.startFunctionCallInvocation(content_block.id, content_block.name, 'incr_str', content_block.input! ?? null);
              break;
            }

            // Show placeholder for known non-persisted server tools
            switch (content_block.name) { // .server_tool_use.name
              case 'web_search':
              case 'web_fetch':
                break;
              case 'code_execution':
                pt.sendOperationState('code-exec', '⚡ Executing code...', { opId: content_block.id });
                break;
              case 'bash_code_execution':
                pt.sendOperationState('code-exec', '⚡ Running bash script...', { opId: content_block.id });
                break;
              case 'text_editor_code_execution':
                pt.sendOperationState('code-exec', '⚡ Executing code...', { opId: content_block.id });
                break;
              // [Anthropic, 2025-11-24] Tool Search Tool
              case 'tool_search_tool_regex':
              case 'tool_search_tool_bm25':
                pt.sendOperationState('code-exec', '🔍 Searching available tools...', { opId: content_block.id });
                break;
              default:
                // For unknown server tools (e.g., future Skills), show a generic placeholder instead of throwing
                console.warn(`[Anthropic Parser] Unknown server tool: ${content_block.name}`);
                pt.sendOperationState('code-exec', `⚡ Using ${content_block.name}...`, { opId: content_block.id });
                break;
            }
            break;

          case 'web_search_tool_result':
            // Web search results arrive fully formed (no deltas)
            const searchResult = _formatAnthropicWebSearchResult(content_block.content);
            pt.addFunctionCallResponse(content_block.tool_use_id, searchResult.error, 'web_search', searchResult.result, 'upstream');
            break;

          case 'web_fetch_tool_result':
            // Web fetch results arrive fully formed (no deltas)
            const fetchResult = _formatAnthropicWebFetchResult(content_block.content);
            pt.addFunctionCallResponse(content_block.tool_use_id, fetchResult.error, 'web_fetch', fetchResult.result, 'upstream');
            if (content_block.content.type === 'web_fetch_result') {
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
              pt.sendOperationState('search-web', `Fetch error: ${content_block.content.error_code}`, { opId: content_block.tool_use_id, state: 'error' });
            }
            break;

          case 'code_execution_tool_result':
            // Code execution result from Skills container - extract file IDs from output
            if (content_block.content.type === 'code_execution_result') {
              // Success - check for generated files in content array
              const fileIds: string[] = [];
              if (Array.isArray(content_block.content.content))
                for (const outputBlock of content_block.content.content)
                  if (outputBlock.type === 'code_execution_output' && outputBlock.file_id)
                    fileIds.push(outputBlock.file_id);

              if (fileIds.length > 0) {
                let resultText = '\n\n⚡ Code executed by Skill\n';
                for (const fileId of fileIds)
                  resultText += `\n📎 File: \`${fileId}\``;
                resultText += '\n';
                pt.appendText(resultText);
              } else
                pt.sendOperationState('code-exec', 'Code executed by Skill', { opId: content_block.tool_use_id, state: 'done' });

              // Log for debugging
              console.log('[Anthropic] Code execution result:', {
                return_code: content_block.content.return_code,
                file_count: fileIds.length,
                file_ids: fileIds,
              });
            } else if (content_block.content.type === 'encrypted_code_execution_result') {
              // Encrypted variant (PFC + web_search) - stdout is encrypted, show as transient placeholder
              pt.sendOperationState('code-exec', 'Code executed (encrypted output)', { opId: content_block.tool_use_id, state: 'done' });
              console.log('[Anthropic] Encrypted code execution result:', { return_code: content_block.content.return_code });
            } else if (content_block.content.type === 'code_execution_tool_result_error') {
              // Error during code execution - log and show as transient placeholder (often a server-side artifact)
              console.log('[Anthropic] Code execution error:', content_block.content.error_code);
              pt.sendOperationState('code-exec', `Skill error: ${content_block.content.error_code}`, { opId: content_block.tool_use_id, state: 'error' });
            }
            break;

          case 'bash_code_execution_tool_result':
            // Bash code execution result from Skills container - extract file IDs from output
            if (content_block.content.type === 'bash_code_execution_result') {
              // Success - check for generated files in content array
              const fileIds: string[] = [];
              if (Array.isArray(content_block.content.content))
                for (const outputBlock of content_block.content.content)
                  if (outputBlock.type === 'bash_code_execution_output' && outputBlock.file_id)
                    fileIds.push(outputBlock.file_id);

              if (fileIds.length > 0) {
                let resultText = '\n\n⚡ Bash executed by Skill\n';
                for (const fileId of fileIds)
                  resultText += `\n📎 File: \`${fileId}\``;
                resultText += '\n';
                pt.appendText(resultText);
              } else
                pt.sendOperationState('code-exec', 'Bash executed by Skill', { opId: content_block.tool_use_id, state: 'done' });

              // Log for debugging
              if (fileIds.length)
                console.log('[Anthropic] Bash code execution result:', {
                  return_code: content_block.content.return_code,
                  file_count: fileIds.length,
                  file_ids: fileIds,
                });
            } else if (content_block.content.type === 'bash_code_execution_tool_result_error') {
              // Error during bash execution - log and show as transient placeholder (often a server-side artifact)
              console.log('[Anthropic] Bash execution error:', content_block.content.error_code);
              pt.sendOperationState('code-exec', `Bash error: ${content_block.content.error_code}`, { opId: content_block.tool_use_id, state: 'error' });
            }
            break;

          case 'text_editor_code_execution_tool_result':
            // Text editor code execution result from Skills container
            pt.sendOperationState('code-exec', '⚡ Text editor code executed by Skill', { opId: content_block.tool_use_id, state: 'done' });

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
            pt.sendOperationState('code-exec', `📎 File generated (ID: ${content_block.file_id})`, { opId: content_block.file_id, state: 'done' });

            // Log for debugging
            console.log('[Anthropic] Container upload:', {
              file_id: content_block.file_id,
              container: responseMessage.container?.id,
            });

            // TODO: Future enhancement - could trigger automatic file download here
            // using the Files API with content_block.file_id
            break;

          case 'tool_search_tool_result': // [Anthropic, 2025-11-24] Tool Search Tool
            if (content_block.content?.type === 'tool_search_tool_search_result') {
              // success
              const toolNames = content_block.content.tool_references.map(ref => ref.tool_name);
              pt.sendOperationState('code-exec', `🔍 Discovered ${toolNames.length} tool(s): ${toolNames.join(', ')}`, { opId: content_block.tool_use_id, state: 'done' });
              // Log for future debugging
              console.log('[Anthropic] Tool search discovered:', { tools: toolNames });
            } else if (content_block.content?.type === 'tool_search_tool_result_error') {
              // error during tool search
              pt.sendOperationState('code-exec', `🔍 Tool search error: ${content_block.content.error_code}`, { opId: content_block.tool_use_id, state: 'error' });
            }
            break;

          default:
            const _exhaustiveCheck: never = content_block;
            aixResilientUnknownValue('Anthropic', 'contentBlockType', (content_block as any)?.type);
            break;
        }

        // set separator flag when server tools complete (text after tools needs visual separation)
        if (content_block.type.includes('tool_use') || content_block.type.includes('tool_result'))
          needsTextSeparator = hotFixAntInjectToolsTextSpacer;

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
              // Hotfix Opus-4.6: elide first text block if it's '\n\n'
              if (elisionCheck(delta.text)) break;
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
              if (_isPersistedHostedWebTool(contentBlock.name))
                pt.appendFunctionCallInvocationArgs(contentBlock.id, delta.partial_json);
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
            aixResilientUnknownValue('Anthropic', 'deltaType', (delta as any)?.type);
            break;
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

        const closedBlock = responseMessage.content[index];
        if (closedBlock.type === 'tool_use' && closedBlock.input === '' && !backfilledEmptyToolUseIds.has(closedBlock.id)) {
          pt.appendFunctionCallInvocationArgs(closedBlock.id, '{}');
          backfilledEmptyToolUseIds.add(closedBlock.id);
        }

        // Signal that the tool is ready? (if it is...)
        pt.endMessagePart();
        break;
      }

      // Optionally handle top-level message changes. Example: updating stop_reason
      case 'message_delta': {
        if (!responseMessage) throw new Error('Unexpected message_delta');

        const { delta, usage } = AnthropicWire_API_Message_Create.event_MessageDelta_schema.parse(JSON.parse(eventData));

        Object.assign(responseMessage, delta);
        if (delta.stop_reason === 'tool_use')
          for (const contentBlock of responseMessage.content)
            if (contentBlock?.type === 'tool_use' && contentBlock.input === '' && !backfilledEmptyToolUseIds.has(contentBlock.id)) {
              pt.appendFunctionCallInvocationArgs(contentBlock.id, '{}');
              backfilledEmptyToolUseIds.add(contentBlock.id);
            }

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
        if (ANTHROPIC_DEBUG_EVENT_SEQUENCE) console.log('ant message_stop', { stop_reason: responseMessage.stop_reason });

        // Continuation: when pause_turn, throw to trigger re-dispatch with accumulated content
        if (responseMessage.stop_reason === 'pause_turn')
          throw new DispatchContinuationSignal(
            _createAnthropicPauseTurnContinuation(responseMessage.content, responseMessage.container?.id),
          );

        return pt.setDialectEnded('done-dialect'); // Anthropic: stop message

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
            throw new OperationRetrySignal(`retrying Anthropic: ${errorText}`, {
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
        aixResilientUnknownValue('Anthropic', 'eventName', eventName);
        break;
    }
  };
}


export function createAnthropicMessageParserNS(): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();
  let needsTextSeparator = false; // insert text separator when text follows server tool

  let elideFirstTextBlock = hotFixAntElideLeadingDoubleNewline;
  const elisionCheck = (fullText: string) => {
    if (!elideFirstTextBlock) return false;
    elideFirstTextBlock = false;
    if (fullText !== '\n\n') return false;
    console.log('[DEV] Anthropic: 🔷 Eliding leading \\n\\n text block');
    return true;
  };

  return function(pt: IParticleTransmitter, fullData: string /*, eventName?: string, context?: { retriesAvailable: boolean } */): void {

    // parse with validation (e.g. type: 'message' && role: 'assistant')
    const {
      model,
      content,
      container,
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
          // Hotfix Opus-4.6: elide first text block if it's '\n\n'
          if (elisionCheck(contentBlock.text)) break;
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
          const isProgrammaticCallNS = contentBlock.caller?.type === 'code_execution_20250825' || contentBlock.caller?.type === 'code_execution_20260120';
          if (isProgrammaticCallNS)
            console.log(`[Anthropic] Programmatic tool call (non-streaming): ${contentBlock.name} called from ${contentBlock.caller!.type} (tool_id: ${contentBlock.caller!.type !== 'direct' ? contentBlock.caller!.tool_id : 'n/a'})`);

          pt.startFunctionCallInvocation(contentBlock.id, contentBlock.name, 'json_object', (contentBlock.input as object) || null);
          pt.endMessagePart();
          break;

        case 'server_tool_use':
          // Server tool use in non-streaming mode
          if (_isPersistedHostedWebTool(contentBlock.name)) {
            pt.startFunctionCallInvocation(contentBlock.id, contentBlock.name, 'json_object', (contentBlock.input as object) || null);
            pt.endMessagePart();
            break;
          }

          switch (contentBlock.name) { // .server_tool_use.name
            case 'web_search':
            case 'web_fetch':
              break;
            case 'code_execution':
              pt.sendOperationState('code-exec', '⚡ Executing code...', { opId: contentBlock.id });
              break;
            case 'bash_code_execution':
              pt.sendOperationState('code-exec', '⚡ Running bash script...', { opId: contentBlock.id });
              break;
            case 'text_editor_code_execution':
              pt.sendOperationState('code-exec', '⚡ Executing code...', { opId: contentBlock.id });
              break;
            // [Anthropic, 2025-11-24] Tool Search Tool
            case 'tool_search_tool_regex':
            case 'tool_search_tool_bm25':
              pt.sendOperationState('code-exec', '🔍 Searching available tools...', { opId: contentBlock.id });
              break;
            default:
              console.warn(`[Anthropic Parser] Unknown server tool (non-streaming): ${contentBlock.name}`);
              pt.sendOperationState('code-exec', `⚡ Using ${contentBlock.name}...`, { opId: contentBlock.id });
              break;
          }
          break;

        case 'web_search_tool_result':
          // Web search results in non-streaming mode
          const searchResultNS = _formatAnthropicWebSearchResult(contentBlock.content);
          pt.addFunctionCallResponse(contentBlock.tool_use_id, searchResultNS.error, 'web_search', searchResultNS.result, 'upstream');
          pt.endMessagePart();
          break;

        case 'web_fetch_tool_result':
          // Web fetch results in non-streaming mode
          const fetchResultNS = _formatAnthropicWebFetchResult(contentBlock.content);
          pt.addFunctionCallResponse(contentBlock.tool_use_id, fetchResultNS.error, 'web_fetch', fetchResultNS.result, 'upstream');
          if (contentBlock.content.type === 'web_fetch_result') {
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
            // already persisted as tool response above
          }
          pt.endMessagePart();
          break;

        case 'code_execution_tool_result':
          // Code execution result from Skills container (non-streaming)
          if (contentBlock.content.type === 'code_execution_result') {
            // Success - check for generated files in content array
            const fileIds: string[] = [];
            if (Array.isArray(contentBlock.content.content))
              for (const outputBlock of contentBlock.content.content)
                if (outputBlock.type === 'code_execution_output' && outputBlock.file_id)
                  fileIds.push(outputBlock.file_id);

            if (fileIds.length > 0) {
              let resultText = '\n\n⚡ Code executed by Skill\n';
              for (const fileId of fileIds)
                resultText += `\n📎 File: \`${fileId}\``;
              resultText += '\n';
              pt.appendText(resultText);
            } else
              pt.sendOperationState('code-exec', 'Code executed by Skill', { opId: contentBlock.tool_use_id, state: 'done' });

            // Log for debugging
            if (fileIds.length)
              console.log('[Anthropic] Code execution result (non-streaming):', {
                return_code: contentBlock.content.return_code,
                file_count: fileIds.length,
                file_ids: fileIds,
              });
          } else if (contentBlock.content.type === 'encrypted_code_execution_result') {
            // Encrypted variant (PFC + web_search) - stdout is encrypted, show as transient placeholder
            pt.sendOperationState('code-exec', 'Code executed (encrypted output)', { opId: contentBlock.tool_use_id, state: 'done' });
            console.log('[Anthropic] Encrypted code execution result (non-streaming):', { return_code: contentBlock.content.return_code });
          } else if (contentBlock.content.type === 'code_execution_tool_result_error') {
            // Error during code execution - log and show as transient placeholder (often a server-side artifact)
            console.log('[Anthropic] Code execution error (non-streaming):', contentBlock.content.error_code);
            pt.sendOperationState('code-exec', `Skill error: ${contentBlock.content.error_code}`, { opId: contentBlock.tool_use_id, state: 'error' });
          }
          break;

        case 'bash_code_execution_tool_result':
          // Bash code execution result from Skills container (non-streaming)
          if (contentBlock.content.type === 'bash_code_execution_result') {
            // Success - check for generated files in content array
            const fileIds: string[] = [];
            if (Array.isArray(contentBlock.content.content))
              for (const outputBlock of contentBlock.content.content)
                if (outputBlock.type === 'bash_code_execution_output' && outputBlock.file_id)
                  fileIds.push(outputBlock.file_id);

            if (fileIds.length > 0) {
              let resultText = '\n\n⚡ Bash executed by Skill\n';
              for (const fileId of fileIds)
                resultText += `\n📎 File: \`${fileId}\``;
              resultText += '\n';
              pt.appendText(resultText);
            } else
              pt.sendOperationState('code-exec', 'Bash executed by Skill', { opId: contentBlock.tool_use_id, state: 'done' });

            // Log for debugging
            console.log('[Anthropic] Bash code execution result (non-streaming):', {
              return_code: contentBlock.content.return_code,
              file_count: fileIds.length,
              file_ids: fileIds,
            });
          } else if (contentBlock.content.type === 'bash_code_execution_tool_result_error') {
            // Error during bash execution - log and show as transient placeholder (often a server-side artifact)
            console.log('[Anthropic] Bash execution error (non-streaming):', contentBlock.content.error_code);
            pt.sendOperationState('code-exec', `Bash error: ${contentBlock.content.error_code}`, { opId: contentBlock.tool_use_id, state: 'error' });
          }
          break;

        case 'text_editor_code_execution_tool_result':
          // Text editor code execution result from Skills container (non-streaming)
          pt.sendOperationState('code-exec', '⚡ Text editor code executed by Skill', { opId: contentBlock.tool_use_id, state: 'done' });
          console.log('[Anthropic] Text editor code execution result from Skills (non-streaming)');
          break;

        case 'mcp_tool_use':
          throw new Error(`Server tool 'mcp_tool_use' is not yet implemented. Please report this issue to request support.`);

        case 'mcp_tool_result':
          throw new Error(`Server tool 'mcp_tool_result' is not yet implemented. Please report this issue to request support.`);

        case 'container_upload':
          // Container upload - this is when a Skill has generated a file
          pt.sendOperationState('code-exec', `📎 File generated (ID: ${contentBlock.file_id})`, { opId: contentBlock.file_id, state: 'done' });

          // Log for debugging
          console.log('[Anthropic] Container upload (non-streaming):', {
            file_id: contentBlock.file_id,
          });
          break;

        case 'tool_search_tool_result': // [Anthropic, 2025-11-24] Tool Search Tool
          if (contentBlock.content?.type === 'tool_search_tool_search_result') {
            // success
            const toolNames = contentBlock.content.tool_references.map(ref => ref.tool_name);
            pt.sendOperationState('code-exec', `🔍 Discovered ${toolNames.length} tool(s): ${toolNames.join(', ')}`, { opId: contentBlock.tool_use_id, state: 'done' });
            // Log for future debugging
            console.log('[Anthropic] Tool search discovered (non-streaming):', { tools: toolNames });
          } else if (contentBlock.content?.type === 'tool_search_tool_result_error') {
            // error during tool search
            pt.sendOperationState('code-exec', `🔍 Tool search error: ${contentBlock.content.error_code}`, { opId: contentBlock.tool_use_id, state: 'error' });
          }
          break;

        default:
          const _exhaustiveCheck: never = contentBlock;
          aixResilientUnknownValue('Anthropic-NS', 'contentBlockType', (contentBlock as any)?.type);
          break;
      }

      // set separator flag when server tools complete (text after tools needs visual separation)
      if (contentBlock.type.includes('tool_use') || contentBlock.type.includes('tool_result'))
        needsTextSeparator = hotFixAntInjectToolsTextSpacer;
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

    // Continuation: when pause_turn, throw to trigger re-dispatch with accumulated content
    if (stop_reason === 'pause_turn')
      throw new DispatchContinuationSignal(
        _createAnthropicPauseTurnContinuation(content, container?.id),
      );
  };
}


// --- Anthropic pause_turn continuation ---

/**
 * Creates a DispatchContinuation for Anthropic's pause_turn stop reason.
 * Appends accumulated content blocks as an assistant message for the next turn.
 * On subsequent turns, detects the trailing assistant message and extends its content.
 */
function _createAnthropicPauseTurnContinuation(
  accumulatedContent: AnthropicWire_API_Message_Create.Response['content'],
  containerId: string | undefined,
): { reason: string; mutateBody: (body: Record<string, unknown>) => Record<string, unknown> } {
  return {
    reason: 'pause_turn',
    mutateBody(body: Record<string, unknown>): Record<string, unknown> {
      const messages = [...(body.messages as { role: string; content: unknown }[])];

      // Streaming accumulates tool_use/server_tool_use `input` as a JSON string via input_json_delta.
      // The API expects `input` as a parsed object when sent back in messages - we convert it here
      const fixedContent = accumulatedContent.map(block => {
        if (('type' in block) && (block.type === 'tool_use' || block.type === 'server_tool_use') && typeof block.input === 'string') {
          try {
            return { ...block, input: JSON.parse(block.input) };
          } catch {
            return block;
          }
        }
        return block;
      });

      // Detect trailing assistant message from a prior continuation turn
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'assistant' && Array.isArray(lastMessage.content)) {
        // Extend existing assistant message with new content blocks
        messages[messages.length - 1] = {
          ...lastMessage,
          content: [...lastMessage.content, ...fixedContent],
        };
      } else {
        // First continuation: append new assistant message with accumulated content
        messages.push({ role: 'assistant', content: [...fixedContent] });
      }

      return {
        ...body,
        messages,
        // Pass container ID as string to reuse the existing container
        ...(containerId ? { container: containerId } : {}),
      };
    },
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
