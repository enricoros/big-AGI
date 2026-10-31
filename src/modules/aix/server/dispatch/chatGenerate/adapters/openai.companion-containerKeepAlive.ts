import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { OPENAI_API_PATHS, openAIAccess, OpenAIAccessSchema } from '~/modules/llms/server/openai/openai.access';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateDispatchCompanion } from '../chatGenerate.dispatch';
import type { OpenAIWire_API_Responses } from '../../wiretypes/openai.wiretypes';


/**
 * OpenAI code-interpreter container keep-alive (#1211).
 *
 * Measured against the Responses API, 2026-10-31:
 * - With `code_interpreter` declared, OpenAI allocates the response's container(s) at response start, used or not: one per
 *   non-pro response, two per `reasoning.mode: 'pro'` response (once, a second pair followed at 73 s). Pro mode never reuses a
 *   container: a replayed id is ignored under `container: { type: 'auto' }`, an explicit id is a 400.
 * - A container expires 20 minutes after its last container operation. A non-pro response keeps its container alive while it
 *   runs (22 idle minutes measured). A pro response does not: when it reasons and searches past 20 minutes before its first
 *   cell, the next container operation fails with `response.failed` { code: 'unknown', message: 'Container is not running.' },
 *   or the stream ends cleanly with no terminal event when the container dies before any item streamed.
 * - A GET on `/v1/containers/{id}` refreshes `last_active_at`. Pinging every few minutes kept cells working at 23, 35 and 54 minutes.
 * - The response reveals a container id only when a cell completes, in pro mode often at the very end. The ids are therefore
 *   discovered by listing the newest containers and taking the `auto` ones created within seconds of the request start; the
 *   exact id joins the set when the parser's `openai-container` vendor-state particle passes through the companion.
 *
 * Shape: one keeper per process, created on first use, reference-counted by in-flight dispatches. The OpenAI dispatch attaches
 * `companion(access)` when the request declares the sandbox in pro mode (`applies`); the companion registers on start (before
 * the connection), feeds the exact container id from the particles, and releases on end. The registration resolves the
 * containers endpoint and credentials from the access, the user's key in the browser and the server's otherwise, and its own
 * time is the discovery anchor. One timer runs while any registration is live, so staggered registrations share the ticks: the
 * first ping of a registration comes within one interval, then every interval, against a 20 minute expiry. Each tick lists once
 * per access, newest first and paginated until the oldest registration's window is covered, then GETs every target once through
 * the routers' fetcher, a few at a time. Sized for 100 parallel pro-mode Beam rays: 200 containers per tick in 2 pages. GETs are
 * free and failures are ignored: the keep-alive is best effort and never touches the response. Only running containers are
 * targeted, so a failed GET (one fetcher log line) is rare. CORS is open on these endpoints, so it runs under Direct Connection
 * as it does on the server.
 *
 * Follow-ups (#1211):
 * - [ ] container error text: name the cause (sandbox expired after 20 idle minutes inside a long Pro run); no automatic retry, it re-arms the same clock
 * - [ ] pro mode: skip the cross-turn container stamp and replay (OpenAI ignores them); sandbox setting help: pro starts fresh every turn
 * - [ ] non-pro: invalidate the stamped container when a run fails on it, drop the id on retry; Beam sandbox default from 'all' to 'first'
 * - [ ] stream drop: one wording for the browser and Node variants; retry only when nothing was parsed and no function call was emitted
 * - [ ] rate limit at the final pass of a long pro response: never restart a response older than a few minutes, surface it
 */

// configuration
const OAI_KEEPALIVE_ENABLED = true;
const OAI_KEEPALIVE_SCOPE: 'pro' | 'all' = 'pro';     // 'pro': requests in reasoning.mode 'pro' (the measured failure); 'all': every request declaring code_interpreter
const OAI_KEEPALIVE_FIRST_PING_MS = 60_000;           // containers exist seconds after the request is admitted; the first tick also covers slow connects
const OAI_KEEPALIVE_INTERVAL_MS = 5 * 60_000;         // against a 20 minute idle expiry
const OAI_KEEPALIVE_DISCOVERY_BEFORE_MS = 10_000;     // discovery window around the registration, generous for clock skew...
const OAI_KEEPALIVE_DISCOVERY_AFTER_MS = 180_000;     // ...and for admission delays under load, connection retries, and a late second pair
const OAI_KEEPALIVE_LIST_PAGE = 100;                  // the API maximum; pages are read newest first until the oldest registration's window is covered...
const OAI_KEEPALIVE_LIST_MAX_PAGES = 5;               // ...or 500 containers, whichever first (100 pro-mode rays are 200 containers)
const OAI_KEEPALIVE_PING_CONCURRENCY = 8;             // GETs in flight per tick: 200 targets take a few seconds, not a minute
const OAI_KEEPALIVE_FEED_KNOWN_IDS = true;            // also ping the exact ids the parser reports as cells complete
const OAI_KEEPALIVE_MAX_HOLD_MS = 90 * 60_000;        // longest a registration is honored: bounds a generator abandoned without release (the longest measured response was 55 minutes)
const OAI_KEEPALIVE_DEBUG = process.env.NODE_ENV === 'development';


