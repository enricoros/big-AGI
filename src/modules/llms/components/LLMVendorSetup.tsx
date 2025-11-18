import * as React from 'react';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';

import { findModelVendor, ModelVendorId } from '../vendors/vendors.registry';


// direct imports for all vendor setup components - NOTE: we could lazy load if this becomes a performance issue
import { AlibabaServiceSetup } from '../vendors/alibaba/AlibabaServiceSetup';
import { AnthropicServiceSetup } from '../vendors/anthropic/AnthropicServiceSetup';
import { AzureServiceSetup } from '../vendors/azure/AzureServiceSetup';
import { DeepseekAIServiceSetup } from '../vendors/deepseek/DeepseekAIServiceSetup';
import { GeminiServiceSetup } from '../vendors/gemini/GeminiServiceSetup';
import { GroqServiceSetup } from '../vendors/groq/GroqServiceSetup';
import { LMStudioServiceSetup } from '../vendors/lmstudio/LMStudioServiceSetup';
import { LocalAIServiceSetup } from '../vendors/localai/LocalAIServiceSetup';
import { MistralServiceSetup } from '../vendors/mistral/MistralServiceSetup';
import { MoonshotServiceSetup } from '../vendors/moonshot/MoonshotServiceSetup';
import { OllamaServiceSetup } from '../vendors/ollama/OllamaServiceSetup';
import { OpenAIServiceSetup } from '../vendors/openai/OpenAIServiceSetup';
import { OpenPipeServiceSetup } from '../vendors/openpipe/OpenPipeServiceSetup';
import { OpenRouterServiceSetup } from '../vendors/openrouter/OpenRouterServiceSetup';
import { PerplexityServiceSetup } from '../vendors/perplexity/PerplexityServiceSetup';
import { TogetherAIServiceSetup } from '../vendors/togetherai/TogetherAIServiceSetup';
import { XAIServiceSetup } from '../vendors/xai/XAIServiceSetup';


/**
 * Add to this map to register a new Vendor Setup Component.
 * NOTE: we do it here to only depend on this file (even lazily) and avoid to import all the Components (UI)
 *       code on vendor definitions (which must be lightweight as it impacts boot time).
 */
const vendorSetupComponents: Record<ModelVendorId, React.ComponentType<{ serviceId: DModelsServiceId }>> = {
  alibaba: AlibabaServiceSetup,
  anthropic: AnthropicServiceSetup,
  azure: AzureServiceSetup,
  deepseek: DeepseekAIServiceSetup,
  googleai: GeminiServiceSetup,
  groq: GroqServiceSetup,
  lmstudio: LMStudioServiceSetup,
  localai: LocalAIServiceSetup,
  mistral: MistralServiceSetup,
  moonshot: MoonshotServiceSetup,
  ollama: OllamaServiceSetup,
  openai: OpenAIServiceSetup,
  openpipe: OpenPipeServiceSetup,
  openrouter: OpenRouterServiceSetup,
  perplexity: PerplexityServiceSetup,
  togetherai: TogetherAIServiceSetup,
  xai: XAIServiceSetup,
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
