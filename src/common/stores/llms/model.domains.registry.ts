import type { DModelDomainId } from './model.domains.types';
import { DModelInterfaceV1, LLM_IF_OAI_Fn } from './llms.types';


type ModelDomainSpec = {
  label: string;
  confLabel: string;
  confTooltip: string;
  description: string;
  recommended?: string;
  /**
   * If non-empty, this domain demands that the assigned LLM
   * must have *all* the listed interfaces. If no LLM matches,
   * we'll fallback to ignoring the filter.
   */
  requiredInterfaces?: DModelInterfaceV1[];
  autoStrategy: 'topVendorTopLlm' | 'topVendorLowestCost';
  fallbackDomain?: DModelDomainId;
};


export const ModelDomainsList: DModelDomainId[] = ['primaryChat', 'codeApply', 'fastUtil', 'imageCaption'] as const;

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
    requiredInterfaces: [LLM_IF_OAI_Fn],
    autoStrategy: 'topVendorTopLlm',
    fallbackDomain: 'fastUtil',
  },
  fastUtil: {
    label: 'Fast Utility',
    confLabel: 'Fast',
    confTooltip: 'Use this Model for "fast" features, such as Auto-Title, Summarize, etc.',
    description: 'Quick response model for simple tasks',
    autoStrategy: 'topVendorLowestCost',
    requiredInterfaces: [LLM_IF_OAI_Fn], // NOTE: we do enforce this already, although this may not be correctly set for all vendors
  },
  imageCaption: {
    label: 'Image Captioning',
    confLabel: 'Vision',
    confTooltip: 'Vision model for image captioning',
    description: 'Describes images as text',
    recommended: 'Qwen VL',
    autoStrategy: 'topVendorTopLlm',
    fallbackDomain: 'primaryChat',
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
