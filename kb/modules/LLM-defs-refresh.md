# LLM Defs Refresh - per-vendor model-definitions versioning and selective client refresh

Clients re-list a vendor's models automatically when that vendor's model definitions change,
instead of relying on manual refresh clicks or on "rolling AIX" (bumping `Release.Monotonics.Aix`,
which refreshes every vendor on every client). Versions are derived from the source files
themselves: merging a change to `anthropic.models.ts` is the whole workflow, and only
Anthropic-backed services re-list on users' next boot.

## The pieces

| File | Role |
|---|---|
| `src/modules/llms/server/llms.defs.manifest.ts` | Hand-edited manifest: which files carry each vendor's definitions. `satisfies Record<ModelVendorId, ...>` makes vendor add/remove a compile error until the manifest (and the generated map) are updated. |
| `tools/develop/gen-llms-defs/generate-llms-defs.mjs` | The generator: semantic-hashes the claimed files, enforces integrity, writes the map. Run manually or let the npm pre-scripts do it. `--check` recomputes without writing. |
| `src/modules/llms/server/gen/llms.defs.versions.ts` | Generated, committed map: one 12-hex version per bucket. A dirty file after a dev/build run is the signal to commit it. |
| `src/modules/llms/llm.client.defs.ts` | `llmsDefsVersionFor(vendorId, setup)`: the effective version a service compares against (AIX monotonic folded in, custom-host OpenAI rule). Client-side; the generated map is plain data. |
| `src/common/logic/reconfigureBackendModels.ts` | The boot-time selective refresh: compares each service's stamp to its version and re-lists only mismatches. |
| `package.json` | `predev`/`predev-debug` chain the generator after gen-devtools-workspace; `prebuild` runs it before `next build`. Integrity failures fail the run. A `--check` step exists in `ci.yml`, commented out on purpose (GitHub-side quick edits can't run the generator; deploy builds regenerate anyway). |

Per-service state: `DModelsService.defsV` (optional, data at rest) - the version the boot refresh
last targeted the service at; absent on new/imported/legacy services, which makes them refresh
candidates.

There is no server surface: the client's own build carries the map, and the client compares its
services against it. No capabilities field, no wire change, nothing for older clients or servers
to disagree about (see "Why the client's map").

## Version derivation (what rolls, what does not)

Each claimed file is normalized through `ts.transpileModule` (comments removed, types erased,
LF newlines) and sha256-hashed; a bucket's version hashes its files plus its `epoch`, and every
non-`_shared` bucket folds the `_shared` digest in. The runtime appends `-a<Monotonics.Aix>`.

- Rolls: any change to shipped data or parsing logic - model tables, labels, pricing, zod
  wiretype schemas, filter/sort/variant code, the shared mappings.
- Does not roll: comments, JSDoc, formatting, whitespace, and type-only edits (interfaces,
  annotations, `import type`). A local variable rename does roll (accepted false positive:
  cost is one extra re-list).
- Because comments no longer roll, the sanctioned force-roll is the manifest `epoch` field:
  bump the vendor's `epoch` to roll one vendor, `_shared.epoch` to roll everyone. Rolling
  `Monotonics.Aix` still refreshes everything and stays reserved for protocol-level changes.
- `SCHEME_REV` in the generator force-rolls all buckets if the hashing scheme itself changes.
- Determinism: the hash is a pure function of source + the pinned `typescript` version, so any
  machine reproduces the committed map bit-for-bit (a TypeScript upgrade may re-emit and roll
  all vendors once - harmless). Cross-check by building and looking for a dirty gen file.

## Buckets and attribution

One bucket per `ModelVendorId`, plus two pseudo-buckets. Files may be claimed by several
buckets, following real value-import dependencies:

- `azure` claims `openai.models.ts` (deployments resolve against the OpenAI curated table).
- `bedrock` claims `anthropic.models.ts` (mantled Anthropic models).
- `openrouter` claims the `anthropic/gemini/metaai/moonshot/openai/sakanaai/xai/zai` models files
  (per-creator parameter inheritance via the `llmOrt*Lookup` tables) - an OpenAI defs edit
  correctly rolls OpenRouter. The generator's import audit flags any new lookup import until it
  is claimed here.
- `_shared`: `models.mappings.ts`, `llm.server.variants.ts`, `llm.server.types.ts`,
  `listModels.dispatch.ts` - rolls every service.
- `_openaiCompat`: the OpenAI-lookalike sub-parsers selected by host heuristics under the
  `openai` dialect (Fireworks, Novita, ChutesAI, MiniMax, LLM API, Nous, Arcee, TLUS, FastAPI,
  plus the NVIDIA and OpenRouter parsers they reuse), and `openai.models.ts` itself: a proxy to
  OpenAI (LiteLLM, corporate gateways) sits behind a custom host but is parsed by the first-party
  parser, so first-party edits must reach it. Custom-host OpenAI services (non `api.openai.com`
  `oaiHost`) compare against this bucket instead of `openai`. Its `ignoreImports` leaves the
  other creator lookups (anthropic/gemini/metaai/moonshot/sakanaai/xai/zai, OpenRouter inheritance)
  untracked - owner decision, bump its `epoch` for an editorial roll.

Generator integrity gates (fail the dev/build run): claimed files must exist; every
`src/modules/llms/server/**/*.models.ts` must be claimed by some bucket; and a one-level import
audit requires each claimed file's relative value-imports to be claimed by the same bucket,
`_shared`, the bucket's `ignoreImports`, or transport infra (`*.access.ts`). `import type` is
ignored (erased at runtime); `listModels.dispatch.ts` is the audit-exempt composition root.
Type-level gates: adding/removing a vendor breaks both the manifest and the generated map until
regenerated. What TypeScript cannot see (files nothing imports) the generator gates at build.

## Boot flow

`ProviderBootstrapLogic` -> sherpa -> `reconfigureBackendModels`, once per session, after the
capabilities provider has gated on a matching server build:

1. Idempotently create services for backend-configured vendors (`hasLlm*` capability flags).
   Note: a deleted backend-provided service reappears on the next boot (previously it only
   returned on the next hash roll).
2. A service refreshes when it was just created, or when its `defsV` stamp differs from
   `llmsDefsVersionFor(vId, setup)`. Services of unknown vendors (data from a newer app) are
   left alone.
3. Mismatched services re-list through a small pool (4 in flight). The stamp is written right
   before each attempt, so a failing service (offline Ollama, dead LocalAI host, revoked key) is
   not retried on every boot - it waits for its version to roll or a manual refresh, exactly the
   old "store the hash upfront" loop protection, now per service.
4. If anything refreshed: LLMs re-rank to the services order (partial refreshes prepend, this
   restores stability) and domain auto-assignment runs (unchanged semantics).

Behavior deltas vs the old global hash: an API key rotation no longer triggers a refresh (the
hash included env values; definitions did not change); refreshes are per-service instead of
all-or-nothing (all instances of a vendor refresh together); the first boot after this feature
lands stamps everything via one full refresh; the boot re-rank follows the services order
(previously backend-configured services were moved first on every roll).

`hashLlmReconfig` stays on the wire for older clients (their refresh-all trigger); new clients
ignore it. The leftovers are marked `TODO(2026-11)` for removal on both branches.

## Why the client's map (and not a server-advertised one)

The client's bundle carries the map, and the client is what boots and compares. On both
deployment shapes the client build equals the server build when the refresh runs: the
capabilities provider gates on a matching `gitSha`/`pkgVersion` before the app boots
(main: hard gate; cloud: boot gate with an explicit bypass), and a reload always fetches the
current bundle from the current server. A server-advertised map would carry the same values
through an extra wire field, and would be wrong for the one path where the client executes
the listing itself (client-side fetch, `csf`): there the client's parsers are the truth by
construction. In the residual skews (PWA-cached shell, alias rollback) the client's map is the
conservative choice - an older client does not re-list against a newer server it cannot fully
render; it refreshes once it is itself updated.

## Deployment notes

- Vercel and Docker run `npm run build`, so `prebuild` regenerates the map and the bundle
  always carries hashes matching the compiled definitions, even if the committed map lagged
  (the commit is for review visibility and determinism checking). Direct `next build`
  invocations skip the regen and use the committed map - still correct when it is current.
- `next start` never runs the generator (the Docker runtime stage is pruned); static exports
  and keyless builds are unaffected (the app never boots past the capabilities gate without a
  backend, as before).

## Cloud branch (dev)

Same code, one seam: `reconfigureBackendModels.ts` is `reconfigureTenantProvidedModels.ts`
there and reads the `hasLlm*` flags from `getCloudFabricLegacy()` instead of
`getBackendCapabilities()` (the pre-existing branch difference). Nothing else differs, since
the feature has no server surface - a deliberate choice so that `dev` rebases carry it without
touching the Cloud Fabric layer.
