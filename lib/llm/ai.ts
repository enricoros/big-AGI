import { ApiChatInput, ApiChatResponse } from '../../pages/api/openai/chat';
import { ChatModelId, fastChatModelId } from '@/lib/data';
import { getOpenAIConfiguration } from '@/lib/stores/store-settings';
import { useChatStore } from '@/lib/stores/store-chats';


/**
 * Creates the AI titles for conversations, by taking the last 5 first-lines and asking AI what's that about
 */
export async function updateAutoConversationTitle(conversationId: string) {

  // external state
  const { conversations, setAutoTitle } = useChatStore.getState();

  // only operate on valid conversations, without any title
  const conversation = conversations.find(c => c.id === conversationId) ?? null;
  if (!conversation || conversation.autoTitle || conversation.userTitle) return;

  // first line of the last 5 messages
  const historyLines: string[] = conversation.messages.slice(-5).filter(m => m.role !== 'system').map(m => {
    let text = m.text.split('\n')[0];
    text = text.length > 50 ? text.substring(0, 50) + '...' : text;
    text = `${m.role === 'user' ? 'You' : 'Assistant'}: ${text}`;
    return `- ${text}`;
  });

  // prepare the payload
  const payload: ApiChatInput = {
    api: getOpenAIConfiguration(),
    model: fastChatModelId,
    messages: [
      { role: 'system', content: `You are an AI language expert who specializes in creating very concise and short chat titles.` },
      {
        role: 'user', content:
          'Analyze the given list of pre-processed first lines from each participant\'s conversation and generate a concise chat ' +
          'title that represents the content and tone of the conversation. Only respond with the lowercase short title and nothing else.\n' +
          '\n' +
          historyLines.join('\n') +
          '\n',
      },
    ],
  };

  try {
    const response = await fetch('/api/openai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const chatResponse: ApiChatResponse = await response.json();
      const title = chatResponse.message?.content?.trim()
        ?.replaceAll('"', '')
        ?.replace('Title: ', '')
        ?.replace('title: ', '');
      if (title)
        setAutoTitle(conversationId, title);
    }
  } catch (error: any) {
    console.error('updateAutoConversationTitle: fetch request error:', error);
  }
}

// https://www.youtube.com/watch?v=XLG-qtZwxIw
/*const promptNew =
  'I want you to act as a prompt engineer. You will help me write prompts for an ai art generator.\n' +
  '\n' +
  'I will provide you with short content ideas and your job is to elaborate these into full, detailed, coherent prompts.\n' +
  '\n' +
  'Prompts involve describing the content and style of images in concise accurate language. It is useful to be explicit and use references to popular culture, artists and mediums. Your focus needs to be on nouns and adjectives. I will give you some example prompts for your reference. Please define the exact camera that should be used\n' +
  '\n' +
  'Here is a formula for you to use(content insert nouns here)(medium: insert artistic medium here)(style: insert references to genres, artists and popular culture here)(lighting, reference the lighting here)(colours reference color styles and palettes here)(composition: reference cameras, specific lenses, shot types and positional elements here)\n' +
  '\n' +
  'when giving a prompt remove the brackets, speak in natural language and be more specific, use precise, articulate language.';
*/

/**
 * Creates a caption for a drawing or photo given some description - used to elevate the quality of the imaging
 */
export async function imaginePromptFromText(messageText: string, modelId: ChatModelId): Promise<string | null> {

  const payload: ApiChatInput = {
    api: getOpenAIConfiguration(),
    messages: [
      {
        role: 'system',
        content: 'As an AI art prompt writer, create captivating prompts using adjectives, nouns, and artistic references that a non-technical person can understand. Craft creative, coherent and descriptive captions to guide the AI in generating visually striking artwork. Provide output as a lowercase prompt and nothing else.',
        // NOTE: formerly using this for GPT3.5Turbo
        // 'You are an AI prompt writer for AI art generation. I will provide you with an input that may include ideas or context, and your task is to create coherent and complete prompts that guide the AI in creating visually captivating artwork.\n' +
        // 'Prompts involve crafting descriptive compelling captions that describe scenes, settings, or subjects at a high level, using mostly adjectives and nouns to provide clear and focused guidance. You may also include references to artistic styles, techniques, or cultural influences to help achieve the desired aesthetic.\n' +
        // 'To ensure the AI can interpret and generate the artwork based on the provided guidance, the output must be the lowercase prompt and nothing else.',
      },
      { role: 'user', content: 'Write a prompt, based on the following input.\n\n```\n' + messageText.slice(0, 1000) + '\n```\n' },
    ],
    model: modelId,
  };

  try {
    const response = await fetch('/api/openai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const chatResponse: ApiChatResponse = await response.json();
      return chatResponse.message?.content?.trim() ?? null;
    }
  } catch (error: any) {
    console.error('imagineFromMessage: fetch request error:', error);
  }
  return null;
}
