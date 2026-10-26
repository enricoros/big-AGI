// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'ff9a7294d9c4',
  _shared: '34b527803117',
  alibaba: '7628a43893af',
  anthropic: '4c896bf8469f',
  azure: 'ee61d6374f6f',
  bedrock: 'de7da33d4268',
  cerebras: '3b66acc3ed41',
  cohere: '634089ce6d2a',
  deepseek: '5c5963bd9033',
  googleai: 'e2535540fffe',
  groq: 'e58ae064ca96',
  lmstudio: 'ffa473b1e073',
  localai: '385c21257f68',
  metaai: '59a663ae3271',
  mistral: 'e5e7500ea918',
  modular: '92010d9a98ec',
  moonshot: '872bb5db670e',
  nvidianim: '904f2efea70b',
  ollama: '2dc1129fa9f4',
  openai: 'aa6e3da3b98a',
  openrouter: '4a44298aa0f0',
  perplexity: '638b6ecf9161',
  sakanaai: 'cdb6c4d6088a',
  togetherai: '5e40121194eb',
  xai: 'f21c93ff92a8',
  zai: '5d68a7611b2d',
} as const satisfies LlmsDefsVersions;
