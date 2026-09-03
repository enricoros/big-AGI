import * as React from 'react';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import type { SiteDocSlug } from '~/common/gen/com.site.docs.slug';

import { findModelVendor, ModelVendorId } from '../vendors/vendors.registry';


// direct imports for all vendor setup components - NOTE: we could lazy load if this becomes a performance issue
import { AlibabaServiceSetup } from '../vendors/alibaba/AlibabaServiceSetup';
import { AnthropicServiceSetup } from '../vendors/anthropic/AnthropicServiceSetup';
import { AzureServiceSetup } from '../vendors/azure/AzureServiceSetup';
import { BedrockServiceSetup } from '../vendors/bedrock/BedrockServiceSetup';
import { CerebrasServiceSetup } from '../vendors/cerebras/CerebrasServiceSetup';
import { CohereServiceSetup } from '../vendors/cohere/CohereServiceSetup';
import { DeepseekAIServiceSetup } from '../vendors/deepseek/DeepseekAIServiceSetup';
import { GeminiServiceSetup } from '../vendors/gemini/GeminiServiceSetup';
import { GroqServiceSetup } from '../vendors/groq/GroqServiceSetup';
import { LMStudioServiceSetup } from '../vendors/lmstudio/LMStudioServiceSetup';
import { LocalAIServiceSetup } from '../vendors/localai/LocalAIServiceSetup';
import { MetaAIServiceSetup } from '../vendors/metaai/MetaAIServiceSetup';
import { MistralServiceSetup } from '../vendors/mistral/MistralServiceSetup';
import { ModularServiceSetup } from '../vendors/modular/ModularServiceSetup';
import { MoonshotServiceSetup } from '../vendors/moonshot/MoonshotServiceSetup';
import { NvidiaNIMServiceSetup } from '../vendors/nvidianim/NvidiaNIMServiceSetup';
import { OllamaServiceSetup } from '../vendors/ollama/OllamaServiceSetup';
import { OpenAIServiceSetup } from '../vendors/openai/OpenAIServiceSetup';
import { OpenRouterServiceSetup } from '../vendors/openrouter/OpenRouterServiceSetup';
import { PerplexityServiceSetup } from '../vendors/perplexity/PerplexityServiceSetup';
import { SakanaAIServiceSetup } from '../vendors/sakanaai/SakanaAIServiceSetup';
import { TogetherAIServiceSetup } from '../vendors/togetherai/TogetherAIServiceSetup';
import { XAIServiceSetup } from '../vendors/xai/XAIServiceSetup';
import { ZAIServiceSetup } from '~/modules/llms/vendors/zai/ZAIServiceSetup';


/**
 * Add to this map to register a new Vendor Setup Component.
 * NOTE: we do it here to only depend on this file (even lazily) and avoid to import all the Components (UI)
 *       code on vendor definitions (which must be lightweight as it impacts boot time).
 */
const vendorSetupComponents: Record<ModelVendorId, React.ComponentType<{ serviceId: DModelsServiceId }>> = {
  alibaba: AlibabaServiceSetup,
  anthropic: AnthropicServiceSetup,
  azure: AzureServiceSetup,
  bedrock: BedrockServiceSetup,
  cerebras: CerebrasServiceSetup,
  cohere: CohereServiceSetup,
  deepseek: DeepseekAIServiceSetup,
  googleai: GeminiServiceSetup,
  groq: GroqServiceSetup,
  lmstudio: LMStudioServiceSetup,
  localai: LocalAIServiceSetup,
  metaai: MetaAIServiceSetup,
  mistral: MistralServiceSetup,
  modular: ModularServiceSetup,
  moonshot: MoonshotServiceSetup,
  nvidianim: NvidiaNIMServiceSetup,
  ollama: OllamaServiceSetup,
  openai: OpenAIServiceSetup,
  openrouter: OpenRouterServiceSetup,
  perplexity: PerplexityServiceSetup,
  sakanaai: SakanaAIServiceSetup,
  togetherai: TogetherAIServiceSetup,
  xai: XAIServiceSetup,
  zai: ZAIServiceSetup,
} as const;


/**
 * Vendor -> big-agi.com/docs setup page. Written out because some ids differ from their slug
 * Record<ModelVendorId, ...> is exhaustive so a new vendor cannot be registered without a docs slug (build-checked via SiteDocSlug).
 */
export const VENDOR_DOCS: Record<ModelVendorId, SiteDocSlug> = {
  alibaba: 'connect-alibaba',
  anthropic: 'connect-anthropic',
  azure: 'connect-azure',
  bedrock: 'connect-bedrock',
  cerebras: 'connect-cerebras',
  cohere: 'connect-cohere',
  deepseek: 'connect-deepseek',
  googleai: 'connect-gemini',
  groq: 'connect-groq',
  lmstudio: 'connect-lmstudio',
  localai: 'connect-localai',
  metaai: 'connect-meta',
  mistral: 'connect-mistral',
  modular: 'connect-modular',
  moonshot: 'connect-moonshot-ai',
  nvidianim: 'connect-nvidia-nim',
  ollama: 'connect-ollama',
  openai: 'connect-openai',
  openrouter: 'connect-openrouter',
  perplexity: 'connect-perplexity',
  sakanaai: 'connect-sakana',
  togetherai: 'connect-together',
  xai: 'connect-xai',
  zai: 'connect-zai',
} as const;

export function LLMVendorSetup(props: { service: DModelsService }) {
  const vendor = findModelVendor(props.service.vId);
  if (!vendor)
    return 'Configuration issue: Vendor not found for Service ' + props.service.id;

  const SetupComponent = vendorSetupComponents[vendor.id];
  if (!SetupComponent)
    return 'Configuration issue: Setup component not found for vendor ' + vendor.id;

  return <SetupComponent key={props.service.id} serviceId={props.service.id} />;
}
