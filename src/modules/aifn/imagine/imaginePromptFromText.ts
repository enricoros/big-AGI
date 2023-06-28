import { callChatGenerate } from '~/modules/llms/llm.client';
import { useModelsStore } from '~/modules/llms/store-llms';


const simpleImagineSystemPrompt =
  `As an AI art prompt writer, create captivating prompts using adjectives, nouns, and artistic references that a non-technical person can understand.
Craft creative, coherent and descriptive captions to guide the AI in generating visually striking artwork.
Provide output as a lowercase prompt and nothing else.`;

/**
 * Creates a caption for a drawing or photo given some description - used to elevate the quality of the imaging
 */
export async function imaginePromptFromText(messageText: string): Promise<string | null> {
  const { fastLLMId } = useModelsStore.getState();
  if (!fastLLMId) return null;
  try {
    const chatResponse = await callChatGenerate(fastLLMId, [
      { role: 'system', content: simpleImagineSystemPrompt },
      { role: 'user', content: 'Write a prompt, based on the following input.\n\n```\n' + messageText.slice(0, 1000) + '\n```\n' },
    ]);
    return chatResponse.content?.trim() ?? null;
  } catch (error: any) {
    console.error('imaginePromptFromText: fetch request error:', error);
    return null;
  }
}

// https://www.youtube.com/watch?v=XLG-qtZwxIw
/*const promptNext =
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