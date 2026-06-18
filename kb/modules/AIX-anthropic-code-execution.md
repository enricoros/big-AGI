# Anthropic Code Execution, Containers, and Sandbox Direction

How big-AGI drives the Anthropic code execution tool and its container, how that interacts with
dynamic web search/fetch, the empirically-verified behavior behind those choices, and the
forward-looking "Sandbox / execution environment" direction.

Status (2026-06): the shipped changes below live on branch `AB-anthropic-code-exec` (uncommitted at
time of writing). The forward design section is direction + open questions, not decided architecture.


## Three ways code execution turns on - all one container

The explicit `code_execution_20260120` tool (with its `bash_code_execution` + `text_editor_code_execution`
sub-tools) and a reusable `container` are added when `enableCodeExecution` is true, which happens three
ways, all converging on ONE explicit container:

- **Standalone toggle** (`vndAntCodeSandbox`, label "Code Sandbox") - a general-purpose hosted-container sandbox the user enables.
- **Skills** (`vndAntSkills`) - skills run inside the code execution container.
- **Programmatic Tool Calling** - the container is the script executor for tools with `allowed_callers`.

Single source of truth: `aixAnthropicHostedFeatures()` in
`src/modules/aix/server/dispatch/chatGenerate/adapters/anthropic.messageCreate.ts` (drives both the
tool list and the beta headers).

Dynamic web tools (`web_search_20260209` / `web_fetch_20260209`) are a fourth, **implicit** source: they
auto-run code execution internally for dynamic filtering. big-AGI never AUTO-adds the standalone tool for
them - see #1087 below.


## The #1087 history (the single-environment lesson)

