import * as z from 'zod/v4';

import type { AnthropicHostedFeatures } from '~/modules/llms/server/anthropic/anthropic.access';

import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixTools_ToolDefinition, AixTools_ToolsPolicy } from '../../../api/aix.wiretypes';
import { AnthropicWire_API_Message_Create, AnthropicWire_Blocks } from '../../wiretypes/anthropic.wiretypes';

import { AIX_MISSING_TOOL_RESULT_TEXT, aixSpillShallFlush, aixSpillSystemToUser, approxDocPart_To_String, approxInReferenceTo_To_XMLString, approxMediaUrlPart_To_String } from './adapters.common';


// configuration
// const DEFAULT_WEB_FETCH_MAX_USES = 5; // we don't set a default anymore, we let it be
// const DEFAULT_WEB_SEARCH_MAX_USES = 10; // we don't set a default anymore, we let it be
const hotFixImagePartsFirst = true;
const hotFixMapModelImagesToUser = true;
const hotFixDisableThinkingWhenToolsForced = true; // "Thinking may not be enabled when tool_choice forces tool use."
// [Anthropic, 2026-09-01] Preserved thinking: models that bind replayed thinking blocks to the conversation prefix - Fable/Mythos 5.1
// and (per Anthropic) every later model; the 5.0 generation only runs the drop-only model check. Substring-matches Bedrock/OR ids.
const hotFixPreservedThinkingModelRe = /claude-(fable|mythos|opus|sonnet|haiku)-(5-\d|[6-9])/;
const hotFixAntSeparateContiguousThinkingBlocks = true; // Interleave continuous thinking blocks (without aText) with the following text block, instead of merging them into a single block - should be more robust to unexpected thinking block formats and to changes in the thinking block format, as we have seen some variations and we might see more in the future
// const hotFixAntShipNoEmptyTextBlocks = true; // If empty text blocks are found (e.g. produced by the API), do not ship them or things will break

// former fixes, now removed
// const hackyHotFixStartWithUser = false; // 2024-10-22: no longer required


type TRequest = AnthropicWire_API_Message_Create.Request;


/**
 * Which endpoint the Messages payload is built for.
 * Not merely an envelope difference: the AWS Bedrock `bedrock-2023-05-31` passthrough validates the
 * body against its own schema and 400s on api.anthropic.com-only fields, so the adapter has to know
 * where the request is going. Keep every target-conditional field in the one block at the bottom.
 */
export type AixAnthropicTarget = 'anthropic' | 'bedrock';


/**
 * Determines which Anthropic hosted features will be active for a request.
 * Single source of truth for both the request builder (tools, container) and the dispatch (beta headers).
 */
export function aixAnthropicHostedFeatures(model: AixAPI_Model, chatGenerate: AixAPIChatGenerate_Request, target: AixAnthropicTarget = 'anthropic'): AnthropicHostedFeatures {

  // Allow/deny auto-adding hosted tools when custom tools are present with a restrictive policy
  const _hasAixCustomTools = chatGenerate.tools?.some(t => t.type === 'function_call');
  const _hasAixToolRestrictivePolicy = chatGenerate.toolsPolicy?.type === 'any' /* || chatGenerate.toolsPolicy?.type === 'function_call' - DISABLED 2026-07-17, see ToolsPolicy_schema */;

  // Dynamic web tools (20260318, was 20260209) require code execution for programmatic tool calling
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
  // Dynamic web tools (_20260318, was _20260209) have their OWN internal code execution. We never AUTO-enable the
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
    enableThinkingBindingControls: target === 'anthropic' && hotFixPreservedThinkingModelRe.test(model.id), // Bedrock 400s the body field (probed 2026-09-01)
    modelIdForPerModelFeatures: model.id,
  };
}