interface _Registration {
  /** `.../v1/containers` for this access; `?limit=` lists, `/${id}` reads */
  containersUrl: string;
  headers: HeadersInit;
  /** discovery anchor and hold start: the response's containers are created within seconds of admission */
  registeredAt: number;
  knownIds: Set<string>;
}

interface _Handle {
  /** sees every particle the dispatch emits; picks the `openai-container` vendor state (a completed cell) for its exact id */
  observeParticle: (particle: AixWire_Particles.ChatGenerateOp) => void;
  /** idempotent */
  release: () => void;
}

/** The wire shape the keeper reads from a container listing (`GET /v1/containers`, newest first, `after` paginates) */
interface _ContainerListing {
  data?: { id: string; name?: string | null; status?: string | null; created_at?: number }[];
  has_more?: boolean;
  last_id?: string | null;
}


export class OpenAIContainerKeepAlive {

  // --- one per process, created on first use ---

  static #instance: OpenAIContainerKeepAlive | null = null;

  static get(): OpenAIContainerKeepAlive {
    return this.#instance ??= new OpenAIContainerKeepAlive();
  }

  /** Whether a Responses request gets the keep-alive: it declares code_interpreter, and runs in pro mode when the scope says so */
  static applies(body: OpenAIWire_API_Responses.Request): boolean {
    if (!OAI_KEEPALIVE_ENABLED) return false;
    if (!body.tools?.some(tool => tool.type === 'code_interpreter')) return false;
    return OAI_KEEPALIVE_SCOPE === 'all' || body.reasoning?.mode === 'pro';
  }

  /** The dispatch companion for one request: registers on start, feeds the exact container id from the particles, releases on end */
  static companion(access: OpenAIAccessSchema): ChatGenerateDispatchCompanion {
    let handle: _Handle | undefined;
    return {
      name: 'openai-container-keepalive',
      onStart: (intakeAbortSignal) => handle = OpenAIContainerKeepAlive.get().register(access, intakeAbortSignal),
      onParticle: (particle) => {
        handle?.observeParticle(particle);
        return particle;
      },
      onEnd: () => handle?.release(),
    };
  }


  // --- instance: registrations and the one timer ---

