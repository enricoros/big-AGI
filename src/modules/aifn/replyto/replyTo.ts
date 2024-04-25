import { createDMessage, DMessage } from '~/common/state/store-chats';


const replyToSystemPrompt = `The user is referring to this in particular:
{{ReplyToText}}`;

/**
 * Adds a system message to the history, explaining the context of the reply
 *
 * FIXME: HACK - this is a temporary solution to pass the metadata to the execution
 *
 * Only works with OpenAI and a couple more right now. Fix it by making it vendor-agnostic
 */
export function updateHistoryForReplyTo(history: DMessage[]) {
  if (history?.length < 1)
    return;

  const lastMessage = history[history.length - 1];

  if (lastMessage.role === 'user' && lastMessage.metadata?.inReplyToText)
    history.push(createDMessage('system', replyToSystemPrompt.replace('{{ReplyToText}}', lastMessage.metadata.inReplyToText)));
}
