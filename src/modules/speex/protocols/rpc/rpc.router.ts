import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';

import type { SpeexSpeechParticle, SpeexWire_ListVoices_Output } from './rpc.wiretypes';
import { SpeexWire } from './rpc.wiretypes';

import { speexRpcCoreListVoices, speexRpcCoreSynthesize } from './synthesize.core';


export const speexRouter = createTRPCRouter({

  /**
   * Speech synthesis - streaming AsyncGenerator
   * Yields SpeexParticle chunks: start, audio, done, error
   */
  synthesize: edgeProcedure
    .input(SpeexWire.Synthesize_input_schema)
    .mutation(async function* ({ input, ctx }): AsyncGenerator<SpeexSpeechParticle> {
      yield* speexRpcCoreSynthesize(input, ctx.reqSignal);
    }),

  /**
   * List available voices for a dialect
   */
  listVoices: edgeProcedure
    .input(SpeexWire.ListVoices_input_schema)
    .query(async ({ input }): Promise<SpeexWire_ListVoices_Output> => {
      return speexRpcCoreListVoices(input.access);
    }),

});
