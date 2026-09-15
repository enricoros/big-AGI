// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'b4596a49309a',
  _shared: '407107c3274a',
  alibaba: 'e2a5594f9123',
  anthropic: 'df7037948637',
  azure: '31482cab3d66',
  bedrock: '88ec738794a3',
  cerebras: '4993e632e6fe',
  cohere: 'f56b03c46837',
  deepseek: '405ea7e7ae0b',
  googleai: '7c4422f98881',
  groq: '22c7c86b292e',
  lmstudio: 'c40e90b8651b',
  localai: '3352bbae24ce',
  metaai: 'ad11595cd897',
  mistral: '4fce7c6ecaee',
  modular: '4d3bc3c34f0b',
  moonshot: 'c2db7f17a66b',
  nvidianim: '1c20acc357d4',
  ollama: '64f3db69a882',
  openai: '43183c884fea',
  openrouter: 'f81bac6359fd',
  perplexity: 'c19febc5322f',
  sakanaai: '510c409cea8c',
  togetherai: '8be81b347fb1',
  xai: '3a27d3f47e97',
  zai: '8efe7e1936f8',
} as const satisfies LlmsDefsVersions;
