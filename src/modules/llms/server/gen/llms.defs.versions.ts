// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'fa942f7974cf',
  _shared: '663745fdce81',
  alibaba: 'a31218aec90a',
  anthropic: '0e0890e83ef1',
  azure: '550f483eb688',
  bedrock: 'f5ae4c209df8',
  cerebras: '36f97a6e2e68',
  cohere: '63eb881e00d3',
  deepseek: 'a265d9780c7f',
  googleai: 'a73264006060',
  groq: 'c0ad0d8c3019',
  lmstudio: '91e4e75480e8',
  localai: '63388887690c',
  metaai: 'f08c4111f84c',
  mistral: '8b627c93555c',
  modular: '365c8d72886c',
  moonshot: '0a10707c1354',
  nvidianim: '8ca5496408f0',
  ollama: '3761d6c3bf40',
  openai: '40f4885c772c',
  openrouter: '5ffcbcafe10b',
  perplexity: '5e3451814eae',
  sakanaai: 'c0e2fb605571',
  togetherai: 'c0dded4ccef6',
  xai: '968fcc64cd79',
  zai: '52b2dabfe937',
} as const satisfies LlmsDefsVersions;
