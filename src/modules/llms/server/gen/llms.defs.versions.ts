// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '159c774b4b05',
  _shared: 'add43d6e96a1',
  alibaba: '71434d1981e5',
  anthropic: 'aab72a59f85c',
  azure: '7995e04c643c',
  bedrock: 'f03aad20f2de',
  cerebras: '67555bfc841e',
  cohere: '3f4b9e6daa65',
  deepseek: 'ae500e29b0a0',
  googleai: 'd216be3060e8',
  groq: 'eff47713af52',
  lmstudio: 'e38d8e0f159f',
  localai: '4ef79a897e43',
  metaai: '8a20dbb5b79c',
  mistral: '603885080b3b',
  modular: 'fe6516a118b5',
  moonshot: '54338b1fa65c',
  nvidianim: '149971f43481',
  ollama: '6934d9656b5a',
  openai: '37d683fed1bd',
  openrouter: '6ac00b1bd9b2',
  perplexity: '906a4cfe264c',
  sakanaai: '0d890a1d4e4c',
  togetherai: 'e72bb972c7aa',
  xai: 'be1f9163a661',
  zai: '72ba849a80e3',
} as const satisfies LlmsDefsVersions;
