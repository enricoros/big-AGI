import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Typography } from '@mui/joy';

import type { AutoBlocksHtmlRenderVariant } from '~/modules/blocks/AutoBlocksRenderer';
import { HostedLinksProvider } from '~/modules/blocks/markdown/HostedLinksContext';
import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling, UIComplexityMode } from '~/common/app.theme';
import { DMessageAttachmentFragment, DMessageFragment, DMessageFragmentId, isImagePart } from '~/common/stores/chat/chat.fragments';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { Release } from '~/common/app.release';

import type { ChatMessageTextPartEditState } from '../ChatMessage';
import { BlockEdit_TextFragment } from '../fragments-content/BlockEdit_TextFragment';
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
import { ImageAttachmentFragments } from '../fragments-attachment-image/ImageAttachmentFragments';
import { humanReadableFunctionName } from '../fragments-content/BlockPartToolInvocation.utils';

import type { CMNodeCitations, CMNodeReasoning, CMNodeReference, CMNodeText, CMRenderNode, CMRenderTree } from './cmRenderTree.types';
import { CMRT_REASONING_SEPARATOR } from './cmRenderTree.build';


// layout

const _stretchLayoutSx: SxProps = {
  // no justifyContent: the implicit grid column (and all nodes) stretches to the container width
  display: 'grid',
  gap: 1.5,     // see why we give more space on ChatMessage
};

const _startLayoutSx: SxProps = {
  ..._stretchLayoutSx,
  justifyContent: 'flex-start',
} as const;

