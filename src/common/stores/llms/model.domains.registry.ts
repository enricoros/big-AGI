import type { DModelDomainId } from './model.domains.types';
import type { DModelInterfaceV1 } from './llms.types';


type ModelDomainSpec = {
  label: string;
  confLabel: string;
  confTooltip: string;
  description: string;
  recommended?: string;
  requiredInterfaces?: DModelInterfaceV1[];
  autoStrategy: 'topVendorTopLlm' | 'topVendorLowestCost';
  fallbackDomain?: DModelDomainId;
};


export const ModelDomainsList: DModelDomainId[] = ['primaryChat', 'codeApply', 'fastUtil'] as const;

export const ModelDomainsRegistry: Record<DModelDomainId, ModelDomainSpec> = {
  primaryChat: {
    label: 'Primary Chat',
    confLabel: 'Chat',
    confTooltip: 'Default model for new Chats',
    description: 'Main conversational model',
    requiredInterfaces: [],
    autoStrategy: 'topVendorTopLlm',
  },
  codeApply: {
    label: 'Code Editor',
    confLabel: 'Code',
    confTooltip: 'Model for applying code changes and other code-related complex operations. E.g. Sonnet 3.5',
    description: 'Code changes editor and applicator',
    recommended: 'Sonnet 3.5',
    requiredInterfaces: [],
    autoStrategy: 'topVendorTopLlm',
    fallbackDomain: 'fastUtil',
  },
  fastUtil: {
    label: 'Fast Utility',
    confLabel: 'Fast',
    confTooltip: 'Use this Model for "fast" features, such as Auto-Title, Summarize, etc.',
    description: 'Quick response model for simple tasks',
    autoStrategy: 'topVendorLowestCost',
    requiredInterfaces: [], // shall be [LLM_IF_OAI_Fn], but we don't inforce for now
  },
};


// NOTE: the following is not ready and is even misleading.
//       For now, we'll only have a single type for the domainId, for tracking.
//
// ModelSpace - ideas:
// - Tiers: primary, secondary, utility, ...
// - Capabilities: expert, standard, basic, ...
// - Functions: reasoning, creative, processing, ...
// - Domains: general, specialized, task-specific, ...
//
// const ModelSpaceDimensionRegistry = {
//
//   modelTier: {
//     label: 'Model Tier',
//     type: 'enum' as const,
//     values: ['primary', 'utility'] as const,
//     description: 'The tier of the model',
//   } as const,
//
//   modelFunction: {
//     label: 'Model Function',
//     type: 'enum' as const,
//     values: ['reasoning', 'creative', 'processing'] as const,
//     description: 'The primary function of the model',
//   },
//
//   // ...
//
// } as const;
