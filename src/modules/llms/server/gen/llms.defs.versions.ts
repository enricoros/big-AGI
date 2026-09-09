// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'eb873a4cc5cd',
  _shared: 'a8b22b12caed',
  alibaba: '624c6250cf91',
  anthropic: '85ca93440c49',
  azure: '1d61ea37dade',
  bedrock: 'e9d3793fafda',
  cerebras: '03f023df04bc',
  cohere: 'fbdbf003684f',
  deepseek: 'da26fdec575e',
  googleai: 'c8888f23f144',
  groq: '79567c09d123',
  lmstudio: '1e9bc67c7861',
  localai: '1e7474477ae9',
  metaai: '7b90fe8d8c9a',
  mistral: 'bf2e0f3ac119',
  modular: '3da4185eda31',
  moonshot: '458d34c6ceff',
  nvidianim: 'cb85069431f7',
  ollama: '4d886ccd3204',
  openai: '5620ef0e1bb6',
  openrouter: '3e73ec8028f6',
  perplexity: '1cf356592b51',
  sakanaai: 'feada733a2ca',
  togetherai: '01501df3c7a4',
  xai: '766b561d7b87',
  zai: '323d37d5580f',
} as const satisfies LlmsDefsVersions;
