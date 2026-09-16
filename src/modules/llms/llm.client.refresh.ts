import * as React from 'react';
import { create } from 'zustand';
import { useIsFetching } from '@tanstack/react-query';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { DModelsChangelogVia, llmsChangelogIsMeaningful } from '~/common/stores/llms/llms.changelog';
import { abortWithReason, resultOrAbort } from '~/common/util/abortUtils';
import { llmsStoreActions, llmsStoreState, useModelsStore } from '~/common/stores/llms/store-llms';
import { reactQueryClientSingleton } from '~/common/app.queryclient';

import { findModelVendor } from './vendors/vendors.registry';
import { llmsDefsVersionFor } from './llm.client.defs';
import { llmsListServiceModelsQueryKey, llmsUpdateModelsForServiceOrThrow } from './llm.client';
import { vendorHasBackendCap } from './vendors/vendor.helpers';


// configuration
const REFRESH_CONCURRENCY = 4; // services listed in parallel


export interface LlmsRefreshOptions {
  via: DModelsChangelogVia;
  at?: number;              // stamp shared by every changelog entry of the session; default Date.now()
  preStampDefs?: boolean;   // boot loop protection: stamp defsV before each attempt, so a dead service is not retried every boot
}

/**
 * The one refresh session (boot, or update all): progress for the UI, and the controls. Not persisted.
 * A session outlives the dialog; `stop` skips the pending services and drops the in-flight results.
 */
export interface ModelsRefreshBatch {
  runningAt: number | null;       // the session `at` while running, null otherwise
  lastAt: number | null;          // the `at` of the last session run in this page
  via: DModelsChangelogVia | null; // what started the current/last session (a boot session is not user-initiated)
  serviceIds: DModelsServiceId[]; // services of the current/last session, in run order (total = length)
  doneIds: DModelsServiceId[];    // services processed (listed, failed, skipped, or stopped) so far
  promise: Promise<void> | null;  // resolves when the session ends, never rejects
  stop: (() => void) | null;      // ends the session early
}

export const useModelsRefreshBatchStore = create<ModelsRefreshBatch>()(() => ({
  runningAt: null,
  lastAt: null,
  via: null,
  serviceIds: [],
  doneIds: [],
  promise: null,
  stop: null,
}));


/**
 * Services an update-all attempts: known vendor, and not positively unconfigured (has models,
 * or a server-side key, or a setup that validates). `validateSetup` is absent on some vendors
 * (anthropic, openai, openrouter, ...) - absent means attempt.
 */
function _llmsRefreshEligibleServiceIds(): DModelsServiceId[] {
  const { llms, sources } = llmsStoreState();
  return sources
    .filter(service => {
      const vendor = findModelVendor(service.vId);
      if (!vendor) return false; // unknown vendor, e.g. data from a newer app version
      if (llms.some(llm => llm.sId === service.id)) return true;
      if (vendorHasBackendCap(vendor)) return true;
      return vendor.validateSetup?.(service.setup) !== false;
    })
    .map(service => service.id);
}


type _RefreshUserCaller = 'app-settings' | 'models-configurator';
type _RefreshCallers = 'boot-refresh-stale' | _RefreshUserCaller;

export function llmsRefreshAllServices(debugCaller: _RefreshUserCaller): Promise<void> {
  return llmsRefreshServices(_llmsRefreshEligibleServiceIds(), { via: 'all' }, debugCaller);
}

/**
 * Lists the given services, a few at a time, one changelog entry each, through the react-query key
 * shared with the per-service listings (a concurrent modal or vendor-setup fetch dedupes into the
 * same request). One session at a time: while one runs, callers join it and get its promise.
 */
export function llmsRefreshServices(serviceIds: DModelsServiceId[], options: LlmsRefreshOptions, _debugCaller: _RefreshCallers): Promise<void> {

  const { promise: current } = useModelsRefreshBatchStore.getState();
  if (current) return current; // join the in-flight session
  if (!serviceIds.length) return Promise.resolve();

  const at = options.at ?? Date.now();
  const controller = new AbortController();
  const promise = _runLLmRefreshSession(serviceIds, options, at, controller.signal)
    .catch(error => {
      console.warn('[llms-refresh] session error:', error);
    })
    .finally(() => {

      // clear session state
      useModelsRefreshBatchStore.setState({
        runningAt: null,
        lastAt: at,
        promise: null,
        stop: null,
      });
    });

  useModelsRefreshBatchStore.setState({
    runningAt: at,
    lastAt: null,
    via: options.via,
    serviceIds: [...serviceIds],
    doneIds: [],
    promise,
    stop: () => abortWithReason(controller, 'The models update was stopped'),
  });

  return promise;
}

