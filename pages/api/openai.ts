import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai-api';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI(OPENAI_API_KEY) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { question } = req.body;
    try {
      if (openai) {
        const result = await openai.completions.create({
          engine: 'davinci',
          prompt: `Q: ${question}\nA:`,
          maxTokens: 1024,
          n: 1,
          stop: '\n',
        });
        const answer = result.choices[0].text.trim();
        res.status(200).json({ answer });
      } else {
        res.status(500).json({ error: 'OpenAI API key is missing.' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Sorry, something went wrong.' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed.' });
  }
}
