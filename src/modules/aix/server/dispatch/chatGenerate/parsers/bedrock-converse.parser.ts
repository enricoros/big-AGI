import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter, ParticleDialectIssue } from './IParticleTransmitter';

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
 *
 * A payload or event that does not parse throws: the executor reports it as our own processing failure (dispatch-parse).
 * An exception is the service's failure however its payload reads.
 */
export function createBedrockConverseStreamParser(): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();
  let hasErrored = false;
  let currentToolUseId: string | null = null;

  return function(pt: IParticleTransmitter, eventData: string, eventName?: string): void {

    // if we've errored, we should not be receiving more data
    if (hasErrored)
      return;

    const parsed = eventName === 'error' ? _parseExceptionPayload(eventData) : JSON.parse(eventData);

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
        } else if ('reasoningContent' in delta) {
          // Reasoning delta, in its own content block before the text
          const { text, signature, redactedContent } = delta.reasoningContent;
          if (text) pt.appendReasoningText(text);
          if (signature) pt.setReasoningSignature(signature);
          if (redactedContent) pt.addReasoningRedactedData(redactedContent);
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
          _setConverseStop(pt, tokenStopReason, stopReason);
        break; // not the end: 'metadata' follows with the usage, and the executor reads nothing past a dialect end
      }

      case 'metadata': {
        const { usage, metrics } = BedrockConverseWire_API.event_Metadata_schema.parse(parsed);
        pt.updateMetrics({
          // inputTokens excludes the cache classes (additive, like Anthropic)
          TIn: usage.inputTokens,
          ...(usage.cacheReadInputTokens && { TCacheRead: usage.cacheReadInputTokens }),
          ...(usage.cacheWriteInputTokens && { TCacheWrite: usage.cacheWriteInputTokens }),
          TOut: usage.outputTokens,
          ...(metrics?.latencyMs ? { dtInner: metrics.latencyMs } : {}),
          dtAll: Date.now() - parserCreationTimestamp,
        });
        return pt.setDialectEnded('done-dialect'); // the last event of a Converse stream
      }

      // exception frames, re-emitted as `event: error` by the AWS event-stream transform: the error ends the stream
      case 'error': {
        hasErrored = true;
        pt.addDialectIssue(_fromConverseException(parsed), 'srv-warn');
        return pt.setDialectEnded('issue-dialect');
      }

      default:
        // Unknown event - log and skip
        console.warn(`[Bedrock Converse] Unknown stream event: ${eventName || '(no event name)'}`, eventData);
        break;
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
      } else if ('reasoningContent' in block) {
        const reasoning = block.reasoningContent;
        if ('reasoningText' in reasoning) {
          pt.appendReasoningText(reasoning.reasoningText.text);
          if (reasoning.reasoningText.signature) pt.setReasoningSignature(reasoning.reasoningText.signature);
        } else
          pt.addReasoningRedactedData(reasoning.redactedContent);
      }
      // image and toolResult blocks are not expected in assistant responses
    }

    // Stop reason
    const tokenStopReason = _fromConverseStopReason(response.stopReason);
    if (tokenStopReason !== null)
      _setConverseStop(pt, tokenStopReason, response.stopReason);

    // Metrics
    pt.updateMetrics({
      TIn: response.usage.inputTokens, // exclusive of the cache classes
      ...(response.usage.cacheReadInputTokens && { TCacheRead: response.usage.cacheReadInputTokens }),
      ...(response.usage.cacheWriteInputTokens && { TCacheWrite: response.usage.cacheWriteInputTokens }),
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

/** The stop reason, and for a filter stop the issue that explains it: the vendor's reason tells an AWS Guardrail from the model's own filter */
function _setConverseStop(pt: IParticleTransmitter, tokenStopReason: NonNullable<ReturnType<typeof _fromConverseStopReason>>, stopReason: string): void {
  pt.setTokenStopReason(tokenStopReason);
  if (tokenStopReason === 'filter-content')
    pt.addDialectIssue({ code: 'model-filter', causeCode: stopReason });
}

/** An exception's payload is the service's report even when it is not JSON (plain text, or empty): its text is the message */
function _parseExceptionPayload(eventData: string): unknown {
  try {
    return JSON.parse(eventData);
  } catch {
    return eventData.trim();
  }
}

/**
 * An exception frame, which fails the generation: the vendor's message is the text, the exception type is `causeCode`, any other payload field is the
 * detail (a modelStreamErrorException adds `originalStatusCode` and `originalMessage`). The demuxer adds the frame's type
 * headers to the payload (`:exception-type`; `:error-code` and `:error-message` for an error frame); an exception sent under
 * its own event type arrives as { type: 'error', error: { type, message: <the payload as JSON text> } }. The demuxer's own decode
 * failure (type `transform_error`) is ours: `dispatch-parse`.
 */
function _fromConverseException(parsed: unknown): ParticleDialectIssue {
  let wrappedType: unknown;
  let payload: Record<string, unknown> = {};
  if (typeof parsed === 'string')
    payload = { message: parsed };
  else if (parsed && typeof parsed === 'object') {
    payload = parsed as Record<string, unknown>;
    const wrapped = payload.type === 'error' ? payload.error as Record<string, unknown> | undefined : undefined;
    if (wrapped && typeof wrapped === 'object') {
      // our demuxer's own decode failure, not the service's
      if (wrapped.type === 'transform_error')
        return { code: 'dispatch-parse', ...(typeof wrapped.message === 'string' && wrapped.message && { detail: wrapped.message }) };
      wrappedType = wrapped.type;
      let inner: unknown;
      try {
        inner = typeof wrapped.message === 'string' ? JSON.parse(wrapped.message) : undefined;
      } catch {
        // not JSON: the message as sent
      }
      payload = inner && typeof inner === 'object' ? inner as Record<string, unknown> : { message: wrapped.message };
    }
  }

  const { message, ':exception-type': exceptionType, ':error-code': errorCode, ':error-message': errorMessage, ...others } = payload;
  const text = [message, errorMessage].find(value => typeof value === 'string' && value) as string | undefined;
  const causeCode = [exceptionType, errorCode, wrappedType].find(value => typeof value === 'string' && value) as string | undefined;
  const detail = Object.entries(others).map(([name, value]) => `${name}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(', ');
  return { text, causeCode, ...(detail && { detail }) }; // no message: the record's own sentence
}
