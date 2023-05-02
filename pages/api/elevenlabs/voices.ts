import { NextRequest, NextResponse } from 'next/server';

import { ElevenLabs } from '@/modules/elevenlabs/elevenlabs.types';
import { getFromElevenLabs } from '@/modules/elevenlabs/elevenlabs.server';


export default async function handler(req: NextRequest) {
  try {
    const { apiKey = '' } = (await req.json()) as ElevenLabs.API.Voices.RequestBody;

    const voicesList = await getFromElevenLabs<ElevenLabs.Wire.Voices.List>(apiKey, '/v1/voices');

    // bring category != 'premade to the top
    voicesList.voices.sort((a, b) => {
      if (a.category === 'premade' && b.category !== 'premade') return 1;
      if (a.category !== 'premade' && b.category === 'premade') return -1;
      return 0;
    });

    // map to our own response format
    const response: ElevenLabs.API.Voices.Response = {
      voices: voicesList.voices.map((voice, idx) => ({
        id: voice.voice_id,
        name: voice.name,
        description: voice.description,
        previewUrl: voice.preview_url,
        category: voice.category,
        default: idx === 0,
      })),
    };

    return new NextResponse(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('api/elevenlabs/voices error:', error);
    return new NextResponse(
      JSON.stringify({
        type: 'error',
        error: error?.toString() || error || 'Network issue',
      }),
      { status: 500 },
    );
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};
