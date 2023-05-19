import { DLLMId } from '~/modules/llms/llm.types';
import { callChat } from '~/modules/llms/llm.client';
import { findLLMOrThrow } from '~/modules/llms/store-llms';

import { cleanupPrompt } from '../prompts';


function breakDownChunk(chunk: string, targetWordCount: number): string[] {
  const words = chunk.split(' ');
  const subChunks = [];

  for (let i = 0; i < words.length; i += targetWordCount) {
    subChunks.push(words.slice(i, i + targetWordCount).join(' '));
  }

  return subChunks;
}

export async function summerizeToFitContextBudget(text: string, targetWordCount: number, llmId: DLLMId): Promise<string> {
  if (targetWordCount < 0) {
    throw new Error('Target word count must be a non-negative number.');
  }

  // 1) Split the input text into chunks by new lines
  const chunks = text.split('\n').filter(chunk => chunk.trim() !== '');

  // 1.1) Break down chunks longer than targetWordCount into sub-chunks
  const subChunks = chunks.flatMap(chunk => {
    if (chunk.split(' ').length > targetWordCount) {
      return breakDownChunk(chunk, targetWordCount);
    } else {
      return [chunk];
    }
  });

  // 2) Remove non-sensical contents from each chunk
  // using OpenAI API to remove non-sensical contents
  const cleanedChunks = await Promise.all(subChunks.map(async chunk => {
    // being conservative, as long as targetWordCount is not reached, we will keep calling the API
    // print out the length of the chunk to be cleaned up
    return await cleanUpContent(chunk, llmId, targetWordCount);
  }));

  console.log('************Finished cleaning up the chunks************');

  // return if the targetWordCount already reached after step 2
  if (cleanedChunks.reduce((acc, chunk) => acc + chunk.split(' ').length, 0) <= targetWordCount) {
    console.log('enough content is removed, return the cleaned chunks');
    return cleanedChunks.join('\n');
  }

  console.log('Simply removing non-sensical contents is not enough, proceed with recursive summerization');

  // 3) Reduce the length of each chunk proportionally based on the text's length over the total length
  const totalLength = cleanedChunks.reduce((acc, chunk) => acc + chunk.split(' ').length, 0);
  const summarizedChunks = await Promise.all(cleanedChunks.map(async chunk => {
    const chunkLength = chunk.split(' ').length;
    const chunkTargetWordCount = Math.floor(targetWordCount * (chunkLength / totalLength));
    return await recursiveSummerize(chunk, llmId, chunkTargetWordCount, 0); // Add the initial depth value
  }));

  // 4) Combine the summarized chunks and return
  return summarizedChunks.join('\n');
}

async function cleanUpContent(chunk: string, llmId: DLLMId, ignored_was_targetWordCount: number): Promise<string> {

  // auto-adjust the tokens assuming the output would be half the size of the input (a bit dangerous,
  // but at this stage we are not guaranteed the input nor output would fit)
  const outputTokenShare = 1 / 3;
  const { contextTokens } = findLLMOrThrow(llmId);
  const autoResponseTokensSize = Math.floor(contextTokens * outputTokenShare);

  try {
    const chatResponse = await callChat(llmId, [
      { role: 'system', content: cleanupPrompt },
      { role: 'user', content: chunk },
    ], autoResponseTokensSize);
    return chatResponse?.content ?? '';
  } catch (error: any) {
    return '';
  }
}

async function recursiveSummerize(text: string, llmId: DLLMId, targetWordCount: number, depth: number = 0): Promise<string> {
  const words = text.split(' ');

  if (words.length <= targetWordCount || words.length <= 1 || depth >= 2) {
    return text;
  }

  const shortenedWords = await cleanUpContent(text, llmId, targetWordCount);

  return await recursiveSummerize(shortenedWords, llmId, targetWordCount, depth + 1);
}