import type { ChatGenerateMessageAction, ChatGenerateParseFunction } from './parsers.types';
import { GeminiWire_API_Generate_Content, GeminiWire_Safety } from '../../wiretypes/gemini.wiretypes';
import { ISSUE_SYMBOL, ISSUE_SYMBOL_PROMPT_BLOCKED, ISSUE_SYMBOL_RECITATION, TEXT_SYMBOL_MAX_TOKENS } from '../chatGenerate.config';


export function createGeminiGenerateContentResponseParser(modelId: string): ChatGenerateParseFunction {
  const modelName = modelId.replace('models/', '');
  let hasBegun = false;

  // this can throw, it's caught by the caller
  return function* (eventData): Generator<ChatGenerateMessageAction> {

    // Throws on malformed event data
    const generationChunk = GeminiWire_API_Generate_Content.Response_schema.parse(JSON.parse(eventData));

    // -> Model
    if (!hasBegun) {
      hasBegun = true;
      yield { op: 'set', value: { model: modelName } };
    }

    // -> Prompt Safety Blocking
    if (generationChunk.promptFeedback?.blockReason) {
      const { blockReason, safetyRatings } = generationChunk.promptFeedback;
      yield { op: 'issue', issue: `Input not allowed: ${blockReason}: ${_explainGeminiSafetyIssues(safetyRatings)}`, symbol: ISSUE_SYMBOL_PROMPT_BLOCKED };
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
          yield { op: 'issue', issue: `Generation stopped due to SAFETY: ${_explainGeminiSafetyIssues(candidate0.safetyRatings)}`, symbol: ISSUE_SYMBOL };
          return yield { op: 'parser-close' };

        default:
          throw new Error(`server response missing content (finishReason: ${candidate0?.finishReason})`);

      }
    }

    // usually a single part, but in some instances there could be more than one (e.g. two FunctionCallParts)
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


function _explainGeminiSafetyIssues(safetyRatings?: GeminiWire_Safety.SafetyRating[]): string {
  if (!safetyRatings || !safetyRatings.length)
    return 'no safety ratings provided';
  safetyRatings = (safetyRatings || []).sort(_geminiHarmProbabilitySortFunction);
  // only for non-neglegible probabilities
  return safetyRatings
    .filter(rating => rating.probability !== 'NEGLIGIBLE')
    .map(rating => `${rating.category/*.replace('HARM_CATEGORY_', '')*/} (${rating.probability?.toLowerCase()})`)
    .join(', ');
}

function _geminiHarmProbabilitySortFunction(a: { probability: string }, b: { probability: string }) {
  const order = ['NEGLIGIBLE', 'LOW', 'MEDIUM', 'HIGH'];
  return order.indexOf(b.probability) - order.indexOf(a.probability);
}
