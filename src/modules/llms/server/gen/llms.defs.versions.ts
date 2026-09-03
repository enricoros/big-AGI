// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'fa7b811bde23',
  _shared: '3997d34429b9',
  alibaba: '6a0274ac4e3a',
  anthropic: '3aa65e8df260',
  azure: 'c1fc7c280ea9',
  bedrock: '9c3c0daf3ae5',
  cerebras: '6a3de69e5bf2',
  cohere: '47a2614b961e',
  deepseek: 'e48d6deab4d0',
  googleai: '88c0fdd77357',
  groq: '3a0b884b2c58',
  lmstudio: '1eb72f43ff72',
  localai: 'f8976bbad443',
  metaai: '27f5e3378399',
  mistral: '38db2bf48150',
  modular: 'd41da765ddb5',
  moonshot: '5e8f86944d9d',
  nvidianim: 'aefb7d28deea',
  ollama: '68677b6961bc',
  openai: 'e00d8ece1854',
  openrouter: '0de5d390980f',
  perplexity: 'ac000c7e489e',
  sakanaai: '0f38e019779c',
  togetherai: 'a07243a9b555',
  xai: '4d60b8417f0a',
  zai: '96306af7b482',
} as const satisfies LlmsDefsVersions;
