import { DConversation } from '~/common/state/store-chats';
import { SystemPurposes } from '../../../data';


export function prettyBaseModel(model: string | undefined): string {
  if (!model) return '';
  if (model.includes('gpt-4-32k')) return 'gpt-4-32k';
  if (model.includes('gpt-4')) return 'gpt-4';
  if (model.includes('gpt-3.5-turbo-16k')) return '3.5 Turbo 16k';
  if (model.includes('gpt-3.5-turbo')) return '3.5 Turbo';
  if (model.endsWith('.bin')) return model.slice(0, -4);
  return model;
}

/**
 * Primitive rendering of a Conversation to Markdown
 */
export function conversationToMarkdown(conversation: DConversation, hideSystemMessage: boolean): string {

  // const title =
  //   `# ${conversation.manual/auto/name || 'Conversation'}\n` +
  //   (new Date(conversation.created)).toLocaleString() + '\n\n';

  return conversation.messages.filter(message => !hideSystemMessage || message.role !== 'system').map(message => {
    let sender: string = message.sender;
    let text = message.text;
    switch (message.role) {
      case 'system':
        sender = '✨ System message';
        text = '<img src="https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp" width="48" height="48" alt="typing fast meme"/>\n\n' + '*' + text + '*';
        break;
      case 'assistant':
        const purpose = message.purposeId || conversation.systemPurposeId || null;
        sender = `${purpose || 'Assistant'} · *${prettyBaseModel(message.originLLM || '')}*`.trim();
        if (purpose && purpose in SystemPurposes)
          sender = `${SystemPurposes[purpose]?.symbol || ''} ${sender}`.trim();
        break;
      case 'user':
        sender = '👤 You';
        break;
    }
    return `### ${sender}\n\n${text}\n\n`;
  }).join('---\n\n');

}