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
| `*.test.ts` | 25 tests: grouping and identity. `NODE_ENV=development npx tsx --test src/apps/chat/components/message/render-tree/*.test.ts` |

## Rules in force

- Citations (`annotations`) leave the sequence into one leading node; the stored order is untouched (replayed as-is).
- View mode fuses adjacent text, reasoning, images, documents. Text members still render one block each (markdown, inline edits and the stream cursor stay per fragment); reasoning renders one chip with the texts joined by a blank line.
- Consecutive tool invocations form one `tool-calls` node; a response joins its invocation by id from anywhere in the message; other content seals the group (`sealed`). An invocation whose tool name is in `proposalToolNames` is its own `tool-proposal` node, never grouped; an unclaimed response of such a tool emits no node and leaves the run open.
- Activity placeholders don't break the run around them; notices (`pType: 'notice'`) do.
- A change of `originId` inserts a `separator`; attachments and citations don't take part; a falsy `originId` is unstamped.
- Edit mode: text, errors and tool parts get an `edit-text` node each; adjacent attachments of any kind fuse into `edit-attachments`; reasoning keeps its chip (not text-editable: signatures, redacted blocks and vendor state would be lost; Delete and Make Regular Text remain); leaves stay.
- `ungrouped` (Labs toggle "Ungrouped fragments"): every fragment is its own node in stored order. Runs never extend; responses are not claimed, so each stays a `tool-response` leaf where it sits (proposal tools included) and each invocation is a `tool-calls` group of one; citations stay in place as single-member nodes keyed `citations:fId`, rendered in the body, except a leading one, which takes the citations row. Other rules unchanged.
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

By priority (P0 foundation, P3 waits on other work):

- [ ] P0 Edit session: a working copy of the fragments inside `ChatMessage`; Cancel atomic (text, deletes, reorders, new attachments); Apply in one write with a changed-underneath check offering Overwrite or Discard; ready drafts enter the copy at the attachment group, drafts still converting at Apply are dropped; the copy's blobs are GC-protected until Apply or Cancel. Foundation for the attachments editor and block reordering. Edits do not survive unmount.
- [ ] P0 Attachments editor: one mixed list for `edit-attachments` (images and documents, cross-kind reorder); new attachments enter the last attachment group rather than the message tail.
- [ ] P1 Attachment marker: with the Chat preference on (checkbox below the order rows in the attachments menu, stored beside the order), `{{attachments}}` alone on a line of the prompt places the attachments there at send: the text goes out as two fragments around them, the marker line dropped. Without the preference or the marker, the order preference applies as today. Composer-side, no dependency on the session.
- [ ] P1 Block reordering: move nodes of user and system messages (text, attachment groups, leaves) with a left-gutter handle; assistant messages after checking provider replay constraints (thinking before tool use).
- [ ] P1 Reorder callback: drop `onMessageFragmentsReorder` from `ChatMessage` and `ChatMessageList` once the session carries reorders; the store action later, after checking dev's history for other users.
- [ ] P2 Composer attachment menu: restore "What can I do?" (commented out in `ComposerAttachmentDraftsList`) with neutral styling.
- [ ] P2 Placeholder transparency: group content according to whether placeholders are transient (producer-set flag; today "not a notice" stands in).
- [ ] P2 Layout: one container for text-like nodes and attachment rows (`width: fit-content; max-width: 100%` on block containers), preserving role alignment and responsive attachment rows.
- [ ] P3 Citation-split text: read as one flow while retaining safe fragment-level editing; waits for AIX per-block citations.

## Known limits

- The `tool-calls` renderer here is plain invocation and response blocks; a richer group renderer reads `node.calls` and `node.sealed`.
- Orphan tool responses render standalone, except those of `proposalToolNames` tools, which emit no node.
- A node's key may name a fragment it no longer holds (carry-forward); cosmetic.
- The image title editor is reachable in chat edit mode (Enter saves the title, Esc cancels, both keys stop at the editor).
- Tests cover the builder and recycler, not the renderer.
