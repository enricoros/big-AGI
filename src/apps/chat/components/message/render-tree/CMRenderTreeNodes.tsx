import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import type { AutoBlocksHtmlRenderVariant } from '~/modules/blocks/AutoBlocksRenderer';
import { HostedLinksProvider } from '~/modules/blocks/markdown/HostedLinksContext';
import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling, UIComplexityMode } from '~/common/app.theme';
import type { DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { Release } from '~/common/app.release';
import { dndDragEndReorder } from '~/common/components/dnd/dndDragEndReorder';
import { dndModifiers } from '~/common/components/dnd/dnd.config';
import { useDndDefaultSensors } from '~/common/components/dnd/useDndDefaultSensors';
import { useDndDragHandleSortable } from '~/common/components/dnd/useDndDragHandleSortable';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import type { CMEditDrafts } from '../cmEditDrafts';
import { BlockEdit_TextFragment } from '../fragments-content/BlockEdit_TextFragment';
import { CMEditAttach } from '../CMEditAttach';
import { BlockOpEmpty } from '../fragments-content/BlockOpEmpty';
import { BlockPartError } from '../fragments-content/BlockPartError';
import { BlockPartHostedResource } from '../fragments-content/BlockPartHostedResource';
import { BlockPartImageRef } from '../fragments-content/BlockPartImageRef';
import { BlockPartModelAnnotations } from '../fragments-void/BlockPartModelAnnotations';
import { BlockPartModelAuxMemo } from '../fragments-void/BlockPartModelAux';
import { BlockPartPlaceholder } from '../fragments-void/BlockPartPlaceholder';
import { BlockPartText_AutoBlocksMemo } from '../fragments-content/BlockPartText_AutoBlocks';
import { BlockPartToolInvocation } from '../fragments-content/BlockPartToolInvocation';
import { BlockPartToolResponse } from '../fragments-content/BlockPartToolResponse';
import { DocumentAttachmentFragments } from '../fragments-attachment-doc/DocumentAttachmentFragments';
import { EditAttachmentFragments } from '../fragments-attachment-edit/EditAttachmentFragments';
import { ImageAttachmentFragments } from '../fragments-attachment-image/ImageAttachmentFragments';
import { humanReadableFunctionName } from '../fragments-content/BlockPartToolInvocation.utils';

import { CMNodeCitations, CMNodeReasoning, CMNodeReference, CMNodeText, cmNodeFragments, CMRenderNode, CMRenderTree } from './cmRenderTree.types';
import { CMRT_REASONING_SEPARATOR } from './cmRenderTree.build';


// configuration
const CMRT_ASSISTANT_BLOCK_REORDER = true; // assistant blocks move too; the edit shows a warning, as some providers reject replays with reasoning or tool calls out of order


// layout: one grid holds the body; text-like blocks hug (each its own width, start or end by role) or stretch,
// attachment lists stretch to the full width (`justifySelf`) and wrap inside it

const _bodyStretchSx: SxProps = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 1.5,     // see why we give more space on ChatMessage
};

const _bodyStartSx: SxProps = {
  ..._bodyStretchSx,
  justifyItems: 'start',
} as const;

const _bodyEndSx: SxProps = {
  ..._bodyStretchSx,
  justifyItems: 'end',
} as const;

// citations keep a row of their own above the body: the body grid may hug its content, the citations stretch
const _citationsStartSx: SxProps = {
  display: 'grid',
  gap: 1.5,
};

const _citationsEndSx: SxProps = {
  ..._citationsStartSx,
  justifyContent: 'flex-end',
} as const;

const _separatorSx: SxProps = {
  my: 2,
  textAlign: 'center',
  color: 'text.primary',
  fontSize: { xs: '1.25rem', md: '1.5rem', lg: '1.75rem' },
  fontWeight: 'lg',
} as const;

// a reorderable block: the handle in a left gutter, the node in the remaining width; the gutter never shrinks below
// the handle (a 2rem IconButton), so the add bar's empty gutter keeps the content column aligned
const _blockSx: SxProps = {
  display: 'grid',
  gridTemplateColumns: 'minmax(2rem, auto) minmax(0, 1fr)',
  alignItems: 'start',
  columnGap: 0.5,
} as const;

