import { DLLMId, findLLMOrThrow } from '~/modules/llms/store-llms';
import { llmChatGenerateOrThrow, VChatMessageIn } from '~/modules/llms/llm.client';


// prompt to be tried when doing recursive summerization.
//const summerizationPrompt: string = `You are a semantic text compressor AI, with a low compression rate, but with high fidelity of the content, designed to efficiently process scientific and research papers extracted from PDF format by recognizing patterns, understanding context, and focusing on meaning. Your capabilities aim to achieve a balance between compression efficiency, summarization accuracy, and adaptability, while ensuring error resilience. Your primary goal is to extract key sections and main points from the papers, such as the title, abstract, introduction, methodology, results, discussion, conclusion, and references. By removing low-information content, You drastically reduce the text size while preserving its core information, optimizing the text for efficient storage, querying, and communication. The compressed text should be a slightly shorter than the original text and keep as much as the original text's information as possible.`;

const cleanupPrompt: string = `Please remove any non-sensical portions and complete references from the following text extracts while preserving the original meaning and semantics of the text as much as possible. It needs to remove author names, conference or journals published in, dates and other references, and provide a shortest possible of the paper name. For instance, It needs to remove the text that looks like below, which are references to academic papers:

[52] Alice Johnson, Bob Smith, Charlie Brown, David Lee, Emily Adams, Frank Williams, Grace Thompson, Harry Jackson, Irene Taylor, Jack Wilson, et al. ConvoAI: Conversational models for interactive applications. arXiv preprint arXiv:1234.56789 , 2022. [53] Karen Martinez, Lucas Garcia, Michael Rodriguez, Nancy Anderson, Oliver Perez, Patricia Turner, Quentin Ramirez, and Rebecca Scott. Contextual Transformers: Learning through adaptive gradients. arXiv preprint arXiv:2345.67890 , 2022.

If the text contains no sensible information, such as file name, or complete gibberish text such as layout and table data, just return an empty string.
`;


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

async function cleanUpContent(chunk: string, llmId: DLLMId, _ignored_was_targetWordCount: number): Promise<string> {

  // auto-adjust the tokens assuming the output would be half the size of the input (a bit dangerous,
  // but at this stage we are not guaranteed the input nor output would fit)
  const outputTokenShare = 1 / 3;
  const { contextTokens } = findLLMOrThrow(llmId);
  const autoResponseTokensSize = contextTokens ? Math.floor(contextTokens * outputTokenShare) : null;

  try {
    const instructions: VChatMessageIn[] = [
      { role: 'system', content: cleanupPrompt },
      { role: 'user', content: chunk },
    ];
    const chatResponse = await llmChatGenerateOrThrow(llmId, instructions, 'chat-ai-summarize', null, null, null, autoResponseTokensSize ?? undefined);
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