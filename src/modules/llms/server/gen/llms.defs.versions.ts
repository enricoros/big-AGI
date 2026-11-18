// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'cd364594bbfd',
  _shared: '573b3fec4b8e',
  alibaba: '71947c997580',
  anthropic: 'd2521d5bd4bb',
  azure: '3f1a3500641f',
  bedrock: '73d09424d2fc',
  cerebras: '42a033e6f0c5',
  cohere: 'a9e959a00159',
  deepseek: '60fed051e6bd',
  googleai: '4bb5d7634170',
  groq: '12db8a46008e',
  lmstudio: '859106e83367',
  localai: 'defbb493e9e1',
  metaai: '246bea18cc69',
  mistral: '221f9462c37b',
  modular: '540e7a1bbf59',
  moonshot: 'd1afaaf66e26',
  nvidianim: '41331fdf6f40',
  ollama: '71ba85b21106',
  openai: '547e35977ee8',
  openrouter: '7d7f99052e5f',
  perplexity: 'c0940e5182d7',
  sakanaai: '06253ca6d496',
  togetherai: '40fabc00e827',
  xai: '1381d9df9218',
  zai: '45f3d3e7be3d',
} as const satisfies LlmsDefsVersions;
