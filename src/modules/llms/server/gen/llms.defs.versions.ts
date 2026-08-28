// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '374f8657e14b',
  _shared: '0891c44fbc22',
  alibaba: 'f80955b134a1',
  anthropic: '543fb2cb9a6c',
  azure: 'c9a0d773618c',
  bedrock: 'cf162ec637c2',
  cerebras: '0b09a4e8fe98',
  cohere: '699143375ebc',
  deepseek: 'cafdc2b74624',
  googleai: '2e434e8fcb21',
  groq: 'c0aea952c8ca',
  lmstudio: '88335246bf94',
  localai: '641d75fd0f1f',
  mistral: '0f2b65e52116',
  modular: '5b4d76b1cf04',
  moonshot: 'a18502daa906',
  nvidianim: 'b758cdb0d04e',
  ollama: 'b2d4f1631f72',
  openai: '6f0f9af1e450',
  openrouter: '0b2f6776177c',
  perplexity: '1f81513f96c0',
  sakanaai: '78a59d143e80',
  togetherai: 'ff8d3d0d58ad',
  xai: 'a6549966314b',
  zai: '6673dd478d60',
} as const satisfies LlmsDefsVersions;
