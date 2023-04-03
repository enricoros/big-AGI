import type { NextApiRequest, NextApiResponse } from 'next';
import { postToPasteGG } from '@/lib/export-conversation';


export interface ApiExportBody {
  to: 'paste.gg';
  title: string;
  fileContent: string;
  fileName: string;
  origin: string;
}

export type ApiExportResponse = {
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
export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiExportResponse>) {

  // validate
  const { to, title, fileContent, fileName, origin }: ApiExportBody = req.body;
  if (req.method !== 'POST' || to !== 'paste.gg' || !title || !fileContent || !fileName)
    return res.status(400).json({ type: 'error', error: 'Invalid options' });

  try {
    const paste = await postToPasteGG(title, fileName, fileContent, origin);
    console.log('server', paste);
    if (paste?.status === 'success')
      return res.status(200).json({
        type: 'success',
        url: `https://paste.gg/${paste.result.id}`,
        expires: paste.result.expires || 'never',
        deletionKey: paste.result.deletion_key || 'none',
        created: paste.result.created_at,
      });

    return res.status(200).json({ type: 'error', error: `${paste?.error || 'Unknown error'}: ${paste?.message || 'Paste.gg Error'}` });

  } catch (error) {

    console.error('Error posting to Paste.GG', error);
    return res.status(500).json({ type: 'error', error: 'Networking issue' });

  }

}
