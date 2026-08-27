# model-fingerprint

Which lab produced an unknown OpenRouter model? An evidence instrument designed to be
driven by an AI assistant: the script gathers and scores, the assistant judges and iterates.
The script makes no judgment calls and runs no LLM-judge - the assistant running it is the judge.

```bash
tools/develop/model-fingerprint/fingerprint.mjs --find "ox alpha"        # locate: catalog search + hidden-slug probing
tools/develop/model-fingerprint/fingerprint.mjs --target <slug> --light  # lay of the land (~9 probes, ~2 min)
tools/develop/model-fingerprint/fingerprint.mjs --target <slug>          # full battery (18 probes)
tools/develop/model-fingerprint/fingerprint.mjs --ask "<prompt>" --models a,b,c   # ad-hoc side-by-side (endgame)
# --refs a,b,c  --max-tokens N  --concurrency N  --timeout MS  --help
```

Needs `OPENROUTER_API_KEY` (env or repo-root `.env.api-keys`). Writes `out/<ts>-<target>/raw.json` + `digest.md` (gitignored), signals dashboard on stdout.

## Signals (deliberately orthogonal axes)

Fused score = mean z-score across refs per signal; verdict CLEAR only when top-2 gap >= 0.5σ AND the leader has >= 4/5 signals populated (a winner with data gaps is a data problem, not a finding).

| signal | axis | what it measures |
|---|---|---|
| z.tok | infrastructure | `prompt_tokens` vector over 5 corpora (en/zh/code/unicode/rare) + completion recount on exact echo. Same tokenizer + template = near-zero L1; unfakeable by RLHF |
| z.cos | lexical surface | char-trigram cosine on behavior probes, z-scored (the ref-vs-ref baseline line calibrates the generic-assistant ceiling) |
| z.style | formatting DNA | 17-dim vector: headers, bold-label pattern, bullet dialect, em-dash, CJK punctuation, opener/closer habits, verbosity |
| z.choice | semantic attractors | forced one-word picks (random number, animal, color, ...) - argmax choices are family DNA; siblings agree far above the pairwise baseline |
| z.meta | protocol | native_finish_reason vocabulary (end_turn=Anthropic, STOP=Google, completed=OpenAI/xAI), reasoning exposure |

Unscored, for the assistant's read:
- **reveal probes** - identity claims, cutoff, prefill continuation, system-prompt dump. Cloaked models lie; *shared wrong claims* (target and one family hallucinating the same cutoff/events) are strong evidence.
- **special_tokens** - which chat-template tokens vanish from the model's view when a third-party host runs the real template (probe covers ChatML, Llama, Gemma, Mistral, GLM sets). First-party endpoints usually escape; the swallow shows on open-weights hosts.
- **tok/s** - median completion speed, size-class hint only (flash vs pro); host- and load-dependent, never a family signal.

## Workflow (assistant-driven)

1. `--find <name>` - callable slug. Retired stealth slugs return a tombstone naming the real model; `--find` prints it.
2. `--target <slug> --light` - dashboard + digest. Timeouts on slow thinking flagships are expected; the coverage gate keeps them from producing false CLEARs.
3. Read `digest.md`: dashboard, tokenizer vectors, choice matrix, then the side-by-side reveal/behavior text. Look for shared wrong claims, identical formatting skeletons, same analogies/成语.
4. If CLEAR and the read agrees: done. If not: full battery on the finalists (`--refs` trimmed), add the leader's siblings as refs.
5. Endgame by hand: `--ask` discriminating prompts at target + finalists (family-specific self-knowledge, template quirks, borderline formats). Declare with an evidence list, never on one signal.

## Validation (2026-08-27)

Ground truth: OpenRouter's `stealth/ox-alpha` tombstone states it was `z-ai/glm-5.3-flash`. Treated blind vs 6 refs in `--light`: verdict CLEAR, `z-ai/glm-5.3` #1 (fused 0.94, gap 0.66σ, 5/5 signals), tokenizer vector 51/63/77 exact match (tokL1 2 vs 32+ for others). Full-battery run against 11 flagship refs: same winner; the Parasail-hosted target swallowed exactly the 5 GLM specials (`<|User|>` capital-U survived - GLM's is lowercase) and reveal probes matched glm-5.3 near-verbatim including the same wrong "October 2023" cutoff claim. Note: single signals do mislead (deepseek won the choice round once, minimax a cosine round) - only the fused dashboard + assistant read identifies.

## Known limits

- Reasoning is disabled (`reasoning: {enabled: false}`, stripped on rejection/timeout) for mechanical probes and all of `--light`; big thinking flagships can still time out - re-run finalists without `--light`.
- `completion_tokens` includes reasoning; the echo recount subtracts itemized reasoning tokens and drops implausible counts, but some vendors itemize wrongly.
- Trigram cosine on short Chinese/poem outputs is noisy - trust the fusion, not single probes.
- Choice probes only work in the moderate-entropy sweet spot: small *semantic* basins (city, name, color). Too narrow collapses to cross-lab attractors (742, 47, π, hex digit-set {A,3,F,7,2}); wide numeric ranges (4-digit odd, 3-decimal) decorrelate even siblings (verified: sibling agreed 1/10 on a wide-numeric battery).
- Keep `DEFAULT_REFS` current as flagships roll. Cloaked slugs mask `provider`; tokenizer and finish-reason signals still work.
