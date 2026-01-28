/**
 * Speex Synthesis Core - Shared executor for both tRPC and CSF paths
 *
 * This module provides the core synthesis logic that runs identically on:
 * - Server (via tRPC router)
 * - Client (via CSF direct execution)
 *
 * Following the AIX pattern of isomorphic dispatch/executor code.
 */

import type { SpeexSpeechParticle, SpeexWire_Access, SpeexWire_ListVoices_Output, SpeexWire_Synthesize_Input, SpeexWire_Voice } from './rpc.wiretypes';
import { listVoicesElevenLabs, synthesizeElevenLabs } from './synthesize-elevenlabs';
import { listVoicesInworld, synthesizeInworld } from './synthesize-inworld';
import { listVoicesLocalAIOrThrow, listVoicesOpenAI, synthesizeOpenAIProtocol } from './synthesize-openai';


// Synthesis RPC backend function spec
export type SynthesizeBackendFn<TSpeexAccess extends SpeexWire_Access> =
  (params: SynthesizeBackendFnParams<TSpeexAccess>) => AsyncGenerator<SpeexSpeechParticle>;

// NOTE: uncertain why we're not using (import type) SpeexWire_Synthesize_Input, but we're redefining it here,
//       perhaps for clarity of interface / separation of concerns.
interface SynthesizeBackendFnParams<TSpeexAccess extends SpeexWire_Access> {
  access: TSpeexAccess;
  text: string;
  voice: SpeexWire_Voice;
  streaming: boolean;
  languageCode?: string;
  priority?: 'fast' | 'balanced' | 'quality';
  signal?: AbortSignal;
}


/**
 * Core synthesis executor - used by both router and client-side fetch.
 *
 * Yields SpeexSpeechParticle stream: start → audio chunks → done (or error)
 */
export async function* speexRpcCoreSynthesize(input: SpeexWire_Synthesize_Input, signal: AbortSignal): AsyncGenerator<SpeexSpeechParticle> {
  const { access, text, voice, streaming, languageCode, priority } = input;

  try {
    yield { t: 'start' };

    switch (access.dialect) {
      case 'elevenlabs':
        yield* synthesizeElevenLabs({ access, text, voice, streaming, languageCode, priority, signal });
        break;

      case 'inworld':
        yield* synthesizeInworld({ access, text, voice, streaming, languageCode, priority, signal });
        break;

      case 'localai':
      case 'openai':
        yield* synthesizeOpenAIProtocol({ access, text, voice, streaming, languageCode, priority, signal });
        break;

      default:
        const _exhaustiveCheck: never = access;
    }
  } catch (error) {
    yield { t: 'error', e: error instanceof Error ? error.message : 'Synthesis failed' };
  }
}


/**
 * Core list voices executor - used by both router and client-side fetch.
 */
export async function speexRpcCoreListVoices(access: SpeexWire_Access): Promise<SpeexWire_ListVoices_Output> {
  switch (access.dialect) {
    case 'elevenlabs':
      return await listVoicesElevenLabs(access);

    case 'inworld':
      return await listVoicesInworld(access);

    case 'openai':
      return { voices: listVoicesOpenAI() };

    case 'localai':
      return await listVoicesLocalAIOrThrow(access);

    default:
      const _exhaustiveCheck: never = access;
      return { voices: [] };
  }
}
