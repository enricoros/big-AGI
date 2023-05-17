import { DLLMId } from '~/modules/llms/llm.types';
import { callChatGenerate } from '~/modules/llms/llm.client';

import { DConversation } from '~/common/state/store-chats';

import { FLATTEN_PROFILES, FlattenStyleType } from './flatten.data';


export async function flattenConversation(llmId: DLLMId, conversation: DConversation, type: FlattenStyleType): Promise<string | null> {

  // get flattening instruction
  const flattenStyle = FLATTEN_PROFILES.find(s => s.type === type);
  const systemInstruction = flattenStyle?.systemPrompt;
  const userPrefixPrompt = flattenStyle?.userPrompt;
  if (!systemInstruction) throw new Error('flattenConversation: no prompt found for type: ' + type);

  // call the flattening function
  const chatResponse = await callChatGenerate(llmId, [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: encodeConversationAsUserMessage(userPrefixPrompt || '', conversation) },
  ]);

  return chatResponse.content?.trim() ?? null;
}


function encodeConversationAsUserMessage(userPrompt: string, conversation: DConversation): string {
  let encodedMessages = '';

  for (const message of conversation.messages) {
    if (message.role === 'system') continue;
    const author = message.role === 'user' ? 'User' : 'Assistant';
    const text = message.text.replace(/\n/g, '\n\n');
    encodedMessages += `---${author}---\n${text}\n\n`;
  }

  return userPrompt ? userPrompt + '\n\n' + encodedMessages.trim() : encodedMessages.trim();
}
