// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '5d88aa1519bc',
  _shared: '60e019e8ab69',
  alibaba: 'ec2d431ba1e7',
  anthropic: 'a613d132a205',
  azure: 'c6282634bccd',
  bedrock: 'a4ce038c55a6',
  cerebras: '24bdd1bb388a',
  cohere: '954a07a795ab',
  deepseek: '5587799783a1',
  googleai: '05a83d721ffb',
  groq: '1682d5f2b683',
  lmstudio: 'c9ad0a1f193b',
  localai: '8214eb16403b',
  metaai: '1c6860fd40c6',
  mistral: 'fdf1a7d6a5d2',
  modular: '9ca675946501',
  moonshot: '7cf78090d6ae',
  nvidianim: '2e4bcfdd0f52',
  ollama: 'f0bb7d0f3613',
  openai: '1e58e7b6bc3a',
  openrouter: 'a7632de6ba16',
  perplexity: 'e45f03117d7b',
  sakanaai: '2e2859f988c6',
  togetherai: 'd1d4ef479336',
  xai: '961d0c02e777',
  zai: '20d654b2e539',
} as const satisfies LlmsDefsVersions;
