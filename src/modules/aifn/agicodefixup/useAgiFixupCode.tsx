import { type QueryObserverResult, useQuery } from '@tanstack/react-query';

import { agiFixupCode, CodeFixType } from './agiFixupCode';


export interface AgiFixCodeBlockData {
  correctedCode: string | null;
  error: Error | null;
  isFetching: boolean;
  isPending: boolean;
  refetch: () => Promise<QueryObserverResult<string, Error>>;
}

export function useAgiFixupCode(codeFixType: CodeFixType, canAutoTrigger: boolean, codeToFix: string, errorString: string | null): AgiFixCodeBlockData {

  // Async operation state using React Query
  const { data, error, isFetching, isPending, refetch } = useQuery<string, Error>({
    enabled: canAutoTrigger,
    queryKey: ['aifn-agi-fix-code', codeToFix, errorString],
    queryFn: async ({ signal }) => {
      return await agiFixupCode(codeFixType, codeToFix, errorString, signal);
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    correctedCode: data || null,
    error,
    isFetching,
    isPending,
    refetch,
  };
}