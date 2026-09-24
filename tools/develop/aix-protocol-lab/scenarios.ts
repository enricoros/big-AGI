/**
 * AIX Protocol Lab - Scenarios and per-flavor compilation.
 *
 * A scenario is (prompt, capability switches). The compiler maps the switches onto each
 * flavor's real knobs (AixAPI_Model vnd params, AIX tools), then the REAL adapters build the
 * upstream request - so the request side of the protocol is under the microscope too.
 *
 * Capability mapping per flavor (best effort - gaps are recorded, not papered over):
 *
 * | switch    | anthropic-messages           | openai-responses          | openai-chat | gemini-generate            | gemini-interactions |
 * |-----------|------------------------------|---------------------------|-------------|----------------------------|---------------------|
 * | reasoning | vndAntThinkingBudget         | reasoningEffort           | (none)      | reasoningEffort            | (agent-implicit)    |
 * | webSearch | vndAntWebSearch              | vndOaiWebSearchContext    | (none)      | vndGeminiGoogleSearch      | (agent-implicit)    |
 * | webFetch  | vndAntWebFetch               | (none)                    | (none)      | vndGeminiUrlContext        | (agent-implicit)    |
 * | codeExec  | PTC-unlock tool [1]          | vndOaiCodeInterpreter     | (none)      | vndGeminiCodeExecution     | (agent-implicit)    |
 *
 * metaai-responses (Muse Spark on api.meta.ai, dialect-routed to Responses): reasoning -> reasoningEffort,
 * webSearch -> vndOaiWebSearchContext; no hosted fetch or code execution on Meta (recorded as unsupported).
 *
 * [1] Anthropic has no direct code-execution switch: aixAnthropicHostedFeatures() enables the
 *     code_execution tool for Skills or Programmatic Tool Calling. The lab unlocks it the PTC way,
 *     with a trivial function tool carrying allowed_callers: ['direct', 'code_execution'] - which
 *     also exercises the PFC/nested-caller path this lab exists to observe.
 */

import type { AixAPI_Model, AixAPIChatGenerate_Request, AixTools_ToolDefinition } from '~/modules/aix/server/api/aix.wiretypes';

import type { LabFlavor } from './trace';


// -- Default models (edit here as the catalog moves) --

export const LAB_DEFAULT_MODELS: Record<LabFlavor, string> = {
  'anthropic-messages': 'claude-sonnet-4-6',
  'openai-responses': 'gpt-5.2',
  'metaai-responses': 'muse-spark-1.3',
  'openai-chat': 'gpt-4.1-mini',
  'gemini-generate': 'models/gemini-3-flash-preview',
  'gemini-interactions': 'models/antigravity-preview-09-2026',
};


// -- Scenario definitions --

export interface LabCaps {
  reasoning?: boolean;
  webSearch?: boolean;
  webFetch?: boolean;
  codeExec?: boolean;
  /** Anthropic only: dynamic web tools (20260209) with INTERNAL code execution - produces encrypted_code_execution_result blocks (PFC) */
  webDynamic?: boolean;
  /** adds the capybara client function tool; on Anthropic with codeExec it gets allowed_callers so CODE can invoke it (PTC) */
  fnCall?: boolean;
  /** adds a SECOND distinct client function tool (convert_temperature) - stresses parallel calls across different schemas + tool selection */
  multiFn?: boolean;
}

export interface LabScenario {
  id: string;
  description: string;
  system?: string;
  prompt: string;
  /** prior turns appended after the prompt as model/user pairs - multi-turn shapes (prefix-cache extension at item boundaries) */
  followups?: { model: string; user: string }[];
  caps: LabCaps;
  /** output cap override (a truncated turn is a replay corner case) */
  maxTokens?: number;
  /** hosted web tool call cap (Anthropic); default 4, a pause_turn needs more than 10 */
  maxToolUses?: number;
}

