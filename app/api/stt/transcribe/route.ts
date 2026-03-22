/**
 * POST /api/stt/transcribe
 *
 * Receives an audio blob from the browser (multipart/form-data with "file"
 * field), forwards it to an OpenAI-compatible /v1/audio/transcriptions
 * endpoint, and returns { text, language, model, segments, usage }.
 *
 * Env vars:
 *   STT_API_BASE_URL  – provider base URL           (default: https://api.mistral.ai)
 *   STT_API_KEY       – Bearer token for the provider
 *   STT_MODEL         – model identifier             (default: voxtral-mini-latest)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_BASE_URL = 'https://api.mistral.ai';
const DEFAULT_MODEL = 'voxtral-mini-latest';

function normalizeLanguage(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/[-_]/)[0]?.toLowerCase() || undefined;
}

async function safeErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()) || res.statusText || 'Unknown upstream error';
  } catch {
    return res.statusText || 'Unknown upstream error';
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.STT_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'Server is missing STT_API_KEY.' },
        { status: 500 },
      );
    }

    const baseUrl = (process.env.STT_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const model = process.env.STT_MODEL || DEFAULT_MODEL;

    const incomingForm = await req.formData();
    const maybeFile = incomingForm.get('file');
    const maybeLanguage = incomingForm.get('language');

    if (
      !maybeFile ||
      typeof maybeFile === 'string' ||
      typeof (maybeFile as any).arrayBuffer !== 'function'
    ) {
      return Response.json(
        { error: 'Missing audio file upload.' },
        { status: 400 },
      );
    }

    const file = maybeFile as File;
    const language = normalizeLanguage(
      typeof maybeLanguage === 'string' ? maybeLanguage : null,
    );

    const upstreamForm = new FormData();
    upstreamForm.append('model', model);
    upstreamForm.append('file', file, file.name || 'audio.webm');

    if (language)
      upstreamForm.append('language', language);

    const upstreamUrl = `${baseUrl}/v1/audio/transcriptions`;

    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: upstreamForm,
      cache: 'no-store',
    });

    if (!upstreamRes.ok) {
      const errorBody = await safeErrorBody(upstreamRes);
      console.error(`[stt/transcribe] Upstream ${upstreamRes.status}:`, errorBody);
      return Response.json(
        {
          error: 'Transcription provider returned an error.',
          details: errorBody,
          status: upstreamRes.status,
        },
        { status: upstreamRes.status },
      );
    }

    const data = await upstreamRes.json();

    return Response.json({
      text: typeof data?.text === 'string' ? data.text.trim() : '',
      language: typeof data?.language === 'string' ? data.language : null,
      model: typeof data?.model === 'string' ? data.model : model,
      segments: Array.isArray(data?.segments) ? data.segments : [],
      usage: data?.usage ?? null,
    });
  } catch (error: any) {
    console.error('[stt/transcribe] Unexpected error:', error);
    return Response.json(
      {
        error: 'Unexpected server error during transcription.',
        details: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
