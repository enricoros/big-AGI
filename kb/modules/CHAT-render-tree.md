# Chat Render Tree

`ChatMessage` renders a message through a render tree instead of per-fragment switches: `src/apps/chat/components/message/render-tree/`.

| File | Role |
|---|---|
| `cmRenderTree.types.ts` | node kinds, `CMRenderTree`, `CMTrailingOptions` |
| `cmRenderTree.build.ts` | pure builder: hoist citations, claim tool responses, fuse adjacent runs, separators, trailing options |
| `cmRenderTree.recycle.ts` | identity across builds: node objects, arrays, tool calls, key continuity |
| `useCMRenderTree.ts` | `useMemo` + previous tree; the host passes a memoized options object |
| `CMRenderTreeNodes.tsx` | the renderer: citations row, body segments (text grids, attachment rows), one case per kind |
| `parseTrailingOptions.ts` | the options parser, formerly in `BlockOpOptions` |
| `*.test.ts` | 21 tests: grouping and identity. `NODE_ENV=development npx tsx --test src/apps/chat/components/message/render-tree/*.test.ts` |

## Rules in force

- Citations (`annotations`) leave the sequence into one leading node; the stored order is untouched (replayed as-is).
- View mode fuses adjacent text, reasoning, images, documents. Text members still render one block each (markdown, inline edits and the stream cursor stay per fragment); reasoning renders one chip with the texts joined by a blank line.
- Consecutive tool invocations form one `tool-calls` node; a response joins its invocation by id from anywhere in the message; other content seals the group (`sealed`). An invocation whose tool name is in `proposalToolNames` is its own `tool-proposal` node, never grouped; an unclaimed response of such a tool emits no node and leaves the run open.
- Activity placeholders don't break the run around them; notices (`pType: 'notice'`) do.
- A change of `originId` inserts a `separator`; attachments and citations don't take part; a falsy `originId` is unstamped.
- Edit mode: text, errors and tool parts get an `edit-text` node each; adjacent attachments of any kind fuse into `edit-attachments`; reasoning keeps its chip (not text-editable: signatures, redacted blocks and vendor state would be lost; Delete and Make Regular Text remain); leaves stay.
- `trailingOptions` (off here, `&& false` in `ChatMessage`; a host may enable it): the option list at the end of the last text node, cut only when the message ends with that text, one object on the node and on the tree.
- Keys: `kind:fId` of the first member, `citations` singleton. The recycler matches a node to the previous node of its kind sharing a fragment (else same key) and carries the key forward, so reorders and first-member removals don't remount. Attachment rows are keyed by their smallest member id, identical in both modes, so the lists keep state across the edit toggle.
- Layout: text-like nodes share a grid (hug or stretch by role); each attachment list is a full-width row, as before the tree. `aria-label='message body'` sits on the first grid only.

## Configuration

`cmRenderTree.build.ts` starts with a `// configuration` block, one constant per policy:

- `CMRT_NOTICES_CLOSE_RUNS`: notice placeholders close the run around them; activity placeholders stay transparent.
- `CMRT_DUPLICATE_CALL_ID_RESPONSE`: which response a repeated tool-call id claims (`'first'`).
- `CMRT_OPTIONS_AFTER_LAST_FRAGMENT_ONLY`: trailing options only when the message ends with that text.
- `CMRT_REASONING_SEPARATOR`: the join between fused reasoning members.

Host data (tool names, the visibility predicate, the options switch) goes through `CMBuildOptions` instead.

## Open work

1. **Attachments editor**: one mixed DnD list for `edit-attachments` (images and documents, cross-kind reorder). Today the renderer splits the node into per-kind rows and reorders within a row.
2. **Edit session**: a working copy of the fragments held outside the component (per-chat overlay store keyed by message id) so an edit survives pane switches; Cancel reverts attachment deletes and reorders (today they write to the store immediately); Save applies atomically to the owner with a changed-underneath check; an insertion anchor for new attachments. The logic is renderer-independent; only the anchor UI touches the attachment rows.
3. **Block reordering**: move whole nodes (a reasoning run, a text run, an attachment group).
4. **Citation-split text**: when AIX emits per-block citations, set `joined` on the text run the builder hoisted a citation from, and render it as one flow (`''` join); inline edits stay edit-mode-only for joined nodes.
5. **Placeholder transparency** uses "not a notice" as a proxy for transient; a producer-set flag would be the proper signal.
6. **One-container layout** would need `width: fit-content; max-width: 100%` on the block containers; separate layout pass.

## Known limits

- The `tool-calls` renderer here is plain invocation and response blocks; a richer group renderer reads `node.calls` and `node.sealed`.
- Orphan tool responses render standalone, except those of `proposalToolNames` tools, which emit no node.
- A node's key may name a fragment it no longer holds (carry-forward); cosmetic.
- The image title editor is reachable in chat edit mode (Enter saves the title, Esc cancels, both keys stop at the editor).
- Tests cover the builder and recycler, not the renderer.
