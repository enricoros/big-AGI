import type { OpenAIDialects } from '~/modules/llms/server/openai/openai.router';

import { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixMessages_SystemMessage, AixTools_ToolDefinition, AixTools_ToolsPolicy } from '../../../api/aix.wiretypes';
import { OpenAIWire_API_Responses, OpenAIWire_Responses_Items, OpenAIWire_Responses_Tools } from '../../wiretypes/openai.wiretypes';

import { aixDocPart_to_OpenAITextContent, aixMetaRef_to_OpenAIText, aixTexts_to_OpenAIInstructionText } from './openai.chatCompletions';
import { aixSpillShallFlush, aixSpillSystemToUser, approxDocPart_To_String } from './adapters.common';


// configuration
const OPENAI_RESPONSES_DEFAULT_TRUNCATION: TRequest['truncation'] = undefined;


type TRequest = OpenAIWire_API_Responses.Request;
type TRequestInput = OpenAIWire_Responses_Items.InputItem;
type TRequestTool = OpenAIWire_Responses_Tools.Tool;


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
  jsonOutput: boolean,
  streaming: boolean,
  enableResumability: boolean,
): TRequest {

  // Pre-process CGR - approximate spill of System to User message
  const chatGenerate = aixSpillSystemToUser(_chatGenerate);

  // [OpenAI] Vendor-specific model checks
  const isOpenAIOFamily = ['gpt-6', 'gpt-5', 'o4', 'o3', 'o1'].some(_id => model.id === _id || model.id.startsWith(_id + '-'));
  const isOpenAIChatGPT = ['gpt-5-chat'].some(_id => model.id === _id || model.id.startsWith(_id + '-'));
  const isOpenAIComputerUse = model.id.includes('computer-use');
  const isOpenAIO1Pro = model.id === 'o1-pro' || model.id.startsWith('o1-pro-');

  const hotFixNoTemperature = isOpenAIOFamily && !isOpenAIChatGPT;
  const hotFixNoTruncateAuto = isOpenAIComputerUse;

  const isDialectAzure = openAIDialect === 'azure';

  // ---
  // construct the request payload
  // NOTE: the zod parsing will remove the undefined values from the upstream request, enabling an easier construction
  // ---

  const { requestInput, requestInstructions } = _toOpenAIResponsesRequestInput(chatGenerate.systemMessage, chatGenerate.chatSequence);
  const payload: TRequest = {

    // Model configuration
    model: model.id,
    max_output_tokens: model.maxTokens ?? undefined, // response if unset: null
    temperature: !hotFixNoTemperature ? model.temperature ?? undefined : undefined,
    // top_p: ... below (alternative to temperature)

    // Input
    instructions: requestInstructions,
    input: requestInput,

    // Tools
    tools: chatGenerate.tools && _toOpenAIResponsesTools(chatGenerate.tools),
    tool_choice: chatGenerate.toolsPolicy && _toOpenAIResponsesToolChoice(chatGenerate.toolsPolicy),
    // parallel_tool_calls: undefined, // response if unset: true

    // Operations Config
    reasoning: !model.vndOaiReasoningEffort ? undefined : {
      effort: model.vndOaiReasoningEffort,
      summary: !isOpenAIO1Pro ? 'detailed' : 'auto', // elevated from 'auto' (o1-pro still at 'auto')
    },

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

  // JSON output: not implemented yet - will need a schema definition (similar to the tool args definition)
  if (jsonOutput) {
    console.warn('[DEV] notImplemented: responses: jsonOutput');
    // payload.text = {
    //   format: {
    //     type: 'json_schema',
    //   },
    // };
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
  const hasRestrictivePolicy = chatGenerate.toolsPolicy?.type === 'any' || chatGenerate.toolsPolicy?.type === 'function_call';
  const skipHostedToolsDueToCustomTools = hasCustomTools && hasRestrictivePolicy;

  // Tool: Web Search: for search and deep research models
  const requestWebSearchTool = !!model.vndOaiWebSearchContext || !!model.userGeolocation;
  if (requestWebSearchTool && !skipHostedToolsDueToCustomTools) {
    /**
     * NOTE: as of 2025-09-12, we still get the "Hosted tool 'web_search' is not supported with gpt-5-mini-2025-08-07"
     *       warning from Azure OpenAI V1. We shall check in the future if this is resolved.
     */
    if (isDialectAzure) {
      // [2025-11-18] Azure OpenAI still doesn't support web search tool yet - confirmed
      // [2025-09-12] Azure OpenAI doesn't support web search tool yet, and we also remove the "parameter" so we shall not come here
      console.log('[DEV] Azure OpenAI Responses: skipping web search tool due to Azure limitations');
    } else if (payload.reasoning?.effort === 'minimal') {
      // Web search is not supported when the reasoning effort is 'minimal'
      // console.log('[DEV] OpenAI Responses: skipping web search tool due to reasoning effort being set to minimal');
    } else {

      // Add the web search tool to the request
      if (!payload.tools?.length)
        payload.tools = [];
      const webSearchTool: TRequestTool = {
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
    const azureImageWorkarounds = isDialectAzure;
    if (azureImageWorkarounds)
      console.warn('[DEV] Azure OpenAI Responses: trying image generation tool despite Azure limitations');

    // Add the image generation tool to the request
    if (!payload.tools?.length)
      payload.tools = [];

    // Map enum values to tool configuration
    const imageMode = model.vndOaiImageGeneration;
    const imageGenerationTool: Extract<TRequestTool, { type: 'image_generation' }> = {
      type: 'image_generation',
      ...(imageMode === 'mq' ? { quality: 'medium' } : { /* quality: 'high' -- auto */ }),
      // ...(imageMode === 'hq' ? ... auto ... ),
      ...(imageMode === 'hq_edit' && { input_fidelity: 'high' }),
      ...(imageMode !== 'hq_png' && !azureImageWorkarounds && { output_format: 'webp' }),
      moderation: 'low',
    };
    payload.tools.push(imageGenerationTool);
  }


  // [OpenAI] Vendor-specific restore markdown, for GPT-5 models and recent 'o' models
  const skipMarkdownDueToCustomTools = hasCustomTools && hasRestrictivePolicy;
  if (model.vndOaiRestoreMarkdown && !skipMarkdownDueToCustomTools)
    vndOaiRestoreMarkdown(payload);


  // Preemptive error detection with server-side payload validation before sending it upstream
  // this includes stripping 'undefined' fields
  const validated = OpenAIWire_API_Responses.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.warn('[DEV] OpenAI: invalid Responses request payload. Error:', { error: validated.error });
    throw new Error(`Invalid sequence for OpenAI models: ${validated.error.issues?.[0]?.message || validated.error.message || validated.error}.`);
  }

  return validated.data;
}


function _toOpenAIResponsesRequestInput(systemMessage: AixMessages_SystemMessage | null, chatSequence: AixMessages_ChatMessage[]): { requestInput: TRequestInput[], requestInstructions: TRequest['instructions'] } {

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
  const chatMessages: (UserMessage | ModelMessage | FunctionCallMessage | FunctionCallOutputMessage)[] = [];
  type UserMessage = Omit<OpenAIWire_Responses_Items.UserItemMessage, 'role'> & { role: 'user' };
  type ModelMessage = Extract<OpenAIWire_Responses_Items.InputMessage_Compat, { role: 'assistant' }>;
  type FunctionCallMessage = OpenAIWire_Responses_Items.OutputFunctionCallItem;
  type FunctionCallOutputMessage = OpenAIWire_Responses_Items.FunctionToolCallOutput;

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

  function modelMessage() {
    // Ensure the last message is a model message, or create a new one
    let lastMessage = chatMessages.length ? chatMessages[chatMessages.length - 1] : undefined;
    if (lastMessage && lastMessage.type === 'message' && lastMessage.role === 'assistant')
      return lastMessage;
    const newMessage: ModelMessage = {
      type: 'message',
      role: 'assistant',
      content: [],
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

  function newFunctionCallOutputMessage(callId: string, functionOutputJson: string) {
    const newMessage: FunctionCallOutputMessage = {
      type: 'function_call_output',
      call_id: callId,
      output: functionOutputJson,
    };
    chatMessages.push(newMessage);
    return newMessage;
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
              modelMessage().content.push({
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
                  console.warn('[DEV] notImplemented: OpenAI Responses: code execution tool calls');
                  newFunctionCallMessage(modelPart.id, 'execute_code', invocation.code || '');
                  break;
                default:
                  const _exhaustiveCheck: never = invocation;
                  throw new Error(`Unsupported tool call type in Model message: ${mPt}`);
              }
              break;

            case 'ma':
              // TODO: support this in the future - may contain the encrypted reasoning data, although we don't parse this yet
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

      case 'tool':
        for (const toolPart of messageParts) {
          const tPt = toolPart.pt;
          switch (tPt) {

            case 'tool_response':
              const toolResponseType = toolPart.response.type;
              switch (toolResponseType) {
                case 'function_call':
                  const { result: functionCallOutput } = toolPart.response;
                  newFunctionCallOutputMessage(toolPart.id, functionCallOutput);
                  break;
                case 'code_execution':
                  const { result: codeExecutionOutput } = toolPart.response;
                  newFunctionCallOutputMessage(toolPart.id, codeExecutionOutput);
                  break;
                default:
                  const _exhaustiveCheck: never = toolResponseType;
                  throw new Error(`Unsupported tool response type in Tool message: ${tPt}/${toolResponseType}`);
              }
              break;

            case 'meta_cache_control':
              // ignored - Anthropic only
              break;

            default:
              const _exhaustiveCheck: never = tPt;
              throw new Error(`Unsupported part type in Tool message: ${tPt}`);
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

function _toOpenAIResponsesTools(itds: AixTools_ToolDefinition[]): NonNullable<TRequestTool[]> {
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
          },
        };

      case 'code_execution':
        throw new Error('Gemini code interpreter is not supported');

      default:
        // const _exhaustiveCheck: never = itdType;
        throw new Error(`OpenAI (Responses API) unsupported tool: ${itdType}`);

    }
  });
}

function _toOpenAIResponsesToolChoice(itp: AixTools_ToolsPolicy): NonNullable<TRequest['tool_choice']> {
  // NOTE: we don't support forcing hosted tools yet
  const itpType = itp.type;
  switch (itpType) {
    case 'auto':
      return 'auto';
    case 'any':
      return 'required';
    case 'function_call':
      return { type: 'function' as const, name: itp.function_call.name };
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

