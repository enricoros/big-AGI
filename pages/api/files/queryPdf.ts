import { OpenAI } from 'langchain/llms/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { ConversationalRetrievalQAChain, RetrievalQAChain } from 'langchain/chains';
import { initPinecone } from '@/modules/pinecone/pinecone-client';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { NextRequest, NextResponse } from 'next/server';

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

export const queryDocuments = async (query: string, chatHistory?: string) => {
  const pinecone = await initPinecone();

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY || '',
  });

  const model = new OpenAI({
    // concurrent request limit to prevent rate limiting
    maxConcurrency: 10,
    temperature: 0, // increase temepreature to get more creative answers
    modelName: 'gpt-3.5-turbo', //change this to gpt-4 if you have access
  });

  let pineconeIndexName = process.env.PINECONE_INDEX_NAME || '';
  const pineconeIndex = pinecone.Index(pineconeIndexName);

  const vectorstore = await PineconeStore.fromExistingIndex(embeddings, { namespace: 'files', pineconeIndex });

  if (chatHistory) {
    // ConversationalRetrievalQAChain is with chat history
    const chain = ConversationalRetrievalQAChain.fromLLM(model, vectorstore.asRetriever(), {
      qaTemplate: QA_PROMPT,
      questionGeneratorTemplate: CONDENSE_PROMPT,
      returnSourceDocuments: true, //The number of source documents returned is 4 by default
    });

    const res = await chain.call({ question: query, chat_history: chatHistory });

    console.log('queryDocuments res', res, chatHistory);
    return res;
  } else {
    // RetrievalQAChain is without chat history

    //  use loadQAMapReduceChain for larger sets of documents
    const chain = RetrievalQAChain.fromLLM(model, vectorstore.asRetriever(), {
      returnSourceDocuments: true,
    });

    const res = await chain.call({
      query,
    });

    console.log('queryDocuments res', res);

    return res;
  }
};

export default async function handler(req: NextRequest) {
  try {
    const requestBodyJson = await req.json();
    const { query, chatHistory } = requestBodyJson;

    const result = await queryDocuments(query, chatHistory);
    console.log('querypdf successful');
    return new NextResponse(JSON.stringify(result), { status: 200 });
  } catch (error: any) {
    console.log('handler error', error);
    return new NextResponse(`[Issue] ${error}`, { status: 400 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};
