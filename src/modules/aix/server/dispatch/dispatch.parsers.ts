import { z } from 'zod';

import { safeErrorString } from '~/server/wire';

import { anthropicWire_ContentBlockDeltaEvent_Schema, anthropicWire_ContentBlockStartEvent_Schema, anthropicWire_ContentBlockStopEvent_Schema, anthropicWire_MessageDeltaEvent_Schema, AnthropicWire_MessageResponse, anthropicWire_MessageStartEvent_Schema, anthropicWire_MessageStopEvent_Schema } from './anthropic/anthropic.wiretypes';
import { geminiGeneratedContentResponseSchema, geminiHarmProbabilitySortFunction, GeminiSafetyRatings } from './gemini/gemini.wiretypes';
import { openaiWire_ChatCompletionChunkResponse_Schema } from './openai/oai.wiretypes';
import { wireOllamaChunkedOutputSchema } from './ollama/ollama.wiretypes';


// configuration
const ISSUE_SYMBOL = '❌';
const ISSUE_SYMBOL_PROMPT_BLOCKED = '🚫';
const ISSUE_SYMBOL_RECITATION = '🦜';
const TEXT_SYMBOL_MAX_TOKENS = '🧱';


type DispatchParsedEvent = {
  op: 'text',
  text: string;
} | {
  op: 'issue';
  issue: string;
  symbol: string;
} | {
  op: 'parser-close';
} | {
  op: 'set';
  value: {
    model?: string;
    stats?: {
      chatInTokens?: number; // -1: unknown
      chatOutTokens: number;
      chatOutRate?: number;
    }
  };
};

export type DispatchParser = (eventData: string, eventName?: string) => Generator<DispatchParsedEvent>;


/// Stream Parsers

export function createDispatchParserAnthropicMessages(): DispatchParser {
  let responseMessage: AnthropicWire_MessageResponse;
  let hasErrored = false;
  let messageStartTime: number | undefined = undefined;
  let chatInTokens: number | undefined = undefined;

  // Note: at this stage, the parser only returns the text content as text, which is streamed as text
  //       to the client. It is however building in parallel the responseMessage object, which is not
  //       yet used, but contains token counts, for instance.
  return function* (eventData: string, eventName?: string): Generator<DispatchParsedEvent> {

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
        responseMessage = anthropicWire_MessageStartEvent_Schema.parse(JSON.parse(eventData)).message;

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
          const { index, content_block } = anthropicWire_ContentBlockStartEvent_Schema.parse(JSON.parse(eventData));
          if (responseMessage.content[index] === undefined)
            responseMessage.content[index] = content_block;

          switch (responseMessage.content[index].type) {
            case 'text':
              yield { op: 'text', text: responseMessage.content[index].text };
              break;
            case 'tool_use':
              yield { op: 'text', text: `TODO: [Tool Use] ${responseMessage.content[index].name} ${responseMessage.content[index].input}` };
              break;
          }
        } else
          throw new Error('Unexpected content block start');
        break;

      // M3+. Append delta text to the current message content
      case 'content_block_delta':
        if (responseMessage) {
          const { index, delta } = anthropicWire_ContentBlockDeltaEvent_Schema.parse(JSON.parse(eventData));
          if (responseMessage.content[index] === undefined)
            throw new Error(`Unexpected content block delta location (${index})`);

          // text delta
          if (delta.type === 'text_delta' && responseMessage.content[index].type === 'text') {
            responseMessage.content[index].text += delta.text;
            yield { op: 'text', text: delta.text };
          } else
            throw new Error(`Unexpected content block delta ${delta.type} for content block ${responseMessage.content[index].type}`);
        } else
          throw new Error('Unexpected content block delta');
        break;

      // Finalize content block if needed.
      case 'content_block_stop':
        if (responseMessage) {
          const { index } = anthropicWire_ContentBlockStopEvent_Schema.parse(JSON.parse(eventData));
          if (responseMessage.content[index] === undefined)
            throw new Error(`Unexpected content block end location (${index})`);
        } else
          throw new Error('Unexpected content block stop');
        break;

      // Optionally handle top-level message changes. Example: updating stop_reason
      case 'message_delta':
        if (responseMessage) {
          const { delta, usage } = anthropicWire_MessageDeltaEvent_Schema.parse(JSON.parse(eventData));
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
                },
              },
            };
          }
        } else
          throw new Error('Unexpected message delta');
        break;

      // We can now close the message
      case 'message_stop':
        anthropicWire_MessageStopEvent_Schema.parse(JSON.parse(eventData));
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


