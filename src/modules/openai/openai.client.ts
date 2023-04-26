import { ChatModelId } from '../../data';
import { useSettingsStore } from '@/common/state/store-settings';

import { OpenAI } from './openai.types';


export const requireUserKeyOpenAI = !process.env.HAS_SERVER_KEY_OPENAI;

export const isValidOpenAIApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;


/**
 * This function either returns the LLM response, or throws a descriptive error string
 */
export async function callChat(modelId: ChatModelId, messages: OpenAI.Wire.Chat.Message[], maxTokens?: number): Promise<OpenAI.API.Chat.Response> {

  // this payload contains the 'api' key, org, host
  const payload: OpenAI.API.Chat.Request = {
    api: getOpenAISettings(),
    model: modelId,
    messages,
    ...(maxTokens !== undefined && { max_tokens: maxTokens }),
  };

  let errorMessage: string;
  try {
    const response = await fetch('/api/openai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok)
      return await response.json();

    // decode a possible error payload, if present, but ignore if missing
    let errorPayload: any = null;
    try {
      errorPayload = await response.json();
    } catch (error: any) {
      // ignore - it's expected there may not be a payload
    }
    errorMessage = `issue fetching: ${response.status} · ${response.statusText}${errorPayload ? ' · ' + JSON.stringify(errorPayload) : ''}`;
  } catch (error: any) {
    errorMessage = `fetch error: ${error?.message || error?.toString() || 'Unknown error'}`;
  }

  console.error(`callChat: ${errorMessage}`);
  throw new Error(errorMessage);
}


export const getOpenAISettings = (): OpenAI.API.Configuration => {
  const { apiKey, apiHost, apiOrganizationId } = useSettingsStore.getState();
  return {
    ...(apiKey ? { apiKey } : {}),
    ...(apiHost ? { apiHost } : {}),
    ...(apiOrganizationId ? { apiOrganizationId } : {}),
  };
};