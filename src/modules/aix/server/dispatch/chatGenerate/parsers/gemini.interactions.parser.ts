import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from './IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';


/**
 * Gemini Interactions API Response Parser
 *
 * Parses responses from the Gemini Interactions API, which is used for
 * agents like Deep Research. Supports both streaming and non-streaming modes.
 *
 * Streaming events:
 * - content.delta: Incremental text/thought updates
 * - interaction.complete: Final interaction with full response
 *
 * Non-streaming:
 * - Single response object with outputs array
 *
 * Deep Research specifics:
 * - Uses background=true for long-running tasks
 * - Status can be: in_progress, completed, requires_action, failed, cancelled
 * - May require polling via interactions.get() for background tasks
 */
export function createGeminiInteractionsResponseParser(
  agentName: string,
  isStreaming: boolean,
): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();
  let sentAgentName = false;
  let timeToFirstEvent: number | undefined;
  let interactionId: string | undefined;

  return function(pt: IParticleTransmitter, rawEventData: string): void {

    // Time to first event
    if (timeToFirstEvent === undefined)
      timeToFirstEvent = Date.now() - parserCreationTimestamp;

    // Parse the raw event data
    let eventData: any;
    try {
      eventData = JSON.parse(rawEventData);
    } catch (e) {
      return pt.setDialectTerminatingIssue(`Failed to parse Interactions API response: ${e}`, null, 'srv-warn');
    }

    // Set agent name as model name (if not already set)
    if (!sentAgentName) {
      pt.setModelName(agentName);
      sentAgentName = true;
    }

    // Handle streaming vs non-streaming
    if (isStreaming) {
      _parseStreamingEvent(pt, eventData, parserCreationTimestamp, timeToFirstEvent);
    } else {
      _parseNonStreamingResponse(pt, eventData, parserCreationTimestamp, timeToFirstEvent);
    }

    // Store interaction ID for potential polling
    if (eventData.id)
      interactionId = eventData.id;
    if (eventData.interaction?.id)
      interactionId = eventData.interaction.id;

    // Store interaction ID for resumability (similar to OpenAI Responses)
    if (interactionId)
      pt.setUpstreamHandle(interactionId, 'gemini-interactions');
  };
}


/**
 * Parse streaming events from the Interactions API
 */
function _parseStreamingEvent(
  pt: IParticleTransmitter,
  eventData: any,
  parserCreationTimestamp: number,
  timeToFirstEvent: number | undefined,
): void {

  const eventType = eventData.event_type;

  switch (eventType) {

    case 'content.delta':
      // Incremental content update
      const delta = eventData.delta;
      if (delta?.type === 'text' && delta.text) {
        pt.appendText(delta.text);
      } else if (delta?.type === 'thought' && delta.thought) {
        pt.appendReasoningText(delta.thought);
      }
      break;

    case 'interaction.complete':
      // Final interaction response
      const interaction = eventData.interaction;
      if (interaction) {
        _handleInteractionComplete(pt, interaction, parserCreationTimestamp, timeToFirstEvent);
      }
      break;

    default:
      // Unknown event type - log but don't fail
      if (eventType)
        console.warn(`[Gemini Interactions] Unknown streaming event type: ${eventType}`);
      // For non-event-type responses (like status updates), try to parse as interaction
      else if (eventData.status)
        _handleInteractionStatus(pt, eventData);
      break;
  }
}


/**
 * Parse non-streaming response from the Interactions API
 */
function _parseNonStreamingResponse(
  pt: IParticleTransmitter,
  eventData: any,
  parserCreationTimestamp: number,
  timeToFirstEvent: number | undefined,
): void {

  // Non-streaming returns the full interaction object
  if (eventData.status) {
    _handleInteractionComplete(pt, eventData, parserCreationTimestamp, timeToFirstEvent);
  } else {
    pt.setDialectTerminatingIssue('Invalid Interactions API response: missing status', null, 'srv-warn');
  }
}


/**
 * Handle a complete interaction response
 */
function _handleInteractionComplete(
  pt: IParticleTransmitter,
  interaction: any,
  parserCreationTimestamp: number,
  timeToFirstEvent: number | undefined,
): void {

  // Handle status
  const status = interaction.status;
  switch (status) {

    case 'completed':
      // Process all outputs
      if (interaction.outputs?.length) {
        for (const output of interaction.outputs) {
          _processOutput(pt, output);
        }
      }
      break;

    case 'in_progress':
      // Background task still running - client should poll
      pt.appendText('[Deep Research is running in the background. Status: in progress...]\n');
      // Don't end the stream yet for background tasks
      return;

    case 'requires_action':
      // Agent needs user input or function execution
      pt.appendText('[Agent requires action - function call or user input needed]\n');
      // Process any outputs that have been generated so far
      if (interaction.outputs?.length) {
        for (const output of interaction.outputs) {
          _processOutput(pt, output);
        }
      }
      break;

    case 'failed':
      pt.setTokenStopReason('cg-issue');
      return pt.setDialectTerminatingIssue('Deep Research failed', IssueSymbols.Generic, false);

    case 'cancelled':
      pt.setTokenStopReason('cg-issue');
      return pt.setDialectTerminatingIssue('Deep Research was cancelled', null, false);

    default:
      console.warn(`[Gemini Interactions] Unknown status: ${status}`);
  }

  // Update metrics
  if (interaction.usage) {
    const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
      TIn: interaction.usage.input_tokens,
      TOut: interaction.usage.output_tokens,
    };
    if (timeToFirstEvent !== undefined)
      metricsUpdate.dtStart = timeToFirstEvent;
    metricsUpdate.dtAll = Date.now() - parserCreationTimestamp;
    pt.updateMetrics(metricsUpdate);
  }
}


/**
 * Handle interaction status updates (for polling scenarios)
 */
function _handleInteractionStatus(
  pt: IParticleTransmitter,
  eventData: any,
): void {
  const status = eventData.status;

  switch (status) {
    case 'in_progress':
      // Still running - this might be a poll response
      pt.appendText('[Research in progress...]\n');
      break;

    case 'completed':
    case 'requires_action':
    case 'failed':
    case 'cancelled':
      // Handle as complete interaction
      _handleInteractionComplete(pt, eventData, Date.now(), 0);
      break;

    default:
      console.warn(`[Gemini Interactions] Unknown status in poll: ${status}`);
  }
}


/**
 * Process a single output from the interaction
 */
function _processOutput(pt: IParticleTransmitter, output: any): void {
  const outputType = output.type;

  switch (outputType) {

    case 'text':
      if (output.text)
        pt.appendText(output.text);
      break;

    case 'thought':
      if (output.thought)
        pt.appendReasoningText(output.thought);
      break;

    case 'image':
      if (output.data && output.mime_type) {
        pt.appendImageInline(
          output.mime_type,
          output.data,
          'Gemini Generated Image',
          'Gemini Deep Research',
          '',
        );
      }
      break;

    case 'function_call':
      // Handle function calls from the agent
      pt.startFunctionCallInvocation(
        output.id || null,
        output.name,
        'json_object',
        output.arguments,
      );
      pt.endMessagePart();
      break;

    case 'google_search_result':
    case 'url_context_result':
      // These are metadata/context outputs - could be used for citations
      // For now, we skip them as they're supplementary to the main text output
      break;

    default:
      console.warn(`[Gemini Interactions] Unknown output type: ${outputType}`);
  }
}
