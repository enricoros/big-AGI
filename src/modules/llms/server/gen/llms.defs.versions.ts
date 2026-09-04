// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '0c331b2f6aaa',
  _shared: 'c1a36cfda2fc',
  alibaba: '925413734b0d',
  anthropic: 'd10dccf1a81e',
  azure: '4db4ef691f51',
  bedrock: '9d33221efd37',
  cerebras: '2ecc92a8770c',
  cohere: '05612b690592',
  deepseek: 'a58f8685f6fa',
  googleai: 'a127e0944ed7',
  groq: '0d811c2fbfbc',
  lmstudio: 'c609c438006d',
  localai: 'b8b1118ca7d5',
  metaai: '38d58b28ec19',
  mistral: '127292af575f',
  modular: 'a1b4f61a267e',
  moonshot: '6332e04acaee',
  nvidianim: '1828638e8057',
  ollama: 'bcc85b9edd31',
  openai: '782a2b9e0f62',
  openrouter: '1e2dcdc2de4f',
  perplexity: '281772aa6168',
  sakanaai: 'b4f1e0ca78f3',
  togetherai: '2b070aec764c',
  xai: 'b815e426a829',
  zai: 'ef9a78155c70',
} as const satisfies LlmsDefsVersions;
