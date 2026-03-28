import * as z from 'zod/v4';

import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixParts_DocPart, AixTools_ToolDefinition, AixTools_ToolsPolicy } from '../../../api/aix.wiretypes';
import { GeminiWire_API_Generate_Content, GeminiWire_ContentParts, GeminiWire_Messages, GeminiWire_Safety, GeminiWire_ToolDeclarations } from '../../wiretypes/gemini.wiretypes';

import { aixSpillSystemToUser, approxDocPart_To_String, approxInReferenceTo_To_XMLString } from './adapters.common';


// configuration
const hotFixImagePartsFirst = true; // https://ai.google.dev/gemini-api/docs/image-understanding#tips-best-practices
const hotFixReplaceEmptyMessagesWithEmptyTextPart = true;

// [Gemini 3, 2025-11-20] Bypass dummy thoughtSignature for Gemini 3+ validation
// https://ai.google.dev/gemini-api/docs/thought-signatures
const GEMINI_BYPASS_THOUGHT_SIGNATURE = 'context_engineering_is_the_way_to_go';
const MODELS_REQUIRING_THOUGHT_SIGNATURE = [
  'nano-banana-pro',
  // preview, e.g.:
  // 'gemini-3.1-flash-image-preview',
  // 'gemini-3-pro-image-preview',
  '-image-preview', // catch-all for image (nano banana) preview models
] as const;


