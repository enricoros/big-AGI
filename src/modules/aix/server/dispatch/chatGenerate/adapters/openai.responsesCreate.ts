import * as z from 'zod/v4';

import type { OpenAIDialects } from '~/modules/llms/server/openai/openai.access';

import { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixMessages_SystemMessage, AixTools_ToolDefinition, AixTools_ToolsPolicy, AixWire_Vendors } from '../../../api/aix.wiretypes';
import { OpenAIWire_API_Responses, OpenAIWire_Responses_Items, OpenAIWire_Responses_Tools } from '../../wiretypes/openai.wiretypes';

import { aixDocPart_to_OpenAITextContent, aixMetaRef_to_OpenAIText, aixTexts_to_OpenAIInstructionText } from './openai.chatCompletions';
import { AIX_MISSING_TOOL_RESULT_TEXT, aixSpillShallFlush, aixSpillSystemToUser, approxDocPart_To_String, approxMediaUrlPart_To_String } from './adapters.common';


// configuration
const OPENAI_RESPONSES_DEFAULT_TRUNCATION: TRequest['truncation'] = undefined;
export const AIX_OAI_DEFAULT_IMAGE_GEN_MODEL: Exclude<Extract<TRequestTool, { type: 'image_generation' }>['model'], undefined> = 'gpt-image-2';


type TRequest = OpenAIWire_API_Responses.Request;
type TRequestInput = OpenAIWire_Responses_Items.InputItem;
type TRequestTool = OpenAIWire_Responses_Tools.Tool;


/**
 * Per-dialect quirks of the OpenAI Responses wire format: the envelope is shared, the validators are not.
 * Defaults = native OpenAI; a dialect overrides only what deviates. Add a row here, not another `isDialectX` flag.
 */
interface RspDialectQuirks {
  /** `_vnd` namespace for continuity state (encrypted reasoning items, message phase) and the parser tag - vendor-private */
  vndNamespace: AixWire_Vendors.RspVendor;
  /** replay assistant messages with their `phase` (harmless on older OpenAI models: accepted and ignored) */
  emitMessagePhase: boolean;
  /** `reasoning.context: 'all_turns'` on gpt-5.4+ */
  reasoningContextAllTurns: boolean;
  /** hosted web_search tool shape: 'full' (context size, location, external access), 'bare' ({ type } only), 'none' (unsupported) */
  webSearchTool: 'full' | 'bare' | 'none';
  /** hosted code_interpreter tool */
  codeInterpreterTool: boolean;
  /** image generation tool may request WebP output */
  imageGenWebP: boolean;
  /** tool_choice accepts only 'auto' (a restrictive tools policy degrades to 'auto') */
  toolChoiceOnlyAuto: boolean;
  /** lowest max_output_tokens the validator accepts */
  minOutputTokens?: number;
}

const _RSP_QUIRKS_DEFAULT: RspDialectQuirks = {
  vndNamespace: 'openai',
  emitMessagePhase: true,
  reasoningContextAllTurns: true,
  webSearchTool: 'full',
  codeInterpreterTool: true,
  imageGenWebP: true,
  toolChoiceOnlyAuto: false,
};

const _RSP_DIALECT_QUIRKS: Partial<Record<OpenAIDialects, Partial<RspDialectQuirks>>> = {
  // [Azure] lags OpenAI: no web search ("Hosted tool 'web_search' is not supported", still true 2025-11-18), no code interpreter,
  // no WebP image output, and the message phase / reasoning.context schema fields may lag too
  azure: { emitMessagePhase: false, reasoningContextAllTurns: false, webSearchTool: 'none', codeInterpreterTool: false, imageGenWebP: false },
  // [Sakana.ai] bare web_search tool (context size tolerated since ~2026-07 but undocumented); own namespace: its encrypted reasoning
  // items are Sakana-private (unusable at OpenAI, and vice versa)
  sakanaai: { vndNamespace: 'sakanaai', webSearchTool: 'bare' },
  // [xAI] own adapter (xai.responsesCreate.ts) and own namespace; listed for the parser tag only
  xai: { vndNamespace: 'xai' },
  // [Meta AI, 2026-09-02] api.meta.ai: strict validator (unknown top-level params 400), tool_choice 'auto' only, max_output_tokens >= 16,
  // truncation 'disabled' only, effort 'none' rejected; reasoning items are Meta-private (own namespace)
  metaai: { vndNamespace: 'metaai', toolChoiceOnlyAuto: true, minOutputTokens: 16 },
};

