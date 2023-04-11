// summerize.ts
import { cleanupPrompt } from './prompts';
import { useSettingsStore } from '@/lib/store-settings';
import { ApiChatInput, ApiChatResponse } from '../pages/api/openai/chat';

export async function summerizeToFitContextBudget(text: string, targetWordCount: number, modelId: string): Promise<string> {
  if (typeof text !== 'string' || typeof targetWordCount !== 'number') {
    throw new Error('Invalid input. Please provide a string and a number.');
  }

  if (targetWordCount < 0) {
    throw new Error('Target word count must be a non-negative number.');
  }

  // 1) Split the input text into chunks by new lines
  const chunks = text.split('\n').filter(chunk => chunk.trim() !== '');

  // 2) Remove non-sensical contents from each chunk
  // using OpenAI summerization API to remove non-sensical contents
  const cleanedChunks = await Promise.all(chunks.map(async chunk => {
    // being conservative, as long as targetWordCount is not reached, we will keep calling the API
    return await cleanUpContent(chunk, modelId, targetWordCount);
  }));

  console.log('************Finished cleaning up the chunks************');

  // return if the targetWordCount already reached after step 2
  if (cleanedChunks.reduce((acc, chunk) => acc + (typeof chunk === 'string' ? chunk.split(' ').length : 0), 0) <= targetWordCount) {
    console.log('enough content is removed, return the cleaned chunks');
    return cleanedChunks.join('\n');
  }

  console.log('Simply removing non-sensical contents is not enough, proceed with recursive summerization');

  // 3) Reduce the length of each chunk according to their portion of the total length
  // 3.1) create aggregated chunks which are composed of multiple cleaned chucks. Each aggregated chuck should be around
  // the size of half of summerization context window, size of which is calculated based on the ratio length of the aggregated chunk over
  // the entire cleanedChunks.
  // 3.2) summerize each aggregated chunk recursively
  const totalLength = cleanedChunks.reduce((acc, chunk) => acc + chunk.split(' ').length, 0);
  console.log('total length of the cleaned chunks is: ', totalLength);
  const summarizedChunks = await Promise.all(cleanedChunks.map(async chunk => {
    const chunkLength = chunk.split(' ').length;
    const chunkTargetWordCount = Math.floor(targetWordCount * (chunkLength / totalLength));
    console.log('chunk length is: ', chunkLength);
    console.log('chunk target word count is: ', chunkTargetWordCount);
    return await recursiveSummerize(chunk, modelId, chunkTargetWordCount);
  }));

  // 4) Combine the summarized chunks and return
  return summarizedChunks.join('\n');
}

async function cleanUpContent(chunk: string, modelId: string, max_tokens: number): Promise<string> {

  const { apiKey, apiHost, apiOrganizationId } = useSettingsStore.getState();
  const input: ApiChatInput = {
    api: {
      ...(apiKey && { apiKey }),
      ...(apiHost && { apiHost }),
      ...(apiOrganizationId && { apiOrganizationId }),
    },
    model: modelId, // Replace with the desired model
    messages: [
      { role: 'system', content: cleanupPrompt },
      { role: 'user', content: chunk }],
    max_tokens: max_tokens, // Adjust the max tokens as needed
  };

  const response = await fetch('/api/openai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data: ApiChatResponse = await response.json();
  return data.message.content;
}

async function recursiveSummerize(text: string, modelId: string, targetWordCount: number): Promise<string> {
  const words = text.split(' ');

  if (words.length <= targetWordCount || words.length <= 1) {
    return text;
  }

  console.log('Content to be cleaned up is: ', text);
  const shortenedWords = await cleanUpContent(text, modelId, targetWordCount);

  return await recursiveSummerize(shortenedWords, modelId, targetWordCount);
}