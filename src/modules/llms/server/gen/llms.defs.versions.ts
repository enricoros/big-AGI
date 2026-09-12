// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '340bb783cf43',
  _shared: '407107c3274a',
  alibaba: '06efedd7c1d3',
  anthropic: 'df7037948637',
  azure: 'cc9c2f9d3860',
  bedrock: 'f3eaffcbbcbb',
  cerebras: '8262faf195a3',
  cohere: '6bbca3f18685',
  deepseek: '405ea7e7ae0b',
  googleai: '4be9ee78e06e',
  groq: '22c7c86b292e',
  lmstudio: 'c40e90b8651b',
  localai: '3352bbae24ce',
  metaai: 'ad11595cd897',
  mistral: '4fce7c6ecaee',
  modular: '1223cf15c8d6',
  moonshot: '1c04f5a60ea5',
  nvidianim: '98ef690a8934',
  ollama: 'c9c18e6600e5',
  openai: '970f492bca59',
  openrouter: '736799514f28',
  perplexity: 'c19febc5322f',
  sakanaai: '90742f7bfe04',
  togetherai: '00ed1ef77481',
  xai: '3a27d3f47e97',
  zai: '8efe7e1936f8',
} as const satisfies LlmsDefsVersions;