function _rspQuirks(dialect: OpenAIDialects): RspDialectQuirks {
  return { ..._RSP_QUIRKS_DEFAULT, ..._RSP_DIALECT_QUIRKS[dialect] };
}

/** The `_vnd` namespace / parser tag for an OpenAI-compatible dialect served over the Responses API */
export function openAIDialectToRspVendor(dialect: OpenAIDialects): AixWire_Vendors.RspVendor {
  return _rspQuirks(dialect).vndNamespace;
}


/**
 * OpenAI Responses request adapter
 *
 * Implementation notes:
 * - much side functionality is not implemented yet
 * - testing with o3-pro only for now
 */
export function aixToOpenAIResponses(
  openAIDialect: OpenAIDialects,
  model: AixAPI_Model,
  _chatGenerate: AixAPIChatGenerate_Request,
  streaming: boolean,
  enableResumability: boolean,
): TRequest {

  // Pre-process CGR - approximate spill of System to User message
  const chatGenerate = aixSpillSystemToUser(_chatGenerate);

  // [OpenAI] Vendor-specific model checks
  const isOpenAIComputerUse = model.id.includes('computer-use');

  // NOTE: we do not use this anymore - LLM_IF_HOTFIX_NoTemperature works in definition, UI, and client calls
  // const isOpenAIOFamily = ['gpt-6', 'gpt-5', 'o4', 'o3', 'o1'].some(_id => model.id === _id || model.id.startsWith(_id + '-'));
  // const isOpenAIChatGPT = ['gpt-5-chat'].some(_id => model.id === _id || model.id.startsWith(_id + '-'));
  const forceNoTemperature = false;  // isOpenAIOFamily && !isOpenAIChatGPT;

  const hotFixNoTruncateAuto = isOpenAIComputerUse;

  // per-dialect deviations from native OpenAI (see _RSP_DIALECT_QUIRKS)
  const quirks = _rspQuirks(openAIDialect);

  // ---
  // construct the request payload
  // NOTE: the zod parsing will remove the undefined values from the upstream request, enabling an easier construction
  // ---

  // constrained output modes - both JSON and tool invocations
  // const strictJsonOutput = !!model.strictJsonOutput;
  const strictToolInvocations = !!model.strictToolInvocations;

  const { requestInput, requestInstructions } = _toOpenAIResponsesRequestInput(chatGenerate.systemMessage, chatGenerate.chatSequence, model.vndOaiContainerId, quirks.emitMessagePhase, quirks.vndNamespace);

  // Pair every interior function_call with a function_call_output, or the request is rejected wholesale
  _pairInteriorFunctionCalls(requestInput);

  const payload: TRequest = {

    // Model configuration
    model: model.id,
    max_output_tokens: model.maxTokens ?? undefined, // response if unset: null
    temperature: !forceNoTemperature ? model.temperature ?? undefined : undefined,
    // top_p: ... below (alternative to temperature)

    // Input
    instructions: requestInstructions,
    input: requestInput,

    // Tools
    tools: chatGenerate.tools && _toOpenAIResponsesTools(chatGenerate.tools, strictToolInvocations),
    tool_choice: chatGenerate.toolsPolicy && _toOpenAIResponsesToolChoice(chatGenerate.toolsPolicy, quirks.toolChoiceOnlyAuto),
    // parallel_tool_calls: undefined, // response if unset: true

    // Operations Config - use unified effort, fall back to deprecated field
    // reasoning: ... below

    // Output Config
    // text: ... below

    // API state management
    /** Default for resumability is true, however we set it to false unless explicitly requested. */
    store: enableResumability ?? false, // enable storage for resumability if requested
    // previous_response_id: undefined,

    // API options
    stream: streaming,
    // background: false, // response if unset: false
    truncation: !hotFixNoTruncateAuto ? OPENAI_RESPONSES_DEFAULT_TRUNCATION : 'auto',
    // include: [], // we incrementally build this below, on-demand
    // user: undefined,

  };

  // "top-p": if present, use instead of temperature
  if (model.topP !== undefined) {
    delete payload.temperature;
    payload.top_p = model.topP;
  }

  // validator floor on max_output_tokens ([Meta AI] >= 16, 400 below; reasoning tokens share the budget)
  if (quirks.minOutputTokens && typeof payload.max_output_tokens === 'number' && payload.max_output_tokens < quirks.minOutputTokens)
    payload.max_output_tokens = quirks.minOutputTokens;

  // Structured Outputs - JSON output grammar
  if (model.strictJsonOutput)
    payload.text = {
      ...payload.text,
      format: {
        type: 'json_schema',
        name: model.strictJsonOutput.name || 'response',
        description: model.strictJsonOutput.description,
        schema: model.strictJsonOutput.schema,
        strict: true,
      },
    };


  // Reasoning
  // [2026-07-09, OpenAI] 'max' effort is valid since GPT-5.6 (was Responses-rejected before then) - per-model domain validation is left to the API
  const reasoningEffort = model.reasoningEffort; // ?? model.vndOaiReasoningEffort;

  if (reasoningEffort) {
    payload.reasoning = {
      effort: reasoningEffort,
    };
    // include detailed reasoning summaries, unless the user has asked to bypass the OpenAI Org verification (via the forceNoStream flag)
    const specialExclusions = [
      'o1-pro', // found manually: unsupported parameter: 'reasoning.summary' is not supported with the 'o1-pro-2025-03-19' model
    ].some(_id => model.id === _id || model.id.startsWith(_id + '-'));
    if (reasoningEffort !== 'none' && !model.forceNoStream && !specialExclusions)
      payload.reasoning.summary = 'detailed';

    // [2026-02-24, OpenAI] Retained reasoning: 'all_turns' makes gpt-5.4+ consume the reasoning items we
    // replay ('auto' is provider discretion). The user lever is what we send (chat 'Reasoning traces'
    // policy); the API only bills consumed items, so this is free when little/nothing is sent.
    // Gate: gpt-5.4+ (older models 400 on 'all_turns'), not Azure (may lag), not effort 'none'.
    const gptGen = /^gpt-(\d+)(?:\.(\d+))?/.exec(model.id);
    const supportsAllTurns = !!gptGen && (+gptGen[1] > 5 || (+gptGen[1] === 5 && +(gptGen[2] || 0) >= 4));
    if (supportsAllTurns && reasoningEffort !== 'none' && quirks.reasoningContextAllTurns)
      payload.reasoning.context = 'all_turns';
  }

  // [2026-07-09, OpenAI] GPT-5.6+ Reasoning Mode: 'pro' performs additional model work for the hardest problems, billed at
  // standard token rates (replaces standalone '-pro' models); orthogonal to effort, verified working with streaming
  if (model.vndOaiReasoningMode)
    payload.reasoning = { ...payload.reasoning, mode: model.vndOaiReasoningMode };

  // ALWAYS REQUEST Reasoning items: always include encrypted_content if there's any reasoning done; we had this inside the
  // former block, but models can reason even if reasoningEffort === undefined;
  if (!payload.store && reasoningEffort !== 'none') {
    const includes = new Set(payload.include);
    includes.add('reasoning.encrypted_content');
    payload.include = Array.from(includes);
  }

  // GPT-5 Verbosity: Add to existing text config or create new one
  if (model.vndOaiVerbosity) {
    payload.text = {
      ...payload.text,
      verbosity: model.vndOaiVerbosity,
    };
  }

  // --- Tools ---

  // Allow/deny auto-adding hosted tools when custom tools are present
  const hasCustomTools = chatGenerate.tools?.some(t => t.type === 'function_call');
  const hasRestrictivePolicy = chatGenerate.toolsPolicy?.type === 'any' /* || chatGenerate.toolsPolicy?.type === 'function_call' - DISABLED 2026-07-17, see ToolsPolicy_schema */;
  const skipHostedToolsDueToCustomTools = hasCustomTools && hasRestrictivePolicy;

  // Tool: Web Search: for search and deep research models
  const requestWebSearchTool = !!model.vndOaiWebSearchContext || !!model.userGeolocation;
  if (requestWebSearchTool && !skipHostedToolsDueToCustomTools) {
    /**
     * NOTE: as of 2025-09-12, we still get the "Hosted tool 'web_search' is not supported with gpt-5-mini-2025-08-07"
     *       warning from Azure OpenAI V1. We shall check in the future if this is resolved.
     */
    if (quirks.webSearchTool === 'none') {
      // [2025-11-18] Azure OpenAI still doesn't support web search tool yet - confirmed
      // [2025-09-12] Azure OpenAI doesn't support web search tool yet, and we also remove the "parameter" so we shall not come here
      console.log(`[DEV] ${openAIDialect} Responses: skipping web search tool - not supported by this dialect`);
    } else if (reasoningEffort === 'minimal') {
      // 2026-02-17: Validated: Web search is not supported when the reasoning effort is 'minimal'
      // console.log('[DEV] OpenAI Responses: skipping web search tool due to reasoning effort being set to minimal');
    } else {

      // Add the web search tool to the request
      if (!payload.tools?.length)
        payload.tools = [];
      const webSearchTool: TRequestTool = model.id.includes('-deep-research') ? {
        type: 'web_search_preview', // HOTFIX for deep research models, which only seem to support the outdated 'web_search_preview' tool
      } : quirks.webSearchTool === 'bare' ? {
        type: 'web_search', // bare tool, no options (see _RSP_DIALECT_QUIRKS)
      } : {
        type: 'web_search',
        search_context_size: model.vndOaiWebSearchContext ?? undefined,
        user_location: model.userGeolocation && {
          type: 'approximate',
          ...model.userGeolocation, // .city, .country, .region, .timezone
        },
        external_web_access: true, // true: live internet access, false: cache-only
      };
      payload.tools.push(webSearchTool);

      // Include all sources (web search list of URLs, but not high quality links at all) in the response ('web_search_call.action.sources')
      const extendedInclude = new Set(payload.include);
      extendedInclude.add('web_search_call.action.sources');
      payload.include = Array.from(extendedInclude);

    }
  }

  // Tool: Image Generation: configurable per model
  const requestImageGenerationTool = !!model.vndOaiImageGeneration;
  if (requestImageGenerationTool && !skipHostedToolsDueToCustomTools) {
    /**
     * [2025-11-18] Azure OpenAI Image Generation limitations:
     * - does not support image generation tool at all ({"type":"error","error":{"type":"invalid_request_error","code":null,"message":"There was an issue with your request. Please check your inputs and try again","param":null}})
     * - does not support WebP output format
     */
    const noWebPImageOutput = !quirks.imageGenWebP;
    if (noWebPImageOutput)
      console.warn(`[DEV] ${openAIDialect} Responses: trying image generation tool despite dialect limitations (PNG only)`);

    // Add the image generation tool to the request
    if (!payload.tools?.length)
      payload.tools = [];

    // Map enum values to tool configuration
    const imageMode = model.vndOaiImageGeneration;
    const imageGenerationTool: Extract<TRequestTool, { type: 'image_generation' }> = {
      type: 'image_generation',
      ...(AIX_OAI_DEFAULT_IMAGE_GEN_MODEL && { model: AIX_OAI_DEFAULT_IMAGE_GEN_MODEL }),
      ...(imageMode === 'mq' ? { quality: 'medium' } : { /* quality: 'high' -- auto */ }),
      // ...(imageMode === 'hq' ? ... auto ... ),
      ...(imageMode === 'hq_edit' && { input_fidelity: 'high' }),
      ...(imageMode !== 'hq_png' && !noWebPImageOutput && { output_format: 'webp' }),
      moderation: 'low',
    };
    payload.tools.push(imageGenerationTool);
  }

  // Tool: Code Interpreter: Python code execution in sandboxed container ($0.03/container)
  const requestCodeInterpreterTool = model.vndOaiCodeInterpreter === 'auto';
  if (requestCodeInterpreterTool && !skipHostedToolsDueToCustomTools) {
    if (!quirks.codeInterpreterTool) {
      console.log(`[DEV] ${openAIDialect} Responses: skipping code interpreter tool - not supported by this dialect`);
    } else {
      // Add the code interpreter tool to the request
      if (!payload.tools?.length)
        payload.tools = [];

      payload.tools.push({
        type: 'code_interpreter',
        // Always 'auto'. Reuse is driven by the round-tripped code_interpreter_call items below, which carry the prior
        // container_id: auto-mode reuses that active container (files + Python state persist) or creates a fresh one if
        // it expired. We deliberately do NOT pin the container explicitly here - per OpenAI docs, referencing an EXPIRED
        // container explicitly hard-fails the request, whereas auto degrades gracefully.
        container: { type: 'auto' }, // memory_limit/file_ids not surfaced (default 1g tier)
        // container: model.vndOaiContainerId ? model.vndOaiContainerId : { type: 'auto' },
      });

      // Include code execution outputs in the response
      const extendedInclude = new Set(payload.include);
      extendedInclude.add('code_interpreter_call.outputs');
      payload.include = Array.from(extendedInclude);
    }
  }


  // [OpenAI] Vendor-specific restore markdown, for GPT-5 models and recent 'o' models
  const skipMarkdownDueToCustomTools = hasCustomTools && hasRestrictivePolicy;
  if (model.vndOaiRestoreMarkdown && !skipMarkdownDueToCustomTools)
    vndOaiRestoreMarkdown(payload);


  // Preemptive error detection with server-side payload validation before sending it upstream
  // this includes stripping 'undefined' fields
  const validated = OpenAIWire_API_Responses.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.warn('[DEV] OpenAI: invalid Responses request payload. Error:', { valError: validated.error });
    throw new Error(`Invalid request for OpenAI models: ${z.prettifyError(validated.error)}`);
  }

  return validated.data;
}


