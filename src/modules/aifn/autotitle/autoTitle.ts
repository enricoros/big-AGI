import { aixChatGenerateText_Simple } from '~/modules/aix/client/aix.client';

import { excludeSystemMessages } from '~/common/stores/chat/chat.conversation';
import { getConversation, useChatStore } from '~/common/stores/chat/store-chats';
import { getLLMIdOrThrow } from '~/common/stores/llms/store-llms';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';


/**
 * Creates the AI titles for conversations, by taking the last 5 first-lines and asking AI what's that about
 * @returns true if the title was actually replaced (for instance, it may not be needed)
 */
export async function autoConversationTitle(conversationId: string, forceReplace: boolean): Promise<boolean> {

  // use valid fast model
  let autoTitleLlmId;
  try {
    autoTitleLlmId = getLLMIdOrThrow(['fast', 'chat'], false, false, 'conversation-titler');
  } catch (error) {
    console.log(`autoConversationTitle: ${error}`);
    return false;
  }

  // only operate on valid conversations, without any title
  const conversation = getConversation(conversationId);
  if (!conversation || (!forceReplace && (conversation.autoTitle || conversation.userTitle)))
    return false;

  const { setAutoTitle, setUserTitle } = useChatStore.getState();
  if (forceReplace) {
    setUserTitle(conversationId, '');
    setAutoTitle(conversationId, '✨...');
  }

  // first line of the last 5 messages
  const historyLines: string[] = excludeSystemMessages(conversation.messages).slice(-5).map(m => {
    const messageText = messageFragmentsReduceText(m.fragments);
    let text = messageText.split('\n')[0];
    text = text.length > 100 ? text.substring(0, 100) + '...' : text;
    text = `${m.role === 'user' ? 'You' : 'Assistant'}: ${text}`;
    return `- ${text}`;
  });


  try {

    // LLM chat-generate call
    let title = await aixChatGenerateText_Simple(
      autoTitleLlmId,
      'You are an AI conversation titles assistant who specializes in creating expressive yet few-words chat titles.',
      `Analyze the given short conversation (every line is truncated) and extract a concise chat title that summarizes the conversation in as little as a couple of words.
Only respond with the lowercase short title and nothing else.

\`\`\`
${historyLines.join('\n')}
\`\`\``,
      'chat-ai-title', conversationId,
    );

    // parse title
    title = title
      ?.trim()
      ?.replaceAll('"', '')
      ?.replace('Title: ', '')
      ?.replace('title: ', '');

    // data write
    if (title) {
      setAutoTitle(conversationId, title);
      return true;
    }

  } catch (error: any) {
    // not critical at all
    console.log('Failed to auto-title conversation', conversationId, { error });
    if (forceReplace)
      setAutoTitle(conversationId, '');
  }

  return false;
}