export function aixToAnthropicMessageCreate(target: AixAnthropicTarget, model: AixAPI_Model, _chatGenerate: AixAPIChatGenerate_Request, streaming: boolean, hostedFeatures: ReturnType<typeof aixAnthropicHostedFeatures>): TRequest {

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

  // [Anthropic] Pair every interior tool_use with a tool_result, or the request is rejected wholesale
  _pairInteriorToolUseBlocks(chatMessages);

  // [Anthropic, 2026-07-10] The API rejects >4 cache_control blocks ("A maximum of 4 blocks with
  // cache_control may be provided.") - manual 'Cache up to here' flags can stack beyond the auto
  // policy's 3. Keep the trailing 4: breakpoints cache prefixes, so earlier ones are redundant.
  _capTrailingCacheBreakpoints(systemMessage, chatMessages, 4);

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
  // [2026-07-24] Opus 5 launch-verified: adaptive-only too ('enabled'/budget_tokens return 400), so 'opus' stays in this regex.
  // (Opus 5 nuance: 'disabled' is legal at effort <= high, but we coerce to adaptive anyway - single always-thinking entry.)
  const hotFixAdaptiveThinkingOnlyModel = /claude-(fable|mythos|opus)-5/.test(model.id);

  // HOTFIX: Fable/Mythos 5 ONLY reject forced tool use: 400 'tool_choice forces tool use is not compatible with this model.'
  // (model-level, regardless of thinking config). Downgrade to 'auto' + a system hint - empirically the model
  // reliably calls the tool when instructed. Forced tool use is deprecated AIX-wide, see ToolsPolicy_schema.
  // [2026-07-24] Opus 5 EXCLUDED (launch probes): tool_choice 'any'/'tool' return 200 with thinking left to its
  // adaptive-on default, so requests pass through unchanged (thinking is skipped below when tools are forced).
  const hotFixNoForcedToolUse = /claude-(fable|mythos)-5/.test(model.id);
  if (hotFixNoForcedToolUse && payload.tool_choice && (payload.tool_choice.type === 'any' || payload.tool_choice.type === 'tool')) {
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

  // [Anthropic, 2026-09-01] Preserved thinking: on Fable 5.1+ a replayed thinking block is valid only against the unchanged
  // system/tools/history prefix - accounts created >= 2026-08-31 get a 400 after any edit ('The block is bound to a different
  // conversation'), which big-AGI does routinely (edits, deletes, persona/tool changes). 'drop_block' (beta header from
  // enableThinkingBindingControls) drops the stale blocks instead, reported in `input_transformations`; 400 with 'disabled'.
  if (hostedFeatures.enableThinkingBindingControls && payload.thinking && payload.thinking.type !== 'disabled')
    payload.thinking.block_binding = { prefix_mismatch_behavior: 'drop_block' };

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

    // Web Search Tool - dynamic filtering (20260318, supersedes 20260209) uses internal code execution for better results.
    // response_inclusion intentionally left unset (defaults to 'full') - unchanged behavior, see _WebSearchTool_20260318_schema.
    if (model.vndAntWebSearch === 'auto') {
      hostedTools.push({
        type: model.vndAntWebDynamic ? 'web_search_20260318' : 'web_search_20250305',
        name: 'web_search',
        ...(model.vndAntWebSearchMaxUses !== undefined ? { max_uses: model.vndAntWebSearchMaxUses } : {}),
        ...(model.userGeolocation ? {
          user_location: { type: 'approximate' as const, ...model.userGeolocation },
        } : {}),
      });
    }

    // Web Fetch Tool - dynamic filtering (20260318, supersedes 20260209/20260309) uses internal code execution for better results.
    // response_inclusion intentionally left unset (defaults to 'full') - unchanged behavior, see _WebFetchTool_20260318_schema.
    if (model.vndAntWebFetch === 'auto') {
      hostedTools.push({
        type: model.vndAntWebDynamic ? 'web_fetch_20260318' : 'web_fetch_20250910',
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
    // Not AUTO-added for dynamic web tools (_20260318, was _20260209) which execute code internally; an explicit user
    // toggle may still coexist with them by design (see aixAnthropicHostedFeatures note re #1087).
    // Keep _20260120: it matches the code execution version dynamic web auto-injects, so coexisting
    // merges into ONE environment (re-verified empirically on _20260318: caller.type is still 'code_execution_20260120').
    // An older version (e.g. _20250825) 400s: 'tool names must be unique'.
    if (enableCodeExecution)
      hostedTools.push({ type: 'code_execution_20260120', name: 'code_execution' });

    // Merge hosted tools with custom tools
    if (hostedTools.length > 0) {
      payload.tools = payload.tools ? [...payload.tools, ...hostedTools] : hostedTools;
    }
  }

  // --- Container continuity between calls ---
  // Re-attaching the container is DECOUPLED from enableCodeExecution: dynamic web tools (_20260318, was _20260209)
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


  // --- Target: remove api.anthropic.com-only fields ---
  // Bedrock's `bedrock-2023-05-31` passthrough validates the body and rejects anything it does not
  // know ("<field>: Extra inputs are not permitted", HTTP 400). Keep all such strips here, in one
  // place - `model`/`stream` are NOT in this list, they are envelope translation (see the dispatch).
  if (target === 'bedrock') {

    /**
     * Reasoning effort on Bedrock is a 4.5-GENERATION limitation, NOT Bedrock-wide (live-probed
     * 2026-08-05): opus-4-5-20251101 / sonnet-4-5-20250929 / haiku-4-5-20251001 all 400 with
     * 'output_config.effort: Extra inputs are not permitted' (also observed in prod 2026-08-03 on
     * us.anthropic.claude-opus-4-5, invoke + streaming), while opus-4-6 and sonnet-4-6 ACCEPT effort
     * (200) - so the strip is model-scoped to not penalize 4.6+. 4.7/4.8/5-family were not probeable
     * (403 on the test account) and are assumed accepting, being newer than 4.6; if one 400s, extend
     * the regex. There is no 4.5 fallback to map effort onto - `thinking.budget_tokens` is a different
     * knob and is already sent when the user sets one - so on 4.5 effort is silently dropped and the
     * model answers at its default depth. The Effort control is also filtered per-model out of Bedrock
     * model definitions (`_BEDROCK_EFFORT_REJECTING_MODELS` in llms .../anthropic.models.ts - keep the
     * two regexes in sync), but this strip is what actually fixes it: it covers values already
     * persisted in a user's per-model parameters, the 'Max reasoning' exec override, and the
     * forced-tool-use hotfix above (which sets effort itself).
     * `output_config.format` (strict JSON) is deliberately kept: the 400 names the NESTED `effort` key,
     * so Bedrock does know `output_config` - whether it also takes `format` is untested, don't guess.
     */
    if (payload.output_config?.effort && /claude-(opus|sonnet|haiku)-4-5-\d{8}/.test(model.id)) {
      delete payload.output_config.effort;
      if (!Object.keys(payload.output_config).length)
        delete payload.output_config;
    }

    // Fast inference mode is not offered on partner clouds: 400 'speed: Extra inputs are not permitted'
    delete payload.speed;

    // Preserved-thinking controls: 400 'thinking.adaptive.block_binding: Extra inputs are not permitted' (never set for this target)
    if (payload.thinking && payload.thinking.type !== 'disabled')
      delete payload.thinking.block_binding;
  }

  // Preemptive error detection with server-side payload validation before sending it upstream
  const validated = AnthropicWire_API_Message_Create.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.warn('[DEV] Anthropic: invalid messageCreate payload. Error:', { valError: validated.error });
    throw new Error(`Invalid request for Anthropic models: ${z.prettifyError(validated.error)}`);
  }

  return validated.data;
}


/** Enforce the Anthropic 4-breakpoint API limit by un-stamping the earliest (prefix-redundant) breakpoints. */
function _capTrailingCacheBreakpoints(systemMessage: TRequest['system'], chatMessages: TRequest['messages'], maxBreakpoints: number): void {
  const stampedBlocks: { cache_control?: unknown }[] = [];
  for (const block of systemMessage || [])
    if (block.cache_control)
      stampedBlocks.push(block);
  for (const message of chatMessages)
    for (const block of message.content)
      if ('cache_control' in block && block.cache_control)
        stampedBlocks.push(block);
  for (let i = 0; i < stampedBlocks.length - maxBreakpoints; i++)
    delete stampedBlocks[i].cache_control;
}

/**
 * Anti-wedge: a `tool_use` block with no `tool_result` for its id in the immediately following user
 * message is a 400 ("tool_use ids were found without tool_result blocks immediately after") that
 * rejects the whole request. Since the orphan lives in stored history (a run that failed/aborted
 * before the tool ran, or a tool no client processor claimed), every later turn replays it and gets
 * the same 400: the conversation is bricked with no in-app way to tell which message is poisoned.
 *
 * This synthesizes the stub prescribed in kb/modules/AIX-stateless-roundtrip-retention.md (cat-1),
 * which also retro-heals conversations already poisoned in users' stores. No-op when well-formed.
 *
 * The LAST assistant message is deliberately skipped: a trailing `tool_use` is the in-flight call of
 * an agentic loop (and pause_turn continuation extends that same trailing message with its own blocks,
 * after this adapter has run) - synthesizing there would fake the result of a call about to execute.
 * `server_tool_use` is likewise untouched: hosted tools owe no tool_result.
 */
function _pairInteriorToolUseBlocks(chatMessages: TRequest['messages']): void {
  for (let i = 0; i < chatMessages.length - 1; i++) {
    const message = chatMessages[i];
    if (message.role !== 'assistant') continue;

    // client tool calls of this turn, in wire order
    const toolUseIds: string[] = [];
    for (const block of message.content)
      if (block.type === 'tool_use')
        toolUseIds.push(block.id);
    if (!toolUseIds.length) continue;

    // the results must be in the next message: if that isn't a user turn (role flip at a flush
    // boundary), insert one to hold them - it will still sit immediately after the tool_use blocks
    let resultsMessage = chatMessages[i + 1];
    if (resultsMessage.role !== 'user') {
      resultsMessage = { role: 'user', content: [] };
      chatMessages.splice(i + 1, 0, resultsMessage);
    }

    const answeredIds = new Set<string>();
    for (const block of resultsMessage.content)
      if (block.type === 'tool_result')
        answeredIds.add(block.tool_use_id);

    const orphanIds = toolUseIds.filter(id => !answeredIds.has(id));
    if (!orphanIds.length) continue;

    // head-insert, in tool_use order: tool_result blocks lead the user turn, ahead of any user content
    console.warn(`[Anthropic] Pairing ${orphanIds.length} orphan tool_use block(s) with a placeholder tool_result (messages.${i})`);
    resultsMessage.content.unshift(...orphanIds.map(id => AnthropicWire_Blocks.ToolResultBlock(
      id,
      [AnthropicWire_Blocks.TextBlock(AIX_MISSING_TOOL_RESULT_TEXT, 'pairing.orphan-tool-use')],
      undefined, // not is_error: the tool did not fail, its result is simply absent from history
    )));
  }
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

          case 'media_url':
            // URL-referenced video: Anthropic cannot watch it - honest text degradation
            yield { role: 'user', content: AnthropicWire_Blocks.TextBlock(approxMediaUrlPart_To_String(part), 'user.media_url') };
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
    // DISABLED 2026-07-17 - forced named tool, see ToolsPolicy_schema (the 'tool' branch of the forced-use
    // hotfix above stays: it guards the Anthropic wire type, which still admits 'tool')
    // case 'function_call':
    //   return { type: 'tool' as const, name: itp.function_call.name };
  }
}
