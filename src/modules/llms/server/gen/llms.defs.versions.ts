// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '7382c16d996d',
  _shared: '407107c3274a',
  alibaba: 'e2a5594f9123',
  anthropic: 'df7037948637',
  azure: '31482cab3d66',
  bedrock: 'f3eaffcbbcbb',
  cerebras: '4993e632e6fe',
  cohere: '6bbca3f18685',
  deepseek: '405ea7e7ae0b',
  googleai: '7c4422f98881',
  groq: '22c7c86b292e',
  lmstudio: 'c40e90b8651b',
  localai: '3352bbae24ce',
  metaai: 'ad11595cd897',
  mistral: '4fce7c6ecaee',
  modular: '1223cf15c8d6',
  moonshot: '1c04f5a60ea5',
  nvidianim: '1c20acc357d4',
  ollama: 'c9c18e6600e5',
  openai: '43183c884fea',
  openrouter: '612efc1857c6',
  perplexity: 'c19febc5322f',
  sakanaai: '510c409cea8c',
  togetherai: '8be81b347fb1',
  xai: '3a27d3f47e97',
  zai: '8efe7e1936f8',
} as const satisfies LlmsDefsVersions;
