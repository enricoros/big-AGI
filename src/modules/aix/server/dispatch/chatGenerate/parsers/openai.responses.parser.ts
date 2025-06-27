import { safeErrorString } from '~/server/wire';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from '../IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';

import { OpenAIWire_API_Responses } from '../../wiretypes/openai.wiretypes';


// configuration
const OPENAI_RESPONSES_DEBUG_EVENT_SEQUENCE = false; // true: shows the sequence of events
const OPENAI_RESPONSES_SAME_PART_SPACER = '\n\n'; // true: shows the sequence of events


type TResponse = OpenAIWire_API_Responses.Response;
type TOutputItem = OpenAIWire_API_Responses.Response['output'][number];
type TEventType = OpenAIWire_API_Responses.StreamingEvent['type'];


/**
 * We need this just to ensure events are not out of order, as out streaming is progressive
 * and ordered part-by-part.
 *
 * Very simple, just checks for orders, indices, allowed operations.
 */
class ResponseParserStateMachine {

  // timings
  public parserCreationTimestamp = Date.now();
  public timeToFirstEvent: number | undefined; // time to the first event, in ms

  // low-level verifications
  #sequenceNumber: number = 0;
  #expectedEvents: TEventType[] | undefined;

  // most recently updated response object
  #response: TResponse | undefined;

  // outer index pointing at 'message', 'reasoning' and 'function_call'
  #inOutputIndex: number | undefined; // index of the output item being processed
  #inOutputType: TOutputItem['type'] | undefined; // type of the output item being processed

  // indices of the part within the output item
  #contentIndex: number | undefined; // within 'message' output items
  #contentAddSpacer: boolean = false; // whether we need to inject a spacer in the content part
  #summaryIndex: number | undefined; // within 'reasoning' output items
  #summaryAddSpacer: boolean = false; // whether we need to inject a spacer in the summary part


  // Validations

