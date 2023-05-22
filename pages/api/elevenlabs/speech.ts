import { NextRequest, NextResponse } from 'next/server';

import { elevenlabsAccess, elevenlabsVoiceId, ElevenlabsWire, speechInputSchema } from '~/modules/elevenlabs/elevenlabs.router';


/* NOTE: Why does this file even exist?

This file is a workaround for a limitation in tRPC; it does not support ArrayBuffer responses,
and that would force us to use base64 encoding for the audio data, which would be a waste of
bandwidth. So instead, we use this file to make the request to ElevenLabs, and then return the
response as an ArrayBuffer. Unfortunately this means duplicating the code in the server-side
and client-side vs. the TRPC implementation. So at lease we recycle the input structures.

*/

export default async function handler(req: NextRequest) {
  try {
    // construct the upstream request
    const { elevenKey, text, voiceId, nonEnglish } = speechInputSchema.parse(await req.json());
    const { headers, url } = elevenlabsAccess(elevenKey, `/v1/text-to-speech/${elevenlabsVoiceId(voiceId)}`);
    const body: ElevenlabsWire.TTSRequest = {
      text: text,
      ...(nonEnglish && { model_id: 'eleven_multilingual_v1' }),
    };

    // elevenlabs POST
    const response = await fetch(url, { headers, method: 'POST', body: JSON.stringify(body) });
    const audioArrayBuffer = await response.arrayBuffer();

    // return the audio
    return new NextResponse(audioArrayBuffer, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  } catch (error) {
    console.error('api/elevenlabs/speech error:', error);
    return new NextResponse(JSON.stringify(`textToSpeech error: ${error?.toString() || 'Network issue'}`), { status: 500 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};