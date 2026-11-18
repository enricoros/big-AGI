import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';
import { egressAssertClientUrlOrThrow } from '~/server/egress.server';

import type { SpeexSpeechParticle, SpeexWire_Access, SpeexWire_ListVoices_Output } from './rpc.wiretypes';
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
      try {
        await _assertSpeexHostAllowed(input.access);
      } catch (error) {
        yield { t: 'error', e: error instanceof Error ? error.message : 'Host not allowed' };
        return;
      }
      yield* speexRpcCoreSynthesize(input, ctx.reqSignal);
    }),

  /**
   * List available voices for a dialect
   */
  listVoices: edgeProcedure
    .input(SpeexWire.ListVoices_input_schema)
    .query(async ({ input }): Promise<SpeexWire_ListVoices_Output> => {
      await _assertSpeexHostAllowed(input.access);
      return speexRpcCoreListVoices(input.access);
    }),

});


/** Server-side only: a client-set apiHost is fetched by this server, so it must pass the outbound policy. */
async function _assertSpeexHostAllowed(access: SpeexWire_Access): Promise<void> {
  if (!access.apiHost?.trim()) return;
  await egressAssertClientUrlOrThrow(access.apiHost, {
    kind: 'api-host',
    label: 'TTS host',
    defaultScheme: access.dialect === 'localai' ? 'http' : 'https', // mirrors the per-dialect host fixups
  });
}