  readonly #registrations = new Set<_Registration>();
  #timer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
  }

  /**
   * Holds the dispatch's containers alive until `release()`, which the companion calls from the executor's `finally`. The intake
   * abort signal is a second exit for the same registration: a consumer that aborts and never resumes the generator leaves that
   * `finally` unreached, and without it the pings would outlive the request (bounded only by OAI_KEEPALIVE_MAX_HOLD_MS).
   */
  register(access: OpenAIAccessSchema, intakeAbortSignal: AbortSignal): _Handle {
    const { url: containersUrl, headers } = openAIAccess(access, null, OPENAI_API_PATHS.containers);
    const registration: _Registration = { containersUrl, headers, registeredAt: Date.now(), knownIds: new Set() };
    this.#registrations.add(registration);
    if (!this.#timer)
      this.#timer = setTimeout(() => this.#tick(), OAI_KEEPALIVE_FIRST_PING_MS);
    if (OAI_KEEPALIVE_DEBUG)
      console.log(`[AIX] OpenAI container keep-alive: registered (${this.#registrations.size} live)`);
    const release = () => {
      intakeAbortSignal.removeEventListener('abort', release);
      if (!this.#registrations.delete(registration)) return; // already released by the other exit
      if (!this.#registrations.size && this.#timer) {
        clearTimeout(this.#timer);
        this.#timer = null;
      }
      if (OAI_KEEPALIVE_DEBUG)
        console.log(`[AIX] OpenAI container keep-alive: released (${this.#registrations.size} live)`);
    };
    intakeAbortSignal.addEventListener('abort', release, { once: true });
    return {
      observeParticle: (particle) => {
        if (OAI_KEEPALIVE_FEED_KNOWN_IDS && 'p' in particle && particle.p === 'svs' && particle.vendor === 'openai-container')
          registration.knownIds.add(particle.state.container.id);
      },
      release,
    };
  }

  async #tick(): Promise<void> {
    this.#timer = null;
    // bounded hold: a dispatch that never released (its generator abandoned without `.return()`, no abort) stops being pinged
    for (const registration of this.#registrations)
      if (Date.now() - registration.registeredAt > OAI_KEEPALIVE_MAX_HOLD_MS) {
        this.#registrations.delete(registration);
        if (OAI_KEEPALIVE_DEBUG)
          console.warn(`[AIX] OpenAI container keep-alive: dropped a registration held over ${OAI_KEEPALIVE_MAX_HOLD_MS / 60_000} minutes (${this.#registrations.size} live)`);
      }
    if (!this.#registrations.size) return;
    try {
      await this.#pingLiveContainers();
    } catch (error: any) {
      if (OAI_KEEPALIVE_DEBUG)
        console.warn('[AIX] OpenAI container keep-alive: tick failed', error?.message || error);
    }
    // a registration that arrived mid-tick already armed the timer
    if (this.#registrations.size && !this.#timer)
      this.#timer = setTimeout(() => this.#tick(), OAI_KEEPALIVE_INTERVAL_MS);
  }

  /** One listing per access, then one GET per target container: the known ids, plus the `auto` containers created in any registration's window */
  async #pingLiveContainers(): Promise<void> {

    // group by access: same containers endpoint and same credentials
    const groups = new Map<string, _Registration[]>();
    for (const registration of this.#registrations) {
      const key = registration.containersUrl + '|' + (new Headers(registration.headers).get('authorization') || '');
      const group = groups.get(key);
      if (group) group.push(registration);
      else groups.set(key, [registration]);
    }

    for (const registrations of groups.values()) {
      const { containersUrl, headers } = registrations[0];
      const targets = new Set<string>();
      for (const registration of registrations)
        for (const id of registration.knownIds)
          targets.add(id);

      // discovery: the newest containers, `auto` and still running, created around a registration; newest first, so paging
      // stops once a page reaches back past the oldest registration's window
      const windowStart = Math.min(...registrations.map(({ registeredAt }) => registeredAt)) - OAI_KEEPALIVE_DISCOVERY_BEFORE_MS;
      let after: string | null = null;
      for (let page = 0; page < OAI_KEEPALIVE_LIST_MAX_PAGES; page++) {
        const listing: _ContainerListing | null = await _fetchJsonOrNull<_ContainerListing>(`${containersUrl}?limit=${OAI_KEEPALIVE_LIST_PAGE}&order=desc${after ? `&after=${after}` : ''}`, headers);
        if (!listing?.data?.length) {
          if (!listing && OAI_KEEPALIVE_DEBUG)
            console.warn(`[AIX] OpenAI container keep-alive: listing failed (page ${page + 1})`);
          break;
        }
        for (const container of listing.data) {
          if (container.name !== 'auto' || container.status !== 'running' || !container.created_at) continue;
          const createdAt = container.created_at * 1000;
          if (registrations.some(({ registeredAt }) => createdAt >= registeredAt - OAI_KEEPALIVE_DISCOVERY_BEFORE_MS && createdAt <= registeredAt + OAI_KEEPALIVE_DISCOVERY_AFTER_MS))
            targets.add(container.id);
        }
        const oldest = listing.data[listing.data.length - 1];
        if (!listing.has_more || !oldest.created_at || oldest.created_at * 1000 < windowStart) break;
        after = listing.last_id || oldest.id;
      }

      // the GET is the keep-alive: it refreshes last_active_at; a few in flight at a time
      const ids = [...targets];
      let next = 0, pinged = 0;
      await Promise.all(Array.from({ length: Math.min(OAI_KEEPALIVE_PING_CONCURRENCY, ids.length) }, async () => {
        while (next < ids.length) {
          const id = ids[next++];
          if (await _fetchJsonOrNull(`${containersUrl}/${id}`, headers))
            pinged++;
        }
      }));
      if (OAI_KEEPALIVE_DEBUG)
        console.log(`[AIX] OpenAI container keep-alive: ${pinged}/${ids.length} containers pinged for ${registrations.length} dispatch(es)`);
    }
  }
}


/** The routers' fetcher, made silent: the parsed JSON, or null on any failure (an expired or deleted container is a 404 and nothing to keep alive) */
async function _fetchJsonOrNull<T extends object = object>(url: string, headers: HeadersInit): Promise<T | null> {
  try {
    return await fetchJsonOrTRPCThrow<T>({ url, headers, name: 'OpenAI.containerKeepAlive', throwWithoutName: true });
  } catch {
    return null;
  }
}
