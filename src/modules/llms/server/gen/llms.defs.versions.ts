// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '523e16c88b92',
  _shared: '03492eb00680',
  alibaba: 'cf65b0a733d8',
  anthropic: 'c3a7163cca3a',
  azure: 'db8e2cf16159',
  bedrock: '34f0a39ba7ab',
  cerebras: '23df09c33211',
  cohere: '78840c92cb81',
  deepseek: '9f0fb35a4f40',
  googleai: 'b020f80df3bb',
  groq: '512b33913e27',
  lmstudio: '4a539828739b',
  localai: '7eaeee1556ee',
  metaai: '1b2ba67f1eee',
  mistral: '5715e674063c',
  modular: '3632e208943b',
  moonshot: '1335d78d9969',
  nvidianim: '6b3b713c3457',
  ollama: '4ba4517ea6ea',
  openai: '3dff06c08172',
  openrouter: '680cbb5cc036',
  perplexity: 'ae904227d79b',
  sakanaai: 'a6b128b357bf',
  togetherai: '6e959f6b23ac',
  xai: 'aa560639ca32',
  zai: '38759990d1ea',
} as const satisfies LlmsDefsVersions;
