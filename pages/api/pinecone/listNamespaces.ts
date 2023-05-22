import { NextRequest, NextResponse } from 'next/server';
import { initPinecone } from '@/modules/pinecone/pinecone-client';

export default async function handler(req: NextRequest) {
  try {
    const pinecone = await initPinecone();

    let pineconeIndexName = process.env.PINECONE_INDEX_NAME || '';
    const index = pinecone.Index(pineconeIndexName);
    const indexStats = await index.describeIndexStats({ describeIndexStatsRequest: {} });

    const namespaces = indexStats?.namespaces;

    return new NextResponse(JSON.stringify({ namespaces }), { status: 200 });
  } catch (error: any) {
    console.log('handler error', error);
    return new NextResponse(`[Issue] ${error}`, { status: 400 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};
