import { useQuery } from '@tanstack/react-query';

import type { DSpeexEngineAny, SpeexListVoiceOption, SpeexListVoicesResult } from '../speex.types';
import { speexListVoices_RPC_orThrow } from '../protocols/rpc/rpc.client';
import { useSpeexWebSpeechVoices } from '../protocols/webspeech/webspeech.client';


const _stableEmptyVoices: SpeexListVoiceOption[] = [] as const;

// returns voices given an engine
export function useSpeexVoices(engine: DSpeexEngineAny): SpeexListVoicesResult {

  // props
  const { vendorType, engineId } = engine;
  const isWebspeech = vendorType === 'webspeech';

  // use browser voices
  const browserVoicesResult = useSpeexWebSpeechVoices(isWebspeech);

  // use RPC voices
  const { data: cloudVoices, error: cloudError, isFetching: cloudIsFetching, refetch } = useQuery({
    enabled: !isWebspeech,
    queryKey: ['speex', 'listVoices', engineId, vendorType],
    queryFn: () => speexListVoices_RPC_orThrow(engine as any /* will not run for 'webspeech' */),
    staleTime: 5 * 60 * 1000, // 5 minutes - voices don't change often
  });

  // do not refetch openai, voices are hardcoded
  const needsRefetch = vendorType !== 'openai';

  // switch result
  return isWebspeech ? browserVoicesResult : {
    voices: cloudVoices?.length ? cloudVoices : _stableEmptyVoices,
    isLoading: cloudIsFetching,
    error: cloudError instanceof Error ? cloudError.message : null,
    refetch: needsRefetch ? refetch : undefined,
  };
}
