import * as z from 'zod/v4';

import type { AnthropicHostedFeatures } from '~/modules/llms/server/anthropic/anthropic.access';

import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixTools_ToolDefinition, AixTools_ToolsPolicy } from '../../../api/aix.wiretypes';
import { AnthropicWire_API_Message_Create, AnthropicWire_Blocks } from '../../wiretypes/anthropic.wiretypes';

import { aixSpillShallFlush, aixSpillSystemToUser, approxDocPart_To_String, approxInReferenceTo_To_XMLString } from './adapters.common';


// configuration
// const DEFAULT_WEB_FETCH_MAX_USES = 5; // we don't set a default anymore, we let it be
// const DEFAULT_WEB_SEARCH_MAX_USES = 10; // we don't set a default anymore, we let it be
const hotFixImagePartsFirst = true;
const hotFixMapModelImagesToUser = true;
const hotFixDisableThinkingWhenToolsForced = true; // "Thinking may not be enabled when tool_choice forces tool use."
const hotFixAntSeparateContiguousThinkingBlocks = true; // Interleave continuous thinking blocks (without aText) with the following text block, instead of merging them into a single block - should be more robust to unexpected thinking block formats and to changes in the thinking block format, as we have seen some variations and we might see more in the future
// const hotFixAntShipNoEmptyTextBlocks = true; // If empty text blocks are found (e.g. produced by the API), do not ship them or things will break

// former fixes, now removed
// const hackyHotFixStartWithUser = false; // 2024-10-22: no longer required


type TRequest = AnthropicWire_API_Message_Create.Request;


/**
 * Determines which Anthropic hosted features will be active for a request.
 * Single source of truth for both the request builder (tools, container) and the dispatch (beta headers).
 */
export function aixAnthropicHostedFeatures(model: AixAPI_Model, chatGenerate: AixAPIChatGenerate_Request): AnthropicHostedFeatures {

  // Allow/deny auto-adding hosted tools when custom tools are present with a restrictive policy
  const _hasAixCustomTools = chatGenerate.tools?.some(t => t.type === 'function_call');
  const _hasAixToolRestrictivePolicy = chatGenerate.toolsPolicy?.type === 'any' || chatGenerate.toolsPolicy?.type === 'function_call';

  // Dynamic web tools (20260209) require code execution for programmatic tool calling
  // const hasDynamicWebTools = model.vndAntWebDynamic === true && (model.vndAntWebSearch === 'auto' || model.vndAntWebFetch === 'auto');

  // Programmatic Tool Calling - tools with allowed_callers or input_examples
  const programmaticToolCalling = chatGenerate.tools?.some(tool =>
    tool.type === 'function_call' && (
      tool.function_call.allowed_callers?.includes('code_execution') ||
      (tool.function_call.input_examples && tool.function_call.input_examples.length > 0)
    ),
  ) ?? false;

  // [Anthropic] Code execution (the explicit code_execution_20260120 tool + container) is triggered
  // three ways, all converging on ONE explicit container: the standalone Code Sandbox toggle (a
  // general-purpose hosted-container sandbox), Skills (which run inside the container), and Programmatic Tool Calling
  // (which uses the container as its script executor).
  // Dynamic web tools (_20260209) have their OWN internal code execution. We never AUTO-enable the
  // standalone tool from them (#1087: a 2nd implicit environment is parasitic), nor from container
  // continuity alone. We DO honor an explicit user toggle even alongside dynamic web: Anthropic's
  // docs note this can create two execution environments that may confuse the model (mitigable via
  // system prompt) - https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools#dynamic-filtering-with-code-execution
  return {
    disableAllHostedTools: !!(_hasAixCustomTools && _hasAixToolRestrictivePolicy),
    enable1MContext: model.vndAnt1MContext === true,
    enableCodeExecution:
      model.vndAntCodeSandbox === 'auto' || // standalone user toggle (general-purpose hosted-container sandbox)
      !!model.vndAntSkills || // Skills execute inside the code execution container
      // || hasDynamicWebTools // NOT auto-enabled - dynamic web executes code internally; see note above
      // || !!model.vndAntContainerId // NOT re-enabled just for continuity - parasitic: https://github.com/enricoros/big-AGI/issues/1087#issuecomment-4340352958
      programmaticToolCalling, // PTC uses the container as its script executor
    enableFastMode: model.vndAntInfSpeed === 'fast',
    enableSkills: !!model.vndAntSkills,
    enableStrictOutputs: !!model.strictJsonOutput || !!model.strictToolInvocations,
    enableToolAdvanced20251120: !!model.vndAntToolSearch || programmaticToolCalling,
    modelIdForPerModelFeatures: model.id,
  };
}

