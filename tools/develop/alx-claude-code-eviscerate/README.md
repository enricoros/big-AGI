# alx-claude-code-eviscerate

Local forensic census of Claude Code's on-disk session format: every
`~/.claude/projects/*/*.jsonl` tape plus the per-session sidecar dirs (`subagents/`,
`tool-results/`, `workflows/`) and project-level `memory/`, and a catalog-level look at the
sibling `~/.claude` stores. Read-only, no network, no API calls - it only reads your own
local Claude Code data and renders a single-file HTML report.

What it establishes, all measured (not asserted):

- the tape is an append-only JSONL **forest** (`parentUuid` tree, fork-by-copy with
  `forkedFrom {sessionId, messageUuid}`, compaction as a new root, zero deletes);
- the **agentic loop on disk**: `promptId` turns, API messages exploded one content block
  per record (reassemble by `message.id`), tool cycles, and the six id systems that stitch
  a flat file back into structure;
- **turn taxonomy**: nine kinds of turns (tool loops, interactive, delegating,
  task-notification-driven, queued, interrupted...), pause attribution, end states, and the
  ladder of loops from content block up to the human+daemon outer loop;
- the **tool interface, measured**: per-parameter fill rates, finite value spaces, error
  rates, result sizes, and the two result copies (wire `tool_result` vs parsed
  `toolUseResult`) with per-tool divergence;
- the **subagent contract**: spawn inputs, per-agentType execution profiles, dual output
  channels, content-hash resume keys, spawn depth;
- **level-3 schemas**: annotated TypeScript definitions for every record type, inferred
  from field presence, observed type unions, and finite value sets;
- the **format's own evolution**, dated from self-stamped `version` fields.

```bash
node scan.mjs      # full corpus census -> out/census.json + out/exemplars.json
node trees.mjs     # exemplar structures -> out/trees.json (condensed trees, barcodes, rhythm, fan)
node turn.mjs      # one real turn with its full id system -> out/turn.json (identity diagrams)
node turns.mjs     # classify all turns + pause/end-state/ladder evidence -> out/turns.json
node toolsx.mjs    # tool-interface census + subagent contract -> out/toolsx.json
node slice.mjs     # two-turn serialization slice -> out/slice.json (ladder-to-tape figure)
node slice2.mjs    # rich drill-view slice (parallel spawns, eager streaming) -> out/slice2.json
node verify.mjs    # the reconstruction contract: 14 invariants checked corpus-wide -> out/verify.json
node schema.mjs    # level-3 field/shape inference -> out/schema.json (TypeScript definitions)
node report.mjs    # render report.html from out/*.json (no rescan)
```

`out/` and `report.html` are gitignored: they are generated from YOUR local conversations
and contain snippets of them - treat them as private, do not commit or share.

Sibling project: `aix-anthropic-eviscerate/` (same report style, live wire probes of the
agentic loop from the API side).
