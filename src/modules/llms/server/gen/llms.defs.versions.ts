// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '8f36090378fd',
  _shared: '3fab3d41d037',
  alibaba: '37163099962c',
  anthropic: '6dd7f7a22132',
  azure: '7d91837319cb',
  bedrock: 'e962336c4385',
  cerebras: 'f5949baeaa05',
  cohere: '84c8b21075b2',
  deepseek: 'fc25b2a050a8',
  googleai: 'd530f2745f03',
  groq: 'b33c60c100cb',
  lmstudio: '5f00d214902a',
  localai: '3819a27b50de',
  metaai: 'f15044e9e63e',
  mistral: 'b3c5343faead',
  modular: 'a4d34576a8b7',
  moonshot: '1e68e415d6a8',
  nvidianim: 'e6308b5a1676',
  ollama: '4a07cc9c1979',
  openai: '5fa979a0b07f',
  openrouter: '8c45c2077abd',
  perplexity: 'a5bfe5da5b22',
  sakanaai: 'ff212bf7809f',
  togetherai: '90be8bda3562',
  xai: '35a14cb408aa',
  zai: 'd91ef080feda',
} as const satisfies LlmsDefsVersions;
