import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixParts_DocPart, AixTools_ToolDefinition, AixTools_ToolsPolicy } from '../../../api/aix.wiretypes';
import { GeminiWire_API_Generate_Content, GeminiWire_ContentParts, GeminiWire_Messages, GeminiWire_Safety, GeminiWire_ToolDeclarations } from '../../wiretypes/gemini.wiretypes';

import { approxDocPart_To_String, approxInReferenceTo_To_XMLString } from './anthropic.messageCreate';


// configuration
const hotFixImagePartsFirst = true;
const hotFixReplaceEmptyMessagesWithEmptyTextPart = true;


export function aixToGeminiGenerateContent(model: AixAPI_Model, chatGenerate: AixAPIChatGenerate_Request, geminiSafetyThreshold: GeminiWire_Safety.HarmBlockThreshold, jsonOutput: boolean, _streaming: boolean): TRequest {

  // Note: the streaming setting is ignored as it only belongs in the path

  // System Instructions
  let systemInstruction: TRequest['systemInstruction'] = undefined;
  if (chatGenerate.systemMessage?.parts.length) {
    systemInstruction = chatGenerate.systemMessage.parts.reduce((acc, part) => {
      switch (part.pt) {

        case 'text':
          acc.parts.push(GeminiWire_ContentParts.TextPart(part.text));
          break;

        case 'doc':
          acc.parts.push(GeminiWire_ContentParts.TextPart(approxDocPart_To_String(part)));
          break;

        case 'meta_cache_control':
          // ignore this breakpoint hint - Anthropic only
          break;

        default:
          const _exhaustiveCheck: never = part;
          throw new Error(`Unsupported part type in System message: ${(part as any).pt}`);
      }
      return acc;
    }, { parts: [] } as Exclude<TRequest['systemInstruction'], undefined>);

    // unset system instruction if empty
    if (!systemInstruction.parts.length)
      systemInstruction = undefined;
  }

  // Chat Messages
  const contents: TRequest['contents'] = _toGeminiContents(chatGenerate.chatSequence);

  // Construct the request payload
  const payload: TRequest = {
    contents,
    tools: chatGenerate.tools && _toGeminiTools(chatGenerate.tools),
    toolConfig: chatGenerate.toolsPolicy && _toGeminiToolConfig(chatGenerate.toolsPolicy),
    safetySettings: _toGeminiSafetySettings(geminiSafetyThreshold),
    systemInstruction,
    generationConfig: {
      stopSequences: undefined, // (default, optional)
      responseMimeType: jsonOutput ? 'application/json' : undefined,
      responseSchema: undefined, // (default, optional) NOTE: for JSON output, we'd take the schema here
      candidateCount: undefined, // (default, optional)
      maxOutputTokens: model.maxTokens !== undefined ? model.maxTokens : undefined,
      ...(model.temperature !== null ? { temperature: model.temperature !== undefined ? model.temperature : undefined } : {}),
      topP: undefined, // (default, optional)
      topK: undefined, // (default, optional)
    },
  };

  // Top-P instead of temperature
  if (model.topP !== undefined) {
    delete payload.generationConfig!.temperature;
    payload.generationConfig!.topP = model.topP;
  }

  // Thinking models: thinking budget and show thoughts
  if (model.vndGeminiShowThoughts === true || model.vndGeminiThinkingBudget !== undefined) {
    const thinkingConfig: Exclude<TRequest['generationConfig'], undefined>['thinkingConfig'] = {};

    // This seems deprecated keep it in case Gemini turns it on again
    if (model.vndGeminiShowThoughts)
      thinkingConfig.includeThoughts = true;

    // 0 disables thinking explicitly
    if (model.vndGeminiThinkingBudget !== undefined) {
      if (model.vndGeminiThinkingBudget > 0)
        thinkingConfig.includeThoughts = true;
      thinkingConfig.thinkingBudget = model.vndGeminiThinkingBudget;
    }

    payload.generationConfig!.thinkingConfig = thinkingConfig;
  }

  // [Gemini, 2025-05-20] Experimental Audio generation (TTS - audio only, no text): Request
  const noTextOutput = !model.acceptsOutputs.includes('text');
  if (model.acceptsOutputs.includes('audio')) {

    // (undocumented) Adapt the request
    delete payload.systemInstruction;
    delete payload.generationConfig!.maxOutputTokens; // maxOutputTokens is not supported for audio-only output
    payload.generationConfig!.temperature = 1;

    // activate audio (/only) output
    payload.generationConfig!.responseModalities = noTextOutput ? ['AUDIO'] : ['TEXT', 'AUDIO'];

    // default voice config - list here: https://ai.google.dev/gemini-api/docs/speech-generation#voices
    payload.generationConfig!.speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Zephyr',
        },
      },
    };
  }
  // [Gemini, 2025-03-14] Experimental Image generation: Request
  else if (model.acceptsOutputs.includes('image')) {
    payload.generationConfig!.responseModalities = noTextOutput ? ['IMAGE'] : ['TEXT', 'IMAGE'];
    // 2025-03-14: both APIs v1alpha and v1beta do not support specifying the resolution
    // payload.generationConfig!.mediaResolution = 'MEDIA_RESOLUTION_HIGH';
  }

  // TODO: Google Search Grounding: for the models that support it, it shall be declared and runtime toggleable
  // it then becomes just a metter of:
  // - payload.tools = [...payload.tools, { googleSearch: {} }]; -- for most models
  // - emitting the missing particles, parsing, rendering
  // - working around the limitations and idiosyncrasies of the Search API

  // Preemptive error detection with server-side payload validation before sending it upstream
  const validated = GeminiWire_API_Generate_Content.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.warn('Gemini: invalid generateContent payload. Error:', validated.error.message);
    throw new Error(`Invalid sequence for Gemini models: ${validated.error.issues?.[0]?.message || validated.error.message || validated.error}.`);
  }

  return validated.data;
}

