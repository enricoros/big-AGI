import { aixChatGenerateText_Simple } from '~/modules/aix/client/aix.client';

import { getLLMIdOrThrow } from '~/common/stores/llms/store-llms';


const simpleImagineSystemPrompt =
  `As an AI image generation prompt writer, create captivating but clear and simple prompts using adjectives, nouns, and artistic references that a non-technical person can understand.
Craft creative, coherent and descriptive captions to guide the AI in generating visually striking artwork.
Follow best practices such as beginning with 'A [photo of, drawing of, ...] {subject} ...', using objective words that are unambiguous to visualize.
Write a minimum of 20-30 words prompt and up to the size of the input.
Provide output a single image generation prompt and nothing else.`;

/**
 * Creates a caption for a drawing or photo given some description - used to elevate the quality of the imaging
 */
export async function imaginePromptFromTextOrThrow(messageText: string, contextRef: string): Promise<string> {

  // we used the fast LLM, but let's just converge to the chat LLM here
  const llmId = getLLMIdOrThrow(['fast', 'chat'], false, false, 'imagine-prompt-from-text');

  // truncate the messageText to full words and up to 1000 characters
  const lastSpace = messageText.slice(0, 1000).lastIndexOf(' ');
  messageText = messageText.slice(0, lastSpace > 0 ? lastSpace : 1000);
  if (!/[.!?]$/.test(messageText)) messageText += '.';

  return (await aixChatGenerateText_Simple(
    llmId,
    simpleImagineSystemPrompt,
    'Write a minimum of 20-30 words prompt and up to the size of the input, based on the INPUT below.\n\nINPUT:\n' + messageText,
    'draw-expand-prompt', contextRef,
  )).trim();
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