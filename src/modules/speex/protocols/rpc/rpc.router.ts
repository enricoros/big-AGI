import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';

import { SpeexSpeechParticle, SpeexWire, SpeexWire_Access, SpeexWire_ListVoices_Output, SpeexWire_Voice } from './rpc.wiretypes';
import { listVoicesElevenLabs, synthesizeElevenLabs } from './synthesize-elevenlabs';
import { listVoicesLocalAIOrThrow, listVoicesOpenAI, synthesizeOpenAIProtocol } from './synthesize-openai';


interface SynthesizeBackendFnParams<TSpeexAccess extends SpeexWire_Access> {
  access: TSpeexAccess;
  text: string;
  voice: SpeexWire_Voice;
  streaming: boolean;
  languageCode?: string;
  priority?: 'fast' | 'balanced' | 'quality';
  signal?: AbortSignal;
}

export type SynthesizeBackendFn<TSpeexAccess extends SpeexWire_Access> = (params: SynthesizeBackendFnParams<TSpeexAccess>) => AsyncGenerator<SpeexSpeechParticle>;


export const speexRouter = createTRPCRouter({

  /**
   * Speech synthesis - streaming AsyncGenerator
   * Yields SpeexParticle chunks: start, audio, done, error
   */
  synthesize: edgeProcedure
    .input(SpeexWire.Synthesize_input_schema)
    .mutation(async function* ({ input, ctx }): AsyncGenerator<SpeexSpeechParticle> {
      const { access, text, voice, streaming, languageCode, priority } = input;

      try {
        yield { t: 'start' };
        switch (access.dialect) {
          case 'elevenlabs':
            yield* synthesizeElevenLabs({ access, text, voice, streaming, languageCode, priority, signal: ctx.reqSignal });
            break;

          case 'localai':
          case 'openai':
            yield* synthesizeOpenAIProtocol({ access, text, voice, streaming, languageCode, priority, signal: ctx.reqSignal });
            break;

          default:
            const _exhaustiveCheck: never = access;
        }
      } catch (error) {
        yield { t: 'error', e: error instanceof Error ? error.message : 'Synthesis failed' };
      }
    }),

  /**
   * List available voices for a dialect
   */
  listVoices: edgeProcedure
    .input(SpeexWire.ListVoices_input_schema)
    .query(async ({ input }): Promise<SpeexWire_ListVoices_Output> => {
      const { access } = input;

      switch (access.dialect) {
        case 'elevenlabs':
          return await listVoicesElevenLabs(access);

        case 'openai':
          return { voices: listVoicesOpenAI() };

        case 'localai':
          return await listVoicesLocalAIOrThrow(access);

        default:
          const _exhaustiveCheck: never = access;
          return { voices: [] };
      }
    }),

});
