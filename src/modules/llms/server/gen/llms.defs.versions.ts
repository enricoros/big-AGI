// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '1fe1e4f313cc',
  _shared: '34b527803117',
  alibaba: '7628a43893af',
  anthropic: '75dee0a1c7e2',
  azure: '331b4545d39f',
  bedrock: 'c1264fea0b03',
  cerebras: '3b66acc3ed41',
  cohere: '634089ce6d2a',
  deepseek: '5c5963bd9033',
  googleai: 'ebb5871c92f6',
  groq: 'e58ae064ca96',
  lmstudio: 'ffa473b1e073',
  localai: '385c21257f68',
  metaai: '59a663ae3271',
  mistral: 'e5e7500ea918',
  modular: '92010d9a98ec',
  moonshot: '872bb5db670e',
  nvidianim: '904f2efea70b',
  ollama: '2dc1129fa9f4',
  openai: '2b7e15b05f7c',
  openrouter: 'e1597d888689',
  perplexity: '638b6ecf9161',
  sakanaai: 'cdb6c4d6088a',
  togetherai: '5e40121194eb',
  xai: 'f3015b62bea9',
  zai: '5d68a7611b2d',
} as const satisfies LlmsDefsVersions;
