// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'b1258256c5d9',
  _shared: 'ef23fd563824',
  alibaba: 'a0a254753628',
  anthropic: '6a1731621b47',
  azure: '0eecb80c8ef9',
  bedrock: '0ed037c90367',
  cerebras: '1dc8a44b2aff',
  cohere: '6697a41e21a8',
  deepseek: '091952e57c71',
  googleai: '0da8a3770eaa',
  groq: '7b3735238dff',
  lmstudio: '3c78cc131c69',
  localai: '2436a20811e8',
  mistral: 'b2ad6e670b6b',
  modular: 'fd1dcc863fd9',
  moonshot: '29fa244c82b5',
  nvidianim: 'bced6eec4b24',
  ollama: '46b5ab8ea4d3',
  openai: 'f480a314c17a',
  openrouter: '2b7fc33a6fec',
  perplexity: 'fd4b45dabd63',
  sakanaai: 'a82bdda31e2f',
  togetherai: '9085df1b0fc1',
  xai: '9a2a7a156112',
  zai: 'cfc0064b8414',
} as const satisfies LlmsDefsVersions;
