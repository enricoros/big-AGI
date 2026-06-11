/**
 * ASRx Batch Client - public `asrxTranscribeBatch()` entry point.
 *
 * Resolves the engine from the optional selector, applies profile overrides,
 * builds an Access object from the engine's credentials (dereferencing any
 * `llms-service` link), and dispatches to the vendor adapter via a dynamic
 * import of `transcribe.core`.
 *
 * All transcription runs client-side (CSF): the browser talks directly to
 * the vendor API. Audio files (can be tens of MB for long Ramble recordings)
 * never traverse our server. Credentials are also resolved client-side, so
 * the key never leaves the browser except to go to the vendor.
 */

import type { DOpenAIServiceSettings } from '~/modules/llms/vendors/openai/openai.vendor';

import { findModelsServiceOrNull } from '~/common/stores/llms/store-llms';

import type { ASRxBatchResult, ASRxProfileSelector, ASRxTranscribeBatchOptions, DASRxEngineAny, DASRxProfileAny } from '../../asrx.types';
import type { ASRxAccess } from './batch.access';
import { ASRX_DEBUG } from '../../asrx.config';
import { asrxAreCredentialsValid, asrxFindEngineById, asrxFindGlobalEngine, asrxFindValidEngineByType } from '../../store-module-asrx';


// --- CSF: cached dynamic import for client-side fetch, unbundled ---

let _asrxCsfModule: typeof import('./transcribe.core') | null = null;

async function _getASRxCsfModule() {
  if (!_asrxCsfModule)
    _asrxCsfModule = await import('./transcribe.core');
  return _asrxCsfModule;
}


/**
 * Transcribe an audio blob through the resolved ASRx engine.
 *
 * Never throws - returns a discriminated `ASRxBatchResult` for success vs error.
 * This lets callers (Ramble and others) treat the batch API as fully awaitable
 * without try/catch boilerplate at every call site.
 */
export async function asrxTranscribeBatch(
  audio: Blob,
  mimeType: string,
  selector?: ASRxProfileSelector,
  options?: ASRxTranscribeBatchOptions,
): Promise<ASRxBatchResult> {

  // 1. Resolve engine
  const engine = _engineFromSelector(selector);
  if (!engine)
    return { success: false, errorType: 'asr-no-engine', errorText: 'No ASR engine configured. Please configure a transcription engine in Settings.' };

  // 2. Apply profile override from selector (if provided and dialect matches)
  const effectiveEngine = _engineApplyProfileOverride(engine, selector);

  // 3. Build wire access from credentials (dereferences 'llms-service')
  const access = _buildBatchWireAccess(effectiveEngine);
  if (!access)
    return { success: false, errorType: 'asr-unconfigured', errorText: `Failed to resolve credentials for engine ${effectiveEngine.engineId}` };

  if (ASRX_DEBUG) console.log('[ASRx] transcribe request', {
    engineId: effectiveEngine.engineId,
    vendor: effectiveEngine.vendorType,
    mimeType,
    bytes: audio.size,
    language: options?.languageCode,
  });

  // 4. Dispatch via CSF: direct browser -> vendor API, no server involvement
  try {
    const audioBytes = new Uint8Array(await audio.arrayBuffer());
    const core = await _getASRxCsfModule();
    const output = await core.asrxBatchCoreTranscribe({
      access,
      profile: effectiveEngine.profile,
      audio: audioBytes,
      mimeType,
      languageCode: options?.languageCode,
      signal: options?.signal,
    });
    return {
      success: true,
      text: output.text,
      model: output.model,
      ...(output.language ? { language: output.language } : {}),
      ...(output.confidence !== undefined ? { confidence: output.confidence } : {}),
      ...(output.durationMs !== undefined ? { durationMs: output.durationMs } : {}),
    };
  } catch (error: any) {
    // abort -> specific error type so callers can distinguish user-stop from failure
    if (error?.name === 'AbortError' || options?.signal?.aborted)
      return { success: false, errorType: 'asr-aborted', errorText: 'Transcription aborted' };

    if (ASRX_DEBUG) console.error('[ASRx] transcribe error', error);
    return { success: false, errorType: 'asr-exception', errorText: error?.message || 'Transcription failed' };
  }
}


// -- private helpers --

function _engineFromSelector(selector: ASRxProfileSelector): DASRxEngineAny | null {
  if (selector) {
    // A. most specific: engineId
    if ('engineId' in selector && selector.engineId) {
      const engine = asrxFindEngineById(selector.engineId, false /* allow through - caller intent wins */);
      if (engine) return engine;
    }

    // B. profile.dialect - first valid engine of that vendor type
    if ('profile' in selector && selector.profile?.dialect) {
      const engine = asrxFindValidEngineByType(selector.profile.dialect);
      if (engine) return engine;
    }
  }

  // C. fall back to global engine (active or priority-ranked)
  return asrxFindGlobalEngine();
}

function _engineApplyProfileOverride(engine: DASRxEngineAny, selector: ASRxProfileSelector): DASRxEngineAny {
  if (!selector || !('profile' in selector) || !selector.profile)
    return engine;

  // Prevent cross-vendor profile merges (e.g. OpenAI selector falling back to Deepgram engine)
  if (selector.profile.dialect && selector.profile.dialect !== engine.vendorType)
    return engine;

  return {
    ...engine,
    profile: { ...engine.profile, ...selector.profile } as DASRxProfileAny,
  } as DASRxEngineAny;
}


/**
 * Build a wire-ready Access object from engine credentials.
 * Dereferences `llms-service` credentials against the live LLM store.
 * Returns null if credentials are unresolvable.
 */
function _buildBatchWireAccess(engine: DASRxEngineAny): ASRxAccess | null {
  const c = engine.credentials;

  // Credential validity precheck - saves us a downstream vendor error
  if (!asrxAreCredentialsValid(c)) return null;

  switch (c.type) {

    case 'api-key':
      switch (engine.vendorType) {
        case 'deepgram':
          return {
            dialect: 'deepgram',
            apiKey: c.apiKey,
            ...(c.apiHost ? { apiHost: c.apiHost } : {}),
          };

        case 'openai':
          return {
            dialect: 'openai',
            ...(c.apiKey ? { apiKey: c.apiKey } : {}),
            ...(c.apiHost ? { apiHost: c.apiHost } : {}),
          };

        default:
          const _exhaustiveCheck: never = engine;
          return null;
      }

    case 'llms-service':
      // Only OpenAI supports llms-service linking (Deepgram credentials are forced api-key by _TypeMap)
      if (engine.vendorType !== 'openai') return null;
      const service = findModelsServiceOrNull(c.serviceId);
      if (!service) return null;
      const oai = (service.setup || {}) as Partial<DOpenAIServiceSettings>;
      return {
        dialect: 'openai',
        ...(oai.oaiKey ? { apiKey: oai.oaiKey } : {}),
        ...(oai.oaiHost ? { apiHost: oai.oaiHost } : {}),
        ...(oai.oaiOrg ? { apiOrgId: oai.oaiOrg } : {}),
      };
  }
}
