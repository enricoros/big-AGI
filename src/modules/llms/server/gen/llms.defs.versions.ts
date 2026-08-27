// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'a0838cd45f25',
  _shared: 'ef23fd563824',
  alibaba: 'a0a254753628',
  anthropic: '6a1731621b47',
  azure: '0eecb80c8ef9',
  bedrock: '0ed037c90367',
  cerebras: '1dc8a44b2aff',
  cohere: '6697a41e21a8',
  deepseek: '091952e57c71',
  googleai: 'b7740248766a',
  groq: '7b3735238dff',
  lmstudio: '3c78cc131c69',
  localai: '2436a20811e8',
  mistral: 'b2ad6e670b6b',
  modular: 'fd1dcc863fd9',
  moonshot: '29fa244c82b5',
  nvidianim: 'bced6eec4b24',
  ollama: '46b5ab8ea4d3',
  openai: 'f480a314c17a',
  openrouter: '4321c31536de',
  perplexity: 'fd4b45dabd63',
  sakanaai: 'a82bdda31e2f',
  togetherai: 'd6194030c98b',
  xai: '9a2a7a156112',
  zai: '172796c03d59',
} as const satisfies LlmsDefsVersions;
