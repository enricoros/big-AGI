// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '6961648430a8',
  _shared: 'ef23fd563824',
  alibaba: '130fe836f9ef',
  anthropic: '97ea5a3b93bc',
  azure: '386649253d84',
  bedrock: 'a793c45f9584',
  cerebras: '26c51ecaa1ae',
  cohere: '6697a41e21a8',
  deepseek: 'c9b5bcea110f',
  googleai: '0da8a3770eaa',
  groq: 'da3cf1a476b3',
  lmstudio: 'a16f56ea63d8',
  localai: '2436a20811e8',
  mistral: 'd0d695e24efe',
  modular: 'fd1dcc863fd9',
  moonshot: 'c4527ebf9210',
  nvidianim: 'e23261802de8',
  ollama: '6d541531b951',
  openai: 'b6f5b6a6d889',
  openrouter: 'a4de5155714a',
  perplexity: 'fd4b45dabd63',
  sakanaai: 'e8ae00ba806d',
  togetherai: '9085df1b0fc1',
  xai: '9a2a7a156112',
  zai: '92b2347ba1dc',
} as const satisfies LlmsDefsVersions;