Issue [enricoros/big-AGI#1087](https://github.com/enricoros/big-AGI/issues/1087), reporter @Slava-256
(filed 2026-04-25, closed 2026-05-08): with `code_execution` enabled alongside the dynamic web tools, the
model tried to call the web tools from generated scripts, which fail because web tools default to
`allowed_callers: ["direct"]` - producing failed scripts, runaway loops, and (with attachments) bash
hunting on disk for inlined files. Root cause: big-AGI was auto-enabling the standalone tool whenever
dynamic filtering was on.

Fixed 2026-04-28 in three commits:
- `e5de61d6827` - stop enabling code execution just because dynamic web is on (removed `hasDynamicWebTools`).
- `ed4edd7c0b8` - stop re-enabling it from leftover container continuity (removed `vndAntContainerId`).
- `6f6375eaba2` - re-enable the safe Search+Max -> dynamic-filtering auto-opt-in, now that the tool is no
  longer dragged in.

Net result: `enableCodeExecution = vndAntSkills || PTC`. The architectural decision (Enrico's comment
`#issuecomment-4340352958`): once a container is created by `web_search_20260209`, **ignore** it rather
than re-attach across turns - chosen because, in the code at the time, re-attaching forced the
`code_execution` tool on. Slava's stated constraint: *"if enabling persistency requires enabling
code_execution_20260120, then I would prefer the default to be not persistent."*


## Empirically verified behavior (live API probes, Opus 4.8)

- **Coexist is wire-legal:** `code_execution_20260120` + `web_search_20260209` returns 200 with a single
  `container` id; both produce interleaved results. The model can still get the soft "scripts the web
  tool" confusion (#1087) on search-heavy prompts, but it is not a hard error.
- **"Pin both to the same version" means version-match, enforced by a name collision.** The dynamic web
  tools **auto-inject** a `code_execution` tool at version `code_execution_20260120`. Declaring your own:
  - `code_execution_20260120` (same version) -> merges into one tool/environment -> 200.
  - `code_execution_20250825` (older, same tool name `code_execution`) -> **400**:
    `"Auto-injecting tools would conflict with existing tool names: ['code_execution']. Each tool name
    must be unique."` This is the hard form of "two execution environments."
  big-AGI ships `code_execution_20260120`, so it is always on the safe (pinned) side.
- **Plain web search creates no container.** `web_search_20250305` (non-dynamic) returns `container: null`.
  Only the `_20260209` dynamic versions create one.
- **Nothing active -> no container.** A request with no container-using tool returns `container: null`.
- **Container continuity works and survives intervening search turns.** A file written by code execution in
  a re-attached container is still readable after an intervening dynamic-web-only turn (verified by
  re-attaching the same id and `cat`-ing the file).
- **A dynamic-web container holds no user-meaningful files** - just internal residue (`pfc_daemon.*`,
  node cache). Its value across turns is continuity for *mixed* sessions, not the search container itself.
- **Haiku 4.5 accepts `code_execution_20260120`** despite the docs' model-compat table listing only
  `_20250825` for it (the table is conservative; basic execution still ran). The `_20260120`-only features
  (REPL persistence, PTC) may silently no-op there.

Model support for `code_execution_20260120` (per docs): Fable/Mythos 5, Opus 4.5+, Sonnet 4.5+ (NOT Haiku
4.5, NOT Opus 4.1).


## Beta headers

`enableCodeExecution` drives: `code-execution-2025-08-25` + `files-api-2025-04-14`; Skills add
`skills-2025-10-02`; Tool Search / PTC add `advanced-tool-use-2025-11-20`. Dynamic web (`_20260209`) needs
no extra beta (the internal code execution is implicit). The `_20260209` web tools are NOT ZDR-eligible
because of that internal code execution; `allowed_callers: ["direct"]` disables dynamic filtering for ZDR.

Cost: code execution is FREE when used with web search/fetch; otherwise metered ($0.05/hr/container after
1,550 free org-hours/month, 5-minute minimum; attached files bill even if code never runs). Containers are
server-retained ~30 days.


## Shipped changes (branch `AB-anthropic-code-exec`)

### 1. Standalone Code Sandbox toggle (`vndAntCodeSandbox`)

An enum (`'auto'`), off by default, rendered as a toggle, added to `enableCodeExecution` (enum not boolean - matches the other vendors' code-exec params and leaves room for future modes). Scoped to `ANT_TOOLS_DYNAMIC` (Opus/Sonnet
4.6+, Fable/Mythos 5) - a clean subset of `code_execution_20260120`-supporting models that excludes Haiku
4.5. UI toggle in the model dialog (`LLMParametersEditor`) and chat side panel
(`ChatPanelModelParameters`); shown checked+disabled (implied-on) when Skills are active. The tool literal
stays `code_execution_20260120` deliberately - matching the dynamic-web auto-injection so coexisting never
hits the 400 name collision.

Touch points: `aix.wiretypes.ts` (`vndAntCodeSandbox`), `llm.server.types.ts` (paramId enum),
`llms.parameters.ts` (registry), `anthropic.models.ts` (`ANT_TOOLS_DYNAMIC`), `aix.client.ts`
(map `llmVndAntCodeSandbox` -> `vndAntCodeSandbox`), `anthropic.messageCreate.ts` (derivation).

Coexist policy (chosen): the standalone toggle + dynamic web may coexist (the "pin to same version" path);
the residual soft confusion is the accepted trade, mitigable with a system-prompt note.

### 2. Container continuity decoupled from `enableCodeExecution`

Container re-attachment now fires when `enableCodeExecution || hasDynamicWeb` (where `hasDynamicWeb =
vndAntWebDynamic && (vndAntWebSearch === 'auto' || vndAntWebFetch === 'auto')`), instead of only
`enableCodeExecution`. This re-attaches the container across dynamic-web turns WITHOUT adding the
`code_execution` tool - so #1087 stays fixed, but conversations keep one sandbox (a file written by code
execution survives an intervening search turn). It reverses only the "ignore the search container" half of
the #1087 decision, now safe because re-attaching no longer forces the tool on (the constraint behind
Slava's caution no longer holds). Plain (non-dynamic) search is excluded (it has no container); nothing
active sends no container. Retention is the same ~30-day profile already used for Skills/code-exec
containers.

Client path (unchanged, already locus-blind): the parser emits container state via the `svs` particle for
any response that carries a `container`; `ContentReassembler.onSetVendorState` promotes it to
`DMessageGenerator.upstreamContainer`; `_findNewestUpstreamContainer` walks history and provides
`vndAntContainerId`. So the server gate change is sufficient - no client change needed.

**State lives per-DMessage** (on the generator), which gives free branch/rewind fidelity: rewinding to an
older message recovers the container state as it was then. This is a feature to preserve.