export function aixToAnthropicMessageCreate(model: AixAPI_Model, _chatGenerate: AixAPIChatGenerate_Request, streaming: boolean, hostedFeatures: ReturnType<typeof aixAnthropicHostedFeatures>): TRequest {

  // Pre-process CGR - approximate spill of System to User message
  const chatGenerate = aixSpillSystemToUser(_chatGenerate);

  // Convert the system message
  let systemMessage: TRequest['system'] = undefined;
  if (chatGenerate.systemMessage?.parts.length) {
    systemMessage = chatGenerate.systemMessage.parts.reduce((acc, part) => {
      switch (part.pt) {

        case 'text':
          acc.push(AnthropicWire_Blocks.TextBlock(part.text, 'system.text'));
          break;

        case 'doc':
          acc.push(AnthropicWire_Blocks.TextBlock(approxDocPart_To_String(part), 'system.doc'));
          break;

        case 'inline_image':
          // we have already removed image parts from the system message
          throw new Error('Anthropic: images have to be in user messages, not in system message');

        case 'meta_cache_control':
          if (!acc.length)
            console.warn('Anthropic: cache_control without a message to attach to');
          else if (part.control !== 'anthropic-ephemeral')
            console.warn('Anthropic: cache_control with an unsupported value:', part.control);
          else
            AnthropicWire_Blocks.blockSetCacheControl(acc[acc.length - 1], 'ephemeral');
          break;

        default:
          const _exhaustiveCheck: never = part;
          throw new Error(`Unsupported part type in System message: ${(part as any).pt}`);
      }
      return acc;
    }, [] as Exclude<TRequest['system'], undefined>);

    // unset system message if empty
    if (!systemMessage.length)
      systemMessage = undefined;
  }

  // Transform the chat messages into Anthropic's format
  const chatMessages: TRequest['messages'] = [];
  let currentMessage: TRequest['messages'][number] | null = null;
  for (const aixMessage of chatGenerate.chatSequence) {
    for (const antPart of _generateAnthropicMessagesContentBlocks(aixMessage)) {
      // apply cache_control to the current head block of the current message
      if ('set_cache_control' in antPart) {
        if (currentMessage && currentMessage.content.length) {
          const lastBlock = currentMessage.content[currentMessage.content.length - 1];
          if (lastBlock.type !== 'thinking' && lastBlock.type !== 'redacted_thinking')
            AnthropicWire_Blocks.blockSetCacheControl(lastBlock, 'ephemeral');
          else
            console.warn('Anthropic: cache_control on a thinking block - not allowed');
        } else
          console.warn('Anthropic: cache_control without a message to attach to');
        continue;
      }
      // create a new message if the role changes, otherwise append as a new content block
      const { role, content } = antPart;
      if (!currentMessage || currentMessage.role !== role) {
        if (currentMessage)
          chatMessages.push(currentMessage);
        currentMessage = { role, content: [] };
      }

      // Hotfix Opus-4.6: a new thinking block cannot follow a thinking or redacted_thinking block directly
      // (redacted_thinking after thinking is fine - that's the normal pattern)
      if (hotFixAntSeparateContiguousThinkingBlocks && content.type === 'thinking' && currentMessage.content.length) {
        const lastBlock = currentMessage.content[currentMessage.content.length - 1];
        if (lastBlock.type === 'thinking' || lastBlock.type === 'redacted_thinking') {
          // FIXME: this happens because some intermediate 'tool requests + responses' may have been skipped, so thinking messages became contiguous
          console.log(`[DEV] Anthropic: 🔷 Separating contiguous ${lastBlock.type} -> thinking with text separator`);
          currentMessage.content.push(AnthropicWire_Blocks.TextBlock('\n', 'hotfix.thinking-separator'));
        }
      }

      currentMessage.content.push(content);
    }

    // Flush: interrupt batching within the same-role and finalize the current message
    if (aixSpillShallFlush(aixMessage) && currentMessage) {
      chatMessages.push(currentMessage);
      currentMessage = null;
    }
  }
  if (currentMessage)
    chatMessages.push(currentMessage);

  // If the first (user) message is missing, copy the first line of the system message
  // [Anthropic] October 8th, 2024 release notes: "...we no longer require the first input message to be a user message."
  // if (hackyHotFixStartWithUser && chatMessages.length && chatMessages[0].role !== 'user' && systemMessage?.length) {
  //   const hackSystemMessageFirstLine = (systemMessage[0]?.text || '').split('\n')[0];
  //   chatMessages.unshift({ role: 'user', content: [AnthropicWire_Blocks.TextBlock(hackSystemMessageFirstLine)] });
  //   console.log(`Anthropic: hotFixStartWithUser (${chatMessages.length} messages) - ${hackSystemMessageFirstLine}`);
  // }

  // [Anthropic, 2025-11-13] constrained output modes - both JSON and tool invocations
  const strictToolsEnabled = !!model.strictToolInvocations;
  // [Anthropic, 2025-11-24] Tool Search Tool - when enabled, all custom tools get defer_loading: true
  const toolSearchEnabled = !!model.vndAntToolSearch;

  // Construct the request payload
  const payload: TRequest = {
    max_tokens: model.maxTokens !== undefined ? model.maxTokens : 8192,
    model: model.id,
    system: systemMessage,
    messages: chatMessages,
    tools: chatGenerate.tools && _toAnthropicTools(chatGenerate.tools, strictToolsEnabled, toolSearchEnabled),
    tool_choice: chatGenerate.toolsPolicy && _toAnthropicToolChoice(chatGenerate.toolsPolicy),
    // metadata: { user_id: ... }
    // stop_sequences: undefined,
    stream: streaming,
    ...(model.temperature !== null ? { temperature: model.temperature !== undefined ? model.temperature : undefined } : {}),
    // top_k: undefined,
    // top_p: undefined,
  };

  // Top-P instead of temperature (Opus 4.7+: HOTFIX_NoTemperature sets temperature=null; also strip top_p to avoid the 400)
  if (model.topP !== undefined && model.temperature !== null) {
    payload.top_p = model.topP;
    delete payload.temperature;
  }

  // [Anthropic, 2026-06-09] Fable 5 / Mythos 5: adaptive is the only thinking mode - 'enabled' (budget_tokens) and 'disabled' return 400
  const hotFixAdaptiveThinkingOnlyModel = /claude-(fable|mythos)-5/.test(model.id);

  // HOTFIX: Fable/Mythos 5 reject forced tool use: 400 'tool_choice forces tool use is not compatible with this model.'
  // (model-level, regardless of thinking config). Downgrade to 'auto' + a system hint - empirically the model
  // reliably calls the tool when instructed. Forced tool use is deprecated AIX-wide, see ToolsPolicy_schema.
  if (hotFixAdaptiveThinkingOnlyModel && payload.tool_choice && (payload.tool_choice.type === 'any' || payload.tool_choice.type === 'tool')) {
    const mustUseHint = payload.tool_choice.type === 'tool'
      ? `IMPORTANT: You MUST respond by calling the \`${payload.tool_choice.name}\` tool. Do not respond with text.`
      : 'IMPORTANT: You MUST respond by calling one of the provided tools. Do not respond with text.';
    console.log(`[Anthropic] ${model.id}: coercing tool_choice '${payload.tool_choice.type}' -> 'auto' (forced tool use rejected by this model)`);
    payload.tool_choice = { type: 'auto' };
    payload.system = [...(payload.system ?? []), AnthropicWire_Blocks.TextBlock(mustUseHint, 'hotfix.forced-tools')];
    // Forced-tool requests are utility flows (autotitle, diagrams, follow-ups): adaptive thinking cannot be
    // disabled on these models, so default effort to 'low' to bound the thinking spend (caller-overridable)
    if (!model.reasoningEffort)
      payload.output_config = { effort: 'low' };
  }

  // [Anthropic] Thinking: adaptive (4.6+), enabled with budget (≤4.5), or disabled
  const areToolCallsRequired = payload.tool_choice && typeof payload.tool_choice === 'object' && (payload.tool_choice.type === 'any' || payload.tool_choice.type === 'tool');
  const canUseThinking = !areToolCallsRequired || !hotFixDisableThinkingWhenToolsForced;
  if (model.vndAntThinkingBudget !== undefined && canUseThinking) {
    if (model.vndAntThinkingBudget === 'adaptive' || hotFixAdaptiveThinkingOnlyModel) {
      if (model.vndAntThinkingBudget !== 'adaptive')
        console.log(`[Anthropic] ${model.id}: coercing thinking '${model.vndAntThinkingBudget}' -> 'adaptive' (adaptive-only model)`);
      payload.thinking = {
        type: 'adaptive',
        display: 'summarized', // Opus 4.7+ and Fable/Mythos 5 default to 'omitted' - explicit 'summarized' preserves 4.6-era UX (slight latency cost)
      };
      delete payload.temperature;
    } else if (model.vndAntThinkingBudget !== null) {
      payload.thinking = {
        type: 'enabled',
        budget_tokens: model.vndAntThinkingBudget < payload.max_tokens ? model.vndAntThinkingBudget : payload.max_tokens - 1,
        // display: 'summarized', // default on 4.5/earlier
      };
      delete payload.temperature;
    } else {
      payload.thinking = {
        type: 'disabled',
      };
      // NOTE: with thinking disabled, we can still use temperature, so we don't delete it
      //       see the note on llms.parameters.ts: 'llmVndAntThinkingBudget'
    }
  }

  // [Anthropic] Effort parameter
  const reasoningEffort = model.reasoningEffort; // ?? model.vndAntEffort;
  if (reasoningEffort) {
    if (reasoningEffort === 'none' || reasoningEffort === 'minimal') throw new Error(`Anthropic API does not support '${reasoningEffort}' effort level`);
    payload.output_config = {
      effort: reasoningEffort,
    };
  }

  // [Anthropic, 2026-01-29 GA] Structured Outputs - JSON output format (now in output_config.format)
  if (model.strictJsonOutput) {

    // auto-add additionalProperties: false to every object node if not present - required by Anthropic (see _strictNormalizeSchema)
    let schema = model.strictJsonOutput.schema;
    if (schema && typeof schema === 'object')
      schema = _strictNormalizeSchema(schema);
    payload.output_config = {
      ...payload.output_config,
      format: { type: 'json_schema', schema },
    };

    // warn about incompatible features (citations are enabled via web_fetch tool)
    if (model.vndAntWebFetch === 'auto')
      console.warn('[Anthropic] Structured output_config.format may conflict with web_fetch citations');
  }

  // [Anthropic, fast-mode-2026-02-01] Fast inference mode (preview/waitlist)
  if (model.vndAntInfSpeed === 'fast')
    payload.speed = 'fast';


  // --- Tools ---

  // Hosted capabilities - shared logic with dispatch for beta header correctness
  const { disableAllHostedTools, enableCodeExecution } = hostedFeatures;

  // Hosted tools
  if (!disableAllHostedTools) {
    const hostedTools: NonNullable<TRequest['tools']> = [];

    // Web Search Tool - dynamic filtering (20260209) uses internal code execution for better results
    if (model.vndAntWebSearch === 'auto') {
      hostedTools.push({
        type: model.vndAntWebDynamic ? 'web_search_20260209' : 'web_search_20250305',
        name: 'web_search',
        ...(model.vndAntWebSearchMaxUses !== undefined ? { max_uses: model.vndAntWebSearchMaxUses } : {}),
        ...(model.userGeolocation ? {
          user_location: { type: 'approximate' as const, ...model.userGeolocation },
        } : {}),
      });
    }

    // Web Fetch Tool - dynamic filtering (20260209) uses internal code execution for better results
    if (model.vndAntWebFetch === 'auto') {
      hostedTools.push({
        type: model.vndAntWebDynamic ? 'web_fetch_20260209' : 'web_fetch_20250910',
        name: 'web_fetch',
        ...(model.vndAntWebFetchMaxUses !== undefined ? { max_uses: model.vndAntWebFetchMaxUses } : {}),
        citations: { enabled: true },
      });
    }

    // [Anthropic, 2025-11-24] Tool Search Tool(s)
    if (model.vndAntToolSearch === 'regex')
      hostedTools.push({
        type: 'tool_search_tool_regex_20251119',
        name: 'tool_search_tool_regex',
      });
    else if (model.vndAntToolSearch === 'bm25')
      hostedTools.push({
        type: 'tool_search_tool_bm25_20251119',
        name: 'tool_search_tool_bm25',
      });

    // Code execution tool (Anthropic's) - added for the Code Sandbox toggle, Skills, container reuse, and Programmatic Tool Calling.
    // Not AUTO-added for dynamic web tools (_20260209) which execute code internally; an explicit user
    // toggle may still coexist with them by design (see aixAnthropicHostedFeatures note re #1087).
    // Keep _20260120: it matches the code execution version dynamic web auto-injects, so coexisting
    // merges into ONE environment. An older version (e.g. _20250825) 400s: 'tool names must be unique'.
    if (enableCodeExecution)
      hostedTools.push({ type: 'code_execution_20260120', name: 'code_execution' });

    // Merge hosted tools with custom tools
    if (hostedTools.length > 0) {
      payload.tools = payload.tools ? [...payload.tools, ...hostedTools] : hostedTools;
    }
  }

  // --- Container continuity between calls ---
  // Re-attaching the container is DECOUPLED from enableCodeExecution: dynamic web tools (_20260209)
  // use a container internally, and the API accepts a `container` alongside them WITHOUT the standalone
  // code_execution tool (empirically verified). So we keep ONE sandbox across mixed search/skills/code
  // turns - a file written by code execution survives an intervening search turn (verified: ls /tmp). This
  // does NOT add code_execution to dynamic-web turns (so #1087 stays fixed). When nothing container-using
  // is active (no code exec, no skills, no PTC, no dynamic web), no container is sent. Plain (non-dynamic)
  // web search creates no container, so it is intentionally excluded.
  // Retention: a reused container is server-retained ~30 days (same profile as the Skills/code-exec
  // containers we already reuse) - dynamic-web conversations now share one retained sandbox per
  // conversation instead of a fresh one each turn.
  const hasDynamicWeb = model.vndAntWebDynamic === true && (model.vndAntWebSearch === 'auto' || model.vndAntWebFetch === 'auto');

  if (enableCodeExecution || hasDynamicWeb) {

    // Container ID from a previous turn (expiry already checked client-side)
    const containerId = model.vndAntContainerId;

    const skillIds = model.vndAntSkills?.split(',').map(s => s.trim()).filter(s => s);
    if (skillIds?.length) {
      // Reuse or create a container for the skills
      payload.container = {
        ...(containerId ? { id: containerId } : {}),
        skills: skillIds.map((skillId: string) => ({ 
          type: 'anthropic',
          skill_id: skillId,
          version: 'latest',
        })),
      };
    } else if (containerId)
      payload.container = containerId;
  }


  // Preemptive error detection with server-side payload validation before sending it upstream
  const validated = AnthropicWire_API_Message_Create.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.warn('[DEV] Anthropic: invalid messageCreate payload. Error:', { valError: validated.error });
    throw new Error(`Invalid request for Anthropic models: ${z.prettifyError(validated.error)}`);
  }

  return validated.data;
}


