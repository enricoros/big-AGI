// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '39fc64719164',
  _shared: '34b527803117',
  alibaba: '7628a43893af',
  anthropic: '4c896bf8469f',
  azure: 'fae931605c7b',
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
  moonshot: 'e6e63fd26b45',
  nvidianim: '904f2efea70b',
  ollama: '2dc1129fa9f4',
  openai: '0ec596f53cd5',
  openrouter: 'b9701de0df77',
  perplexity: '638b6ecf9161',
  sakanaai: 'cdb6c4d6088a',
  togetherai: '5e40121194eb',
  xai: 'f21c93ff92a8',
  zai: '5d68a7611b2d',
} as const satisfies LlmsDefsVersions;