const _endLayoutSx: SxProps = {
  ..._stretchLayoutSx,
  justifyContent: 'flex-end',
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

// the zero-state button keeps a fill, so it stays visible on the message background (#934)
const _addTextAssistantSx: SxProps = {
  justifyContent: 'flex-start',
  backgroundColor: 'neutral.softBg',
  '&:hover': { backgroundColor: 'neutral.softHoverBg' },
} as const;

const _addTextUserSx: SxProps = {
  justifyContent: 'flex-start',
  backgroundColor: 'primary.softBg',
  '&:hover': { backgroundColor: 'primary.softHoverBg' },
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


// body layout: text-like nodes share a grid (hugging or stretching with the role); each attachment list is a
// full-width row of its own, as before the render tree, so an attachment never widens the text column

interface AttachmentRow {
  kind: 'images' | 'documents';
  fragments: readonly DMessageAttachmentFragment[];
  editing: boolean;
}

type BodySegment =
  | { kind: 'grid', key: string, nodes: CMRenderNode[], emptyNotice?: boolean, addText?: boolean }
  | { kind: 'row', key: string, row: AttachmentRow };

/** Keyed by membership, not position: the list survives the mode switch, a reorder, and the removal of other members. */
function _attachmentRowKey(kind: AttachmentRow['kind'], fragments: readonly DMessageAttachmentFragment[]): string {
  let minId = fragments[0].fId;
  for (const fragment of fragments)
    if (fragment.fId < minId) minId = fragment.fId;
  return `${kind}:${minId}`;
}

function _bodySegments(body: readonly CMRenderNode[], emptyNotice: boolean, addText: boolean): BodySegment[] {
  const segments: BodySegment[] = [];
  let grid: CMRenderNode[] | null = null;

  const pushRow = (kind: AttachmentRow['kind'], fragments: readonly DMessageAttachmentFragment[], editing: boolean) =>
    segments.push({ kind: 'row', key: _attachmentRowKey(kind, fragments), row: { kind, fragments, editing } });

  for (const node of body) {
    switch (node.kind) {
      case 'images':
      case 'documents':
        grid = null;
        pushRow(node.kind, node.fragments, false);
        break;
      case 'edit-attachments':
        // one row per contiguous kind, keyed like the view rows so the lists keep their state across the mode switch
        grid = null;
        for (const fragment of node.fragments) {
          const kind = isImagePart(fragment.part) ? 'images' : 'documents';
          const last = segments[segments.length - 1];
          if (last?.kind === 'row' && last.row.kind === kind && last.row.editing) {
            const fragments = [...last.row.fragments, fragment];
            segments[segments.length - 1] = { kind: 'row', key: _attachmentRowKey(kind, fragments), row: { kind, fragments, editing: true } };
          } else
            pushRow(kind, [fragment], true);
        }
        break;
      default:
        if (!grid) {
          grid = [];
          segments.push({ kind: 'grid', key: `grid:${node.key}`, nodes: grid });
        }
        grid.push(node);
    }
  }

  if (emptyNotice && !segments.length)
    segments.push({ kind: 'grid', key: 'grid:empty', nodes: [], emptyNotice: true });
  if (addText) {
    const last = segments[segments.length - 1];
    if (last?.kind === 'grid') last.addText = true;
    else segments.push({ kind: 'grid', key: 'grid:add-text', nodes: [], addText: true });
  }
  return segments;
}


/**
 * Renders a CMRenderTree: the citations row, then the body segments.
 */
export function CMRenderTreeNodes(props: {

  tree: CMRenderTree,
  inFluxFragmentId?: DMessageFragmentId,
  showEmptyNotice: boolean,
  showAddText: boolean,

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

  textEditsState: ChatMessageTextPartEditState | null,
  setEditedText?: (fragmentId: DMessageFragmentId, value: string, applyNow: boolean) => void,
  onEditsApply: (withControl: boolean) => void,
  onEditsCancel: () => void,

  onFragmentAddBlank?: () => void,
  onFragmentDelete?: FragmentDeleteHandler,
  onFragmentReplace?: FragmentReplaceHandler,
  onFragmentsReorder?: FragmentsReorderHandler,
  onMessageDelete?: () => void,

  onReattachAsFile?: (file: File) => void,
  onDoubleClick?: (event: React.MouseEvent) => void,

}) {

  const { tree, setEditedText } = props;
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

  const showEmptyNotice = props.showEmptyNotice && !isEditing;
  const segments = React.useMemo(() => _bodySegments(body, showEmptyNotice, props.showAddText), [body, props.showAddText, showEmptyNotice]);

  // solo placeholder: the data stream visualization while generating
  const showDataStreamViz =
    !Release.Features.LIGHTER_ANIMATIONS
    && !!props.messagePendingIncomplete
    && !zenMode
    && body.length === 1
    && body[0].kind === 'placeholder';

  // input-transform notices are neutral infos: hidden (not removed) beside an error, where they'd read as its cause
  const noticesYieldToError = body.some(node => node.kind === 'error' || (node.kind === 'edit-text' && node.fragment.part.pt === 'error'));

  if (!segments.length && !citations)
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
      case 'documents':
      case 'edit-attachments':
        return null; // the attachment rows render outside the grids

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
            editedText={props.textEditsState?.[fragment.fId]}
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

  const renderRow = (key: string, row: AttachmentRow): React.ReactNode => row.kind === 'images' ? (
    <ImageAttachmentFragments
      key={key}
      imageAttachments={row.fragments}
      contentScaling={props.contentScaling}
      messageRole={props.messageRole}
      isEditing={row.editing}
      onFragmentDelete={props.onFragmentDelete}
      onFragmentReplace={row.editing ? props.onFragmentReplace : undefined}
      onFragmentsReorder={row.editing ? props.onFragmentsReorder : undefined}
    />
  ) : (
    <DocumentAttachmentFragments
      key={key}
      attachmentFragments={row.fragments}
      messageRole={props.messageRole}
      renderVariant='chat-message'
      contentScaling={props.contentScaling}
      isMobile={props.isMobile}
      zenMode={zenMode}
      allowSelection={!row.editing}
      allowReordering={row.editing}
      disableMarkdownText={props.disableMarkdownDocuments}
      onFragmentDelete={props.onFragmentDelete}
      onFragmentReplace={props.onFragmentReplace}
      onFragmentsReorder={row.editing ? props.onFragmentsReorder : undefined}
    />
  );


  const gridSx = (showDataStreamViz || isEditing || (fromAssistant && props.blocksStretch)) ? _stretchLayoutSx : fromAssistant ? _startLayoutSx : _endLayoutSx;

  // every grid carries data-cm-body for hosts that measure the body; the aria-label names the first one
  const firstGridKey = segments.find(segment => segment.kind === 'grid')?.key;
  const bodyElements = segments.map(segment => segment.kind === 'row' ? renderRow(segment.key, segment.row) : (
    <Box key={segment.key} aria-label={segment.key === firstGridKey ? 'message body' : undefined} data-cm-body='' sx={gridSx}>

      {/* Empty Message Block - if empty */}
      {segment.emptyNotice && (
        <BlockOpEmpty
          text={`empty ${fromAssistant ? 'model ' : fromUser ? 'user ' : ''}message`}
          contentScaling={props.contentScaling}
          onDelete={props.onMessageDelete}
        />
      )}

      {segment.nodes.map(renderNode)}

      {/* Edit zero-state: nothing to type into yet */}
      {segment.addText && (
        <Button
          aria-label='Add message text'
          color={fromAssistant ? 'neutral' : 'primary'}
          variant='outlined'
          onClick={props.onFragmentAddBlank}
          sx={fromAssistant ? _addTextAssistantSx : _addTextUserSx}
        >
          Add text
        </Button>
      )}

    </Box>
  ));

  return <>

    {citations && (
      <Box aria-label='message void' sx={fromAssistant ? _citationsStartSx : _citationsEndSx}>
        <CMCitationsNode node={citations} contentScaling={props.contentScaling} />
      </Box>
    )}

    {/* links in the text resolve to this message's hosted-file blocks; no provider when there are none, so text-only messages pay nothing */}
    {body.some(node => node.kind === 'hosted-resource') ? <HostedLinksProvider>{bodyElements}</HostedLinksProvider> : bodyElements}

  </>;
}
