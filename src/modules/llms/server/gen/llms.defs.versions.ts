// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'ce72e2acbe75',
  _shared: '2c7483b9f037',
  alibaba: '72950eabb6ca',
  anthropic: '96a232308676',
  azure: 'c336f6b00eb3',
  bedrock: 'fe3826884a26',
  cerebras: '63aa3ec98854',
  cohere: '7b009730df61',
  deepseek: '1370beca22f5',
  googleai: 'b0201fe7c6c2',
  groq: '59ff3dfb1c3d',
  lmstudio: '44352d89892c',
  localai: '1e96ec6cf1c7',
  metaai: 'c14cf106f0eb',
  mistral: 'f4abf9a3964b',
  modular: 'a0a2d9835e33',
  moonshot: '6cfaccd2e304',
  nvidianim: 'c16b43eaa3d5',
  ollama: '0c5df0c3342d',
  openai: 'e7dafb2cd667',
  openrouter: 'b89a2923c4ea',
  perplexity: 'e9faa25f04dd',
  sakanaai: '058e730fbebf',
  togetherai: 'c8866c6cb017',
  xai: '5ff3ff108d2b',
  zai: '3109b255c81f',
} as const satisfies LlmsDefsVersions;
