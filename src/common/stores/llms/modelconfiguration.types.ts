import type { DLLMId } from './llms.types';
import type { DModelParameterValues } from './llms.parameters';


export type DModelConfiguration = DModelConfigurationParametric;

type DModelConfigurationParametric = {
  mct: 'model-parametric';

  // simpler version of a search space
  domainId: DModelDomainId;

  // configuration of the model and its parameters
  // NOTE: this is flattened into DLLM already, with a base and user override configuration
  modelId: DLLMId | null;
  modelParameters?: DModelParameterValues; // this is an override, to be overlaid on top of other configurations, if any
}

type DModelDomainId = 'primaryChat' | 'fastUtil';


/// Future: Model Search Space ///

/*

NOTE: the following is not ready and is even misleading.
      For now, we'll only have a single type for the domainId, for tracking.

ModelSpace - ideas:
- Tiers: primary, secondary, utility, ...
- Capabilities: expert, standard, basic, ...
- Functions: reasoning, creative, processing, ...
- Domains: general, specialized, task-specific, ...

const ModelSpaceDimensionRegistry = {

  modelTier: {
    label: 'Model Tier',
    type: 'enum' as const,
    values: ['primary', 'utility'] as const,
    description: 'The tier of the model',
  } as const,

  modelFunction: {
    label: 'Model Function',
    type: 'enum' as const,
    values: ['reasoning', 'creative', 'processing'] as const,
    description: 'The primary function of the model',
  }

  // ...

} as const;

*/