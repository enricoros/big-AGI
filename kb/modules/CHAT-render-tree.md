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
- Edit mode: text, errors and tool parts get an `edit-text` node each; adjacent attachments of any kind fuse into `edit-attachments`, rendered as one framed unit (`EditAttachmentFragments`, the frame shared with the end bar): the sortable list (compact images with the title on hover, warning-outlined documents, message order, left-aligned, a drag crosses kinds, each item keeps delete), the pane of the selected document (text and title edits go to the copy, Ok closes the editor, Done stores), then a rule and the Add row as the footer; reasoning keeps its chip (not text-editable: signatures, redacted blocks and vendor state would be lost; Delete and Make Regular Text remain); leaves stay. In user and system messages every node with fragments is a block with a left-gutter handle (`CMSortableBlock`, one vertical sortable list over the body; the attachment list nests its own); a drop permutes the blocks' fragments among the slots they held (`reorderFragmentsInSlots`); each block has Delete in a right gutter (under the handle on mobile), confirmed unless the block is empty text. Assistant blocks move too (`CMRT_ASSISTANT_BLOCK_REORDER`), under a one-line warning: some providers need reasoning and tool calls in the original order. The bar below the blocks (`CMEditAttach`) adds a text block (focused, placeholder "New text"; a trailing empty block is focused again instead of adding another) or, for user and system messages, attachments at the end.
- `ungrouped` (Labs toggle "Ungrouped fragments"): every fragment is its own node in stored order. Runs never extend; responses are not claimed, so each stays a `tool-response` leaf where it sits (proposal tools included) and each invocation is a `tool-calls` group of one; citations stay in place as single-member nodes keyed `citations:fId`, rendered in the body, except a leading one, which takes the citations row. Other rules unchanged.
- `trailingOptions` (off here, `&& false` in `ChatMessage`; a host may enable it): the option list at the end of the last text node, cut only when the message ends with that text, one object on the node and on the tree.
- Keys: `kind:fId` of the first member, `citations` singleton. The recycler matches a node to the previous node of its kind sharing a fragment (else same key) and carries the key forward, so reorders and first-member removals don't remount. Attachment lists carry their node key.
- Layout: one grid per body (`data-cm-body`, `aria-label='message body'`). Blocks stretch (assistant with `blocksStretch`, the stream placeholder, edit mode) or hug, each its own width, at the start (assistant) or end (user) through `justify-items`; attachment lists set `justify-self: stretch`, so they span the body and wrap inside it.

## Configuration

`cmRenderTree.build.ts` starts with a `// configuration` block, one constant per policy:

- `CMRT_NOTICES_CLOSE_RUNS`: notice placeholders close the run around them; activity placeholders stay transparent.
- `CMRT_DUPLICATE_CALL_ID_RESPONSE`: which response a repeated tool-call id claims (`'first'`).
- `CMRT_OPTIONS_AFTER_LAST_FRAGMENT_ONLY`: trailing options only when the message ends with that text.
- `CMRT_REASONING_SEPARATOR`: the join between fused reasoning members.

Host data (tool names, the visibility predicate, the options switch) goes through `CMBuildOptions` instead.

## Edit session

`useCMEditSession.tsx` (beside `ChatMessage`), no effects:

- Copy: untouched, the stored fragments render and `editable` is null. The first edit captures `base` and copies; every edit returns a new array that keeps the untouched fragment objects, so `editable !== null` means edited. `editedFragmentIds` marks the changed editors for the save shortcuts. A pending flip ends the session during render.
- Done: takes each add control's drafts into the copy after its anchor (the group's last member, else the end), drops empty text, and writes the message once. Disabled while a draft loads or converts. Confirms the overwrite when the stored message changed since the first edit (sync, a follow-up, another tab); declining keeps the session. Cancel confirms only when edited.
- Drafts: each add control (the footer of an attachments group, the bar at the end) owns a drafts store and registers it with the session's `CMEditDrafts` under its anchor; the session reads the aggregate (busy, any). Insert takes a control's drafts into the copy at once (after its anchor), Done takes the rest. A control that unmounts drops its drafts. A collector registered for the session keeps the copy's images and the drafts' (taken ones pinned) from the chat GC until after the write; on Cancel, inserted images are left to the next GC. A session lost to unmount leaves its draft blobs to the boot GC of the `attachment-drafts` scope. At Done the taken images move into the chat scope before the message references them: an asset collector registered for the write keeps them from a chat GC meanwhile.
- Hosts: one write, `onMessageFragmentsReplace(messageId, fragments)`; without it the message is read-only. `ChatMessageList` (`ConversationHandler.messageFragmentsReplace`: skips pending messages, writes as complete, GC when an asset id was dropped), Beam ray, fusion and base-history message, link viewer (local state). `useCMHostFragmentCalls` derives the view-mode delete and replace from it; calls within one event chain.
- Reorders: `reorderFragmentsInSlots` (`chat.fragments.ts`) moves the listed fragments into the slots they held; `reorderFragments` is gone.
- Programmatic edits: `ConversationHandler.messageFragmentAppend/Delete/Replace`, `editMessage` updaters on the latest stored message, also on pending messages (placeholders, image generation, follow-ups). An updater returns `false` to decline: no write, no touch (a replace of a missing fragment logs and declines).

## Open work

By priority (P0 foundation, P3 waits on other work):

- [x] P0 Edit session: see the section above (copy on first edit, one write at Done, confirm on Cancel when edited, one host call).
- [x] P0 Attachments editor: one mixed list for `edit-attachments` (images and documents, cross-kind reorder).
- [x] P1 Attachment marker: with the Chat preference on (checkbox below the order rows in the attachments menu, stored beside the order), the first `{{attachments}}` in the prompt places the attachments there at send: the text goes out as two fragments around them, the marker dropped. Without the preference, the marker or attachments, the order preference applies (`orderedUserFragments`, `chat.fragment-order.ts`).
- [x] P1 Block reordering: nodes of user and system messages move as blocks with a left-gutter handle (see the edit-mode rule); assistant messages wait on provider replay constraints (thinking before tool use).
- [x] P1 Reorder callback: `onMessageFragmentsReorder`, `ConversationHandler.messageFragmentsReorder` and the store's `reorderMessageFragments` removed (reorders live in the copy).
- [ ] P2 Composer attachment menu: restore "What can I do?" (commented out in `ComposerAttachmentDraftsList`) with neutral styling.
- [ ] P2 Placeholder transparency: group content according to whether placeholders are transient (producer-set flag; today "not a notice" stands in).
- [x] P2 Layout: one grid per body in both modes (see Layout above); the body segments are gone.
- [ ] P3 Citation-split text: read as one flow while retaining safe fragment-level editing; waits for AIX per-block citations.

## Known limits

- The `tool-calls` renderer here is plain invocation and response blocks; a richer group renderer reads `node.calls` and `node.sealed`.
- Orphan tool responses render standalone, except those of `proposalToolNames` tools, which emit no node.
- A node's key may name a fragment it no longer holds (carry-forward); cosmetic.
- The image title editor is reachable in chat edit mode (Enter saves the title, Esc cancels, both keys stop at the editor).
- Tests cover the builder and recycler, not the renderer.
