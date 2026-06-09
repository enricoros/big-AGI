import * as z from 'zod/v4';

import { aixFunctionCallTool } from '~/modules/aix/client/aix.client.fromSimpleFunction';

import type { ProbeScenario } from './probe.types';


// Shared tool used by the probes - intentionally simple and unambiguous.
const getWeatherTool = aixFunctionCallTool({
  name: 'get_current_weather',
  description: 'Look up the current weather for a given city. Call this whenever the user asks about current weather conditions.',
  inputSchema: z.object({
    location: z.string().describe('The city and optional region/country, e.g. "Tokyo, Japan".'),
    unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit to return.'),
  }),
});


/**
 * The two probes, same tool, different policies:
 * - fc_auto: policy 'auto' asks the model to freely decide - tests natural/useful tool invocation.
 * - fc_required: policy 'any' forces a tool call - tests whether the model can format a call at all.
 *
 * Combined, they separate three buckets:
 *  (A) full support         -> both pass
 *  (B) weak support         -> only fc_required passes (model refuses to invoke unprompted)
 *  (C) no/broken support    -> fc_required fails (model ignores or errors on tool schema)
 *
 * Per-vendor notes for fc_required (toolsPolicy: { type: 'any' }):
 *  - Anthropic Fable/Mythos 5: 'any' is coerced server-side to 'auto' + system steering hint + effort=low;
 *    the probe should expect success but the model was not wire-forced.
 *  - Perplexity: will throw 'This service does not support function calls' if tools are present.
 *  - Mistral: will throw for any non-auto policy.
 *  - OpenAI/xAI/Gemini/DeepSeek/Bedrock: 'any' maps to native forced-call equivalents and works.
 *  - Models with always-on thinking (Fable/Mythos 5, DeepSeek V4): client-side
 *    aixRequireSingleFunctionCallInvocation filters void fragments, so extraction works.
 */
export const PROBE_SCENARIOS: ProbeScenario[] = [
  {
    id: 'fc_auto',
    label: 'FC (auto)',
    description: 'Single tool, policy=auto. Model must decide to call the tool unprompted.',
    systemMessage: 'You are a concise assistant. Use available tools when they are clearly helpful. Never invent answers for real-time data.',
    userMessage: 'What is the current weather in Tokyo? Use the provided tool to find out.',
    tools: [getWeatherTool],
    toolsPolicy: { type: 'auto' },
    expectedFunctionName: 'get_current_weather',
  },
  {
    id: 'fc_required',
    label: 'FC (required)',
    description: 'Single tool, policy=any (forced invocation). See per-vendor notes in probe.scenarios.ts.',
    systemMessage: 'You are a concise assistant. You must call one of the available tools to answer. Do not respond with plain text.',
    userMessage: 'What is the current weather in Tokyo? You must use the available tool.',
    tools: [getWeatherTool],
    // NOTE: 'any' is DEPRECATED in AIX (Claude Fable/Mythos 5 reject it with 400; the Anthropic
    // adapter coerces to 'auto' + system steering hint). Kept for probe purposes - matches what
    // main's own forced-call callers (autoChatFollowUps, agiAttachmentPrompts) send today.
    // All other adapters translate it natively (OpenAI -> 'required', Gemini -> 'ANY', etc.).
    toolsPolicy: { type: 'any' },
    expectedFunctionName: 'get_current_weather',
  },
  {
    id: 'fc_roundtrip',
    label: 'FC (roundtrip)',
    description: 'Two-turn: tool call -> inject canned result -> verify turn 2 text consumed the result.',
    systemMessage: 'You are a concise assistant. Use available tools when helpful.',
    userMessage: 'What is the current weather in Tokyo? Use the provided tool to find out.',
    tools: [getWeatherTool],
    toolsPolicy: { type: 'auto' },
    expectedFunctionName: 'get_current_weather',
    roundtrip: {
      cannedResult: JSON.stringify({ temperature_c: 18, condition: 'cloudy', wind_kph: 12 }),
      signalTokens: ['cloudy', '18'], // either is sufficient proof the model consumed the result
    },
  },
];