## Cross-vendor: code execution across providers

Each provider exposes its own server-side code-execution capability as a separate `llmVnd*` parameter.
All four now share the **"Code Sandbox"** user-facing label (they are the same capability - the
`vendor-container` locus), while each param **id** stays vendor-true (matching the vendor's API term and
avoiding orphaning existing users' saved settings):

| Vendor | Param id (kept) | Label (uniform) | Backing |
|---|---|---|---|
| Anthropic | `llmVndAntCodeSandbox` | Code Sandbox | `code_execution_20260120` container (`vndAntContainerId` reuse) |
| Gemini | `llmVndGeminiCodeExecution` | Code Sandbox | Gemini server-side code execution |
| xAI | `llmVndXaiCodeExecution` | Code Sandbox | xAI server-side code execution |
| OpenAI | `llmVndOaiCodeInterpreter` | Code Sandbox | OpenAI code interpreter container (`vndOaiContainerId` reuse) |

These are independent today: each is a vendor-specific server tool, declared and executed on that vendor's
infrastructure, with no shared abstraction. Only the label is unified; the underlying tools and ids keep
their vendor terms (Anthropic's tool stays `code_execution_20260120`, OpenAI's id stays `CodeInterpreter`).
The "Sandbox" umbrella and its locus qualifiers (Cloud/VPS/Browser/Local Sandbox) are the forward UI +
conceptual layer; in the forward design all four are the `vendor-container` locus of the unified Sandbox.


## Forward direction: Sandbox / execution environments (FUTURE, partly open)

Direction agreed in design discussion; the architecture forks below are still open.

- **Umbrella noun: "Sandbox"** (chosen). The locus qualifies it.
- **Locus enum (flat, hyphenated, extensible; prefix = operator):**
  - `vendor-container` - the LLM vendor runs it (today's `vndAntCodeSandbox`; OpenAI interpreter; Gemini).
  - `hosted-vps` - big-AGI/operator-hosted persistent VM (OpenClaw-style; full OS, network, computer-use).
  - `client-browser` - in-page isolate (iframe/Worker/Pyodide), app-bound, OPFS for file persistence.
  - `client-local` - the user's machine via the desktop app (real shell/FS). Maps to the XE `host` subsystem.
- **Chat as execution context:** a conversation owns a roster of environment instances (locus, handle,
  status, continuity token, policy), built for async disposal, assumed ephemerality/breakage, and
  structured errors reported cleanly to the model. Today's container-id reuse is the seed of "environment
  continuity." This is the `conversations are execution contexts` vision vector and the ATOL
  (`PRD.FUTURE-atol.md`) multi-environment layer.
- **State scope tension:** per-DMessage (branch-friendly, proven, persists well) vs the execution-model /
  chat-scoped roster (needed for live/distributed handles). Likely hybrid: durable snapshot on DMessage +
  live handle on the execution-model keyed by env id.
- **Model view:** the model should be aware of the roster (distributed/pluri) and able to target/queue work
  to specific environments; confusion avoided by distinct, well-described environments (the #1087 lesson),
  not by hiding them.

### Open questions (interview not concluded)
1. State home/scope: DMessage-only vs hoist-to-execution-model vs hybrid (and ZYNC-synced for cross-device).
2. Targeting: env-handle on one Sandbox tool vs distinct tool per environment vs list-then-target.
3. Lifecycle/errors: handle+status+structured-errors vs recreate-on-miss vs lease+TTL.
4. Near-term: the toggle now ships as "Code Sandbox" (`vndAntCodeSandbox`); open whether to go
   locus-qualified ("Cloud Sandbox") once other loci exist; write the ATOL design out; sketch the
   `Sandbox`/`Environment`/locus types.

Naming notes: avoid `host*` for the vendor/remote loci (XE `host` already means the local machine); avoid
"Remote Code Execution" (RCE connotation). The id is `vndAntCodeSandbox` ("Code Sandbox") - adopting the
Sandbox umbrella so the hosted-container nature is apparent; the underlying Anthropic tool stays
`code_execution_20260120`. The other vendors keep their own param ids (CodeExecution / CodeInterpreter) but now share the "Code Sandbox" label.
