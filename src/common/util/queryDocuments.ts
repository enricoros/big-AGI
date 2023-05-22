import { OpenAI } from 'langchain/llms/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { ConversationalRetrievalQAChain, RetrievalQAChain } from 'langchain/chains';
import { initPinecone } from '@/modules/pinecone/pinecone-client';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

const CONDENSE_PROMPT = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const QA_PROMPT = `You are a helpful AI assistant. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say you don't know. DO NOT try to make up an answer.
If the question is not related to the context, politely respond that you are tuned to only answer questions that are related to the context.

{context}

Question: {question}
Helpful answer in markdown:`;

export const queryDocuments = async (query: string) => {
  const pinecone = await initPinecone();

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY || '',
  });

  const model = new OpenAI({
    // concurrent request limit to prevent rate limiting
    maxConcurrency: 10,
    temperature: 0, // increase temepreature to get more creative answers
    modelName: 'gpt-4', //change this to gpt-4 if you have access
  });

  let pineconeIndexName = process.env.PINECONE_INDEX_NAME || '';
  const pineconeIndex = pinecone.Index(pineconeIndexName);

  const vectorstore = await PineconeStore.fromExistingIndex(embeddings, { namespace: 'files', pineconeIndex });

  console.log('vectorstore', vectorstore, 'model', model, 'QA_PROMPT', QA_PROMPT, 'CONDENSE_PROMPT', CONDENSE_PROMPT);

  const chain = RetrievalQAChain.fromLLM(model, vectorstore.asRetriever());

  console.log('query chain', chain);
  const res = await chain.call({
    query,
  });
  // const chain = ConversationalRetrievalQAChain.fromLLM(model, vectorstore.asRetriever(), {
  //   qaTemplate: QA_PROMPT,
  //   questionGeneratorTemplate: CONDENSE_PROMPT,
  //   returnSourceDocuments: true, //The number of source documents returned is 4 by default
  // });
  // return chain;
  console.log('queryDocuments res', res);
  return res;
};
