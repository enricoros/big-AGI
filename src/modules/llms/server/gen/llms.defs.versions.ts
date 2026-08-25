// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '4eaef5d59035',
  _shared: 'ef23fd563824',
  alibaba: '130fe836f9ef',
  anthropic: '3e734a9bf5d9',
  azure: '386649253d84',
  bedrock: '8c04924c2e7a',
  cerebras: '1dc8a44b2aff',
  cohere: '6697a41e21a8',
  deepseek: '091952e57c71',
  googleai: '0da8a3770eaa',
  groq: '7b3735238dff',
  lmstudio: '3c78cc131c69',
  localai: '2436a20811e8',
  mistral: '1062f2733807',
  modular: 'fd1dcc863fd9',
  moonshot: '29fa244c82b5',
  nvidianim: 'e23261802de8',
  ollama: '6d541531b951',
  openai: 'b6f5b6a6d889',
  openrouter: 'f0f1da89cf89',
  perplexity: 'fd4b45dabd63',
  sakanaai: 'a82bdda31e2f',
  togetherai: '9085df1b0fc1',
  xai: '9a2a7a156112',
  zai: 'cfc0064b8414',
} as const satisfies LlmsDefsVersions;
