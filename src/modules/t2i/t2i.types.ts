import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';


// --- Data Types for persisted Engine setups ---

// T2I Vendor Types (supported image generation providers)

export type DT2IVendorType = 'openai' | 'azure' | 'localai' | 'openrouter';


// T2I Engines - instances of T2I Vendor Types - persisted in store-module-t2i

export type DT2IEngineAny = { [TVt in DT2IVendorType]: DT2IEngine<TVt> }[DT2IVendorType];

export interface DT2IEngine<TVt extends DT2IVendorType> {
  engineId: DT2IEngineId;
  vendorType: TVt;
  label: string;
  isAutoDetected: boolean;
  isAutoLinked: boolean;
  isDeleted: boolean;
  credentials: DT2ICredentials<TVt>;
  profile: DT2IProfile<TVt>;
  // timestamps for sorting and ZYNC sync
  createdAt: number;
  updatedAt: number;
}

export type DT2IEngineId = string; // agiUuidV4('t2i.engine.instance')

// helper for mapping credentials and profile types to the engine type
interface _TypeMap extends Record<DT2IVendorType, { profile: unknown; credentials: unknown }> {
  'openai': { profile: DProfileDalle; credentials: DCredentialsLLMSService };
  'azure': { profile: DProfileDalle; credentials: DCredentialsLLMSService };
  'localai': { profile: DProfileDalle; credentials: DCredentialsLLMSService };
  'openrouter': { profile: DProfileOpenRouterImages; credentials: DCredentialsLLMSService };
}


// Profiles - a vendor-specific image generation configuration (model + output
// options), analogous to DASRxProfile* for ASR. Discriminated union on `dialect`.

export type DT2IProfileAny = { [TVt in DT2IVendorType]: DT2IProfile<TVt> }[DT2IVendorType];

export type DT2IProfile<TVt extends DT2IVendorType> = _TypeMap[TVt]['profile'];

/**
 * OpenAI/DALL·E-protocol profile - shared by the openai, azure and localai
 * vendors, which all generate through the OpenAI images path.
 * NOTE: keep the model/size/quality types in sync with the server-side router
 *       schemas in `openai.router.ts` (strict subset of OpenAIWire_API_Images_Generations.Request).
 */
export interface DProfileDalle {
  dialect: 'dalle';
  dalleModelId: DalleModelSelection; // null = auto-select latest
  dalleNoRewrite: boolean;
  // -- GPT Image family --
  dalleSizeGI: DalleSizeGI;
  dalleQualityGI: DalleImageQualityGI;
  dalleBackgroundGI: DalleBackgroundGI;
  dalleOutputFormatGI: DalleOutputFormatGI;
  dalleOutputCompressionGI: number;
  dalleModerationGI: DalleModerationGI;
  // -- DALL·E 3 --
  dalleSizeD3: DalleSizeD3;
  dalleQualityD3: DalleImageQualityD3;
  dalleStyleD3: DalleImageStyleD3;
  // -- DALL·E 2 --
  dalleSizeD2: DalleSizeD2;
}

export interface DProfileOpenRouterImages {
  dialect: 'openrouter';
  imageModelId: string | null; // null = auto = first model in the curated list
}


// OpenAI/DALL·E-protocol model and output types

// Note: 'chatgpt-image-latest' also exists with same pricing as gpt-image-1.5
type GPTImageModelId = 'gpt-image-2' | 'gpt-image-1.5' | 'gpt-image-1' | 'gpt-image-1-mini';
export type DalleModelId = GPTImageModelId | 'dall-e-3' | 'dall-e-2';
export type DalleModelSelection = DalleModelId | null; // null = auto-select latest

export type DalleImageQuality = DalleImageQualityGI | DalleImageQualityD3;
export type DalleImageQualityGI = 'high' | 'medium' | 'low'; // GPT Image family
export type DalleImageQualityD3 = 'hd' | 'standard'; // DALL·E 3

export type DalleImageStyleD3 = 'vivid' | 'natural';

export type DalleBackgroundGI = 'auto' | 'transparent' | 'opaque';
export type DalleOutputFormatGI = 'png' | 'jpeg' | 'webp';
export type DalleModerationGI = 'auto' | 'low';

export type DalleImageSize = DalleSizeGI | DalleSizeD3 | DalleSizeD2;
export type DalleSize = DalleImageSize;
export type DalleSizeGI = '1024x1024' | '1536x1024' | '1024x1536'; // 'auto': would force w/h inference in the server, so we remove it
export type DalleSizeD3 = '1024x1024' | '1792x1024' | '1024x1792';
export type DalleSizeD2 = '256x256' | '512x512' | '1024x1024';


// Credentials

export type DT2ICredentialsAny = { [TVt in DT2IVendorType]: DT2ICredentials<TVt> }[DT2IVendorType];

export type DT2ICredentials<TVt extends DT2IVendorType> = _TypeMap[TVt]['credentials'];

// future: manual (api-key) engines, as in DASRxCredentials
export interface DCredentialsApiKey {
  type: 'api-key';
  apiKey: string;
  apiHost?: string;
}

export interface DCredentialsLLMSService {
  type: 'llms-service';
  serviceId: DModelsServiceId;
}

// future: system-provided engines - nothing is stored client-side; any
// authorization is handled server-side
export interface DCredentialsNone {
  type: 'none';
}
