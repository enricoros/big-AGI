import { NextRequest, NextResponse } from 'next/server';

import { ElevenLabs } from '@/modules/elevenlabs/elevenlabs.types';
import { postToElevenLabs } from '@/modules/elevenlabs/elevenlabs.server';


export default async function handler(req: NextRequest) {
  try {
    const { apiKey = '', text, voiceId: userVoiceId, nonEnglish } = (await req.json()) as ElevenLabs.API.TextToSpeech.RequestBody;
    const voiceId = userVoiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const requestPayload: ElevenLabs.Wire.TextToSpeech.Request = {
      text: text,
      ...(nonEnglish ? { model_id: 'eleven_multilingual_v1' } : {}),
    };
    const response = await postToElevenLabs<ElevenLabs.Wire.TextToSpeech.Request>(apiKey, `/v1/text-to-speech/${voiceId}`, requestPayload);
    const audioBuffer: ElevenLabs.API.TextToSpeech.Response = await response.arrayBuffer();
    return new NextResponse(audioBuffer, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  } catch (error) {
    console.error('api/elevenlabs/speech error:', error);
    return new NextResponse(JSON.stringify(`speechToText error: ${error?.toString() || 'Network issue'}`), { status: 500 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};