  validateSequenceNumber(sequenceNumber: number) {
    // time-to-first-event
    if (this.timeToFirstEvent === undefined)
      this.timeToFirstEvent = Date.now() - this.parserCreationTimestamp;

    if (sequenceNumber !== this.#sequenceNumber)
      console.warn(`[DEV] AIX: OpenAI Responses: sequence mismatch: got ${sequenceNumber}, expected ${this.#sequenceNumber}`);
    this.#sequenceNumber = sequenceNumber + 1;
  }

  validateExpectedEventType(eventType: TEventType) {
    if (!this.#expectedEvents || !this.#expectedEvents.length || this.#expectedEvents.includes(eventType))
      return true;
    console.warn(`[DEV] AIX: OpenAI Responses: unexpected event type: got ${eventType}, expected one of ${this.#expectedEvents.join(', ')}`);
    return false;
  }

  expectEvents(events: TEventType[] | undefined) {
    this.#expectedEvents = (!events || !events.length) ? undefined : events;
  }


  // Response validation

  setResponse(label: string, response: TResponse, excludeFields: string[] = []) {
    if (!this.#response) {
      this.#response = response;
      return false;
    }
    const diff = _warnIfObjectPropertiesDiffer(this.#response, response, excludeFields);
    if (diff)
      console.warn(`[DEV] AIX: ${label}: response differs:`, { diff, excludedFields: excludeFields });
    return !!diff;
  }

  get responseId() {
    return this.#response?.id ?? 'new response';
  }


  // Monotonic indices validation

  outputItemEnter(label: TEventType, outputIndex: number, outputType: TOutputItem['type']) {
    const expectedIndex = outputIndex === 0 ? undefined : outputIndex - 1;
    if (this.#inOutputIndex !== expectedIndex || this.#inOutputType !== undefined)
      console.warn(`[DEV] AIX: ${label} - output item enter index/type mismatch: expected ${expectedIndex}/${outputType}, got ${this.#inOutputIndex}/${this.#inOutputType}`);
    this.#inOutputIndex = outputIndex;
    this.#inOutputType = outputType;
  }

  outputItemExit(label: TEventType, outputIndex: number, outputType: TOutputItem['type']) {
    if (this.#inOutputIndex !== outputIndex || this.#inOutputType !== outputType)
      console.warn(`[DEV] AIX: ${label} - output item exit index/type mismatch: expected ${outputIndex}/${outputType}, got ${this.#inOutputIndex}/${this.#inOutputType}`);
    // this.#inOutputIndex = undefined; // leave the index to increase
    this.#inOutputType = undefined;
  }

  outputItemVisit(label: TEventType, outputIndex: number, outputType: TOutputItem['type']) {
    if (this.#inOutputIndex !== outputIndex || this.#inOutputType !== outputType)
      console.warn(`[DEV] AIX: ${label} - output item visit index/type mismatch: expected ${outputIndex}/${outputType}, got ${this.#inOutputIndex}/${this.#inOutputType}`);
    this.#inOutputIndex = outputIndex;
    this.#inOutputType = outputType;
  }


  contentPartEnter(label: TEventType, outputIndex: number, contentIndex: number) {
    this.outputItemVisit(label, outputIndex, 'message');
    const previousIndex = contentIndex === 0 ? undefined : contentIndex - 1;
    if (this.#contentIndex !== previousIndex)
      console.warn(`[DEV] AIX: ${label} - content index mismatch: expected ${previousIndex}, got ${this.#contentIndex}`);
    this.#contentIndex = contentIndex;
    this.#contentAddSpacer = contentIndex > 0;
  }

  contentPartExit(label: TEventType, outputIndex: number, contentIndex: number) {
    this.outputItemVisit(label, outputIndex, 'message');
    if (this.#contentIndex !== contentIndex)
      console.warn(`[DEV] AIX: ${label} - content index mismatch: expected ${contentIndex}, got ${this.#contentIndex}`);
    this.#contentIndex = contentIndex;
  }

  contentPartVisit(label: TEventType, outputIndex: number, contentIndex: number) {
    this.outputItemVisit(label, outputIndex, 'message');
    if (this.#contentIndex !== contentIndex)
      console.warn(`[DEV] AIX: ${label} - content index mismatch: expected ${contentIndex}, got ${this.#contentIndex}`);
    this.#contentIndex = contentIndex;
  }

  contentPartInjectSpacer() {
    if (!this.#contentAddSpacer) return false;
    this.#contentAddSpacer = false;
    return true;
  }


  summaryPartEnter(label: TEventType, outputIndex: number, summaryIndex: number) {
    this.outputItemVisit(label, outputIndex, 'reasoning');
    const previousIndex = summaryIndex === 0 ? undefined : summaryIndex - 1;
    if (this.#summaryIndex !== previousIndex)
      console.warn(`[DEV] AIX: ${label} - summary index mismatch: expected ${previousIndex}, got ${this.#summaryIndex}`);
    this.#summaryIndex = summaryIndex;
    this.#summaryAddSpacer = summaryIndex > 0;
  }

  summaryPartExit(label: TEventType, outputIndex: number, summaryIndex: number) {
    this.outputItemVisit(label, outputIndex, 'reasoning');
    if (this.#summaryIndex !== summaryIndex)
      console.warn(`[DEV] AIX: ${label} - summary index mismatch: expected ${summaryIndex}, got ${this.#summaryIndex}`);
    this.#summaryIndex = summaryIndex;
  }

  summaryPartVisit(label: TEventType, outputIndex: number, summaryIndex: number) {
    this.outputItemVisit(label, outputIndex, 'reasoning');
    if (this.#summaryIndex !== summaryIndex)
      console.warn(`[DEV] AIX: ${label} - summary index mismatch: expected ${summaryIndex}, got ${this.#summaryIndex}`);
    this.#summaryIndex = summaryIndex;
  }

  summaryPartInjectSpacer() {
    if (!this.#summaryAddSpacer) return false;
    this.#summaryAddSpacer = false;
    return true;
  }

}


/**
 * OpenAI Responses API Streaming Parser
 */
export function createOpenAIResponsesEventParser(): ChatGenerateParseFunction {

  const R = new ResponseParserStateMachine();

  return function(pt: IParticleTransmitter, eventData: string) {

    // throws on malformed event data
    const chunkData = JSON.parse(eventData);

    const event = OpenAIWire_API_Responses.StreamingEvent_schema.parse(chunkData);
    const eventType = event?.type;

    // Validations
    R.validateSequenceNumber(event.sequence_number);
    R.validateExpectedEventType(eventType);

    // Debugging: show the sequence of events
    OPENAI_RESPONSES_DEBUG_EVENT_SEQUENCE && console.log(`response ${R.responseId}: ${eventType}`);

    switch (eventType) {

      // level 1. Lifecycle events

      // 1.1. First event, with the response substrate
      case 'response.created':

        /* This response has the following worth noting:
         * - .id = 'resp_12345'
         *
         * Values set by the API even if unset in the request:
         * - .model = 'model-real-name'
         * - .temperature = 1
         * - .top_p = 1
         * - .tool_choice = 'auto', .tools = []
         * - .truncation = 'disabled'
         *
         * Not useful, still set:
         * - .text = { format: { type: 'text' } }
         * - .usage = null
         * - .metadata = {}
         */
        R.setResponse(eventType, event.response);

        // -> Model
        pt.setModelName(event.response.model);

        // -> TODO: Generation Details:
        //    .created_at, .truncation, .temperature, .top_p, .tool_choice, tool count, text output type
        break;

      case 'response.in_progress':
        // NO CHANGES expected, since 'response.created'
        R.setResponse(eventType, event.response);
        break;

      case 'response.completed':
        // CHANGE of { status, output, usage } expected
        R.setResponse(eventType, event.response, ['status', 'output', 'usage']);

        // -> Status
        // TODO: set the terminating reason?

        // -> Output
        // TODO: verify that we correctly captured all the outputs?

        // -> Usage (incl. dtAll)
        if (event.response.usage) {
          const metrics = _fromResponseUsage(event.response.usage, R.parserCreationTimestamp, R.timeToFirstEvent);
          if (metrics)
            pt.updateMetrics(metrics);
        }
        break;

      case 'response.failed':
      case 'response.incomplete':
        // TODO: We haven't seen one of those events yet; we need to see what happens and parse it!
        console.warn(`[DEV] AIX: FIXME: we got a Response ${eventType}:`);
        R.setResponse(eventType, event.response);
        break;


      // level 2: Output Item events - in our implementation we let them set an index to compare against

      case 'response.output_item.added':
        // expected the beginning of a new output item
        // BLANK item expected, of type 'message', 'reasoning' or 'function_call'
        R.outputItemEnter(eventType, event.output_index, event.item.type);
        break;

      case 'response.output_item.done':
        R.outputItemExit(eventType, event.output_index, event.item.type);

        // FULL ITEM parse
        const doneItem = event.item;
        const doneItemType = doneItem.type;
        switch (doneItemType) {
          case 'message':
            // already parsed incrementally
            break;

          case 'reasoning':
            // already parsed incrementally
            break;

          case 'function_call':
            // -> FC: we parse function calls in full, for convenience
            const {
              // id: fcId,
              call_id: fcCallId,
              arguments: fcArguments,
              name: fcName,
            } = doneItem;
            pt.startFunctionCallInvocation(fcCallId, fcName, 'incr_str', fcArguments);
            break;

          case 'web_search_call':
            // -> WSC: TODO
            console.warn('[DEV] notImplemented: OpenAI Responses: web_search_call', { doneItem });
            break;

          default:
            const _exhaustiveCheck: never = doneItemType;
            break;
        }

        // signal the end of the item
        pt.endMessagePart();
        break;


      // level 3: Output Items have multiple Parts

      // 3.1. Message Items: 'output_text' and 'output_refusal' parts

      case 'response.content_part.added':
        R.contentPartEnter(eventType, event.output_index, event.content_index);
        R.expectEvents(['response.output_text.delta', 'response.output_text.done', 'response.output_text_annotation.added', 'response.output_text.annotation.added', 'response.content_part.done']);
        // nothing else to do, the part is likely empty, and we will incrementally parse it
        break;

      case 'response.content_part.done':
        R.contentPartExit(eventType, event.output_index, event.content_index);
        R.expectEvents(undefined);
        pt.endMessagePart();
        break;

      // 3.2. Summary Items: 'summary_text' parts

      case 'response.reasoning_summary_part.added':
        R.summaryPartEnter(eventType, event.output_index, event.summary_index);
        R.expectEvents(['response.reasoning_summary_text.delta', 'response.reasoning_summary_text.done', 'response.reasoning_summary_part.done']);
        // nothing else to do, the part is likely empty, and we will incrementally parse it
        break;

      case 'response.reasoning_summary_part.done':
        R.summaryPartExit(eventType, event.output_index, event.summary_index);
        R.expectEvents(undefined);
        // nothing to do here, as we parsed the content incrementally already
        break;


      // level 4: Content Part sub-events (shall ensure this is within their added-done, to avoid out of sequence)

      // 4.1 - Content Items

      case 'response.output_text.delta':
        R.contentPartVisit(eventType, event.output_index, event.content_index);
        // .delta: -> append the text content
        pt.appendText(R.contentPartInjectSpacer() ? OPENAI_RESPONSES_SAME_PART_SPACER + event.delta : event.delta);
        break;

      case 'response.output_text.done':
        R.contentPartVisit(eventType, event.output_index, event.content_index);
        // .text: ignore finalized content, we already transmitted all partials
        break;

      case 'response.output_refusal.delta':
      case 'response.output_refusal.done':
        R.contentPartVisit(eventType, event.output_index, event.content_index);
        // .delta: ignore refusal string piece for now
        // .refusal: ignore finalized refusal, we already transmitted all partials
        // FIXME: implement this, if it shows up
        console.log(`[DEV] AIX: OpenAI Responses: ignoring output_refusal event: ${eventType}`, event);
        break;

      // 4.2 - Reasoning Items

      case 'response.reasoning_summary_text.delta':
        R.summaryPartVisit(eventType, event.output_index, event.summary_index);
        // .delta: -> append the reasoning content
        pt.appendReasoningText(R.summaryPartInjectSpacer() ? OPENAI_RESPONSES_SAME_PART_SPACER + event.delta : event.delta);
        break;

      case 'response.reasoning_summary_text.done':
        R.summaryPartVisit(eventType, event.output_index, event.summary_index);
        // .text: ignore finalized content, we already transmitted all partials
        break;

      // case 'response.reasoning.delta':
      //   break;
      // case 'response.reasoning.done':
      //   break;
      // case 'response.reasoning_summary.delta':
      //   break;
      // case 'response.reasoning_summary.done':
      //   break;

      // 4.3 - Function Calls

      case 'response.function_call_arguments.delta':
      case 'response.function_call_arguments.done':
        R.outputItemVisit(eventType, event.output_index, 'function_call');
        // .delta: we parse this at the end
        // .done: we parse this at the end
        break;

      // 1.5 - Error

      case 'error':
        // there are complexities related to parsing this type: the docs suggest a flat structure, but we see nested objects
        // see the explanation on OpenAIWire_API_Responses.ErrorEvent_schema

        const errorCode = safeErrorString(event.error?.type || event.error?.code || event.code) ?? undefined;
        const errorMessage = safeErrorString(event.error?.message || event?.message) ?? undefined;
        const errorParam = safeErrorString(event.error?.param || event?.param) ?? undefined;

        // Transmit the error as text - note: throw if you want to transmit as 'error'
        pt.setDialectTerminatingIssue(`${errorCode || 'Error'}: ${errorMessage || 'unknown.'}${errorParam ? ` (param: ${errorParam})` : ''}`, IssueSymbols.Generic);
        break;

      default:
        // const _exhaustiveCheck: never = eventType;
        // FIXME: if we're here, we prob needed to implement the part
        console.warn('[DEV] AIX: OpenAI Responses: unexpected event type:', eventType);
        break;

    }
  };
}


/**
 * OpenAI Responses API Non-Streaming Parser
 */
export function createOpenAIResponseParserNS(): ChatGenerateParseFunction {

  const parserCreationTimestamp = Date.now();

  return function(pt: IParticleTransmitter, eventData: string) {

    // Throws on malformed event data
    const responseData = JSON.parse(eventData);

    // .error: transmits upstream errors pre-parsing (object wouldn't be valid)
    if (_forwardResponseError(responseData, pt))
      return;

    // [OpenAI] possibly log the warnings to get more insights on the API
    if (responseData.warning)
      console.log('AIX: OpenAI-Response-NS warning:', responseData.warning);

    // full response parsing
    const response = OpenAIWire_API_Responses.Response_schema.parse(responseData);

    // -> Model
    if (response.model)
      pt.setModelName(response.model);

    // -> Usage
    if (response.usage) {
      const metrics = _fromResponseUsage(response.usage, parserCreationTimestamp, undefined);
      if (metrics)
        pt.updateMetrics(metrics);
    }

    // -> Status

    // say it's okay for now
    pt.setTokenStopReason('ok');

    switch (response.status) {
      case 'completed':
        // expected: the response is complete
        break;

      case 'incomplete':
        // pedantic check (.incomplete_details)
        if (response.incomplete_details && typeof response.incomplete_details === 'object') {

          // append the incomplete details as text
          pt.appendText(`**Incomplete response**: the response was incomplete because ${response.incomplete_details?.reason || 'unknown reason'}\n`);
          console.warn('[DEV] AIX: OpenAI-Response-NS response incomplete:', { incomplete_details: response.incomplete_details });

        } else {
          // unexpected: we don't expect to receive lifecycle-partial responses in the non-streaming mode
          console.warn('[DEV] AIX: OpenAI-Response-NS unexpected incomplete response details:', { response });
          // not sure what to parse if we get here?
        }
        break;

      case 'cancelled':
      case 'in_progress':
      case 'queued':
        // unexpected: we don't expect to receive lifecycle-partial responses in the non-streaming mode
        console.warn('[DEV] AIX: OpenAI-Response-NS unexpected response status:', { response });
        // not sure what to parse if we get here?
        break;

      case 'failed':
        // TODO: check the full response for the error
        console.log('[DEV] AIX: OpenAI-Response-NS response failed:', { response });
        break;

      default:
        const _exhaustiveCheck: never = response.status;
        console.warn('[DEV] AIX: OpenAI-Response-NS unexpected response status:', { status: response.status });
        break;
    }

    // -> Output[]
    for (const oItem of response.output) {

      // NOTE: we ignore the status field, as it's partial (only in message, not reasoning)
      //       and wrong (in 'message' items it still shows as 'in_progress' despite being
      //       done in the response)
      // pedantic check on status
      // switch (oItem.status) {
      //   case 'completed':
      //     break;
      //
      //   case 'in_progress':
      //   case 'incomplete':
      //     console.warn('[DEV] AIX: OpenAI-Response-NS unexpected output item status:', oItem.status);
      //     break;
      //
      //   default:
      //     console.warn('[DEV] AIX: OpenAI-Response-NS unexpected output item status:', oItem.status);
      //     break;
      // }

      const oItemType = oItem.type;
      switch (oItemType) {

        // Reasoning contains all the reasoning summaries (if present)
        case 'reasoning':
          const {
            // id: reasoningId,
            summary: reasoningSummary,
            // encrypted_content: reasoningEC,
          } = oItem;

          // pedantic check
          if (!Array.isArray(reasoningSummary)) {
            console.warn('[DEV] AIX: OpenAI-Response-NS unexpected reasoning summary type:', { reasoningSummary });
            break;
          }

          // TODO: implement once we know how this looks like
          for (const item of reasoningSummary) {
            if (!item.text) {
              console.warn('[DEV] AIX: OpenAI-Response-NS unexpected reasoning summary item:', { item });
              continue;
            }
            pt.appendReasoningText(item.text);
          }
          break;

        // Message contains the main 'assistant' response
        case 'message':
          const {
            // id: messageId,
            content: messageContent,
            // role: messageRole,
          } = oItem;

          // pedantic check
          if (!Array.isArray(messageContent)) {
            console.warn('[DEV] AIX: OpenAI-Response-NS unexpected message content type:', { messageContent });
            break;
          }

          // Message
          for (const content of messageContent) {
            const contentType = content.type;
            switch (contentType) {
              case 'output_text':
                pt.appendText(content.text || '');
                break;

              case 'refusal':
                // show in DEV as we don't know how this looks like
                console.log('[DEV] AIX: OpenAI-Response-NS refusal content:', { refusal: content });
                break;

              default:
                const _exhaustiveCheck: never = contentType;
                console.warn('[DEV] AIX: OpenAI-Response-NS unexpected message content type:', contentType);
                break;
            }
          }

          break;

        case 'function_call':
          const {
            id: fcId,
            call_id: fcCallId,
            arguments: fcArguments,
            name: fcName,
          } = oItem;

          // pedantic check (fcId = fcCallId)
          if (fcId !== fcCallId) {
            console.warn('[DEV] AIX: OpenAI-Response-NS unexpected function call ID mismatch:', { fcId, fcCallId });
            break;
          }

          pt.startFunctionCallInvocation(fcCallId, fcName, 'incr_str', fcArguments);
          pt.endMessagePart();
          break;

        case 'web_search_call':
          // -> WSC: TODO
          console.warn('[DEV] notImplemented: OpenAI Responses: web_search_call', { oItem });
          break;

        default:
          const _exhaustiveCheck: never = oItemType;
          console.warn('[DEV] AIX: OpenAI-Response-NS unexpected output item type:', oItemType);
          break;
      }

    } // .output[]

    // -> Status
    // .status: check for the status
    // if (response.status !== 'completed')
    //   console.warn('[DEV] AIX: OpenAI-Response-NS unexpected response status:', { status: response.status });

  };
}


function _fromResponseUsage(usage: OpenAIWire_API_Responses.Response['usage'], parserCreationTimestamp: number, timeToFirstEvent: number | undefined) {

  // -> Stats only in some packages
  if (!usage)
    return undefined;

  // Require at least the completion tokens, or issue a DEV warning otherwise
  if (usage.output_tokens === undefined) {
    // Warn, so we may adjust this usage parsing for Non-OpenAI APIs
    console.log('[DEV] AIX: OpenAI Responses missing completion tokens in usage', { usage });
    return undefined;
  }

  // Create the metrics update object
  const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
    TIn: usage.input_tokens ?? undefined,
    TOut: usage.output_tokens,
    // dtInner: openAI is not reporting the time as seen by the servers
    dtAll: Date.now() - parserCreationTimestamp,
  };

  // Input Metrics

  // Input redistribution: Cache Read
  if (usage.input_tokens_details) {
    const TCacheRead = usage.input_tokens_details.cached_tokens;
    if (TCacheRead !== undefined && TCacheRead > 0) {
      metricsUpdate.TCacheRead = TCacheRead;
      if (metricsUpdate.TIn !== undefined)
        metricsUpdate.TIn -= TCacheRead;
    }
  }

  // TODO Input redistribution: Audio tokens

  // Output Metrics

  // Output breakdown: Reasoning
  if (usage.output_tokens_details) {
    const details = usage.output_tokens_details || {};
    if (details.reasoning_tokens !== undefined)
      metricsUpdate.TOutR = usage.output_tokens_details.reasoning_tokens;
  }

  // TODO: Output breakdown: Audio

  // Time Metrics

  if (timeToFirstEvent !== undefined)
    metricsUpdate.dtStart = timeToFirstEvent;

  return metricsUpdate;
}

/**
 * If there's an error in the pre-decoded message, push it down to the particle transmitter.
 */
function _forwardResponseError(parsedData: any, pt: IParticleTransmitter) {

  // operate on .error
  if (!parsedData || !parsedData.error) return false;
  const { error } = parsedData;

  // require .message/.code to consider this a valid error object
  if (!(typeof error === 'object') || !('message' in error) || !('code' in error)) {
    console.log('[DEV] AIX: OpenAI-Responses-dispatch ignored error:', { error });
    return false;
  }

  // Transmit the error as text - note: throw if you want to transmit as 'error'
  pt.setDialectTerminatingIssue(safeErrorString(error) || 'unknown.', IssueSymbols.Generic);
  return true;
}


// Support functions

/**
 * Generic function to compare two objects and return their differences.
 * Uses JSON.stringify for deep comparison of top-level properties.
 */
function _warnIfObjectPropertiesDiffer(
  a: object,
  b: object,
  excludeFields: string[] = [],
): null | Record<string, { a: any, b: any }> {

  // Get all keys from both objects
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  const allKeys = new Set([...aKeys, ...bKeys]);

  // Remove excluded fields
  const fieldsToCompare = Array.from(allKeys).filter(key => !excludeFields.includes(key));

  // Compare each property using JSON.stringify for deep comparison
  const diff: Record<string, { a: any, b: any }> = {};

  for (const key of fieldsToCompare) {
    const aValue = (a as any)[key];
    const bValue = (b as any)[key];

    // Deep compare using JSON.stringify
    const aStr = JSON.stringify(aValue);
    const bStr = JSON.stringify(bValue);

    if (aStr !== bStr) {
      diff[key] = { a: aValue, b: bValue };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}