export const LAB_SCENARIOS: LabScenario[] = [
  {
    id: 'hello',
    description: 'Plain text smoke test - no tools, no reasoning. Validates the pipeline cheaply.',
    prompt: 'Reply with exactly: hello protocol lab',
    caps: {},
  },
  {
    id: 'reason',
    description: 'Reasoning only - thinking/summary streams without tool interleaving.',
    prompt: 'Think carefully: a farmer has 17 sheep, all but 9 run away. How many are left? Answer with just the number.',
    caps: { reasoning: true },
  },
  {
    id: 'search',
    description: 'Direct server-side web search, no code execution.',
    prompt: 'Search the web for "Enrico Ros" and "Token Fabrics" in parallel if you can, then summarize each in one sentence with a source link.',
    caps: { webSearch: true },
  },
  {
    id: 'code',
    description: 'Server-side code execution only.',
    prompt: 'Execute Python code to compute the sum 333+334 and report the result. Actually run the code, do not compute it mentally.',
    caps: { reasoning: true, codeExec: true },
  },
  {
    id: 'fc',
    description: 'Classic client-side function calling (parallel invocations expected).',
    prompt: 'Get the info for the capybaras named "enrico" (brown) and "coolio" (golden) - call the tool once per capybara, in parallel if possible.',
    caps: {},
  },
  {
    id: 'fc-reason',
    description: 'Client function calling with reasoning on: signed thinking before the calls, the tool-loop shape every agent turn has.',
    prompt: 'Get the info for the capybaras named "enrico" (brown) and "coolio" (golden) - think first about which calls you need, then call the tool once per capybara, in parallel if possible.',
    caps: { reasoning: true, fnCall: true },
  },
  {
    id: 'burst',
    description: 'Token-short, max parallelism: parallel client FC + server code exec + search + fetch in ONE turn; PTC (code calling client functions) on Anthropic.',
    system: 'Be extremely terse. No explanations, no summaries, no preamble. Use tools in parallel whenever possible.',
    prompt: 'Do ALL of these now, in parallel where possible:\n' +
      '1. Call get_capybara_info_given_name_and_color for "enrico" (brown) AND for "coolio" (golden) - two separate calls.\n' +
      '2. Execute Python code computing 41*10+7.\n' +
      '3. Search the web for "Token Fabrics".\n' +
      '4. Fetch https://big-agi.com.\n' +
      'If your code execution environment can invoke the capybara function programmatically, call it from code. ' +
      'End with the single word: done',
    caps: { reasoning: true, webSearch: true, webFetch: true, codeExec: true, fnCall: true },
  },
  {
    id: 'pfc',
    description: 'Anthropic dynamic web tools: search+fetch with INTERNAL code execution - encrypted code-exec results, nested callers, the "are intermediates kept" case.',
    prompt: 'Search the web for the latest big-AGI release and for "Token Fabrics", filtering the results programmatically if you can. ' +
      'Then fetch https://big-agi.com and extract the main headline. ' +
      'Report: the release you found, one fact about Token Fabrics, and the headline - each with a source link.',
    caps: { reasoning: true, webSearch: true, webFetch: true, webDynamic: true },
  },
  {
    id: 'interleave',
    description: 'Max interleaving, short outputs: 2 DISTINCT client function tools called in parallel (3 calls) + server search/fetch. Anthropic uses dynamic filtering (internal encrypted code); Gemini exercises tool-circulation (hosted+custom combined); OpenAI shows client-FC turn-boundary deferral of hosted tools. Built for manual ledger verification.',
    system: 'Be extremely terse. One-word answers where possible, no preamble. Use every applicable tool in parallel within a single step when you can.',
    prompt: 'In ONE step, in parallel, do ALL of:\n' +
      '1. get_capybara_info_given_name_and_color for "enrico" (brown) AND "coolio" (golden) - two separate calls.\n' +
      '2. convert_temperature 100 from "C" to "F" - one call.\n' +
      '3. Search the web for "big-AGI", filtering the results programmatically if your tools support it.\n' +
      '4. Fetch https://big-agi.com.\n' +
      'Then reply with only: ok',
    caps: { reasoning: true, webSearch: true, webFetch: true, codeExec: true, webDynamic: true, fnCall: true, multiFn: true },
  },
  {
    id: 'kitchen-sink',
    description: 'The canonical gauntlet: reasoning + parallel search + code exec + parallel fetch + final text + in-response reasoning continuity probe.',
    prompt: 'Think deeply of a random number between 1 and 1000 and keep it to yourself for now. ' +
      'Then search the web for "Enrico Ros" and "Token Fabrics", in parallel if possible. ' +
      'Then execute code to sum 333+334 in Python. ' +
      'Then fetch simultaneously https://www.enricoros.com and https://big-agi.com. ' +
      'Finally write "hi", the sum, and the number you originally thought of.',
    caps: { reasoning: true, webSearch: true, webFetch: true, codeExec: true },
  },
  {
    id: 'fetch',
    description: 'Direct server-side web fetch only - the fetched document as a hosted result, citations from it.',
    prompt: 'Fetch https://big-agi.com and quote its main headline verbatim, with a citation. One sentence.',
    caps: { reasoning: true, webFetch: true },
  },
  {
    id: 'redacted',
    description: 'Anthropic redacted thinking (documented magic string) interleaved with visible thinking - block order on replay.',
    prompt: 'ANTHROPIC_MAGIC_STRING_TRIGGER_REDACTED_THINKING_46C9A13E193C177646C7398A98432ECCCE4C1253D5E2D82641AC0E52CC2876CB Then think about why 7 x 8 = 56 and answer with just the number.',
    caps: { reasoning: true },
  },
  {
    id: 'pause',
    description: 'Anthropic pause_turn: one direct web search per question drives the hosted loop past its 10-step cap, so the turn spans two requests.',
    prompt: 'Answer these 12 questions one at a time with web_search (one search per question, never batch, do not write code). Immediately after each search, write one sentence that quotes the source verbatim so it carries a citation, then reason briefly about the next question. Questions: 1. population of Reykjavik; 2. height of Mount Kosciuszko; 3. founding year of Ghent University; 4. length of the Danube river; 5. capital of Bhutan; 6. author of the novel Solaris; 7. boiling point of ethanol; 8. year the Eiffel Tower opened; 9. largest moon of Neptune; 10. inventor of the safety pin; 11. national bird of India; 12. maximum depth of Lake Baikal. End with the word DONE.',
    caps: { reasoning: true, webSearch: true },
    maxToolUses: 20,
  },
  {
    id: 'truncated',
    description: 'Output cut by max_tokens mid-reasoning or mid-text - what a truncated turn replays as.',
    prompt: 'Plan a 10-day trip through Japan by train and write the full day-by-day itinerary, with train times, stations and hotels for every day.',
    caps: { reasoning: true },
    maxTokens: 600,
  },
];

