import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import type { DVoidPlaceholderMOp } from '~/common/stores/chat/chat.fragments';
import { useAIPreferencesStore } from '~/common/stores/store-ai';

import { vertexLinksResolveUrls } from './vertexai.client';
import { VERTEX_GROUNDING_REDIRECT_REGEX } from './vertexai.types';


/** Resolve transient search status URLs while visible (#1246), without changing fragments or delaying the stream. */
export function useVertexLinksForDisplay(op: DVoidPlaceholderMOp): DVoidPlaceholderMOp {
  const policy = useAIPreferencesStore(state => state.vndGeminiVertexLinks);
  const enabled = policy === 'resolve' && op.mot === 'search-web';

  const redirectUrls = React.useMemo(() => {
    if (!enabled) return [];
    const urls = new Set<string>();
    for (const text of [op.text, ...op.iTexts ?? [], ...op.oTexts ?? []])
      for (const match of text.matchAll(VERTEX_GROUNDING_REDIRECT_REGEX))
        urls.add(match[0]);
    // Input and output often repeat the same URLs. Keep their query key stable across status updates.
    return Array.from(urls).sort();
  }, [enabled, op.text, op.iTexts, op.oTexts]);

  const { data: resolvedMap } = useQuery({
    queryKey: ['vertex-links-display', redirectUrls],
    enabled: redirectUrls.length > 0,
    queryFn: () => vertexLinksResolveUrls(redirectUrls),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!enabled || !resolvedMap?.size) return op;
  const resolveText = (text: string) => text.replace(VERTEX_GROUNDING_REDIRECT_REGEX, url => resolvedMap.get(url) || url);
  return {
    ...op,
    text: resolveText(op.text),
    ...op.iTexts ? { iTexts: op.iTexts.map(resolveText) } : undefined,
    ...op.oTexts ? { oTexts: op.oTexts.map(resolveText) } : undefined,
  };
}
