import { NextRequest, NextResponse } from "next/server";
import { ChatModerationSchema, chatModerationSchema, openAIAccess } from "~/modules/llms/openai/openai.router";
import { OpenAI } from "~/modules/llms/openai/openai.types";

async function rethrowOpenAIError(response: Response) {
    if (!response.ok) {
      let errorPayload: object | null = null;
      try {
        errorPayload = await response.json();
      } catch (e) {
        // ignore
      }
      throw new Error(`${response.status} · ${response.statusText}${errorPayload ? ' · ' + JSON.stringify(errorPayload) : ''}`);
    }
}  

async function moderation(access: ChatModerationSchema['access'], text: ChatModerationSchema['text']) {
    try {
        // prepare request objects
        const { headers, url } = openAIAccess(access, '/v1/moderations');

        // perform the request
        const moderationResponse = await fetch(url, { headers, method: 'POST', body: JSON.stringify({ input: text }) });
        await rethrowOpenAIError(moderationResponse);
        return await moderationResponse.json() as OpenAI.API.Moderation.Response;
    } catch (error: any) {
        console.log(error);
        const message = '[OpenAI Issue] ' + (error?.message || typeof error === 'string' ? error : JSON.stringify(error)) + (error?.cause ? ' · ' + error.cause : '');
        throw new Error(message);    
    }
}

export default async function handler(req: NextRequest): Promise<Response> {
    try {
      const { access, text } = chatModerationSchema.parse(await req.json());
      const moderationResult = await moderation(access, text);
      return NextResponse.json(moderationResult);
    } catch (error: any) {
      if (error.code === 'ECONNRESET') {
        console.log('Connection reset by the client in handler');
        return new NextResponse('Connection reset by the client.', { status: 499 }); // Use 499 status code for client closed request
      } else {
        console.error('api/openai/moderation error:', error);
        return new NextResponse(`[Issue] ${error}`, { status: 400 });
      }
    }
  }
  
  // noinspection JSUnusedGlobalSymbols
  export const config = { runtime: 'edge' };