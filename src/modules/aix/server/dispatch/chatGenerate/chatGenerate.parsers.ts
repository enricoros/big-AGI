import { safeErrorString } from '~/server/wire';

import { AnthropicWire_API_Message_Create } from '../wiretypes/anthropic.wiretypes';
import { GeminiWire_API_Generate_Content, GeminiWire_Safety } from '../wiretypes/gemini.wiretypes';
import { OpenAIWire_API_Chat_Completions } from '../wiretypes/openai.wiretypes';
import { wireOllamaChunkedOutputSchema } from '../wiretypes/ollama.wiretypes';

import type { ChatGenerateMessageAction, ChatGenerateParseFunction } from './chatGenerate.types';
import { ISSUE_SYMBOL, ISSUE_SYMBOL_PROMPT_BLOCKED, ISSUE_SYMBOL_RECITATION, TEXT_SYMBOL_MAX_TOKENS } from './chatGenerate.config';


/// Stream Parsers

export function createAnthropicMessageParser(): ChatGenerateParseFunction {
  let responseMessage: AnthropicWire_API_Message_Create.Response;
  let hasErrored = false;
  let messageStartTime: number | undefined = undefined;
  let chatInTokens: number | undefined = undefined;

  // Note: at this stage, the parser only returns the text content as text, which is streamed as text
  //       to the client. It is however building in parallel the responseMessage object, which is not
  //       yet used, but contains token counts, for instance.
  return function* (eventData: string, eventName?: string): Generator<ChatGenerateMessageAction> {

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
        responseMessage = AnthropicWire_API_Message_Create.event_MessageStart_schema.parse(JSON.parse(eventData)).message;

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
          const { index, content_block } = AnthropicWire_API_Message_Create.event_ContentBlockStart_schema.parse(JSON.parse(eventData));
          if (responseMessage.content[index] !== undefined)
            throw new Error(`Unexpected content block start location (${index})`);
          responseMessage.content[index] = content_block;

          switch (content_block.type) {
            case 'text':
              yield { op: 'text', text: content_block.text };
              break;
            case 'tool_use':
              yield { op: 'text', text: `TODO: [Tool Use] ${content_block.id} ${content_block.name} ${content_block.input}` };
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
                yield { op: 'text', text: delta.text };
              }
              break;

            case 'input_json_delta':
              if (responseMessage.content[index].type === 'tool_use') {
                responseMessage.content[index].input += delta.partial_json;
                yield { op: 'text', text: `[${delta.partial_json}]` };
              }
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
        } else
          throw new Error('Unexpected content_block_stop');
        break;

      // Optionally handle top-level message changes. Example: updating stop_reason
      case 'message_delta':
        if (responseMessage) {
          const { delta, usage } = AnthropicWire_API_Message_Create.event_MessageDelta_schema.parse(JSON.parse(eventData));
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
                  timeInner: elapsedTimeSeconds,
                },
              },
            };
          }
        } else
          throw new Error('Unexpected message_delta');
        break;

      // We can now close the message
      case 'message_stop':
        AnthropicWire_API_Message_Create.event_MessageStop_schema.parse(JSON.parse(eventData));
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


export function createAnthropicMessageParserNS(): ChatGenerateParseFunction {
  let messageStartTime: number = Date.now();

  return function* (fullData: string): Generator<ChatGenerateMessageAction> {

    // parse with validation (e.g. type: 'message' && role: 'assistant')
    const {
      model,
      content,
      stop_reason,
      usage,
    } = AnthropicWire_API_Message_Create.Response_schema.parse(JSON.parse(fullData));

    // -> Model
    if (model)
      yield { op: 'set', value: { model } };

    // -> Content Blocks
    for (let i = 0; i < content.length; i++) {
      const contentBlock = content[i];
      const isLastBlock = i === content.length - 1;
      switch (contentBlock.type) {
        case 'text':
          const hitMaxTokens = (isLastBlock && stop_reason === 'max_tokens') ? ` ${TEXT_SYMBOL_MAX_TOKENS}` : '';
          yield { op: 'text', text: contentBlock.text + hitMaxTokens };
          break;
        case 'tool_use':
          yield { op: 'text', text: `TODO: [Tool Use] ${contentBlock.id} ${contentBlock.name} ${JSON.stringify(contentBlock.input)}` };
          break;
        default:
          throw new Error(`Unexpected content block type: ${(contentBlock as any).type}`);
      }
    }

    // -> Stats
    if (usage) {
      const elapsedTimeSeconds = (Date.now() - messageStartTime) / 1000;
      const chatOutRate = elapsedTimeSeconds > 0 ? usage.output_tokens / elapsedTimeSeconds : 0;
      yield {
        op: 'set', value: {
          stats: {
            chatInTokens: usage.input_tokens,
            chatOutTokens: usage.output_tokens,
            chatOutRate: Math.round(chatOutRate * 100) / 100, // Round to 2 decimal places
            timeInner: elapsedTimeSeconds,
          },
        },
      };
    }
  };
}


// Utility function for sorting harm probabilities
export function geminiHarmProbabilitySortFunction(a: { probability: string }, b: { probability: string }) {
  const order = ['NEGLIGIBLE', 'LOW', 'MEDIUM', 'HIGH'];
  return order.indexOf(b.probability) - order.indexOf(a.probability);
}

