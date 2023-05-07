import { NextRequest, NextResponse } from 'next/server';

import { Prodia } from '@/modules/prodia/prodia.types';


// for lack of an API
const HARDCODED_MODELS: Prodia.API.Models.Response = {
  models: [
    { id: 'sdv1_4.ckpt [7460a6fa]', label: 'Stable Diffusion 1.4', priority: 8 },
    { id: 'v1-5-pruned-emaonly.ckpt [81761151]', label: 'Stable Diffusion 1.5', priority: 9 },
    { id: 'anythingv3_0-pruned.ckpt [2700c435]', label: 'Anything V3.0' },
    { id: 'anything-v4.5-pruned.ckpt [65745d25]', label: 'Anything V4.5' },
    { id: 'analog-diffusion-1.0.ckpt [9ca13f02]', label: 'Analog Diffusion' },
    { id: 'theallys-mix-ii-churned.safetensors [5d9225a4]', label: `TheAlly's Mix II` },
    { id: 'elldreths-vivid-mix.safetensors [342d9d26]', label: `Elldreth's Vivid Mix` },
    { id: 'deliberate_v2.safetensors [10ec4b29]', label: 'Deliberate V2', priority: 5 },
    { id: 'openjourney_V4.ckpt [ca2f377f]', label: 'Openjourney v4' },
    { id: 'dreamlike-diffusion-1.0.safetensors [5c9fd6e0]', label: 'Dreamlike Diffusion' },
    { id: 'dreamlike-diffusion-2.0.safetensors [fdcf65e7]', label: 'Dreamlike Diffusion 2' },
    { id: 'portrait+1.0.safetensors [1400e684]', label: 'Portrait' },
    { id: 'riffusion-model-v1.ckpt [3aafa6fe]', label: 'Riffusion' },
    { id: 'timeless-1.0.ckpt [7c4971d4]', label: 'Timeless' },
    { id: 'dreamshaper_5BakedVae.safetensors [a3fbf318]', label: 'Dreamshaper 5' },
    { id: 'revAnimated_v122.safetensors [3f4fefd9]', label: 'ReV Animated V1.2.2' },
    { id: 'meinamix_meinaV9.safetensors [2ec66ab0]', label: 'MeinaMix Meina V9' },
  ],
};

// sort by priority
HARDCODED_MODELS.models.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));


export default async function handler(req: NextRequest): Promise<NextResponse> {
  try {
    // this is ignored for now, as there's not an API - but still we want to be able to use it in the future
    // noinspection JSUnusedLocalSymbols
    const { apiKey = '' } = (await req.json()) as Prodia.API.Models.RequestBody;
    return new NextResponse(JSON.stringify(HARDCODED_MODELS));
  } catch (error: any) {
    console.error('api/prodia/models error:', error);
    return new NextResponse(`[Issue] ${error}`, { status: 400 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};