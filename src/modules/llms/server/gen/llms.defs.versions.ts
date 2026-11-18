// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'c08db32c35dc',
  _shared: '5509f74d81ec',
  alibaba: '7addfdeb1477',
  anthropic: '856f58b0f605',
  azure: 'eed0a20a90c7',
  bedrock: 'c2ae5734f236',
  cerebras: 'd6f7deed6bd4',
  cohere: '113eb310d9ad',
  deepseek: '6d6931923189',
  googleai: '4496cd49ccb1',
  groq: 'a39d38d678de',
  lmstudio: 'b8f94b69b825',
  localai: '75cc19d984f2',
  metaai: 'a47c815ed772',
  mistral: 'e03dbdf8859a',
  modular: 'd56acac68fbe',
  moonshot: 'eb49278c73a8',
  nvidianim: 'f49fe7250908',
  ollama: 'b298348379c2',
  openai: '2431846b659d',
  openrouter: 'e0f562c9d1fd',
  perplexity: '81b17563c52e',
  sakanaai: '358edeb2a215',
  togetherai: '482813a35994',
  xai: 'c4d73d2c373c',
  zai: 'f02342084784',
} as const satisfies LlmsDefsVersions;
