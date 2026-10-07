// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '489d4de68abe',
  _shared: '68133b8c1f89',
  alibaba: 'cfe761129f26',
  anthropic: '91b2fa9d3928',
  azure: 'd7a9698b050e',
  bedrock: 'e79e52a7578a',
  cerebras: '5d9a05eafc9b',
  cohere: '244b4ec3d312',
  deepseek: 'b064e339342b',
  googleai: '2eb807477e6d',
  groq: 'a5fa4dd1d8b7',
  lmstudio: 'b8278679587e',
  localai: '169ef5505991',
  metaai: '168fb30e1a09',
  mistral: '2de32b0356f3',
  modular: '8eddb3438263',
  moonshot: '82c1ddb20bc0',
  nvidianim: '09a145e95785',
  ollama: 'cd4086343dc2',
  openai: 'c15fd239cf9c',
  openrouter: '6021380d02ff',
  perplexity: 'c0ad305f4551',
  sakanaai: '440b7e29b85e',
  togetherai: '0fdf850d40c9',
  xai: '3af4421d94a3',
  zai: '03fe05e23314',
} as const satisfies LlmsDefsVersions;