function* _generateAnthropicMessagesContentBlocks({ parts, role }: AixMessages_ChatMessage): Generator<{
  role: 'user' | 'assistant',
  content: TRequest['messages'][number]['content'][number]
} | {
  set_cache_control: 'anthropic-ephemeral'
}> {
  if (parts.length < 1) return; // skip empty messages

  if (hotFixImagePartsFirst) {
    parts.sort((a, b) => {
      if (a.pt === 'inline_image' && b.pt !== 'inline_image') return -1;
      if (a.pt !== 'inline_image' && b.pt === 'inline_image') return 1;
      return 0;
    });
  }

  switch (role) {

    case 'user':
      for (const part of parts) {
        switch (part.pt) {

          case 'text':
            yield { role: 'user', content: AnthropicWire_Blocks.TextBlock(part.text, 'user.text') };
            break;

          case 'inline_image':
            yield { role: 'user', content: AnthropicWire_Blocks.ImageBlock(part.mimeType, part.base64) };
            break;

          case 'doc':
            yield { role: 'user', content: AnthropicWire_Blocks.TextBlock(approxDocPart_To_String(part), 'user.doc') };
            break;

          case 'meta_in_reference_to':
            const irtXMLString = approxInReferenceTo_To_XMLString(part);
            if (irtXMLString)
              yield { role: 'user', content: AnthropicWire_Blocks.TextBlock(irtXMLString, 'user.irt') };
            break;

          case 'meta_cache_control':
            yield { set_cache_control: part.control };
            break;

          default:
            throw new Error(`Unsupported part type in User message: ${(part as any).pt}`);
        }
      }
      break;

    case 'model':
      for (const part of parts) {
        switch (part.pt) {

          case 'text':
            yield { role: 'assistant', content: AnthropicWire_Blocks.TextBlock(part.text, 'model.text') };
            break;

          case 'inline_audio':
            // Anthropic does not support inline audio, if we got to this point, we should throw an error
            throw new Error('Model-generated inline audio is not supported by Anthropic yet');

          case 'inline_image':
            // Example of mapping a model-generated image (even from other vendors, not just Anthropic) to a user message
            if (hotFixMapModelImagesToUser) {
              yield { role: 'user', content: AnthropicWire_Blocks.ImageBlock(part.mimeType, part.base64) };
            } else
              throw new Error('Model-generated images are not supported by Anthropic yet');
            break;

          case 'tool_invocation':
            let toolUseBlock;
            switch (part.invocation.type) {
              case 'function_call':
                toolUseBlock = AnthropicWire_Blocks.ToolUseBlock(part.id, part.invocation.name, part.invocation.args);
                break;
              case 'code_execution':
                // wrap the raw code into a dict (Anthropic native code_execution input shape is { code }): ToolUseBlock JSON.parses its
                // input, and Anthropic rejects non-dictionary .input - passing the bare code string would throw on JSON.parse
                toolUseBlock = AnthropicWire_Blocks.ToolUseBlock(part.id, 'execute_code' /* suboptimal */, JSON.stringify({ code: part.invocation.code }));
                break;
              default:
                const _exhaustiveCheck: never = part.invocation;
                throw new Error(`Unsupported tool call type in Model message: ${(part.invocation as any).type}`);
            }
            yield { role: 'assistant', content: toolUseBlock };
            break;

          case 'ma':
            if (!part.aText && !part.textSignature && !part.redactedData) {
              console.warn('Anthropic: broken empty thinking block', { part });
              break;
            }
            // signature-only blocks (empty aText) happen with thinking.display: 'omitted' and must round-trip unchanged
            if (part.textSignature)
              yield { role: 'assistant', content: AnthropicWire_Blocks.ThinkingBlock(part.aText || '', part.textSignature) };
            for (const redactedData of part.redactedData || [])
              yield { role: 'assistant', content: AnthropicWire_Blocks.RedactedThinkingBlock(redactedData) };
            break;

          case 'tool_response':
            const toolErrorPrefix = part.error ? (typeof part.error === 'string' ? `[ERROR] ${part.error} - ` : '[ERROR] ') : '';
            switch (part.response.type) {
              case 'function_call':
                const fcTextParts = [AnthropicWire_Blocks.TextBlock(toolErrorPrefix + part.response.result, 'tool.fc_result')];
                yield { role: 'user', content: AnthropicWire_Blocks.ToolResultBlock(part.id, fcTextParts, part.error ? true : undefined) };
                break;
              case 'code_execution':
                const ceTextParts = [AnthropicWire_Blocks.TextBlock(toolErrorPrefix + part.response.result, 'tool.ce_result')];
                yield { role: 'user', content: AnthropicWire_Blocks.ToolResultBlock(part.id, ceTextParts, part.error ? true : undefined) };
                break;
              default:
                throw new Error(`Unsupported tool response type in Model message: ${(part as any).pt}`);
            }
            break;

          case 'meta_cache_control':
            yield { set_cache_control: part.control };
            break;

          default:
            const _exhaustiveCheck: never = part;
            throw new Error(`Unsupported part type in Model message: ${(part as any).pt}`);
        }
      }
      break;
  }
}

