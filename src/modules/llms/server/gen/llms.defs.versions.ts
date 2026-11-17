// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '8056683a91db',
  _shared: '3fab3d41d037',
  alibaba: '37163099962c',
  anthropic: '56c426f278a5',
  azure: '186dba800835',
  bedrock: 'ff39a8b39994',
  cerebras: 'f5949baeaa05',
  cohere: '84c8b21075b2',
  deepseek: 'fc25b2a050a8',
  googleai: 'ffdbb99f6a95',
  groq: 'b33c60c100cb',
  lmstudio: '5f00d214902a',
  localai: '3819a27b50de',
  metaai: '984866e4e273',
  mistral: 'b3c5343faead',
  modular: 'a4d34576a8b7',
  moonshot: '1e68e415d6a8',
  nvidianim: 'e6308b5a1676',
  ollama: '4a07cc9c1979',
  openai: '46c75527f5e7',
  openrouter: 'cf69e099c5f4',
  perplexity: 'a5bfe5da5b22',
  sakanaai: 'ff212bf7809f',
  togetherai: '90be8bda3562',
  xai: '35a14cb408aa',
  zai: 'd91ef080feda',
} as const satisfies LlmsDefsVersions;