function explainGeminiSafetyIssues(safetyRatings?: GeminiSafetyRatings): string {
  if (!safetyRatings || !safetyRatings.length)
    return 'no safety ratings provided';
  safetyRatings = (safetyRatings || []).sort(geminiHarmProbabilitySortFunction);
  // only for non-neglegible probabilities
  return safetyRatings
    .filter(rating => rating.probability !== 'NEGLIGIBLE')
    .map(rating => `${rating.category/*.replace('HARM_CATEGORY_', '')*/} (${rating.probability?.toLowerCase()})`)
    .join(', ');
}

export function createDispatchParserGemini(modelName: string): DispatchParser {
  let hasBegun = false;

  // this can throw, it's caught by the caller
  return function* (eventData): Generator<DispatchParsedEvent> {

    // parse the JSON chunk
    const wireGenerationChunk = JSON.parse(eventData);
    let generationChunk: z.infer<typeof geminiGeneratedContentResponseSchema>;
    try {
      generationChunk = geminiGeneratedContentResponseSchema.parse(wireGenerationChunk);
    } catch (error: any) {
      // log the malformed data to the console, and rethrow to transmit as 'error'
      console.log(`/api/llms/stream: Gemini parsing issue: ${error?.message || error}`, wireGenerationChunk);
      throw error;
    }

    // -> Prompt Safety Blocking
    if (generationChunk.promptFeedback?.blockReason) {
      const { blockReason, safetyRatings } = generationChunk.promptFeedback;
      yield { op: 'issue', issue: `Input not allowed: ${blockReason}: ${explainGeminiSafetyIssues(safetyRatings)}`, symbol: ISSUE_SYMBOL_PROMPT_BLOCKED };
      return yield { op: 'parser-close' };
    }

    // expect: single completion
    const singleCandidate = generationChunk.candidates?.[0] ?? null;
    if (!singleCandidate)
      throw new Error(`expected 1 completion, got ${generationChunk.candidates?.length}`);

    // no contents: could be an expected or unexpected condition
    if (!singleCandidate.content) {
      switch (singleCandidate.finishReason) {
        case 'MAX_TOKENS':
          // NOTE: this will show up in the chat as a message as a brick wall
          // and without the " [Gemini Issue]: Interrupted.." prefix, as it's written in the history
          // This can be changed in the future?
          yield { op: 'text', text: ` ${TEXT_SYMBOL_MAX_TOKENS}` /* Interrupted: MAX_TOKENS reached */ };
          return yield { op: 'parser-close' };
        case 'RECITATION':
          yield { op: 'issue', issue: `Generation stopped due to 'RECITATION'`, symbol: ISSUE_SYMBOL_RECITATION };
          return yield { op: 'parser-close' };
        case 'SAFETY':
          yield { op: 'issue', issue: `Interrupted due to 'SAFETY' filtering: ${explainGeminiSafetyIssues(singleCandidate.safetyRatings)}`, symbol: ISSUE_SYMBOL };
          return yield { op: 'parser-close' };
        default:
          throw new Error(`server response missing content (finishReason: ${singleCandidate?.finishReason})`);
      }
    }

    // expect: single part
    if (singleCandidate.content.parts?.length !== 1 || !('text' in singleCandidate.content.parts[0]))
      throw new Error(`expected 1 text part, got ${singleCandidate.content.parts?.length}`);

    // -> Model
    if (!hasBegun && modelName) {
      hasBegun = true;
      yield { op: 'set', value: { model: modelName } };
    }

    // -> Text
    let text = singleCandidate.content.parts[0].text || '';
    yield { op: 'text', text };

    // -> Stats
    if (generationChunk.usageMetadata) {
      // TODO: we should only return this on the last packet, once we have the full stats
      // yield { op: 'set', value: { stats: { chatInTokens: generationChunk.usageMetadata.promptTokenCount ?? -1, chatOutTokens: generationChunk.usageMetadata.candidatesTokenCount ?? -1 } } };
    }
  };
}