function _toOpenAIResponsesRequestInput(systemMessage: AixMessages_SystemMessage | null, chatSequence: AixMessages_ChatMessage[], sessionContainerId: string | undefined, emitMessagePhase: boolean, vndNamespace: AixWire_Vendors.RspVendor): { requestInput: TRequestInput[], requestInstructions: TRequest['instructions'] } {

  /**
   * Instructions to the model
   *
   * Single-part texts stay as-is, while multi-part texts or docs are flattened to a string.
   */
  const instructionsParts: string[] = [];
  systemMessage?.parts.forEach((part) => {
    switch (part.pt) {
      case 'text':
        instructionsParts.push(part.text);
        break;

      case 'doc':
        instructionsParts.push(aixDocPart_to_OpenAITextContent(part).text);
        break;

      case 'inline_image':
        // we have already removed image parts from the system message
        throw new Error('OpenAI Responses: images have to be in user messages, not in system message');

      case 'meta_cache_control':
        // ignore this breakpoint hint - Anthropic only
        break;

      default:
        const _exhaustiveCheck: never = part;
        throw new Error(`Unsupported part type in System message: ${(part as any).pt}`);
    }
  });
  const requestInstructions: TRequest['instructions'] = instructionsParts.length ? aixTexts_to_OpenAIInstructionText(instructionsParts) : undefined;


  // We decide to adopt these schemas for the conversion (API gives us a few choices)
  const chatMessages: (UserMessage | ModelMessage | FunctionCallMessage | FunctionCallOutputMessage | ReasoningMessage | CodeInterpreterCallMessage)[] = [];
  type UserMessage = Omit<OpenAIWire_Responses_Items.UserItemMessage, 'role'> & { role: 'user' };
  type ModelMessage = Extract<OpenAIWire_Responses_Items.InputMessage_Compat, { role: 'assistant' }>;
  type FunctionCallMessage = OpenAIWire_Responses_Items.OutputFunctionCallItem;
  type FunctionCallOutputMessage = OpenAIWire_Responses_Items.FunctionToolCallOutput;
  type ReasoningMessage = OpenAIWire_Responses_Items.OutputReasoningItem;
  type CodeInterpreterCallMessage = Extract<OpenAIWire_Responses_Items.InputItem, { type: 'code_interpreter_call' }>;

  let allowUserAppend = true;

  function userMessage() {
    // Ensure the last message is a user message, or create a new one
    let lastMessage = chatMessages.length ? chatMessages[chatMessages.length - 1] : undefined;
    if (allowUserAppend && lastMessage && lastMessage.type === 'message' && lastMessage.role === 'user')
      return lastMessage;
    const newMessage: UserMessage = {
      type: 'message',
      role: 'user',
      content: [],
    };
    chatMessages.push(newMessage);
    allowUserAppend = true;
    return newMessage;
  }

  function modelMessage(phase?: 'commentary' | 'final_answer') {
    // Reuse the last assistant message only when the phase matches; a mismatch (incl. tagged vs untagged)
    // starts a new message item, mirroring the upstream item boundaries.
    let lastMessage = chatMessages.length ? chatMessages[chatMessages.length - 1] : undefined;
    if (lastMessage && lastMessage.type === 'message' && lastMessage.role === 'assistant' && lastMessage.phase === phase)
      return lastMessage;
    const newMessage: ModelMessage = {
      type: 'message',
      role: 'assistant',
      content: [],
      ...(phase ? { phase } : {}), // assistant-only field, resent verbatim on replay
    };
    chatMessages.push(newMessage);
    return newMessage;
  }

  function newFunctionCallMessage(callId: string, functionName: string, functionArguments: string) {
    const newMessage: FunctionCallMessage = {
      type: 'function_call',
      call_id: callId,
      name: functionName,
      arguments: functionArguments,
    };
    chatMessages.push(newMessage);
    return newMessage;
  }

  function newReasoningMessage(itemId: string | undefined, encryptedContent: string | undefined) {
    // Stateless multi-turn continuity: echo a reasoning item back so the model can resume its prior
    // thought KV state. In stateful mode (store=true + previous_response_id) the id alone is enough;
    // in stateless mode (our default) the encrypted_content is what the provider actually decodes.
    const newMessage: ReasoningMessage = {
      type: 'reasoning',
      ...(itemId ? { id: itemId } : {}),
      summary: [], // display-only, never part of the continuity contract
      ...(encryptedContent ? { encrypted_content: encryptedContent } : {}),
    };
    chatMessages.push(newMessage);
    return newMessage;
  }

  function newFunctionCallOutputMessage(callId: string, functionOutputJson: string) {
    const newMessage: FunctionCallOutputMessage = {
      type: 'function_call_output',
      call_id: callId,
      output: functionOutputJson,
    };
    chatMessages.push(newMessage);
    return newMessage;
  }

  // The following 2 functions are to recreate native code execution (which includes the output) blocks
  function newCodeInterpreterCallMessage(itemId: string, containerId: string, code: string) {
    // Round-trip the hosted call as its canonical 'code_interpreter_call' item (not a fake 'execute_code' function_call):
    // this also satisfies stateless reasoning's "a reasoning item must be followed by the item it produced" constraint.
    // Caller gates on a live container, so container_id is always present (OpenAI rejects the item without it).
    // PROVENANCE: containerId is the chat-wide most-recent (sessionContainerId), not each item's original sandbox -
    // auto-mode still reuses the live container, but the replayed history isn't per-execution faithful.
    const newMessage: CodeInterpreterCallMessage = {
      type: 'code_interpreter_call',
      id: itemId,
      code: code,
      container_id: containerId,
      status: 'completed',
    };
    chatMessages.push(newMessage);
    return newMessage;
  }

  function attachCodeInterpreterCallOutputs(itemId: string, result: string, isError: boolean) {
    // Merge the paired tool_response's logs into the 'code_interpreter_call' item created above (matched by id).
    // There is no separate output item type for code interpreter, so outputs live on the call item itself.
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const candidate = chatMessages[i];
      if (candidate.type === 'code_interpreter_call' && candidate.id === itemId) {
        if (result)
          candidate.outputs = [{ type: 'logs', logs: result }];
        candidate.status = isError ? 'failed' : 'completed';
        return;
      }
    }
    // Orphaned: a code_execution response should always follow its paired invocation - if not, fragments got separated upstream.
    console.warn(`[DEV] AIX: OpenAI Responses - orphaned code_execution response (id=${itemId}), dropping outputs`);
  }


  /**
   * Input Messages
   *
   * Conversion from the AIX input format to the OpenAI Responses Input format is straightforward.
   *
   * - user messages will be converted to the new Input Item format (which doesn't need IDs)
   * - assistant messages to the old Input Message format (which doesn't need IDs)
   *
   */
  for (const aixMessage of chatSequence) {
    const { role: messageRole, parts: messageParts } = aixMessage;

    switch (messageRole) {
      case 'user':
        for (const userPart of messageParts) {
          const uPt = userPart.pt;
          switch (uPt) {

            case 'text':
              userMessage().content.push({
                type: 'input_text',
                text: userPart.text,
              });
              break;

            case 'doc':
              const docText = userPart.data.text.startsWith('```') ? userPart.data.text : approxDocPart_To_String(userPart);
              userMessage().content.push({
                type: 'input_text',
                text: docText,
              });
              break;

            case 'inline_image':
              // create a new OpenAIWire_ImageContentPart
              const { mimeType, base64 } = userPart;
              const base64DataUrl = `data:${mimeType};base64,${base64}`;
              userMessage().content.push({
                type: 'input_image',
                detail: 'high', // TODO: check if user images shall always be 'high' detail
                image_url: base64DataUrl,
              });
              break;

            case 'media_url':
              // URL-referenced video: no native lowering - honest text degradation
              userMessage().content.push({
                type: 'input_text',
                text: approxMediaUrlPart_To_String(userPart),
              });
              break;

            case 'meta_in_reference_to':
              userMessage().content.push({
                type: 'input_text',
                text: aixMetaRef_to_OpenAIText(userPart),
              });
              break;

            case 'meta_cache_control':
              // ignored - Anthropic only
              break;

            default:
              const _exhaustiveCheck: never = uPt;
              throw new Error(`Unsupported part type in User message: ${uPt}`);
          }
        }

        // If this message shall be flushed, disallow append once next
        allowUserAppend = !aixSpillShallFlush(aixMessage);
        break;

      case 'model':
        for (const modelPart of messageParts) {
          const mPt = modelPart.pt;
          switch (mPt) {

            case 'text':
              modelMessage(emitMessagePhase ? modelPart._vnd?.[vndNamespace]?.phase : undefined).content.push({
                type: 'output_text',
                text: modelPart.text,
              });
              break;

            case 'inline_audio':
              // Workaround for OpenAI Responses API: - TODO: verify if this is still needed
              // - audio (file) parts are not supported on the assistant side, but on the user side, so we upload as user

              // create a new OpenAI_AudioContentPart of type User
              // const audioFormat = _toOpenAIAudioFormat(modelPart);
              const audioBase64DataUrl = `data:${modelPart.mimeType};base64,${modelPart.base64}`;
              userMessage().content.push({
                type: 'input_file',
                file_data: audioBase64DataUrl,
              });
              break;

            case 'inline_image':
              // Workaround: as User part - TODO: verify if this is still needed
              const { mimeType, base64 } = modelPart;
              const base64DataUrl = `data:${mimeType};base64,${base64}`;
              userMessage().content.push({
                type: 'input_image',
                detail: 'high', // TODO: check if model images shall always be 'high' detail
                image_url: base64DataUrl,
              });
              break;

            case 'tool_invocation':
              const invocation = modelPart.invocation;
              const invocationType = invocation.type;
              switch (invocationType) {
                case 'function_call':
                  newFunctionCallMessage(modelPart.id, invocation.name, invocation.args || '');
                  break;
                case 'code_execution':
                  // A 'code_interpreter_call' input item REQUIRES a container_id that still exists upstream (omitting it
                  // 400s with "Missing required parameter: 'input[..].container_id'"; a stale id 404s). We only have a live
                  // one when sessionContainerId is set. Without it - idle/expired, OR the prior execution was another
                  // vendor's container (e.g. Gemini, stored as 'vnd.gem.interactions') - fall back to the container-
                  // independent 'execute_code' function_call, which carries the code as context with no container dependency.
                  if (sessionContainerId)
                    newCodeInterpreterCallMessage(modelPart.id, sessionContainerId, invocation.code || '');
                  else
                    newFunctionCallMessage(modelPart.id, 'execute_code', invocation.code || '');
                  break;
                default:
                  const _exhaustiveCheck: never = invocation;
                  throw new Error(`Unsupported tool call type in Model message: ${mPt}`);
              }
              break;

            case 'ma':
              // Preserve reasoning continuity across turns via _vnd.<vndNamespace>.reasoningItem (set by openai.responses.parser,
              // tagged with the producing Responses dialect - blobs never cross providers).
              // Round-trip ONLY when both encrypted_content AND id are present (canonical, complete handle).
              // - bare id without EC -> 404 "Item with id rs_... not found" in stateless mode
              // - bare EC without id -> torn handle, undefined behavior across providers/versions
              // Defense-in-depth: matches the parser's capture gate; rejects torn handles even if any sneak through.
              // ma fragments without an openai handle are common (e.g., DeepSeek reasoning_content emits ma fragments
              // with no continuity blob) - skip without warning to avoid log noise on cross-vendor history.
              const rspReasoning = modelPart._vnd?.[vndNamespace]?.reasoningItem;
              if (rspReasoning?.encryptedContent && rspReasoning?.id)
                newReasoningMessage(rspReasoning.id, rspReasoning.encryptedContent);
              break;

            case 'tool_response':
              const toolResponseType = modelPart.response.type;
              switch (toolResponseType) {
                case 'function_call':
                  const { result: functionCallOutput } = modelPart.response;
                  newFunctionCallOutputMessage(modelPart.id, functionCallOutput);
                  break;
                case 'code_execution':
                  // Mirror the invocation's representation (same sessionContainerId gate): merge outputs into the
                  // code_interpreter_call when live, else emit a plain function_call_output for the 'execute_code' fallback.
                  if (sessionContainerId)
                    attachCodeInterpreterCallOutputs(modelPart.id, modelPart.response.result, !!modelPart.error);
                  else
                    newFunctionCallOutputMessage(modelPart.id, modelPart.response.result);
                  break;
                default:
                  const _exhaustiveCheck: never = toolResponseType;
                  throw new Error(`Unsupported tool response type in Model message: ${mPt}/${toolResponseType}`);
              }
              break;

            case 'meta_cache_control':
              // ignored - Anthropic only
              break;

            default:
              const _exhaustiveCheck: never = mPt;
              throw new Error(`Unsupported part type in Model message: ${mPt}`);
          }
        }
        break;

      default:
        const _exhaustiveCheck: never = messageRole;
        break;
    }
  }

  // return the instruction and input sequence
  return {
    requestInstructions,
    requestInput: chatMessages,
  };
}

