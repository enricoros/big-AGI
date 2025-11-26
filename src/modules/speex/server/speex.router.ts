import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';

import { SpeexSpeechParticle, SpeexWire, SpeexWire_ListVoices_Output } from './speex.wiretypes';

import { listVoicesElevenLabs, synthesizeElevenLabs } from './synthesize-elevenlabs';
import { synthesizeOpenAIProtocol } from './synthesize-openai';


export const speexRouter = createTRPCRouter({

  /**
   * Speech synthesis - streaming AsyncGenerator
   * Yields SpeexParticle chunks: start, audio, done, error
   */
  synthesize: edgeProcedure
    .input(SpeexWire.Synthesize_input_schema)
    .mutation(async function* ({ input, ctx }): AsyncGenerator<SpeexSpeechParticle> {
      const { access, text, voice, streaming } = input;

      try {
        yield { t: 'start' };

        // Route based on access.dialect discriminant
        switch (access.dialect) {
          case 'elevenlabs':
            yield* synthesizeElevenLabs({ access, text, voice, streaming, signal: ctx.reqSignal });
            break;

          case 'localai':
          case 'openai':
            yield* synthesizeOpenAIProtocol({ access, text, voice, streaming, signal: ctx.reqSignal });
            break;

          default:
            yield { t: 'error', e: 'Unknown dialect' };
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
          return listVoicesElevenLabs(access);

        case 'openai':
          // OpenAI has hardcoded voices
          return {
            voices: [
              { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
              { id: 'ash', name: 'Ash', description: 'Warm and engaging' },
              { id: 'coral', name: 'Coral', description: 'Warm and friendly' },
              { id: 'echo', name: 'Echo', description: 'Clear and resonant' },
              { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
              { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
              { id: 'nova', name: 'Nova', description: 'Friendly and upbeat' },
              { id: 'sage', name: 'Sage', description: 'Calm and wise' },
              { id: 'shimmer', name: 'Shimmer', description: 'Clear and bright' },
            ],
          };

        case 'localai':
          // TODO: Query LocalAI for available TTS models
          return { voices: [] };

        default:
          return { voices: [] };
      }
    }),

});
