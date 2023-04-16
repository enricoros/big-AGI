// noinspection ExceptionCaughtLocallyJS

import { NextRequest, NextResponse } from 'next/server';

import { postToPasteGG } from '@/lib/publish';


export interface ApiPublishBody {
  to: 'paste.gg';
  title: string;
  fileContent: string;
  fileName: string;
  origin: string;
}

export type ApiPublishResponse = {
  type: 'success';
  url: string;
  expires: string;
  deletionKey: string;
  created: string;
} | {
  type: 'error';
  error: string
};


/**
 * 'Proxy' that uploads a file to paste.gg.
 * Called by the UI to avoid CORS issues, as the browser cannot post directly to paste.gg.
 */
export default async function handler(req: NextRequest) {

  try {

    const { to, title, fileContent, fileName, origin } = await req.json() as ApiPublishBody;
    if (req.method !== 'POST' || to !== 'paste.gg' || !title || !fileContent || !fileName)
      throw new Error('Invalid options');

    const paste = await postToPasteGG(title, fileName, fileContent, origin);
    console.log(`Posted to paste.gg`, paste);

    if (paste?.status !== 'success')
      throw new Error(`${paste?.error || 'Unknown error'}: ${paste?.message || 'Paste.gg Error'}`);

    return new NextResponse(JSON.stringify({
      type: 'success',
      url: `https://paste.gg/${paste.result.id}`,
      expires: paste.result.expires || 'never',
      deletionKey: paste.result.deletion_key || 'none',
      created: paste.result.created_at,
    } as ApiPublishResponse));

  } catch (error) {

    console.error('Error posting to paste.gg', error);
    return new NextResponse(JSON.stringify({
      type: 'error',
      error: error || 'Network issue',
    } as ApiPublishResponse), { status: 500 });

  }

}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};