export function createDispatchParserOllama(): DispatchParser {
  let hasBegun = false;

  return function* (eventData: string): Generator<DispatchParsedEvent> {

    // parse the JSON chunk
    let wireJsonChunk: any;
    try {
      wireJsonChunk = JSON.parse(eventData);
    } catch (error: any) {
      // log the malformed data to the console, and rethrow to transmit as 'error'
      console.log(`/api/llms/stream: Ollama parsing issue: ${error?.message || error}`, eventData);
      throw error;
    }

    // validate chunk
    const chunk = wireOllamaChunkedOutputSchema.parse(wireJsonChunk);

    // pass through errors from Ollama
    if ('error' in chunk) {
      yield { op: 'issue', issue: `Error: ${chunk.error}`, symbol: ISSUE_SYMBOL };
      return yield { op: 'parser-close' };
    }

    // -> Model
    if (!hasBegun && chunk.model) {
      hasBegun = true;
      yield { op: 'set', value: { model: chunk.model } };
    }

    // -> Text
    let text = chunk.message?.content || /*chunk.response ||*/ '';
    yield { op: 'text', text };

    if (chunk.eval_count && chunk.eval_duration) {
      const chatOutTokens = chunk.eval_count;
      const chatOutTime = chunk.eval_duration / 1E+09;
      const chatOutRate = Math.round(100 * (chatOutTime > 0 ? chatOutTokens / chatOutTime : 0)) / 100;
      yield { op: 'set', value: { stats: { chatInTokens: chunk.prompt_eval_count || -1, chatOutTokens, chatOutRate } } };
    }

    if (chunk.done)
      yield { op: 'parser-close' };
  };
}


export function createDispatchParserOpenAI(): DispatchParser {
  let hasBegun = false;
  let hasWarned = false;
  // NOTE: could compute rate (tok/s) from the first textful event to the last (to ignore the prefill time)

  return function* (eventData: string): Generator<DispatchParsedEvent> {

    // Throws on malformed event data
    const json = openaiWire_ChatCompletionChunkResponse_Schema.parse(JSON.parse(eventData));

    // -> Model
    if (!hasBegun && json.model) {
      hasBegun = true;
      yield { op: 'set', value: { model: json.model } };
    }

    // [OpenAI] an upstream error will be handled gracefully and transmitted as text (throw to transmit as 'error')
    if (json.error) {
      yield { op: 'issue', issue: safeErrorString(json.error) || 'unknown.', symbol: ISSUE_SYMBOL };
      return yield { op: 'parser-close' };
    }

    // [OpenAI] if there's a warning, log it once
    if (json.warning && !hasWarned) {
      hasWarned = true;
      console.log('/api/llms/stream: OpenAI dispatch warning:', json.warning);
    }

    // -> Stats
    if (json.usage && json.usage.completion_tokens)
      yield { op: 'set', value: { stats: { chatInTokens: json.usage.prompt_tokens || -1, chatOutTokens: json.usage.completion_tokens } } };

    // expect: 1 completion, or stop
    if (json.choices.length !== 1) {

      // Usage objects will likely have an empty completion
      if (json.usage)
        return;

      // [Azure] we seem to get 'prompt_annotations' or 'prompt_filter_results' objects - which we will ignore to suppress the error
      if (json.id === '' && json.object === '' && json.model === '')
        return;

      throw new Error(`expected 1 completion, got ${json.choices.length}`);
    }

    // expect: index=0 (n: 1)
    const index = json.choices[0].index;
    if (index !== 0)
      throw new Error(`expected completion index 0, got ${index}`);

    // -> Text
    const text = json.choices[0].delta?.content /*|| json.choices[0]?.text*/ || '';
    if (text?.length)
      yield { op: 'text', text };

    // Note: not needed anymore - Workaround for implementations that don't send the [DONE] event
    // use the finish_reason to close the parser
    // if (json.choices[0].finish_reason)
    //   return yield { op: 'parser-close' };
  };
}