/**
 * Anti-wedge: a `function_call` item with no `function_call_output` for its call_id is a 400 ("No
 * tool output found for function call ...") that rejects the whole request. The orphan lives in
 * stored history (a run that failed/aborted before the tool ran, or a tool no client processor
 * claimed), so every later turn replays it and gets the same 400 - the conversation is bricked
 * until the message is deleted.
 *
 * Synthesizes the stub prescribed in kb/modules/AIX-stateless-roundtrip-retention.md (cat-1), which
 * also retro-heals conversations already poisoned in users' stores. No-op when well-formed.
 * The LAST item is skipped: a trailing call is the in-flight call of an agentic loop.
 * Hosted calls (code_interpreter_call and friends) carry their own outputs and are untouched.
 */
function _pairInteriorFunctionCalls(requestInput: TRequestInput[]): void {

  // outputs may sit anywhere after their call, so collect them all first
  const answeredIds = new Set<string>();
  for (const item of requestInput)
    if ('type' in item && item.type === 'function_call_output')
      answeredIds.add(item.call_id);

  for (let i = requestInput.length - 2; i >= 0; i--) {
    const item = requestInput[i];
    if (!('type' in item) || item.type !== 'function_call') continue;
    if (answeredIds.has(item.call_id)) continue;

    // insert right after the call, the canonical position for its output
    console.warn(`[OpenAI Responses] Pairing an orphan function_call with a placeholder output (input.${i})`);
    requestInput.splice(i + 1, 0, { type: 'function_call_output', call_id: item.call_id, output: AIX_MISSING_TOOL_RESULT_TEXT });
  }
}

