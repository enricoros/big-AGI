// noinspection ExceptionCaughtLocallyJS

import { NextRequest, NextResponse } from 'next/server';

import { Prodia } from '@/modules/prodia/prodia.types';


export const prodiaHeaders = (apiKey: string): Record<string, string> => ({
  'X-Prodia-Key': (apiKey || process.env.PRODIA_API_KEY || '').trim(),
});


async function createGenerationJob(apiKey: string, jobRequest: Prodia.Wire.Imagine.JobRequest): Promise<Prodia.Wire.Imagine.JobResponse> {
  const response = await fetch('https://api.prodia.com/v1/job', {
    method: 'POST',
    headers: {
      ...prodiaHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jobRequest),
  });
  if (response.status !== 200) {
    console.log('Bad Prodia Response:', await response.text());
    throw new Error(`Bad Prodia Response: ${response.status}`);
  }
  return await response.json();
}

async function getJobStatus(apiKey: string, jobId: string): Promise<Prodia.Wire.Imagine.JobResponse> {
  const response = await fetch(`https://api.prodia.com/v1/job/${jobId}`, {
    headers: prodiaHeaders(apiKey),
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
    const { apiKey = '', prompt, prodiaModelId, negativePrompt, steps, cfgScale, seed } = (await req.json()) as Prodia.API.Imagine.RequestBody;

    // crate the job, getting back a job ID
    const jobRequest: Prodia.Wire.Imagine.JobRequest = {
      model: prodiaModelId,
      prompt,
      ...(!!cfgScale && { cfg_scale: cfgScale }),
      ...(!!steps && { steps }),
      ...(!!negativePrompt && { negative_prompt: negativePrompt }),
      ...(!!seed && { seed }),
    };
    let job: Prodia.Wire.Imagine.JobResponse = await createGenerationJob(apiKey, jobRequest);

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
    const altText = `Prodia generated "${jobRequest.prompt}". Options: ${JSON.stringify({ seed: job.params })}.`;
    const response: Prodia.API.Imagine.Response = { status: 'success', imageUrl: job.imageUrl, altText, elapsed };
    return new NextResponse(JSON.stringify(response));

  } catch (error) {
    console.error('api/prodia/imagine error:', error);
    const elapsed = Math.round((Date.now() - tStart) / 100) / 10;
    const response: Prodia.API.Imagine.Response = { status: 'error', error: error?.toString() || 'Network issue', elapsed };
    return new NextResponse(JSON.stringify(response), { status: 500 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};