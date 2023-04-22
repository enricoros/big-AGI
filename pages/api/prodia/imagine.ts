// noinspection ExceptionCaughtLocallyJS

import { NextRequest, NextResponse } from 'next/server';

import { Prodia } from '@/types/api-prodia';


// FIXME: make model configurable? would need an API to query it
// const DEFAULT_MODEL = 'sdv1_4.ckpt [7460a6fa]';
const DEFAULT_MODEL: string = 'deliberate_v2.safetensors [10ec4b29]';

/*const WEBSITE_MODELS = [
  'sdv1_4.ckpt [7460a6fa]',
  'v1-5-pruned-emaonly.ckpt [81761151]',
  'anythingv3_0-pruned.ckpt [2700c435]',
  'anything-v4.5-pruned.ckpt [65745d25]',
  'analog-diffusion-1.0.ckpt [9ca13f02]',
  'theallys-mix-ii-churned.safetensors [5d9225a4]',
  'elldreths-vivid-mix.safetensors [342d9d26]',
  'deliberate_v2.safetensors [10ec4b29]',
  'openjourney_V4.ckpt [ca2f377f]',
  'dreamlike-diffusion-1.0.safetensors [5c9fd6e0]',
  'dreamlike-diffusion-2.0.safetensors [fdcf65e7]',
  'portrait+1.0.safetensors [1400e684]',
  'riffusion-model-v1.ckpt [3aafa6fe]',
  'timeless-1.0.ckpt [7c4971d4]'
];*/


async function createGenerationJob(apiKey: string, jobRequest: Prodia.Wire.Imagine.JobRequest): Promise<Prodia.Wire.Imagine.JobResponse> {
  const response = await fetch('https://api.prodia.com/v1/job', {
    method: 'POST',
    headers: {
      'X-Prodia-Key': (apiKey || process.env.PRODIA_API_KEY || '').trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jobRequest),
  });
  if (response.status !== 200)
    throw new Error(`Bad Prodia Response: ${response.status}`);
  return await response.json();
}

async function getJobStatus(apiKey: string, jobId: string): Promise<Prodia.Wire.Imagine.JobResponse> {
  const response = await fetch(`https://api.prodia.com/v1/job/${jobId}`, {
    headers: {
      'X-Prodia-Key': (apiKey || process.env.PRODIA_API_KEY || '').trim(),
    },
  });
  if (response.status !== 200)
    throw new Error(`Bad Prodia Response: ${response.status}`);
  return await response.json();
}


export default async function handler(req: NextRequest) {
  // timeout, in seconds
  const timeout = 15;
  const tStart = Date.now();

  try {
    const { apiKey = '', prompt } = (await req.json()) as Prodia.API.Imagine.RequestBody;

    // crate the job, getting back a job ID
    let job = await createGenerationJob(apiKey, { model: DEFAULT_MODEL, prompt });

    // poll the job status until it's done
    let sleepDelay = 2000;
    while (job.status !== 'succeeded' && job.status !== 'failed' && (Date.now() - tStart) < (timeout * 1000)) {
      await new Promise(resolve => setTimeout(resolve, sleepDelay));
      job = await getJobStatus(apiKey, job.job);
      if (sleepDelay > 250)
        sleepDelay /= 2;
    }

    // check for success
    const elapsed = Math.round((Date.now() - tStart) / 100) / 10;
    if (job.status !== 'succeeded' || !job.imageUrl)
      throw new Error(`Prodia image generation failed within ${elapsed}s`);

    // respond with the image URL
    const response: Prodia.API.Imagine.Response = { status: 'success', imageUrl: job.imageUrl, elapsed };
    return new NextResponse(JSON.stringify(response));

  } catch (error) {
    console.error('Error in Prodia API:', error);
    const elapsed = Math.round((Date.now() - tStart) / 100) / 10;
    const response: Prodia.API.Imagine.Response = { status: 'error', error: error?.toString() || 'Network issue', elapsed };
    return new NextResponse(JSON.stringify(response), { status: 500 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};