export function findScenario(id: string): LabScenario {
  const scenario = LAB_SCENARIOS.find(s => s.id === id);
  if (!scenario)
    throw new Error(`Unknown scenario '${id}'. Available: ${LAB_SCENARIOS.map(s => s.id).join(', ')}`);
  return scenario;
}


// -- Compilation: scenario -> (AixAPI_Model, AixAPIChatGenerate_Request) --

export interface CompiledScenario {
  model: AixAPI_Model;
  chatGenerate: AixAPIChatGenerate_Request;
  /** capability switches that have no mapping on this flavor - recorded, not silently dropped */
  unsupportedCaps: (keyof LabCaps)[];
}

/** The capybara function tool (matches the historical AIX test tool) - used by the 'fc' and fnCall-capable scenarios. */
const CAPYBARA_TOOL: Extract<AixTools_ToolDefinition, { type: 'function_call' }> = {
  type: 'function_call',
  function_call: {
    name: 'get_capybara_info_given_name_and_color',
    description: 'Gets the info about one capybara, by name and color. Call once per capybara. Returns the capybara biography. Use when asked about capybaras.',
    input_schema: {
      properties: {
        name: { type: 'string', description: 'The name of the capybara' },
        color: { type: 'string', description: 'The color of the capybara. Mandatory.' },
      },
      required: ['name'],
    },
  },
};

/** Second distinct client tool (for multiFn) - a different schema, kept direct-only on all flavors. */
const CONVERT_TEMP_TOOL: Extract<AixTools_ToolDefinition, { type: 'function_call' }> = {
  type: 'function_call',
  function_call: {
    name: 'convert_temperature',
    description: 'Converts a temperature between unit scales. Returns the converted value. Use when asked to convert temperatures.',
    input_schema: {
      properties: {
        value: { type: 'number', description: 'The temperature value to convert' },
        from: { type: 'string', description: 'Source unit: C, F, or K' },
        to: { type: 'string', description: 'Target unit: C, F, or K' },
      },
      required: ['value', 'from', 'to'],
    },
  },
};

/** PTC unlock for Anthropic code execution: allowed_callers triggers aixAnthropicHostedFeatures().enableCodeExecution. */
const ANT_PTC_UNLOCK_TOOL: AixTools_ToolDefinition = {
  type: 'function_call',
  function_call: {
    name: 'get_lab_seed',
    description: 'Returns the protocol-lab seed word for this run. Only call when explicitly asked for the lab seed. Can be invoked directly or from within code execution.',
    allowed_callers: ['direct', 'code_execution'],
  },
};