// the add bar below the blocks, in the content column when the blocks have a gutter
const _editBarSx: SxProps = {
  mt: 1.5, // the grid gap
} as const;

const _editBarGutteredSx: SxProps = {
  ..._blockSx,
  ..._editBarSx,
} as const;

const _assistantReorderNoticeSx: SxProps = {
  mb: 1,
} as const;

const _blockGutterSx: SxProps = {
  display: 'flex',
  flexDirection: 'column',
  pl: 1.5, // undo the handle's inline margin
  pt: 1,
} as const;

// below the handle, which pulls its block margins in
const _blockDeleteSx: SxProps = {
  ml: -1.5,
  mt: 1.5,
  borderRadius: '50%',
} as const;

const _blockDeleteIconSx = {
  fontSize: '1.25rem',
} as const;


type FragmentDeleteHandler = (fragmentId: DMessageFragmentId) => void;
type FragmentReplaceHandler = (fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void;
type FragmentsReorderHandler = (reorderedIds: DMessageFragmentId[]) => void;


// fused nodes: memoized on the node object, which the recycler keeps while the members are unchanged

const CMCitationsNode = React.memo(function CMCitationsNode(props: {
  node: CMNodeCitations,
  contentScaling: ContentScaling,
}) {
  const annotations = React.useMemo(() => props.node.fragments.flatMap(fragment => fragment.part.annotations), [props.node]);
  return <BlockPartModelAnnotations annotations={annotations} contentScaling={props.contentScaling} />;
});

const CMReasoningNode = React.memo(function CMReasoningNode(props: {
  node: CMNodeReasoning,
  inFluxFragmentId?: DMessageFragmentId,
  hideActions: boolean,
  contentScaling: ContentScaling,
  fitScreen: boolean,
  isMobile: boolean,
  onFragmentDelete?: FragmentDeleteHandler,
  onFragmentReplace?: FragmentReplaceHandler,
}) {

  const { node, onFragmentDelete, onFragmentReplace } = props;
  const leader = node.fragments[0];
  const inFlux = node.fragments[node.fragments.length - 1].fId === props.inFluxFragmentId;

  // continuity vehicles (signature or vendor state, no text) are members but not shown; the actions leave them alone
  const { visible, auxText, auxHasSignature, auxRedactedDataCount } = React.useMemo(() => {
    const visible = node.fragments.filter(fragment => fragment.part.aText || fragment.part.redactedData?.length);
    return {
      visible,
      auxText: visible.map(fragment => fragment.part.aText).filter(Boolean).join(CMRT_REASONING_SEPARATOR),
      auxHasSignature: visible.some(fragment => fragment.part.textSignature !== undefined),
      auxRedactedDataCount: visible.reduce((count, fragment) => count + (fragment.part.redactedData?.length ?? 0), 0),
    };
  }, [node]);

  // the block acts on one fragment id; a fused node forwards the action to every visible member
  const handleDelete = React.useCallback(() => {
    for (const fragment of visible)
      onFragmentDelete?.(fragment.fId);
  }, [onFragmentDelete, visible]);

  const handleInline = React.useCallback((_fragmentId: DMessageFragmentId, textFragment: DMessageFragment) => {
    onFragmentReplace?.(visible[0].fId, textFragment);
    for (const fragment of visible.slice(1))
      onFragmentDelete?.(fragment.fId);
  }, [onFragmentDelete, onFragmentReplace, visible]);

  // nothing to show, unless this is the stream cursor
  if (!inFlux && !visible.length)
    return null;

  return (
    <BlockPartModelAuxMemo
      fragmentId={leader.fId}
      auxType={leader.part.aType}
      auxText={auxText}
      auxHasSignature={auxHasSignature}
      auxRedactedDataCount={auxRedactedDataCount}
      hideActions={props.hideActions}
      contentScaling={props.contentScaling}
      fitScreen={props.fitScreen}
      isMobile={props.isMobile}
      inFlux={inFlux}
      onFragmentDelete={onFragmentDelete && visible.length ? handleDelete : undefined}
      onFragmentReplace={onFragmentReplace && (visible.length === 1 || (visible.length > 1 && onFragmentDelete)) ? handleInline : undefined}
    />
  );
});

/**
 * Fused text: one node, but each member renders as its own block, so markdown parsing, inline edits (task lists,
 * code block actions) and the stream cursor stay per fragment. Joining members into one flow is a per-node decision
 * left to a producer that splits one paragraph (citation-split text).
 */
const CMTextNode = React.memo(function CMTextNode(props: {
  node: CMNodeText,
  inFluxFragmentId?: DMessageFragmentId,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  fitScreen: boolean,
  isMobile: boolean,
  disableMarkdownText: boolean,
  htmlRenderVariant?: AutoBlocksHtmlRenderVariant,
  setEditedText?: (fragmentId: DMessageFragmentId, value: string, applyNow: boolean) => void,
  onDoubleClick?: (event: React.MouseEvent) => void,
  onReattachAsFile?: (file: File) => void,
}) {
  const { node } = props;
  const lastIndex = node.fragments.length - 1;
  return <>
    {node.fragments.map((fragment, index) => {
      // the trailing option list is cut off the last member's display text
      const { text } = fragment.part;
      const displayText = index === lastIndex && node.trailingOptions ? text.slice(0, text.length - node.trailingOptions.suffix.length) : text;
      return (
        <BlockPartText_AutoBlocksMemo
          key={fragment.fId}
          textPartText={displayText}
          messageRole={props.messageRole}
          fragmentId={fragment.fId}
          setEditedText={props.setEditedText}
          contentScaling={props.contentScaling}
          fitScreen={props.fitScreen}
          isMobile={props.isMobile}
          inputAsWordsDiff={undefined}
          disableMarkdownText={props.disableMarkdownText}
          htmlRenderVariant={props.htmlRenderVariant}
          inFlux={fragment.fId === props.inFluxFragmentId}
          onDoubleClick={props.onDoubleClick}
          onReattachAsFile={props.onReattachAsFile}
        />
      );
    })}
  </>;
});


/** Edit mode: a node as one block, movable by its gutter handle; a text block also deletes from the gutter. */
function CMSortableBlock(props: { id: string, deleteConfirm?: boolean, onDelete?: () => void, children: React.ReactNode }) {
  const { dragContainerSetRef, dragContainerStyle, dragHandle } = useDndDragHandleSortable(props.id, false, 'warning');
  const { showPromisedOverlay } = useOverlayComponents();
  const { deleteConfirm, onDelete } = props;

  // the dialog only when there is text to lose; an empty block goes at once (Done would drop it anyway)
  const handleDelete = !onDelete ? undefined : async () => {
    if (deleteConfirm && !await showPromisedOverlay('chat-message-delete-block', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        title='Delete Block'
        confirmationText='Delete this text block?'
        positiveActionText='Delete'
      />,
    )) return;
    onDelete();
  };

  return (
    <Box ref={dragContainerSetRef} style={dragContainerStyle} sx={_blockSx}>
      <Box sx={_blockGutterSx}>
        {dragHandle}
        {!!handleDelete && (
          <IconButton size='sm' variant='plain' color='warning' aria-label='Delete block' title='Delete this block' onClick={handleDelete} sx={_blockDeleteSx}>
            <DeleteOutlineIcon sx={_blockDeleteIconSx} />
          </IconButton>
        )}
      </Box>
      <Box>{props.children}</Box>
    </Box>
  );
}


/**
 * Renders a CMRenderTree: the citations row, then the body grid.
 */
export function CMRenderTreeNodes(props: {

  tree: CMRenderTree,
  inFluxFragmentId?: DMessageFragmentId,
  showEmptyNotice: boolean,

  contentScaling: ContentScaling,
  uiComplexityMode: UIComplexityMode,
  blocksStretch: boolean,
  fitScreen: boolean,
  isMobile: boolean,
  messageRole: DMessageRole,
  messagePendingIncomplete?: boolean,
  messageGeneratorLlmId?: string | null,
  disableMarkdownText: boolean,
  disableMarkdownDocuments: boolean,
  htmlRenderVariant?: AutoBlocksHtmlRenderVariant,

  editedFragmentIds: ReadonlySet<DMessageFragmentId> | null, // the fragments the edit session changed: their editors count as edited
  editFocus?: { fragmentId: DMessageFragmentId, seq: number }, // the editor to focus, per request
  editDrafts?: CMEditDrafts, // the session's drafts registry: the add controls take attachments (none: text only)
  setEditedText?: (fragmentId: DMessageFragmentId, value: string, applyNow: boolean) => void,
  onEditsApply: (withControl: boolean) => void,
  onEditsCancel: () => void,

  onFragmentAddText?: () => void,
  onFragmentDelete?: FragmentDeleteHandler,
  onFragmentReplace?: FragmentReplaceHandler,
  onFragmentsReorder?: FragmentsReorderHandler,
  onMessageDelete?: () => void,

  onReattachAsFile?: (file: File) => void,
  onDoubleClick?: (event: React.MouseEvent) => void,

}) {

  const { tree, setEditedText, onFragmentDelete } = props;
  const fromAssistant = props.messageRole === 'assistant';
  const fromUser = props.messageRole === 'user';
  const isEditing = tree.mode === 'edit';
  const zenMode = props.uiComplexityMode === 'minimal';
  const enableRestartFromEdit = !fromAssistant && props.messageRole !== 'system';

  // the leading citations node keeps a row of its own above the body; in-place ones (ungrouped) render in the body
  const { citations, body } = React.useMemo(() => {
    const first = tree.nodes[0];
    return first?.kind === 'citations' ? { citations: first, body: tree.nodes.slice(1) } : { citations: null, body: tree.nodes };
  }, [tree]);

  const showEmptyNotice = props.showEmptyNotice && !isEditing && !body.length;

  // solo placeholder: the data stream visualization while generating
  const showDataStreamViz =
    !Release.Features.LIGHTER_ANIMATIONS
    && !!props.messagePendingIncomplete
    && !zenMode
    && body.length === 1
    && body[0].kind === 'placeholder';

  // input-transform notices are neutral infos: hidden (not removed) beside an error, where they'd read as its cause
  const noticesYieldToError = body.some(node => node.kind === 'error' || (node.kind === 'edit-text' && node.fragment.part.pt === 'error'));

  // block reordering: edit mode moves whole nodes; a drop permutes the blocks' fragments among the slots they held
  const { onFragmentsReorder } = props;
  const blockKeys = React.useMemo(() => body.filter(node => cmNodeFragments(node).length).map(node => node.key), [body]);
  const canReorderBlocks = isEditing && (!fromAssistant || CMRT_ASSISTANT_BLOCK_REORDER) && !!onFragmentsReorder && blockKeys.length > 1;
  const blockSensors = useDndDefaultSensors();
  const handleBlocksDragEnd = React.useCallback((event: DragEndEvent) => {
    dndDragEndReorder(event, blockKeys, reorderedKeys => {
      const idsByKey = new Map(body.map(node => [node.key, cmNodeFragments(node).map(fragment => fragment.fId)]));
      onFragmentsReorder?.(reorderedKeys.flatMap(key => idsByKey.get(key) ?? []));
    });
  }, [blockKeys, body, onFragmentsReorder]);

  // the add bar: a new text block, and attachments at the end (the registry decides); none when the host is read-only
  const editBar = !isEditing || (!props.editDrafts && !props.onFragmentAddText) ? null : (
    <CMEditAttach variant='bar' drafts={props.editDrafts} isMobile={props.isMobile} onAddText={props.onFragmentAddText} />
  );

  if (!body.length && !showEmptyNotice && !citations && !editBar)
    return null;


  const renderReference = (node: CMNodeReference): React.ReactNode => {
    const { part } = node.fragment;
    let errorMessage: string;
    const rt = part.rt;
    switch (rt) {
      case 'zync': {
        const zt = part.zType;
        switch (zt) {
          case 'asset':
            // TODO: [ASSET] future: implement rendering for the real Reference to Zync Asset
            if (part._legacyImageRefPart?.pt === 'image_ref')
              return (
                <BlockPartImageRef
                  key={node.key}
                  imageRefPart={part._legacyImageRefPart}
                  fragmentId={node.fragment.fId}
                  contentScaling={props.contentScaling}
                  onFragmentDelete={props.onFragmentDelete}
                  onFragmentReplace={props.onFragmentReplace}
                />
              );
            errorMessage = `[DEV] ContentFragment: Asset System not implemented (zync asset ${part.zUuid})`;
            break;
          default: {
            const _exhaustiveCheck: never = zt;
            errorMessage = `[DEV] ContentFragment: unsupported zync reference type (${zt})`;
          }
        }
        break;
      }
      case '_sentinel':
        errorMessage = '[DEV] ContentFragment: sentinel reference type (_sentinel)';
        break;
      default: {
        const _exhaustiveCheck: never = rt;
        errorMessage = `[DEV] ContentFragment: unsupported reference type (${rt})`;
      }
    }
    return (
      <BlockPartError
        key={node.key}
        errorText={errorMessage}
        messageRole={props.messageRole}
        contentScaling={props.contentScaling}
      />
    );
  };

  const renderNode = (node: CMRenderNode): React.ReactNode => {
    switch (node.kind) {

      case 'citations':
        return <CMCitationsNode key={node.key} node={node} contentScaling={props.contentScaling} />;

      case 'images':
        return (
          <ImageAttachmentFragments
            key={node.key}
            imageAttachments={node.fragments}
            contentScaling={props.contentScaling}
            messageRole={props.messageRole}
            onFragmentDelete={props.onFragmentDelete}
          />
        );

      case 'documents':
        return (
          <DocumentAttachmentFragments
            key={node.key}
            attachmentFragments={node.fragments}
            messageRole={props.messageRole}
            renderVariant='chat-message'
            contentScaling={props.contentScaling}
            isMobile={props.isMobile}
            disableMarkdownText={props.disableMarkdownDocuments}
            onFragmentDelete={props.onFragmentDelete}
            onFragmentReplace={props.onFragmentReplace}
          />
        );

      case 'edit-attachments':
        return (
          <EditAttachmentFragments
            key={node.key}
            fragments={node.fragments}
            contentScaling={props.contentScaling}
            messageRole={props.messageRole}
            isMobile={props.isMobile}
            disableMarkdownText={props.disableMarkdownDocuments}
            drafts={props.editDrafts}
            onFragmentDelete={props.onFragmentDelete}
            onFragmentReplace={props.onFragmentReplace}
            onFragmentsReorder={props.onFragmentsReorder}
          />
        );

      case 'reasoning':
        return (
          <CMReasoningNode
            key={node.key}
            node={node}
            inFluxFragmentId={props.inFluxFragmentId}
            hideActions={!!props.messagePendingIncomplete}
            contentScaling={props.contentScaling}
            fitScreen={props.fitScreen}
            isMobile={props.isMobile}
            onFragmentDelete={props.onFragmentDelete}
            onFragmentReplace={props.onFragmentReplace}
          />
        );

      case 'text':
        return (
          <CMTextNode
            key={node.key}
            node={node}
            inFluxFragmentId={props.inFluxFragmentId}
            messageRole={props.messageRole}
            contentScaling={props.contentScaling}
            fitScreen={props.fitScreen}
            isMobile={props.isMobile}
            disableMarkdownText={props.disableMarkdownText}
            htmlRenderVariant={props.htmlRenderVariant}
            setEditedText={setEditedText}
            onDoubleClick={props.onDoubleClick}
            onReattachAsFile={props.onReattachAsFile}
          />
        );

      case 'tool-calls':
        return (
          <React.Fragment key={node.key}>
            {node.calls.map(call => (
              <React.Fragment key={call.invocation.fId}>
                <BlockPartToolInvocation toolInvocationPart={call.invocation.part} contentScaling={props.contentScaling} onDoubleClick={props.onDoubleClick} />
                {call.response && <BlockPartToolResponse toolResponsePart={call.response.part} contentScaling={props.contentScaling} onDoubleClick={props.onDoubleClick} />}
              </React.Fragment>
            ))}
          </React.Fragment>
        );

      case 'tool-proposal':
        // no proposal renderers on this branch: shown as its invocation and response
        return (
          <React.Fragment key={node.key}>
            <BlockPartToolInvocation toolInvocationPart={node.fragment.part} contentScaling={props.contentScaling} onDoubleClick={props.onDoubleClick} />
            {node.response && <BlockPartToolResponse toolResponsePart={node.response.part} contentScaling={props.contentScaling} onDoubleClick={props.onDoubleClick} />}
          </React.Fragment>
        );

      case 'tool-response':
        return (
          <BlockPartToolResponse
            key={node.key}
            toolResponsePart={node.fragment.part}
            contentScaling={props.contentScaling}
            onDoubleClick={props.onDoubleClick}
          />
        );

      case 'separator':
        return (
          <Typography key={node.key} sx={_separatorSx} title='Beam separator'>
            ※ {/*  ※ ★ ◇ ✧ ◯ △ § ⑀ ⁕ ※ ✣  */}
          </Typography>
        );

      case 'placeholder': {
        const { part } = node.fragment;
        return (
          <BlockPartPlaceholder
            key={node.key}
            fragmentId={node.fragment.fId}
            placeholderPart={part}
            contentScaling={props.contentScaling}
            messagePendingIncomplete={!!props.messagePendingIncomplete}
            showAsDataStreamViz={showDataStreamViz}
            zenMode={zenMode}
            showNotices={!zenMode && (!noticesYieldToError || part.pNoticeKind !== 'input-transform')}
            onFragmentDelete={props.messagePendingIncomplete ? undefined : props.onFragmentDelete}
          />
        );
      }

      case 'error':
        return (
          <BlockPartError
            key={node.key}
            errorText={node.fragment.part.error}
            errorHint={node.fragment.part.hint}
            messageRole={props.messageRole}
            messageGeneratorLlmId={props.messageGeneratorLlmId}
            contentScaling={props.contentScaling}
          />
        );

      case 'image-ref':
        return (
          <BlockPartImageRef
            key={node.key}
            imageRefPart={node.fragment.part}
            fragmentId={node.fragment.fId}
            contentScaling={props.contentScaling}
            onFragmentDelete={props.onFragmentDelete}
            onFragmentReplace={props.onFragmentReplace}
          />
        );

      case 'reference':
        return renderReference(node);

      case 'hosted-resource':
        return (
          <BlockPartHostedResource
            key={node.key}
            hostedResourcePart={node.fragment.part}
            fragmentId={node.fragment.fId}
            messageGeneratorLlmId={props.messageGeneratorLlmId}
            contentScaling={props.contentScaling}
            isEditingMessage={isEditing}
            onFragmentDelete={props.onFragmentDelete}
            onFragmentReplace={props.onFragmentReplace}
          />
        );

      case 'edit-text': {
        if (!setEditedText) return null; // the host enters edit mode only with this handler
        const { fragment } = node;
        const { part } = fragment;
        let editText = '';
        let editLabel: string | undefined;
        switch (part.pt) {
          case 'text':
            editText = part.text;
            break;
          case 'error':
            editText = part.error;
            break;
          case 'tool_invocation':
            if (part.invocation.type === 'function_call') {
              editText = part.invocation.args /* string | null */ || '';
              editLabel = `[Invocation] ${humanReadableFunctionName(part.invocation.name, 'function_call', 'invocation')} · \`${part.invocation.name}\``;
            } else {
              editText = part.invocation.code;
              editLabel = `[Invocation] ${humanReadableFunctionName('code_execution', 'code_execution', 'invocation')} · \`${part.invocation.language}\``;
            }
            break;
          case 'tool_response':
            if (!part.error) {
              editText = part.response.result;
              const responseName = part.response.type === 'function_call' ? part.response.name : 'code_execution';
              editLabel = `[Response] ${humanReadableFunctionName(responseName, part.response.type, 'response')} · \`${part.id}\``;
            } else {
              editText = typeof part.error === 'string' ? part.error : '';
              editLabel = `[Response] error · \`${part.id}\``;
            }
            break;
          default: {
            const _exhaustiveCheck: never = part;
          }
        }
        return (
          <BlockEdit_TextFragment
            key={node.key}
            initialText={editText}
            inputLabel={editLabel}
            fragmentId={fragment.fId}
            contentScaling={props.contentScaling}
            enableRestart={enableRestartFromEdit}
            placeholder={props.editedFragmentIds?.has(fragment.fId) && !editText ? 'New text' : undefined}
            focusSeq={props.editFocus?.fragmentId === fragment.fId ? props.editFocus.seq : undefined}
            editedText={props.editedFragmentIds?.has(fragment.fId) ? editText : undefined}
            setEditedText={setEditedText}
            onSubmit={props.onEditsApply}
            onEscapePressed={props.onEditsCancel}
          />
        );
      }

      case 'unknown':
        return (
          <ScaledTextBlockRenderer
            key={node.key}
            text={`Unknown fragment: ${node.reason}`}
            contentScaling={props.contentScaling}
            textRenderVariant='text'
            showAsDanger
          />
        );

      default: {
        const _exhaustiveCheck: never = node;
        return null;
      }
    }
  };

  const bodySx = (showDataStreamViz || isEditing || (fromAssistant && props.blocksStretch)) ? _bodyStretchSx : fromAssistant ? _bodyStartSx : _bodyEndSx;

  // the body grid, when there is anything to show; hosts that measure the body look for data-cm-body
  const bodyGrid = (!body.length && !showEmptyNotice) ? null : (
    <Box aria-label='message body' data-cm-body='' sx={bodySx}>

      {/* Empty Message Block - if empty */}
      {showEmptyNotice && (
        <BlockOpEmpty
          text={`empty ${fromAssistant ? 'model ' : fromUser ? 'user ' : ''}message`}
          contentScaling={props.contentScaling}
          onDelete={props.onMessageDelete}
        />
      )}

      {body.map(node => !canReorderBlocks || !cmNodeFragments(node).length ? renderNode(node) : (
        <CMSortableBlock
          key={node.key}
          id={node.key}
          deleteConfirm={node.kind === 'edit-text' && !(node.fragment.part.pt === 'text' && !node.fragment.part.text)}
          onDelete={node.kind === 'edit-text' && onFragmentDelete ? () => onFragmentDelete(node.fragment.fId) : undefined}
        >
          {renderNode(node)}
        </CMSortableBlock>
      ))}

    </Box>
  );

  const sortableBody = !canReorderBlocks ? bodyGrid : (
    <DndContext sensors={blockSensors} modifiers={dndModifiers} onDragEnd={handleBlocksDragEnd}>
      <SortableContext items={blockKeys} strategy={verticalListSortingStrategy}>
        {bodyGrid}
      </SortableContext>
    </DndContext>
  );

  return <>

    {citations && (
      <Box aria-label='message void' sx={fromAssistant ? _citationsStartSx : _citationsEndSx}>
        <CMCitationsNode node={citations} contentScaling={props.contentScaling} />
      </Box>
    )}

    {/* assistant blocks move at the user's risk */}
    {canReorderBlocks && fromAssistant && (
      <Typography level='body-xs' color='warning' sx={_assistantReorderNoticeSx}>
        Editing or moving the blocks of a model reply can break the next request: some models need their original text, reasoning and tool calls.
      </Typography>
    )}

    {/* links in the text resolve to this message's hosted-file blocks; no provider when there are none, so text-only messages pay nothing */}
    {body.some(node => node.kind === 'hosted-resource') ? <HostedLinksProvider>{sortableBody}</HostedLinksProvider> : sortableBody}

    {/* the add bar, aligned with the blocks' content column */}
    {editBar && (canReorderBlocks ? <Box sx={_editBarGutteredSx}><Box />{editBar}</Box> : <Box sx={_editBarSx}>{editBar}</Box>)}

  </>;
}