function _toOpenAIResponsesTools(itds: AixTools_ToolDefinition[], strictToolInvocations: boolean): NonNullable<TRequestTool[]> {
  return itds.map(itd => {
    const itdType = itd.type;
    switch (itdType) {

      case 'function_call':
        const { name, description, input_schema } = itd.function_call;
        return {
          type: 'function',
          name: name,
          description: description,
          parameters: {
            type: 'object',
            properties: input_schema?.properties ?? {},
            required: input_schema?.required,
            ...(strictToolInvocations ? { additionalProperties: false } : {}), // required for strict tool invocations
          },
          ...(strictToolInvocations ? { strict: true } : {}), // enable strict (grammar-constrained) tool invocation inputs
        };

      case 'code_execution':
        throw new Error('Gemini code interpreter is not supported');

      default:
        // const _exhaustiveCheck: never = itdType;
        throw new Error(`OpenAI (Responses API) unsupported tool: ${itdType}`);

    }
  });
}

function _toOpenAIResponsesToolChoice(itp: AixTools_ToolsPolicy, onlyAuto: boolean): NonNullable<TRequest['tool_choice']> {
  // NOTE: we don't support forcing hosted tools yet
  const itpType = itp.type;
  switch (itpType) {
    case 'auto':
      return 'auto';
    case 'any':
      // [Meta AI] only 'auto' is accepted ('none', 'required' and named choices 400 - verified 2026-09-02): degrade rather
      // than reject the request; the tool descriptions still steer the model
      return onlyAuto ? 'auto' : 'required';
    // DISABLED 2026-07-17 - forced named tool, see ToolsPolicy_schema
    // case 'function_call':
    //   return { type: 'function' as const, name: itp.function_call.name };
    default:
      const _exhaustiveCheck: never = itpType;
      throw new Error(`Unsupported tools policy type: ${itpType}`);
  }
}

/**
 * Adds GPT-5 specific markdown instructions to Responses API payload.
 *
 * Background:
 * GPT-5 benefits from explicit markdown formatting guidance per the GPT-5 prompting guide.
 * This function adds the recommended markdown instructions to the instructions field.
 *
 * References:
 * - GPT-5 prompting guide markdown section
 */
export function vndOaiRestoreMarkdown(payload: TRequest) {
  const MARKDOWN_INSTRUCTION = 'Formatting re-enabled. Use Markdown **only where semantically correct** (e.g., `inline code`, ```code fences```, lists, tables). When using markdown, use backticks to format file, directory, function, and class names. Use \\( and \\) for inline math, \\[ and \\] for block math.';
  const MARKDOWN_CHECK = 'Use Markdown **only where semantically correct**';

  if (payload.instructions && !payload.instructions.includes(MARKDOWN_CHECK))
    payload.instructions = MARKDOWN_INSTRUCTION + '\n' + payload.instructions;
  else if (!payload.instructions)
    payload.instructions = MARKDOWN_INSTRUCTION;
}