function explainGeminiSafetyIssues(safetyRatings?: GeminiWire_Safety.SafetyRating[]): string {
  if (!safetyRatings || !safetyRatings.length)
    return 'no safety ratings provided';
  safetyRatings = (safetyRatings || []).sort(geminiHarmProbabilitySortFunction);
  // only for non-neglegible probabilities
  return safetyRatings
    .filter(rating => rating.probability !== 'NEGLIGIBLE')
    .map(rating => `${rating.category/*.replace('HARM_CATEGORY_', '')*/} (${rating.probability?.toLowerCase()})`)
    .join(', ');
}

export function createGeminiGenerateContentParser(modelId: string): ChatGenerateParseFunction {
  const modelName = modelId.replace('models/', '');
  let hasBegun = false;

  // this can throw, it's caught by the caller
  return function* (eventData): Generator<ChatGenerateMessageAction> {

    // -> Model
    if (!hasBegun) {
      hasBegun = true;
      yield { op: 'set', value: { model: modelName } };
    }

    // Throws on malformed event data
    const generationChunk = GeminiWire_API_Generate_Content.Response_schema.parse(JSON.parse(eventData));

    // remove wireGenerationChunk.candidates[number].safetyRatings
    (generationChunk as GeminiWire_API_Generate_Content.Response).candidates?.forEach(candidate => {
      delete candidate.safetyRatings;
      // delete candidate.citationMetadata;
    });
    console.log('\n' + JSON.stringify(generationChunk.candidates, null, 2));

    // -> Prompt Safety Blocking
    if (generationChunk.promptFeedback?.blockReason) {
      const { blockReason, safetyRatings } = generationChunk.promptFeedback;
      yield { op: 'issue', issue: `Input not allowed: ${blockReason}: ${explainGeminiSafetyIssues(safetyRatings)}`, symbol: ISSUE_SYMBOL_PROMPT_BLOCKED };
      return yield { op: 'parser-close' };
    }

    // expect: single completion
    if (generationChunk.candidates?.length !== 1)
      throw new Error(`expected 1 completion, got ${generationChunk.candidates?.length}`);
    const candidate0 = generationChunk.candidates[0];
    if (candidate0.index !== 0)
      throw new Error(`expected completion index 0, got ${candidate0.index}`);

    // handle missing content
    if (!candidate0.content) {
      switch (candidate0.finishReason) {

        case 'MAX_TOKENS':
          // NOTE: this will show up in the chat as a message as a brick wall
          // and without the " [Gemini Issue]: Interrupted.." prefix, as it's written in the history
          // This can be changed in the future?
          yield { op: 'text', text: ` ${TEXT_SYMBOL_MAX_TOKENS}` /* Interrupted: MAX_TOKENS reached */ };
          return yield { op: 'parser-close' };

        case 'RECITATION':
          yield { op: 'issue', issue: `Generation stopped due to RECITATION`, symbol: ISSUE_SYMBOL_RECITATION };
          return yield { op: 'parser-close' };

        case 'SAFETY':
          yield { op: 'issue', issue: `Generation stopped due to SAFETY: ${explainGeminiSafetyIssues(candidate0.safetyRatings)}`, symbol: ISSUE_SYMBOL };
          return yield { op: 'parser-close' };

        default:
          throw new Error(`server response missing content (finishReason: ${candidate0?.finishReason})`);

      }
    }

    // expect a single part
    if (candidate0.content.parts?.length !== 1)
      throw new Error(`expected 1 content part, got ${candidate0.content.parts?.length}`);

    for (const mPart of candidate0.content.parts) {
      switch (true) {

        // <- TextPart
        case 'text' in mPart:
          yield { op: 'text', text: mPart.text || '' };
          break;

        // <- FunctionCallPart
        case 'functionCall' in mPart:
          yield { op: 'text', text: `TODO: [Function Call] ${mPart.functionCall.name} ${JSON.stringify(mPart.functionCall.args)}` };
          break;

        // <- ExecutableCodePart
        case 'executableCode' in mPart:
          yield { op: 'text', text: `TODO: [Executable Code] ${mPart.executableCode}` };
          break;

        // <- CodeExecutionResultPart
        case 'codeExecutionResult' in mPart:
          yield { op: 'text', text: `TODO: [Code Execution Result] ${mPart.codeExecutionResult}` };
          break;

        default:
          throw new Error(`unexpected content part: ${JSON.stringify(mPart)}`);
      }
    }

    // -> Stats
    // if (generationChunk.usageMetadata) {
    //   // TODO: we should only return this on the last packet, once we have the full stats
    //   yield {
    //     op: 'set', value: {
    //       stats: {
    //         chatInTokens: generationChunk.usageMetadata.promptTokenCount ?? -1,
    //         chatOutTokens: generationChunk.usageMetadata.candidatesTokenCount ?? -1,
    //       },
    //     },
    //   };
    // }

  };
}


export function createOllamaParser(): ChatGenerateParseFunction {
  let hasBegun = false;

  return function* (eventData: string): Generator<ChatGenerateMessageAction> {

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


export function createOpenAIMessageCreateParser(): ChatGenerateParseFunction {
  let hasBegun = false;
  let hasWarned = false;
  // NOTE: could compute rate (tok/s) from the first textful event to the last (to ignore the prefill time)

  return function* (eventData: string): Generator<ChatGenerateMessageAction> {

    // Throws on malformed event data
    const json = OpenAIWire_API_Chat_Completions.ChunkResponse_schema.parse(JSON.parse(eventData));

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
    if (index !== 0 && index !== undefined /* [OpenRouter->Gemini] */)
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
