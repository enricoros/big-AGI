// pages/api/shorten.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import type { OpenAIAPI } from './chat';

export interface ApiShortenInput {
  apiKey?: string;
  apiHost?: string;
  model: string;
  messages: OpenAIAPI.Chat.CompletionMessage[];
  temperature?: number;
  max_tokens?: number;
}

type Data = {
  response: string;
};


const callOpenAI = async (input: ApiShortenInput): Promise<string> => {
  // console.log(input);
  const inputPayload: OpenAIAPI.Chat.CompletionsRequest = {
    model: input.model,
    messages: input.messages,
    max_tokens: input.max_tokens || 4097,
    n: 1,
    stream: false,
    temperature: input.temperature || 0.5,
  };
  const response = await fetch(`https://${input.apiHost}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(inputPayload),
  });

  const data = await response.json();
  // console.log("Response:", data.choices[0].message.content);
  if (data && data.choices && data.choices.length > 0) {
    console.log("response received");
    return data.choices[0].message.content;
  } else {
    console.log("no response");
    return "";
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const input: ApiShortenInput = req.body;

  if (!input || !input.model || !Array.isArray(input.messages)) {
    res.status(400).json({ response: 'Invalid input' });
    return;
  }

  const openaiResponse = await callOpenAI(input);

  res.status(200).json({ response: openaiResponse });
}