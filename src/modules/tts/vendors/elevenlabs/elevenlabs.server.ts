import { NextRequest } from 'next/server';

import { createEmptyReadableStream, nonTrpcServerFetchOrThrow, safeErrorString } from '~/server/wire';

import { elevenlabsAccess, elevenlabsVoiceId, ElevenlabsWire, speechInputSchema } from './elevenlabs.router';


/* NOTE: Why does this file even exist?

This file is a workaround for a limitation in tRPC; it does not support ArrayBuffer responses,
and that would force us to use base64 encoding for the audio data, which would be a waste of
bandwidth. So instead, we use this file to make the request to ElevenLabs, and then return the
response as an ArrayBuffer. Unfortunately this means duplicating the code in the server-side
and client-side vs. the tRPC implementation. So at lease we recycle the input structures.

*/

export async function elevenLabsHandler(req: NextRequest) {
  try {

    // construct the upstream request
    const {
      elevenKey, text, voiceId, nonEnglish,
      streaming, streamOptimization,
    } = speechInputSchema.parse(await req.json());
    const path = `/v1/text-to-speech/${elevenlabsVoiceId(voiceId)}` + (streaming ? `/stream?optimize_streaming_latency=${streamOptimization || 1}` : '');
    const { headers, url } = elevenlabsAccess(elevenKey, path);
    const body: ElevenlabsWire.TTSRequest = {
      text: text,
      ...(nonEnglish && { model_id: 'eleven_multilingual_v1' }),
    };

    // elevenlabs POST
    const upstreamResponse: Response = await nonTrpcServerFetchOrThrow(url, 'POST', headers, body);

    // NOTE: this is disabled, as we pass-through what we get upstream for speed, as it is not worthy
    //       to wait for the entire audio to be downloaded before we send it to the client
    // if (!streaming) {
    //   const audioArrayBuffer = await upstreamResponse.arrayBuffer();
    //   return new NextResponse(audioArrayBuffer, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    // }

    // stream the data to the client
    const audioReadableStream = upstreamResponse.body || createEmptyReadableStream();
    return new Response(audioReadableStream, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });

  } catch (error: any) {
    const fetchOrVendorError = safeErrorString(error) + (error?.cause ? ' · ' + error.cause : '');
    console.log(`api/elevenlabs/speech: fetch issue: ${fetchOrVendorError}`);
    return new Response(`[Issue] elevenlabs: ${fetchOrVendorError}`, { status: 500 });
  }
}