export function aixToGeminiGenerateContent(model: AixAPI_Model, _chatGenerate: AixAPIChatGenerate_Request, geminiSafetyThreshold: GeminiWire_Safety.HarmBlockThreshold, jsonOutput: boolean, _streaming: boolean): TRequest {

  // Hotfixes - reduce these to the minimum, as they shall be higher-level resolved
  const isFamilyNanoBanana = MODELS_REQUIRING_THOUGHT_SIGNATURE.some(m => model.id.includes(m));
  const api3RequiresSignatures = isFamilyNanoBanana;

  // Note: the streaming setting is ignored here as it only belongs in the path

  // Pre-process CGR - approximate spill of System to User message - note: no need to flush as every message is not batched
  const chatGenerate = aixSpillSystemToUser(_chatGenerate);

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

        case 'inline_image':
          // we have already removed image parts from the system message
          throw new Error('Gemini: images have to be in user messages, not in system message');

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
  const contents: TRequest['contents'] = _toGeminiContents(chatGenerate.chatSequence, api3RequiresSignatures);

  // constrained output modes - only JSON (not tool invocations for now)
  const jsonOutputEnabled = !!model.strictJsonOutput || jsonOutput;
  const jsonOutputSchema = model.strictJsonOutput?.schema;
  // const strictToolInvocation = model.strictToolInvocations; // Gemini does not seem to support this yet - need to confirm

  // Construct the request payload
  const payload: TRequest = {
    contents,
    safetySettings: _toGeminiSafetySettings(geminiSafetyThreshold),
    systemInstruction,
    generationConfig: {
      stopSequences: undefined, // (default, optional)
      responseMimeType: jsonOutputEnabled ? 'application/json' : undefined,
      responseSchema: jsonOutputSchema,
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
  const thinkingLevel = model.reasoningEffort; // ?? model.vndGeminiThinkingLevel;
  if (thinkingLevel === 'none' || thinkingLevel === 'xhigh' || thinkingLevel === 'max') // domain validation
    throw new Error(`Gemini API does not support '${thinkingLevel}' thinking level`);

  if (thinkingLevel || model.vndGeminiThinkingBudget !== undefined /*|| model.vndGeminiShowThoughts === true*/) {
    const thinkingConfig: Exclude<TRequest['generationConfig'], undefined>['thinkingConfig'] = {};

    // This shows mainly 'summaries' of thoughts, and we enable it for most cases where thinking is requested
    if (thinkingLevel || (model.vndGeminiThinkingBudget ?? 0) > 1 /*|| model.vndGeminiShowThoughts === true*/)
      thinkingConfig.includeThoughts = true;

    // [Gemini 3, 2025-11-18] Thinking Level (replaces thinkingBudget for Gemini 3)
    // CRITICAL: Cannot use both thinkingLevel and thinkingBudget (400 error)
    if (thinkingLevel) {
      // - Gemini 3 Flash: supports 'high', 'medium', 'low', 'minimal'
      // - Gemini 3 Pro: supports 'high', 'low'
      thinkingConfig.thinkingLevel = thinkingLevel;
    }
    // [Gemini 2.x] Thinking Budget (0 disables thinking explicitly) - mutually exclusive with thinkingLevel
    else if (model.vndGeminiThinkingBudget !== undefined) {
      if (model.vndGeminiThinkingBudget > 0)
        thinkingConfig.includeThoughts = true;
      thinkingConfig.thinkingBudget = model.vndGeminiThinkingBudget;
    }

    payload.generationConfig!.thinkingConfig = thinkingConfig;
  }

  // [Gemini, 2025-11-18] Media Resolution: controls vision processing quality
  if (model.vndGeminiMediaResolution) {
    const mediaResolutionValuesMap = {
      'mr_low': 'MEDIA_RESOLUTION_LOW',
      'mr_medium': 'MEDIA_RESOLUTION_MEDIUM',
      'mr_high': 'MEDIA_RESOLUTION_HIGH',
    } as const;
    payload.generationConfig!.mediaResolution = mediaResolutionValuesMap[model.vndGeminiMediaResolution];
  }

  // [Gemini, 2025-10-02] [Gemini, 2025-11-20] Image generation: aspect ratio and size configuration
  if (model.vndGeminiAspectRatio || model.vndGeminiImageSize) {
    payload.generationConfig!.imageConfig = {
      ...(model.vndGeminiAspectRatio ? { aspectRatio: model.vndGeminiAspectRatio } : {}),
      ...(model.vndGeminiImageSize ? { imageSize: model.vndGeminiImageSize } : {}),
    };
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


  // --- Tools ---

  // --- Hosted tools (added first, custom tools below) ---
  let _addedHostedTools = false;

  // [Gemini, 2025-11-18] Code Execution: add tool when enabled
  if (model.vndGeminiCodeExecution === 'auto') {
    if (!payload.tools) payload.tools = [];

    // Build the Code Execution tool configuration (empty object)
    const codeExecutionTool: NonNullable<TRequest['tools']>[number] = {
      codeExecution: {},
    };

    // Add to tools array
    payload.tools.push(codeExecutionTool);
    _addedHostedTools = true;
  }

  // [Gemini, 2025-11-01] Computer Use: add tool when explicitly enabled or auto-detected from model ID
  const computerUseEnv = model.vndGeminiComputerUse || (model.id.includes('-computer-use') ? 'browser' : undefined);
  if (computerUseEnv) {
    if (!payload.tools) payload.tools = [];

    // Build the Computer Use tool configuration
    const computerUseTool: NonNullable<TRequest['tools']>[number] = {
      computerUse: {
        environment: computerUseEnv === 'browser' ? 'ENVIRONMENT_BROWSER' : 'ENVIRONMENT_BROWSER',
      },
    };

    // Add to tools array
    payload.tools.push(computerUseTool);
    _addedHostedTools = true;
  }

  // [Gemini, 2025-10-13] Google Search Grounding: add tool when enabled
  if (model.vndGeminiGoogleSearch) {
    if (!payload.tools) payload.tools = [];

    // Build the Google Search tool configuration
    const googleSearchTool: NonNullable<TRequest['tools']>[number] = {
      googleSearch: _buildGoogleSearchConfig(model.vndGeminiGoogleSearch),
    };

    // Add to tools array
    payload.tools.push(googleSearchTool);
    _addedHostedTools = true;
  }

  // [Gemini, 2025-08-18] URL Context: add tool when enabled
  if (model.vndGeminiUrlContext === 'auto' && !isFamilyNanoBanana /* Nano Bananas don't fetch */) {
    if (!payload.tools) payload.tools = [];

    // Build the URL Context tool configuration (empty object)
    const urlContextTool: NonNullable<TRequest['tools']>[number] = {
      urlContext: {},
    };

    // Add to tools array
    payload.tools.push(urlContextTool);
    _addedHostedTools = true;
  }


  // --- Custom tools (function calling) ---

  const hasUserTools = chatGenerate.tools?.some(t => t.type === 'function_call');

  // Tool Context Circulation: Gemini 3+ can combine hosted + custom tools and expose server-side tool invocations.
  // - https://ai.google.dev/gemini-api/docs/tool-combination
  // - AUTO mode is NOT supported - forces VALIDATED.
  // Deny-list: models WITHOUT tool context circulation (pre-Gemini 3, image models, deep research)
  const _noToolContextCirculation = ['gemini-2.', '-image-preview', 'nano-banana', 'deep-research'];
  const hasToolContextCirculation = !_noToolContextCirculation.some((p) => model.id.includes(p));

  // [NO-CIRCULATION] can't combine hosted + custom tools with restrictive policies - custom wins -> wipe hosted if any
  const hasUserRestrictivePolicy = chatGenerate.toolsPolicy?.type === 'any' || chatGenerate.toolsPolicy?.type === 'function_call';
  // NOTE: we may have to remove the 'hasUserRestrictivePolicy' as some models seem to not want any other tool when user tools are set
  if (_addedHostedTools && hasUserTools && !hasToolContextCirculation && hasUserRestrictivePolicy) {
    _addedHostedTools = false;
    payload.tools = undefined; // wipe
  }

  // Function Calls
  if (chatGenerate.tools) {
    payload.tools = [
      ...payload.tools || [],
      ..._toGeminiTools(chatGenerate.tools)
    ];
    if (chatGenerate.toolsPolicy)
      payload.toolConfig = _toGeminiToolConfig(chatGenerate.toolsPolicy);
  }

  // [CIRCULATION] Enables server-side tool invocation visibility (toolCall/toolResponse parts in the stream). For:
  //  A. hosted+custom on Gemini 3+ -> circulation + VALIDATED
  //  B. hosted-only on Gemini 3+ -> circulation
  //  C. hosted on Gemini 2.x -> tools work without circulation
  //  D. custom-only -> no circulation needed.
  if (_addedHostedTools && hasToolContextCirculation) {
    payload.toolConfig = { ...payload.toolConfig, includeServerSideToolInvocations: true };

    // When combining hosted + custom tools, AUTO mode is not supported - force VALIDATED
    if (hasUserTools && payload.toolConfig?.functionCallingConfig?.mode === 'AUTO')
      payload.toolConfig.functionCallingConfig.mode = 'VALIDATED';
  }


  // Preemptive error detection with server-side payload validation before sending it upstream
  const validated = GeminiWire_API_Generate_Content.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.warn('[DEV] Gemini: invalid generateContent payload. Error:', { valError: validated.error });
    throw new Error(`Invalid request for Gemini models: ${z.prettifyError(validated.error)}`);
  }

  return validated.data;
}

type TRequest = GeminiWire_API_Generate_Content.Request;


function _toGeminiContents(chatSequence: AixMessages_ChatMessage[], apiRequiresSignatures: boolean): GeminiWire_Messages.Content[] {

  // Remove messages that are made of empty parts
  // if (hotFixRemoveEmptyMessages)
  //   chatSequence = chatSequence.filter(message => message.parts.length > 0);


  return chatSequence.reduce<GeminiWire_Messages.Content[]>((contents, message) => {
    const isModelMessage = message.role === 'model';
    const baseRole: GeminiWire_Messages.Content['role'] = isModelMessage ? 'model' : 'user';

    if (hotFixImagePartsFirst) {
      // https://ai.google.dev/gemini-api/docs/image-understanding#tips-best-practices
      // "When using a single image with text, place the text prompt after the image part in the contents array."
      message.parts.sort((a, b) => {
        if (a.pt === 'inline_image' && b.pt !== 'inline_image') return -1;
        if (a.pt !== 'inline_image' && b.pt === 'inline_image') return 1;
        return 0;
      });
    }

    // Gemini requires tool_response (FunctionResponse/CodeExecutionResult) in 'user' Content,
    // but tool_invocation (FunctionCall/ExecutableCode) in 'model' Content. For model messages
    // that contain both (multi-turn tool loop), we emit separate Content objects at each role
    // boundary to preserve part ordering and thought signature positional context.
    let currentRole: GeminiWire_Messages.Content['role'] = baseRole;
    let parts: GeminiWire_ContentParts.ContentPart[] = [];

    function flushContent() {
      if (parts.length > 0)
        contents.push({ role: currentRole, parts: parts });
      parts = [];
    }

    /* Semantically we want to preserve an empty assistant response, but Gemini requires
     * at least one part for a `Content` object, so the empty message becomes a "" instead.
     * E.g. { role: 'rolename', parts: [{text: ''}] }
     */
    if (hotFixReplaceEmptyMessagesWithEmptyTextPart && message.parts.length === 0) {
      parts.push(GeminiWire_ContentParts.TextPart(''));
    }

    for (const part of message.parts) {
      // Determine the target Gemini role for this part: tool_response -> 'user', everything else -> baseRole
      const partRole: GeminiWire_Messages.Content['role'] = (isModelMessage && part.pt === 'tool_response') ? 'user' : baseRole;

      // Flush on role boundary to preserve ordering
      if (partRole !== currentRole) {
        flushContent();
        currentRole = partRole;
      }

      let partRequiresSignature = false;
      switch (part.pt) {

        case 'text':
          parts.push(GeminiWire_ContentParts.TextPart(part.text));

          // [Gemini, 2025-11-20] Nano Banana Pro requires thoughtSignature on the first model text part
          if (apiRequiresSignatures && isModelMessage)
            partRequiresSignature = true;
          break;

        case 'inline_audio':
        case 'inline_image':
          parts.push(GeminiWire_ContentParts.InlineDataPart(part.mimeType, part.base64));
          if (apiRequiresSignatures)
            partRequiresSignature = true;
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
              parts.push(GeminiWire_ContentParts.FunctionCallPart({ id: part.id, name: invocation.name, args: functionCallArgs }));
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
              parts.push(GeminiWire_ContentParts.FunctionResponsePart({ id: part.id, name: part.response.name, response: functionResponseResponse }));
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

      // apply thoughtSignature if present
      if (parts.length) {
        const tsTarget = parts[parts.length - 1];

        // apply thoughtSignature to the last part if applicable
        if ('_vnd' in part && part._vnd?.gemini?.thoughtSignature) {
          tsTarget.thoughtSignature = part._vnd.gemini.thoughtSignature;
        }
        // if not applied yet, and required for this part type, apply bypass dummy and warn
        else if (partRequiresSignature) {
          // Without this, images that are generated by other (non-signed) models/tools will cause errors:
          // << [Service Issue] Gemini: Upstream responded with HTTP 400 Bad Request - Image part is missing a thought_signature in content position 12, part position 1. Please refer to https://ai.google.dev/gemini-api/docs/thought-signatures#model-behavior for more details. >>
          tsTarget.thoughtSignature = GEMINI_BYPASS_THOUGHT_SIGNATURE;
          // [Gemini 3, 2025-11-20] Cross-provider or edited content warning
          console.log(`[Gemini 3] ${part.pt} missing thoughtSignature - bypass applied`);
        }
      }
    }

    flushContent();
    return contents;
  }, []);
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
        // NOTE: commented because now we have 'code_interpreter' too
        // if (itd.variant !== 'gemini_auto_inline')
        //   throw new Error('Gemini only supports inline code execution');

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

      default: // Note: Gemini's tool function doesn't break on unknown tools, so we need the default case here
        throw new Error('Tool ${itd.type} is not supported by Gemini');

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

function _buildGoogleSearchConfig(searchGrounding: AixAPI_Model['vndGeminiGoogleSearch']): NonNullable<NonNullable<TRequest['tools']>[number]['googleSearch']> {

  // enabled: any time interval
  if (searchGrounding === 'unfiltered')
    return {};

  // calculate the time range based on the filter value
  const until = new Date();
  const startTime = new Date(until);
  switch (searchGrounding) {
    case '1d':
      startTime.setDate(until.getDate() - 1);
      // Fix "Invalid time range: end_time must be 24 hours after start_time."
      until.setHours(until.getHours() + 1);
      break;
    case '1w':
      startTime.setDate(until.getDate() - 7);
      break;
    case '1m':
      startTime.setMonth(until.getMonth() - 1);
      break;
    case '6m':
      startTime.setMonth(until.getMonth() - 6);
      break;
    case '1y':
      startTime.setFullYear(until.getFullYear() - 1);
      break;
    default:
      console.warn(`Unknown Google Search grounding value: ${searchGrounding}`);
      return {};
  }
  // format timestamps: https://ai.google.dev/api/caching#Interval
  return {
    timeRangeFilter: {
      startTime: startTime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      endTime: until.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    },
  };
}
