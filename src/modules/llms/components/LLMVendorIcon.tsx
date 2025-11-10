import * as React from 'react';

import type { SvgIconProps } from '@mui/joy';

import type { ModelVendorId } from '../vendors/vendors.registry';

// fallback icon
import { PhRobot } from '~/common/components/icons/phosphor/PhRobot';


// direct imports for all vendor icons - given we use them frequently, we won't consider lazy loading them
import { AlibabaCloudIcon } from '~/common/components/icons/vendors/AlibabaCloudIcon';
import { AnthropicIcon } from '~/common/components/icons/vendors/AnthropicIcon';
import { AzureIcon } from '~/common/components/icons/vendors/AzureIcon';
import { DeepseekIcon } from '~/common/components/icons/vendors/DeepseekIcon';
import { GeminiIcon } from '~/common/components/icons/vendors/GeminiIcon';
import { GroqIcon } from '~/common/components/icons/vendors/GroqIcon';
import { LMStudioIcon } from '~/common/components/icons/vendors/LMStudioIcon';
import { LocalAIIcon } from '~/common/components/icons/vendors/LocalAIIcon';
import { MistralIcon } from '~/common/components/icons/vendors/MistralIcon';
import { MoonshotIcon } from '~/common/components/icons/vendors/MoonshotIcon';
import { OllamaIcon } from '~/common/components/icons/vendors/OllamaIcon';
import { OpenAIIcon } from '~/common/components/icons/vendors/OpenAIIcon';
import { OpenPipeIcon } from '~/common/components/icons/vendors/OpenPipeIcon';
import { OpenRouterIcon } from '~/common/components/icons/vendors/OpenRouterIcon';
import { PerplexityIcon } from '~/common/components/icons/vendors/PerplexityIcon';
import { TogetherIcon } from '~/common/components/icons/vendors/TogetherIcon';
import { XAIIcon } from '~/common/components/icons/vendors/XAIIcon';


/**
 * Add to this registry to register a new Vendor Icon.
 *
 * They are used throughout the app and frequently.
 */
const vendorIcons: Record<ModelVendorId, React.FunctionComponent<SvgIconProps>> = {
  alibaba: AlibabaCloudIcon,
  anthropic: AnthropicIcon,
  azure: AzureIcon,
  deepseek: DeepseekIcon,
  googleai: GeminiIcon,
  groq: GroqIcon,
  lmstudio: LMStudioIcon,
  localai: LocalAIIcon,
  mistral: MistralIcon,
  moonshot: MoonshotIcon,
  ollama: OllamaIcon,
  openai: OpenAIIcon,
  openpipe: OpenPipeIcon,
  openrouter: OpenRouterIcon,
  perplexity: PerplexityIcon,
  togetherai: TogetherIcon,
  xai: XAIIcon,
};


/**
 * Get the icon component for a vendor ID
 * @param vendorId - The vendor ID to get the icon for
 * @returns The icon component or undefined if not found
 */
export function llmsGetVendorIcon(vendorId: ModelVendorId | undefined): React.FunctionComponent<SvgIconProps> {
  return vendorId ? vendorIcons[vendorId] ?? PhRobot : PhRobot;
}

/**
 * Render a vendor icon with optional props
 * @param vendorId - The vendor ID to render the icon for
 * @param props - Optional SVG icon props to pass to the icon component
 * @returns The rendered icon element or null if vendor not found
 */
export function LLMVendorIcon({ vendorId, ...props }: { vendorId: ModelVendorId | undefined } & SvgIconProps): React.ReactElement {
  const Icon = llmsGetVendorIcon(vendorId);
  return <Icon {...props} />;
}


/**
 * Type guard to check if a vendor has an icon
 * @param vendorId - The vendor ID to check
 * @returns True if the vendor has an icon
 */
export function hasVendorIcon(vendorId: ModelVendorId | undefined): boolean {
  return !!vendorId && !!vendorIcons[vendorId];
}


/**
 * Get all vendor icons as an array
 * @returns Array of {vendorId, Icon} objects
 */
export function getAllVendorIcons(): Array<{ vendorId: ModelVendorId; Icon: React.FunctionComponent<SvgIconProps> }> {
  return Object.entries(vendorIcons).map(([vendorId, Icon]) => ({
    vendorId: vendorId as ModelVendorId,
    Icon,
  }));
}
