// noinspection ExceptionCaughtLocallyJS

import { NextRequest, NextResponse } from 'next/server';

import { ApiPublishResponse } from '../publish';
import { ElevenLabs } from '@/types/api-elevenlabs';


async function postToElevenLabs<TBody extends object>(configuration: ElevenLabs.API.Configuration, apiPath: string, body: TBody, signal?: AbortSignal): Promise<Response> {

  const apiHost = (configuration.apiHost || process.env.ELEVENLABS_API_HOST || 'api.elevenlabs.io').trim().replaceAll('https://', '');
  const apiHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    'xi-api-key': (configuration.apiKey || process.env.ELEVENLABS_API_KEY || '').trim(),
  };

  const response = await fetch(`https://${apiHost}${apiPath}`, {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Error in ElevenLabs API:', errorData);
    throw new Error('ElevenLabs error: ' + JSON.stringify(errorData));
  }

  return response;
}


export interface ApiElevenLabsSpeechBody {
  api?: ElevenLabs.API.Configuration,
  text: string,
  voiceId?: string,
}


export default async function handler(req: NextRequest) {
  const { api = {}, text, voiceId: userVoiceId } = (await req.json()) as ApiElevenLabsSpeechBody;
  try {
    if (!text) throw new Error('Missing text');
    const voiceId = userVoiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const response = await postToElevenLabs<ElevenLabs.API.TextToSpeech.Request>(api, `/v1/text-to-speech/${voiceId}`, { text });
    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  } catch (error) {
    console.error('Error posting to ElevenLabs', error);
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