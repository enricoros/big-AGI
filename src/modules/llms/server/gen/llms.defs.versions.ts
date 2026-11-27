// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '31b221418de2',
  _shared: '15fb4619a986',
  alibaba: '3f8e37a9d48c',
  anthropic: '136db8012509',
  azure: 'e11a21ab7245',
  bedrock: 'fecb19d69fce',
  cerebras: 'f1c8ee5b04e5',
  cohere: 'de7eaf0888dd',
  deepseek: '86c8682e7173',
  googleai: '5a766dc530a3',
  groq: '06b8968145e0',
  lmstudio: '15349e839f17',
  localai: '043b377eaa88',
  metaai: 'a8be272bdbbf',
  mistral: '3c36506377af',
  modular: '1eded1a12500',
  moonshot: '55df41cae193',
  nvidianim: '886b2fcc7cfa',
  ollama: '6afaf11e021a',
  openai: 'a63dac182d50',
  openrouter: '1146dff287a3',
  perplexity: 'ff5201dcee8a',
  sakanaai: '2d3aca941e22',
  togetherai: '41b2cd219613',
  xai: 'f659a929ff54',
  zai: '28ef73fa05ad',
} as const satisfies LlmsDefsVersions;