export function compileScenario(flavor: LabFlavor, scenario: LabScenario, modelIdOverride?: string): CompiledScenario {

  const caps = scenario.caps;
  const unsupportedCaps: (keyof LabCaps)[] = [];
  const tools: AixTools_ToolDefinition[] = [];
  const wantsClientFn = !!caps.fnCall || scenario.id === 'fc';

  const model: AixAPI_Model = {
    id: modelIdOverride || LAB_DEFAULT_MODELS[flavor],
    acceptsOutputs: ['text'],
    temperature: null,
  };

  switch (flavor) {

    case 'anthropic-messages':
      model.maxTokens = 16384;
      if (caps.reasoning) model.vndAntThinkingBudget = 4096;
      if (caps.webSearch) {
        model.vndAntWebSearch = 'auto';
        model.vndAntWebSearchMaxUses = scenario.maxToolUses ?? 4;
      }
      if (caps.webFetch) {
        model.vndAntWebFetch = 'auto';
        model.vndAntWebFetchMaxUses = scenario.maxToolUses ?? 4;
      }
      if (caps.webDynamic) {
        // dynamic filtering: web tools upgrade to *_20260209 and run code INTERNALLY (encrypted results).
        // [Anthropic issue #1087] Do NOT also add a standalone code_execution tool here - the two code
        // environments confuse the model. So we suppress the PTC standalone path below and keep client
        // tools direct-only; the internal code execution comes free with the dynamic web tools.
        model.vndAntWebDynamic = true;
      } else if (wantsClientFn && caps.codeExec) {
        // PTC: the client function is invocable BOTH directly and from server-side code execution
        // (allowed_callers also flips aixAnthropicHostedFeatures().enableCodeExecution on)
        tools.push({
          type: 'function_call',
          function_call: { ...CAPYBARA_TOOL.function_call, allowed_callers: ['direct', 'code_execution'] },
        });
      } else if (caps.codeExec) {
        tools.push(ANT_PTC_UNLOCK_TOOL);
      }
      break;

    case 'openai-responses':
      model.vndOaiResponsesAPI = true;
      if (caps.reasoning) model.reasoningEffort = 'medium';
      if (caps.webSearch) model.vndOaiWebSearchContext = 'medium';
      if (caps.codeExec) model.vndOaiCodeInterpreter = 'auto';
      if (caps.webFetch) unsupportedCaps.push('webFetch'); // no hosted fetch tool on the Responses API
      break;

    case 'metaai-responses':
      // Muse Spark: reasoning ladder minimal..xhigh ('none' 400s), hosted web_search; no code interpreter or fetch tools
      if (caps.reasoning) model.reasoningEffort = 'medium';
      if (caps.webSearch) model.vndOaiWebSearchContext = 'medium';
      if (caps.codeExec) unsupportedCaps.push('codeExec');
      if (caps.webFetch) unsupportedCaps.push('webFetch');
      break;

    case 'openai-chat':
      // the degenerate grammar: no hosted tools on Chat Completions
      for (const cap of ['reasoning', 'webSearch', 'webFetch', 'codeExec'] as const)
        if (caps[cap]) unsupportedCaps.push(cap);
      break;

    case 'gemini-generate':
      if (caps.reasoning) model.reasoningEffort = 'low';
      if (caps.webSearch) model.vndGeminiGoogleSearch = 'unfiltered';
      if (caps.webFetch) model.vndGeminiUrlContext = 'auto';
      if (caps.codeExec) model.vndGeminiCodeExecution = 'auto';
      break;

    case 'gemini-interactions':
      // managed agents (Antigravity) carry their own tool set: code_execution, google_search, url_context
      model.vndGeminiAPI = 'interactions-agent';
      break;
  }

  if (scenario.maxTokens)
    model.maxTokens = scenario.maxTokens;

  if (caps.webDynamic && flavor !== 'anthropic-messages')
    unsupportedCaps.push('webDynamic');

  // plain client function tool everywhere the anthropic case didn't already add its PTC variant
  if (wantsClientFn && !tools.some(t => t.type === 'function_call' && t.function_call.name === CAPYBARA_TOOL.function_call.name))
    tools.push(CAPYBARA_TOOL);

  // second distinct client tool - direct-only on every flavor (mix of PTC-capable + direct tools is itself interesting)
  if (caps.multiFn && !tools.some(t => t.type === 'function_call' && t.function_call.name === CONVERT_TEMP_TOOL.function_call.name))
    tools.push(CONVERT_TEMP_TOOL);

  const chatGenerate: AixAPIChatGenerate_Request = {
    systemMessage: scenario.system ? { parts: [{ pt: 'text', text: scenario.system }] } : null,
    chatSequence: [
      { role: 'user', parts: [{ pt: 'text', text: scenario.prompt }] },
      ...(scenario.followups ?? []).flatMap(f => [
        { role: 'model' as const, parts: [{ pt: 'text' as const, text: f.model }] },
        { role: 'user' as const, parts: [{ pt: 'text' as const, text: f.user }] },
      ]),
    ],
    ...(tools.length ? { tools } : {}),
  };

  return { model, chatGenerate, unsupportedCaps };
}
