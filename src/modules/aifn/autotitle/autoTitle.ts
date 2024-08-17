import { llmChatGenerateOrThrow, VChatMessageIn } from '~/modules/llms/llm.client';

import { getFastLLMId } from '~/common/stores/llms/store-llms';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { useChatStore } from '~/common/stores/chat/store-chats';


/**
 * Creates the AI titles for conversations, by taking the last 5 first-lines and asking AI what's that about
 * @returns true if the title was actually replaced (for instance, it may not be needed)
 */
export async function autoConversationTitle(conversationId: string, forceReplace: boolean): Promise<boolean> {

  // use valid fast model
  const fastLLMId = getFastLLMId();
  if (!fastLLMId) return false;

  // only operate on valid conversations, without any title
  const { conversations, setAutoTitle, setUserTitle } = useChatStore.getState();
  const conversation = conversations.find(c => c.id === conversationId) ?? null;
  if (!conversation || (!forceReplace && (conversation.autoTitle || conversation.userTitle))) return false;

  if (forceReplace) {
    setUserTitle(conversationId, '');
    setAutoTitle(conversationId, '✨...');
  }

  // first line of the last 5 messages
  const historyLines: string[] = conversation.messages.filter(m => m.role !== 'system').slice(-5).map(m => {
    const messageText = messageFragmentsReduceText(m.fragments);
    let text = messageText.split('\n')[0];
    text = text.length > 50 ? text.substring(0, 50) + '...' : text;
    text = `${m.role === 'user' ? 'You' : 'Assistant'}: ${text}`;
    return `- ${text}`;
  });

  try {
    // LLM chat-generate call
    const instructions: VChatMessageIn[] = [
        { role: 'system', content: `You are an AI conversation titles assistant who specializes in creating expressive yet few-words chat titles.` },
        {
          role: 'user', content: `
Analyze the given short conversation (every line is truncated) and extract a concise chat title that summarizes the conversation in as little as a couple of words.
Only respond with the lowercase short title and nothing else.

\`\`\`
${historyLines.join('\n')}
\`\`\``.trim(),
      },
    ];
    const chatResponse = await llmChatGenerateOrThrow(
      fastLLMId,
      instructions,
      'chat-ai-title', conversationId,
      null, null,
    );

    // parse title
    const title = chatResponse?.content
      ?.trim()
      ?.replaceAll('"', '')
      ?.replace('Title: ', '')
      ?.replace('title: ', '');

    // data write
    if (title) {
      setAutoTitle(conversationId, title);
      return true;
    }

  } catch (err) {
    // not critical at all
    console.log('Failed to auto-title conversation', conversationId, err);
  }

  return false;
}