type TRequest = GeminiWire_API_Generate_Content.Request;


function _toGeminiContents(chatSequence: AixMessages_ChatMessage[]): GeminiWire_Messages.Content[] {

  // Remove messages that are made of empty parts
  // if (hotFixRemoveEmptyMessages)
  //   chatSequence = chatSequence.filter(message => message.parts.length > 0);


  return chatSequence.map(message => {
    const parts: GeminiWire_ContentParts.ContentPart[] = [];

    if (hotFixImagePartsFirst) {
      message.parts.sort((a, b) => {
        if (a.pt === 'inline_image' && b.pt !== 'inline_image') return -1;
        if (a.pt !== 'inline_image' && b.pt === 'inline_image') return 1;
        return 0;
      });
    }

    /* Semantically we want to preserve an empty assistant response, but Gemini requires
     * at least one part for a `Content` object, so the empty message becomes a "" instead.
     * E.g. { role: 'rolename', parts: [{text: ''}] }
     */
    if (hotFixReplaceEmptyMessagesWithEmptyTextPart && message.parts.length === 0) {
      parts.push(GeminiWire_ContentParts.TextPart(''));
    }

    for (const part of message.parts) {
      switch (part.pt) {

        case 'text':
          parts.push(GeminiWire_ContentParts.TextPart(part.text));
          break;

        case 'inline_audio':
        case 'inline_image':
          parts.push(GeminiWire_ContentParts.InlineDataPart(part.mimeType, part.base64));
          break;

        case 'doc':
          parts.push(_toApproximateGeminiDocPart(part));
          break;

        case 'ma':
          // ignore this thinking block - Anthropic only
          break;

        case 'meta_cache_control':
          // ignore this breakpoint hint - Anthropic only
          break;

        case 'meta_in_reference_to':
          const irtXMLString = approxInReferenceTo_To_XMLString(part);
          if (irtXMLString)
            parts.push(GeminiWire_ContentParts.TextPart(irtXMLString));
          break;

        case 'tool_invocation':
          const invocation = part.invocation;
          switch (invocation.type) {
            case 'function_call':
              let functionCallArgs: Record<string, any> | undefined;
              if (invocation.args) {
                // TODO: migrate to JSON | objects across all providers
                // noinspection SuspiciousTypeOfGuard - reason: above
                if (typeof invocation.args === 'string') {
                  try {
                    functionCallArgs = JSON.parse(invocation.args);
                  } catch (e) {
                    console.warn('Gemini: failed to parse (string -> JSON) function call arguments', e);
                    functionCallArgs = { output: invocation.args };
                  }
                } else {
                  functionCallArgs = invocation.args;
                }
              }
              parts.push(GeminiWire_ContentParts.FunctionCallPart(invocation.name, functionCallArgs));
              break;
            case 'code_execution':
              if (invocation.language?.toLowerCase() !== 'python')
                console.warn('Gemini only supports Python code execution, but got:', invocation.language);
              parts.push(GeminiWire_ContentParts.ExecutableCodePart('PYTHON', invocation.code));
              break;
            default:
              const _exhaustiveCheck: never = invocation;
              throw new Error(`Unsupported tool call type in message: ${(part as any).call.type}`);
          }
          break;

        case 'tool_response':
          const toolErrorPrefix = part.error ? (typeof part.error === 'string' ? `[ERROR] ${part.error} - ` : '[ERROR] ') : '';
          switch (part.response.type) {
            case 'function_call':
              let functionResponseResponse: Record<string, any> | undefined;
              if (part.response.result) {
                // TODO: migrate function call results to JSON | objects across all providers
                // noinspection SuspiciousTypeOfGuard
                if (typeof part.response.result === 'string') {
                  try {
                    functionResponseResponse = JSON.parse(part.response.result);
                  } catch (e) {
                    console.warn('Gemini: failed to parse (string -> JSON) function response result', e);
                    functionResponseResponse = { output: toolErrorPrefix + part.response.result };
                  }
                  if (Array.isArray(functionResponseResponse)) {
                    console.warn('toGeminiContents: Gemini requires results of function calls to be objects', { result: functionResponseResponse });
                    throw new Error('Gemini: unexpected array as function response');
                  }
                } else {
                  functionResponseResponse = part.response.result;
                }
              }
              parts.push(GeminiWire_ContentParts.FunctionResponsePart(part.response._name || part.id, functionResponseResponse));
              break;
            case 'code_execution':
              parts.push(GeminiWire_ContentParts.CodeExecutionResultPart(!part.error ? 'OUTCOME_OK' : 'OUTCOME_FAILED', toolErrorPrefix + part.response.result));
              break;
            default:
              const _exhaustiveCheck: never = part.response;
              throw new Error(`Unsupported tool response type in message: ${(part as any).response.type}`);
          }
          break;

        default:
          const _exhaustiveCheck: never = part;
          throw new Error(`Unsupported part type in Chat message: ${(part as any).pt}`);
      }
    }

    return {
      role: message.role === 'model' ? 'model' : 'user',
      parts,
    };
  });
}

