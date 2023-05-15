import type React from 'react';
import type { SourceSetupLocalAI } from './localai/vendor';
import type { SourceSetupOpenAI } from './openai/vendor';

export type DLLMId = string;
export type DLLMTags = 'stream' | 'chat';
export type DLLMValues = object; //DLLMValuesOpenAI | DLLMVaLocalAIDLLMValues;
export type DModelSourceId = string;
export type DModelSourceSetup = SourceSetupOpenAI | SourceSetupLocalAI;
export type ModelVendorId = 'localai' | 'openai'; // | 'anthropic' | 'azure_openai' | 'google_vertex';


/// Large Language Model - a model that can generate text
export interface DLLM {
  id: DLLMId;
  label: string;
  created: number | 0;
  description: string;
  tags: DLLMTags[];
  contextTokens: number;
  hidden: boolean;

  // llm -> source
  sId: DModelSourceId;
  _source: DModelSource;

  // llm-specific
  settings: Partial<DLLMValues>;
}


/// An origin of models - has enough parameters to list models and invoke generation
export interface DModelSource {
  id: DModelSourceId;
  label: string;

  // source -> vendor
  vId: ModelVendorId;

  // source-specific
  setup: Partial<DModelSourceSetup>;
}


/// Hardcoded vendors - have factory methods to enable dynamic configuration / access
export interface ModelVendor {
  id: ModelVendorId;
  name: string;
  rank: number;
  icon: React.JSX.Element | null;
  location: 'local' | 'cloud';
  instanceLimit: number;
  disabled?: boolean; // probably remove

  // factories
  createSource: (sourceId: DModelSourceId, sourceCount: number) => DModelSource;
  createSourceSetupComponent: (sourceId: DModelSourceId) => React.JSX.Element;
  createLLMSettingsComponent: (llmId: DLLMId) => React.JSX.Element;
}