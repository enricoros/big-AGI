import { ChatModelId } from '../../data';

import { apiAsync } from '~/modules/trpc/trpc.client';

import { useSettingsStore } from '~/common/state/store-settings';

import { OpenAI } from './openai.types';


export const hasServerKeyOpenAI = !!process.env.HAS_SERVER_KEY_OPENAI;

export const isValidOpenAIApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;


/**
 * This function either returns the LLM response, or throws a descriptive error string
 */
export async function callChat(modelId: ChatModelId, messages: OpenAI.Wire.Chat.Message[], maxTokens?: number): Promise<OpenAI.API.Chat.Response> {
  const { apiHost, apiKey, apiOrganizationId, heliconeKey, modelTemperature } = useSettingsStore.getState();
  try {
    return await apiAsync.openai.chatGenerate.mutate({
      access: { oaiKey: apiKey, oaiHost: apiHost, oaiOrg: apiOrganizationId, heliKey: heliconeKey },
      history: messages,
      model: { id: modelId, temperature: modelTemperature, ...(maxTokens && { maxTokens }) },
    });
    // errorMessage = `issue fetching: ${response.status} · ${response.statusText}${errorPayload ? ' · ' + JSON.stringify(errorPayload) : ''}`;
  } catch (error: any) {
    const errorMessage = `fetch error: ${error?.message || error?.toString() || 'Unknown error'}`;
    console.error(`callChat: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}