function _toGeminiTools(itds: AixTools_ToolDefinition[]): NonNullable<TRequest['tools']> {
  const tools: TRequest['tools'] = [];

  itds.forEach(itd => {
    switch (itd.type) {

      // Note: we add each function call as a separate tool, however it could be possible to add
      // a single tool with multiple function calls - which one to choose?
      case 'function_call':
        const { name, description, input_schema } = itd.function_call;

        // create the function declaration
        const functionDeclaration: GeminiWire_ToolDeclarations.FunctionDeclaration = {
          name,
          description,
        };

        // handle no-params function call definitions for Gemini (no input_schema, or empty properties)
        if (input_schema?.properties && Object.keys(input_schema.properties).length) {
          functionDeclaration.parameters = {
            type: 'object',
            properties: input_schema?.properties,
            required: input_schema?.required,
          };
        }

        // coalesce the function declaration into the last tool, if of the right type
        const lastTool = tools[tools.length - 1];
        if (lastTool && 'functionDeclarations' in lastTool && lastTool.functionDeclarations?.length) {
          lastTool.functionDeclarations.push(functionDeclaration);
          break;
        }

        // create a new tool with the function declaration
        tools.push({
          functionDeclarations: [functionDeclaration],
        });
        break;

      case 'code_execution':
        if (itd.variant !== 'gemini_auto_inline')
          throw new Error('Gemini only supports inline code execution');

        // throw if code execution is present more than once
        if (tools.some(tool => tool.codeExecution))
          throw new Error('Gemini code interpreter already defined');

        tools.push({
          codeExecution: {
            // the official docs have no parameters yet...
            // https://ai.google.dev/api/caching#tool
          },
        });
        break;

    }
  });

  return tools;
}

function _toGeminiToolConfig(itp: AixTools_ToolsPolicy): NonNullable<TRequest['toolConfig']> {
  switch (itp.type) {
    case 'auto':
      return { functionCallingConfig: { mode: 'AUTO' } };
    case 'any':
      return { functionCallingConfig: { mode: 'ANY' } };
    case 'function_call':
      return {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [itp.function_call.name],
        },
      };
  }
}

function _toGeminiSafetySettings(threshold: GeminiWire_Safety.HarmBlockThreshold): TRequest['safetySettings'] {
  return threshold === 'HARM_BLOCK_THRESHOLD_UNSPECIFIED' ? undefined : [
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: threshold },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: threshold },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: threshold },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: threshold },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: threshold },
  ];
}


// Approximate conversions - alternative approaches should be tried until we find the best one

function _toApproximateGeminiDocPart(aixPartsDocPart: AixParts_DocPart): GeminiWire_ContentParts.ContentPart {
  // NOTE: we keep this function because we could use Gemini's different way to represent documents in the future...
  return GeminiWire_ContentParts.TextPart(approxDocPart_To_String(aixPartsDocPart));
}
