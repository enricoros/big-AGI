import { NextRequest, NextResponse } from 'next/server';

import { ElevenLabs } from '@/modules/elevenlabs/elevenlabs.types';


function parseApiParameters(apiKey?: string) {
  return {
    apiHost: (process.env.ELEVENLABS_API_HOST || 'api.elevenlabs.io').trim().replaceAll('https://', ''),
    apiHeaders: {
      'Content-Type': 'application/json',
      'xi-api-key': (apiKey || process.env.ELEVENLABS_API_KEY || '').trim(),
    },
  };
}

async function rethrowElevenLabsError(response: Response) {
  if (!response.ok) {
    let errorPayload: object | null = null;
    try {
      errorPayload = await response.json();
    } catch (e) {
      // ignore
    }
    console.error('Error in ElevenLabs API:', errorPayload);
    throw new Error('ElevenLabs error: ' + JSON.stringify(errorPayload));
  }
}


export async function getFromElevenLabs<TJson extends object>(apiKey: string, apiPath: string): Promise<TJson> {
  const { apiHost, apiHeaders } = parseApiParameters(apiKey);

  const response = await fetch(`https://${apiHost}${apiPath}`, {
    method: 'GET',
    headers: apiHeaders,
  });

  await rethrowElevenLabsError(response);
  return await response.json();
}

export async function postToElevenLabs<TBody extends object>(apiKey: string, apiPath: string, body: TBody, signal?: AbortSignal): Promise<Response> {
  const { apiHost, apiHeaders } = parseApiParameters(apiKey);

  const response = await fetch(`https://${apiHost}${apiPath}`, {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify(body),
    signal,
  });

  await rethrowElevenLabsError(response);
  return response;
}


export default async function handler(req: NextRequest) {
  try {
    const { apiKey = '', text, voiceId: userVoiceId } = (await req.json()) as ElevenLabs.API.TextToSpeech.RequestBody;
    const voiceId = userVoiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const response = await postToElevenLabs<ElevenLabs.Wire.TextToSpeech.Request>(apiKey, `/v1/text-to-speech/${voiceId}`, { text });
    const audioBuffer: ElevenLabs.API.TextToSpeech.Response = await response.arrayBuffer();
    return new NextResponse(audioBuffer, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  } catch (error) {
    console.error('Error posting to ElevenLabs', error);
    return new NextResponse(JSON.stringify(`speechToText error: ${error?.toString() || 'Network issue'}`), { status: 500 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};