async function _runLLmRefreshSession(serviceIds: DModelsServiceId[], options: LlmsRefreshOptions, at: number, signal: AbortSignal): Promise<void> {
  const queryClient = reactQueryClientSingleton();

  const queue = [...serviceIds];

  await Promise.all(Array.from({ length: Math.min(REFRESH_CONCURRENCY, queue.length) }, async () => {
    for (let serviceId = queue.shift(); serviceId; serviceId = queue.shift()) {
      try {
        if (signal.aborted) continue;

        // the service may have been removed while the session was running
        const service = llmsStoreState().sources.find(s => s.id === serviceId);
        if (!service) continue;

        if (options.preStampDefs)
          llmsStoreActions().stampServiceDefs(serviceId, llmsDefsVersionFor(service.vId, service.setup));

        // through the query client, not a direct call: the per-service listings (useLlmUpdateModels in the modal, the
        // vendor setups and the Updates rows) run on this same key, so an in-flight fetch is joined instead of
        // duplicated (one vendor call, one changelog entry), and their isFetching/error state reflects the session.
        // staleTime 0 forces the listing (the hook caches forever).
        // a stop releases the wait at once; the listing itself drops its result when it lands
        await resultOrAbort(queryClient.query({
          queryKey: llmsListServiceModelsQueryKey(serviceId),
          queryFn: () => llmsUpdateModelsForServiceOrThrow(serviceId, { at, via: options.via }, signal),
          staleTime: 0,
        }), signal);

      } catch (error) {
        // listing failures are already logged as changelog entries; a stop is silent
        if (!signal.aborted) console.warn('[llms-refresh] listing failed:', serviceId, error);
      } finally {
        useModelsRefreshBatchStore.setState(state => ({
          doneIds: [...state.doneIds, serviceId!],
        }));
      }
    }
  }));

  // Re-rank the LLMs to the services order (partial refreshes prepend, this restores stability)
  llmsStoreActions().rerankLLMsByServices(llmsStoreState().sources.map(s => s.id));
}


/**
 * The refresh session as one summary, for the Updates screen header and any compact status (e.g. a Preferences alert):
 * 'running' while the session lists, 'done' while its outcome is the newest thing in the changelog, 'idle' otherwise.
 */
export interface ModelsRefreshSummary {
  state: 'idle' | 'running' | 'done';
  at: number | null;      // running: the session start; done: the session stamp; idle: the newest entry, null if none
  via: DModelsChangelogVia | null; // running/done: what started the session
  totalModels: number;
  // running
  total: number;
  done: number;
  inFlight: number;
  // done: services in the session, and their outcome (model counts, except services* and failed)
  services: number;
  servicesChanged: number;
  added: number;
  removed: number;
  changed: number;
  failed: number;
  upToDate: boolean;
}

export function useModelsRefreshSummary(): ModelsRefreshSummary {
  const changelog = useModelsStore(state => state.changelog); // newest first
  const totalModels = useModelsStore(state => state.llms.length);
  const batch = useModelsRefreshBatchStore();
  const inFlight = useIsFetching({
    queryKey: [llmsListServiceModelsQueryKey(null)[0]],
  });

  return React.useMemo((): ModelsRefreshSummary => {
    const zero = { totalModels, via: null, total: 0, done: 0, inFlight: 0, services: 0, servicesChanged: 0, added: 0, removed: 0, changed: 0, failed: 0, upToDate: false };
    if (batch.runningAt !== null)
      return { ...zero, state: 'running', at: batch.runningAt, via: batch.via, total: batch.serviceIds.length, done: batch.doneIds.length, inFlight };

    const newestAt = changelog.reduce((newest, entry) => Math.max(newest, entry.at), 0);
    if (batch.lastAt !== null && batch.lastAt === newestAt) {
      // the entries this session stamped: a stopped or skipped service has none, and a listing that
      // deduped into a concurrent per-service fetch carries that fetch's stamp (not counted either)
      const entries = changelog.filter(entry => entry.at === batch.lastAt);
      if (entries.length)
        return {
          ...zero, state: 'done', at: batch.lastAt, via: batch.via,
          services: entries.length,
          servicesChanged: entries.filter(llmsChangelogIsMeaningful).length,
          added: entries.reduce((sum, entry) => sum + (entry.add?.length ?? 0), 0),
          removed: entries.reduce((sum, entry) => sum + (entry.rem?.length ?? 0), 0),
          changed: entries.reduce((sum, entry) => sum + Object.keys(entry.mod ?? {}).length, 0),
          failed: entries.filter(entry => !!entry.err).length,
          upToDate: !entries.some(entry => llmsChangelogIsMeaningful(entry) || !!entry.err),
        };
    }
    return { ...zero, state: 'idle', at: newestAt || null };
  }, [batch, changelog, inFlight, totalModels]);
}
