import { NextRequest, NextResponse } from 'next/server';

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { initPinecone } from '@/modules/pinecone/pinecone-client';

/**
 * Main function to use langchain send the chat to the assistant and receive a response (streaming)
 */
async function pineconeIngestPDFs(pdfText: string, pineconeIndex?: string, pineconeNamespace?: string) {
  try {
    console.log('pineconeIngestPDFs', pdfText?.slice(0, 100));

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const document: Document = {
      pageContent: pdfText,
      metadata: {
        type: 'pdf',
      },
    };

    const docs = await textSplitter.splitDocuments([document]);

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY || '',
    });

    const pinecone = await initPinecone();

    let pineconeIndexName = process.env.PINECONE_INDEX_NAME || '';
    if (pineconeIndex) {
      pineconeIndexName = pineconeIndex;
    }
    const index = pinecone.Index(pineconeIndexName); //change to your own index name

    let pineconeNamespaceName = process.env.PINECONE_NAME_SPACE || '';

    if (pineconeNamespace) {
      pineconeNamespaceName = pineconeNamespace;
    }

    // improvement opportunity - compare fileText length to pinecone dimension to calculate
    // how many vectors we will be uploading
    // then poll pinecone api until all vectors are uploaded to determine done state

    // //embed the PDF documents
    const result = await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: pineconeNamespaceName,
      textKey: 'text',
    });

    console.log('embedded documents sent to /api/files/pdf');

    return result;
  } catch (error) {
    // @ts-ignore
    console.log('error', error, error?.name, Object.keys(error));
    throw new Error('Failed to ingest your data');
  }
}

export default async function handler(req: NextRequest) {
  try {
    const requestBodyJson = await req.json();
    const { pdfText, pineconeIndex, pineconeNamespace } = requestBodyJson;

    let pineconeIndexName = pineconeIndex || process.env.PINECONE_INDEX_NAME || '';
    let pineconeNamespaceName = pineconeNamespace || process.env.PINECONE_INDEX_NAME || '';

    const result = await pineconeIngestPDFs(pdfText, pineconeIndexName, pineconeNamespaceName);
    return new NextResponse(JSON.stringify(result), { status: 200 });

    // const { api, ...rest } = await toApiChatRequest(requestBodyJson);
    // const upstreamRequest: OpenAI.Wire.Chat.CompletionRequest = toWireCompletionRequest(rest, false);
    // const upstreamResponse: OpenAI.Wire.Chat.CompletionResponse = await openaiPost(api, '/v1/chat/completions', upstreamRequest);
    // return new NextResponse(
    //   JSON.stringify({
    //     message: upstreamResponse.choices[0].message,
    //   } satisfies OpenAI.API.Chat.Response),
    // );
  } catch (error: any) {
    console.log('handler error', error);
    // don't log 429 errors, they are expected
    // if (!error || !(typeof error.startsWith === 'function') || !error.startsWith('Error: 429 · Too Many Requests'))
    //   console.error('api/openai/chat error:', error);
    return new NextResponse(`[Issue] ${error}`, { status: 400 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};
