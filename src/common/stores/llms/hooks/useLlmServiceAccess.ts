import * as React from 'react';

import { findModelVendor, type ModelVendorAccessOf, type ModelVendorId, type ModelVendorOf } from '~/modules/llms/vendors/vendors.registry';

import type { DLLMId } from '../llms.types';
import { useModelsStore } from '../store-llms';


/**
 * Reactively resolve the vendor-specific transport access for a given LLM ID.
 *
 * - `llmId` nullish: hook is disabled, returns null.
 * - `llmId` set: resolves the LLM's own service (if it matches `fallbackFirstOf`),
 *   or falls back to the first configured service for that vendor.
 *
 * NOTE: when the LLM's vendor doesn't match `fallbackFirstOf`, the LLM's own
 * service is ignored but the fallback still resolves - so a non-null access may
 * be returned even for unrelated LLMs. Callers should gate accordingly.
 */
export function useLlmServiceAccess<V extends ModelVendorId>(llmId: undefined | null | DLLMId, fallbackFirstOf: V) {

  // reactive: resolve stable service object reference
  const service = useModelsStore(({ llms, sources }) => {
    if (!llmId) return null;

    // prefer the LLM's own service
    const llm = llms.find(m => m.id === llmId);
    if (llm && llm.vId === fallbackFirstOf) {
      const svc = sources.find(s => s.id === llm.sId);
      if (svc) return svc;
    }

    // fallback: first service for the given vendor
    return sources.find(s => s.vId === fallbackFirstOf) ?? null;
  });

  // derive transport access (stable: only recomputes when service changes)
  return React.useMemo(() => {
    if (!service) return null;
    const vendor = findModelVendor(service.vId) as ModelVendorOf<V> | null;
    return vendor?.getTransportAccess(service.setup) as ModelVendorAccessOf<V> ?? null;
  }, [service]);
}