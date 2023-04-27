// pages/api/search/google.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query, key, cx } = req.query;

  if (typeof query !== 'string' || !key || !cx) {
    res.status(400).json({ error: 'Invalid query, API key, or Custom Search Engine ID parameter.' });
    return;
  }
  // limit to 2 search results first in order for smaller context window such as in GPT-3.5 to work.
  // TODO: use summerization feature later to shorten results
  const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=2`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    res.status(200).json(data.items);
  } catch (error) {
    console.error('Error in customGoogleSearch:', (error as Error).message);
    res.status(500).json({ error: 'An error occurred while fetching search results.' });
  }
}