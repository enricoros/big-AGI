// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'e3228412fe05',
  _shared: '15fa823b2ad4',
  alibaba: '20eb3913958f',
  anthropic: '49a5a3dab479',
  azure: 'f4017c86abbf',
  bedrock: '56493865d22f',
  cerebras: 'b66df1145d81',
  cohere: 'eabb771ca478',
  deepseek: '5dbfc7be70ad',
  googleai: 'f940298288d8',
  groq: '5b4ce7385b3b',
  lmstudio: '79484a113947',
  localai: '00db0b2bdc1c',
  metaai: 'eb8f1c51d423',
  mistral: 'eabac35556c7',
  modular: '0ec897976839',
  moonshot: 'f3c4f0ba2f26',
  nvidianim: '870711a8a758',
  ollama: 'e20f59b3a1fa',
  openai: 'cd750501c43e',
  openrouter: 'ee9f6c755768',
  perplexity: 'dfa2f544ad35',
  sakanaai: '92388b1a48ab',
  togetherai: 'dc42550cc50a',
  xai: '5f78729e407e',
  zai: '29cb9f5b1a7d',
} as const satisfies LlmsDefsVersions;
