// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'c6923bb1842b',
  _shared: 'be2aaee236f9',
  alibaba: 'ecb62387fe95',
  anthropic: 'b97db05a9fd8',
  azure: 'd906d5c84664',
  bedrock: '3fd831973a55',
  cerebras: '85d488e85def',
  cohere: 'd8b3e1c4a3f5',
  deepseek: '4f1ee8d91ed0',
  googleai: '2316dcbc01c2',
  groq: '016e3497cb63',
  lmstudio: 'b11b3fd4ec3c',
  localai: 'bcbe2397f31d',
  metaai: 'eead4d6de1eb',
  mistral: '08c3c2b10da8',
  modular: 'dc33927749bc',
  moonshot: 'da9246e24fa9',
  nvidianim: '4b22d510f9f3',
  ollama: '3e4feb4b1230',
  openai: '18993bba7034',
  openrouter: '8aa9b1f6314f',
  perplexity: '85dc331f1ac0',
  sakanaai: '2cd20abca400',
  togetherai: '9297c47349bd',
  xai: 'b59e7c0a5e2e',
  zai: 'e0dc87c0ebfb',
} as const satisfies LlmsDefsVersions;
