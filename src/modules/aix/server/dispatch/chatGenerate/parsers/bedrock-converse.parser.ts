import { safeErrorString } from '~/server/wire';

import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from './IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';

import { BedrockConverseWire_API } from '../../wiretypes/bedrock-converse.wiretypes';


/**
 * Bedrock Converse Stream Parser
 *
 * Handles the Converse stream events which arrive as SSE events with names:
 * messageStart, contentBlockStart, contentBlockDelta, contentBlockStop, messageStop, metadata
 *
 * The EventStream binary protocol is decoded upstream into SSE by the aws-eventstream demuxer.
 * Unlike InvokeModel (which wraps payloads in base64), Converse events have direct JSON payloads
 * with the `:event-type` header as the SSE event name.
 */
export function createBedrockConverseStreamParser(): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();
  let hasErrored = false;
  let currentToolUseId: string | null = null;

  return function(pt: IParticleTransmitter, eventData: string, eventName?: string): void {

    // if we've errored, we should not be receiving more data
    if (hasErrored)
      return;

    try {
      const parsed = JSON.parse(eventData);

      switch (eventName) {

        case 'messageStart': {
          // { role: 'assistant' } - init state
          const { role } = BedrockConverseWire_API.event_MessageStart_schema.parse(parsed);
          if (role !== 'assistant')
            console.warn(`[Bedrock Converse] Unexpected role in messageStart: ${role}`);
          break;
        }

        case 'contentBlockStart': {
          const { contentBlockIndex: _, start } = BedrockConverseWire_API.event_ContentBlockStart_schema.parse(parsed);
          // Text blocks have empty start (they don't emit this) - nothing to do
          if ('toolUse' in start && start.toolUse) {
            currentToolUseId = start.toolUse.toolUseId;
            pt.startFunctionCallInvocation(start.toolUse.toolUseId, start.toolUse.name, 'incr_str', null);
          }
          break;
        }

        case 'contentBlockDelta': {
          const { contentBlockIndex: _, delta } = BedrockConverseWire_API.event_ContentBlockDelta_schema.parse(parsed);
          if ('text' in delta) {
            // Text delta
            pt.appendText(delta.text);
          } else if ('toolUse' in delta) {
            // Tool use input delta (incremental JSON string)
            if (currentToolUseId)
              pt.appendFunctionCallInvocationArgs(currentToolUseId, delta.toolUse.input);
          }
          break;
        }

        case 'contentBlockStop': {
          const { contentBlockIndex: _ } = BedrockConverseWire_API.event_ContentBlockStop_schema.parse(parsed);
          // End the current part (important for tool blocks)
          pt.endMessagePart();
          currentToolUseId = null;
          break;
        }


        case 'messageStop': {
          const { stopReason } = BedrockConverseWire_API.event_MessageStop_schema.parse(parsed);
          const tokenStopReason = _fromConverseStopReason(stopReason);
          if (tokenStopReason !== null)
            pt.setTokenStopReason(tokenStopReason);
          return pt.setDialectEnded('done-dialect');
        }

        case 'metadata': {
          const { usage, metrics } = BedrockConverseWire_API.event_Metadata_schema.parse(parsed);
          pt.updateMetrics({
            TIn: usage.inputTokens,
            TOut: usage.outputTokens,
            ...(metrics?.latencyMs ? { dtInner: metrics.latencyMs } : {}),
            dtAll: Date.now() - parserCreationTimestamp,
          });
          break;
        }

        // case 'error': {
        //   hasErrored = true;
        //   const errorText = parsed?.message || parsed?.error?.message || safeErrorString(parsed);
        //   return pt.setDialectTerminatingIssue(errorText || 'Unknown Bedrock Converse error', IssueSymbols.Generic, 'srv-warn');
        // }

        default:
          // Unknown event - log and skip
          console.warn(`[Bedrock Converse] Unknown stream event: ${eventName || '(no event name)'}`, eventData);
          break;
      }
    } catch (error: any) {
      hasErrored = true;
      const errorMessage = error?.message || safeErrorString(error);
      return pt.setDialectTerminatingIssue(`Bedrock Converse parse error: ${errorMessage}`, IssueSymbols.Generic, 'srv-warn');
    }
  };
}


/**
 * Bedrock Converse Non-Streaming Parser
 *
 * Parses the full Converse API response in one shot.
 */
export function createBedrockConverseParserNS(): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();

  return function(pt: IParticleTransmitter, fullData: string): void {

    const response = BedrockConverseWire_API.Response_schema.parse(JSON.parse(fullData));

    // Process content blocks
    const contentBlocks = response.output.message.content;
    for (const block of contentBlocks) {
      if ('text' in block) {
        pt.appendText(block.text);
      } else if ('toolUse' in block) {
        pt.startFunctionCallInvocation(
          block.toolUse.toolUseId,
          block.toolUse.name,
          'json_object',
          (block.toolUse.input as object) || null,
        );
        pt.endMessagePart();
      }
      // image and toolResult blocks are not expected in assistant responses
    }

    // Stop reason
    const tokenStopReason = _fromConverseStopReason(response.stopReason);
    if (tokenStopReason !== null)
      pt.setTokenStopReason(tokenStopReason);

    // Metrics
    pt.updateMetrics({
      TIn: response.usage.inputTokens,
      TOut: response.usage.outputTokens,
      ...(response.metrics?.latencyMs ? { dtInner: response.metrics.latencyMs } : {}),
      dtAll: Date.now() - parserCreationTimestamp,
    });
  };
}


function _fromConverseStopReason(stopReason: string | null | undefined) {
  switch (stopReason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'ok' as const;
    case 'tool_use':
      return 'ok-tool_invocations' as const;
    case 'max_tokens':
      return 'out-of-tokens' as const;
    case 'guardrail_intervened':
    case 'content_filtered':
      return 'filter-content' as const;
    default:
      if (stopReason)
        console.warn(`[Bedrock Converse] Unknown stop reason: ${stopReason}`);
      return null;
  }
}