function _toAnthropicTools(itds: AixTools_ToolDefinition[], strictToolsEnabled: boolean, toolSearchToolEnabled: boolean): NonNullable<TRequest['tools']> {
  return itds.map(itd => {
    switch (itd.type) {

      case 'function_call':
        const { name, description, input_schema, allowed_callers, input_examples } = itd.function_call;
        const properties = input_schema?.properties || null; // Anthropic valid values for input_schema.properties are 'object' or 'null' (null is used to declare functions with no inputs)
        return {
          type: 'custom', // we could not set it, but it helps our typesystem with discrimination
          name,
          description,
          input_schema: {
            type: 'object',
            properties: strictToolsEnabled && properties ? _strictNormalizeSchema(properties) : properties,
            required: input_schema?.required,
            // [Anthropic, 2025-11-13] Structured Outputs requires additionalProperties: false (on every nested object too, see _strictNormalizeSchema)
            ...(strictToolsEnabled ? { additionalProperties: false } : {}),
          },
          // [Anthropic, 2025-11-13] Structured Outputs: strict mode guarantees tool inputs match schema
          ...(strictToolsEnabled ? { strict: true } : {}),
          // [Anthropic, 2025-11-24] Tool Search Tool - auto-defer all custom tools
          ...(toolSearchToolEnabled ? { defer_loading: true } : {}),
          // [Anthropic, 2025-11-24] Programmatic Tool Calling - pass through allowed_callers and input_examples
          ...(allowed_callers ? { allowed_callers: allowed_callers.map(c => c === 'code_execution' ? 'code_execution_20260120' : c) } : {}),
          ...(input_examples ? { input_examples } : {}),
        };

      case 'code_execution':
        throw new Error('Gemini code interpreter is not supported');

    }
  });
}

/**
 * [Anthropic, 2025-11-13] Strict mode (tools and JSON output) requires `additionalProperties: false` on EVERY
 * 'object' node in the schema, not just the root - 400 otherwise (verified empirically on Fable 5, 2026-06-09).
 * Recursively adds it wherever undefined, without overriding explicit values.
 */
function _strictNormalizeSchema<T>(node: T): T {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(_strictNormalizeSchema) as T;
  const obj: Record<string, any> = {};
  for (const [key, value] of Object.entries(node))
    obj[key] = _strictNormalizeSchema(value);
  if (obj.type === 'object' && obj.additionalProperties === undefined)
    obj.additionalProperties = false;
  return obj as T;
}

function _toAnthropicToolChoice(itp: AixTools_ToolsPolicy): NonNullable<TRequest['tool_choice']> {
  switch (itp.type) {
    case 'auto':
      return { type: 'auto' as const };
    case 'any':
      return { type: 'any' as const };
    case 'function_call':
      return { type: 'tool' as const, name: itp.function_call.name };
  }
}
