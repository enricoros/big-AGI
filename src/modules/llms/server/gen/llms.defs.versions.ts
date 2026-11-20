// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'ccfe92e2a708',
  _shared: '4cd86b8f645e',
  alibaba: '7e153bc67bdb',
  anthropic: '1fe5989d6d5e',
  azure: '6a6b709578f8',
  bedrock: 'e92f16943dbe',
  cerebras: '09c5f2583fbf',
  cohere: '83c538828876',
  deepseek: 'a4365e20d805',
  googleai: '5c067b0f3307',
  groq: '5f88b1ce8756',
  lmstudio: '913ed26d9727',
  localai: '9c2db550515c',
  metaai: 'ae7d928dbdcb',
  mistral: 'd08a5d9ff61a',
  modular: 'b35e745c0e89',
  moonshot: '96f2c1afc593',
  nvidianim: '600fe4106d45',
  ollama: '4dde1cee1ffa',
  openai: '26f9af685a00',
  openrouter: 'ed5f0962dbbf',
  perplexity: '6ced1552922f',
  sakanaai: '9d6c96a2a49a',
  togetherai: '04a1ca54d53a',
  xai: 'abd7469b5db3',
  zai: 'de8f706a8056',
} as const satisfies LlmsDefsVersions;
