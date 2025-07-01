import * as React from 'react';

import { Box, Button, Switch, Tooltip, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';
import { enhancedCodePanelTitleTooltipSx, RenderCodePanelFrame } from '~/modules/blocks/code/RenderCodePanelFrame';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { DMessageAttachmentFragment, DMessageDocPart, DMessageFragmentId, DVMimeType, isDocPart, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { useContextWorkspaceId } from '~/common/stores/workspace/WorkspaceIdProvider';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

import { BlockEdit_TextFragment } from '../fragments-content/BlockEdit_TextFragment';
import { buttonIconForFragment, DocSelColor } from './DocAttachmentFragmentButton';
import { useLiveFileSync } from './livefile-sync/useLiveFileSync';


// configuration
const FALLBACK_NO_TITLE = 'Untitled Attachment';


const _styles = {
  button: {
    minWidth: 100,
  } as const,
  titleDisabled: {
    opacity: 0.5,
  } as const,
  titleEditable: {
    cursor: 'pointer',
    '&:hover': { textDecoration: 'underline' } as const,
  } as const,
  titleTextArea: {
    minWidth: 200,
    flexGrow: 1,
  } as const,
} as const;


function _inferInitialViewAsCode(attachmentFragment: DMessageAttachmentFragment) {
  if (!isDocPart(attachmentFragment.part))
    return false;
  // just use the mime of the doc part
  return attachmentFragment.part.vdt === DVMimeType.VndAgiCode;
}


export function DocAttachmentFragment(props: {
  fragment: DMessageAttachmentFragment,
  controlledEditor: boolean,
  editedText?: string,
  setEditedText: (fragmentId: DMessageFragmentId, value: string) => void,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  isMobile: boolean,
  zenMode: boolean,
  disableMarkdownText: boolean,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newContent: DMessageAttachmentFragment) => void,
}) {

  // state
  const [isDeleteArmed, setIsDeleteArmed] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [viewAsCode, setViewAsCode] = React.useState(() => _inferInitialViewAsCode(props.fragment));

  // external state
  const workspaceId = useContextWorkspaceId();
  const { skipNextAutoScroll } = useScrollToBottom();

  // derived state
  const { editedText, fragment, onFragmentDelete, onFragmentReplace } = props;


  const fragmentId = fragment.fId;
  const fragmentDocPart = fragment.part;

  if (!isDocPart(fragmentDocPart))
    throw new Error('Unexpected part type: ' + fragmentDocPart.pt);

  const fragmentTitle = fragmentDocPart.l1Title || fragment.caption; // what's this for?
  const reverseToolbar = props.messageRole === 'assistant';

  const displayTitle = fragmentDocPart.meta?.srcFileName || fragmentDocPart.l1Title || fragmentDocPart.ref || FALLBACK_NO_TITLE;

  const showDeleteInstead = typeof editedText === 'string' && editedText.length === 0 && !!onFragmentDelete;


  // hooks

  const handleReplaceDocFragmentText = React.useCallback((newText: string) => {
    if (!onFragmentReplace) return;

    // replacement fragment (same fId), and stop if not replaced
    const newFragment = updateFragmentWithEditedText(fragment, newText);
    if (!newFragment) return;

    // Note: this reuses the same fragment ID, which makes the screen not flash (otherwise the whole editor would disappear as the ID does not exist anymore)
    onFragmentReplace?.(fragmentId, newFragment as DMessageAttachmentFragment);
  }, [fragment, fragmentId, onFragmentReplace]);

  const handleReplaceFragmentLiveFileId = React.useCallback((liveFileId: LiveFileId) => {
    onFragmentReplace?.(fragmentId, { ...fragment, liveFileId: liveFileId });
  }, [fragment, fragmentId, onFragmentReplace]);


  const handleTitleEditBegin = React.useCallback(() => {
    if (!onFragmentReplace) return;
    setIsEditing(false);
    setIsEditingTitle(true);
  }, [onFragmentReplace]);

  const handleTitleEditCancel = React.useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  const handleTitleEditSave = React.useCallback((newTitle: string) => {
    setIsEditingTitle(false);
    if (!newTitle.trim() || newTitle === displayTitle || !onFragmentReplace) return;

    // retitle the fragment, without changing Id
    const newDocPart: DMessageDocPart = { ...fragmentDocPart, l1Title: newTitle, version: (fragmentDocPart?.version ?? 1) + 1 };
    const newFragment: DMessageAttachmentFragment = { ...fragment, title: newTitle, part: newDocPart };

    onFragmentReplace(fragment.fId, newFragment);
  }, [displayTitle, fragment, fragmentDocPart, onFragmentReplace]);


  // LiveFile sync

  const disableLiveFile = !onFragmentReplace
    || !workspaceId; // NOTE: this is a trick for when used outside of a WorkspaceId context provider

  const { liveFileControlButton, liveFileActions } = useLiveFileSync(
    fragment.liveFileId ?? null,
    workspaceId,
    props.isMobile,
    fragmentDocPart.data.text,
    disableLiveFile ? undefined : handleReplaceFragmentLiveFileId,
    disableLiveFile ? undefined : handleReplaceDocFragmentText,
  );


  // delete

  const handleFragmentDelete = React.useCallback(() => {
    onFragmentDelete?.(fragmentId);
  }, [fragmentId, onFragmentDelete]);

  const handleToggleDeleteArmed = React.useCallback((event: React.MouseEvent) => {
    // reset other states when entering Delete
    if (!isDeleteArmed) {
      // setIsLiveFileArmed(false);
      // setIsEditing(false);
    }
    if (!isDeleteArmed && event.shiftKey) // immadiately delete:fragment
      handleFragmentDelete();
    else
      setIsDeleteArmed(on => !on);
  }, [handleFragmentDelete, isDeleteArmed]);


  // edit

  const handleEditApply = React.useCallback(() => {
    setIsDeleteArmed(false);

    if (props.controlledEditor) {
      setIsEditing(false);
      setIsEditingTitle(false); // just in case
      return; // controlled editor, already applied, delete is only allowed via the button
    }

    if (editedText === undefined)
      return;

    if (editedText.length > 0 || !onFragmentDelete) {
      handleReplaceDocFragmentText(editedText);
      setIsEditing(false);
      setIsEditingTitle(false); // just in case
    } else {
      // if the user deleted all text, let's remove the part
      handleFragmentDelete();
    }
  }, [editedText, handleFragmentDelete, handleReplaceDocFragmentText, onFragmentDelete, props.controlledEditor]);

  const handleToggleEdit = React.useCallback(() => {
    // reset other states when entering Edit
    if (!isEditing) {
      setIsEditingTitle(false); // cancel title edit
      setIsDeleteArmed(false);
      // setIsLiveFileArmed(false);
      // resetLiveFileState();
      skipNextAutoScroll();
    }
    setIsEditing(on => !on);
  }, [isEditing, skipNextAutoScroll]);


  // view as code

  const handleToggleViewAsCode = React.useCallback(() => {
    setViewAsCode(on => !on);
  }, []);


  // memoed components

  const viewAsLabel =
    !viewAsCode ? (fragmentDocPart.vdt ? 'text' : '(unknown)')
      : (fragmentDocPart.data.mimeType && fragmentDocPart.data.mimeType !== fragmentDocPart.vdt) ? fragmentDocPart.data.mimeType || ''
        : '';

  const headerTooltipContents = React.useMemo(() => (
    <Box sx={enhancedCodePanelTitleTooltipSx}>
      <div>Attachment Title</div>
      <div>{fragment.title}</div>
      <div>Identifier</div>
      <div>{fragmentDocPart.ref}</div>
      <div>Doc Title</div>
      <div>{fragmentDocPart.l1Title}</div>
      <div>Doc Version</div>
      <div>{fragmentDocPart.version || '(none)'}</div>
      <div>Text Mime type</div>
      <div>{fragmentDocPart.data?.mimeType || '(unknown)'}</div>
      <div>Render type</div>
      <div>{fragmentDocPart.vdt}</div>
      <div>Text Buffer Id</div>
      <div>{fragmentId}</div>
      {!!fragment.caption && <div>Att. Caption</div>}
      {!!fragment.caption && <div>{fragment.caption}</div>}
      <div>view as code</div>
      <Switch
        size='sm'
        variant='solid'
        color='neutral'
        checked={viewAsCode}
        onChange={handleToggleViewAsCode}
        endDecorator={viewAsLabel}
      />
    </Box>
  ), [fragment.caption, fragment.title, fragmentDocPart, fragmentId, handleToggleViewAsCode, viewAsCode, viewAsLabel]);


  const headerRow = React.useMemo(() => {
    const TitleIcon = buttonIconForFragment(fragmentDocPart);

    return <>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>

        <Tooltip arrow variant='outlined' color='neutral' placement='top-start' title={headerTooltipContents}>
          {TitleIcon && <TitleIcon />}
        </Tooltip>

        {(!isEditingTitle || isEditing) ? (
          <Typography
            level='title-sm'
            onClick={isEditing ? undefined : onFragmentReplace ? handleTitleEditBegin : undefined}
            sx={isEditing ? _styles.titleDisabled : onFragmentReplace ? _styles.titleEditable : undefined}
            className='agi-ellipsize'
          >
            {displayTitle}
          </Typography>
        ) : (
          <InlineTextarea
            initialText={displayTitle}
            placeholder='Document title'
            onEdit={handleTitleEditSave}
            onCancel={handleTitleEditCancel}
            sx={_styles.titleTextArea}
          />
        )}

      </Box>

      {/* Live File Control button */}
      {!isEditing && liveFileControlButton}

    </>;
  }, [displayTitle, fragmentDocPart, handleTitleEditBegin, handleTitleEditCancel, handleTitleEditSave, headerTooltipContents, isEditing, isEditingTitle, liveFileControlButton, onFragmentReplace]);


  const toolbarRow = React.useMemo(() => (!onFragmentDelete && !onFragmentReplace) ? null : (
    <Box sx={{
      display: 'flex',
      flexDirection: !reverseToolbar ? 'row' : 'row-reverse',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 1,
    }}>

      {/* Delete / Confirm */}
      {!!onFragmentDelete && (
        <Box sx={{ display: 'flex', flexDirection: !reverseToolbar ? 'row' : 'row-reverse', gap: 1 }}>
          {!isEditing && <Button
            variant='soft'
            color={DocSelColor}
            size='sm'
            onClick={handleToggleDeleteArmed}
            startDecorator={isDeleteArmed ? <CloseRoundedIcon /> : <DeleteOutlineIcon />}
            sx={_styles.button}
          >
            {isDeleteArmed ? 'Cancel' : 'Delete'}
          </Button>}
          {isDeleteArmed && (
            <Button
              variant='solid'
              color='danger'
              size='sm'
              onClick={handleFragmentDelete}
              startDecorator={<DeleteForeverIcon />}
            >
              Delete
            </Button>
          )}
        </Box>
      )}

      {/* Edit / Save */}
      {!!onFragmentReplace && (
        <Box sx={{ display: 'flex', flexDirection: !reverseToolbar ? 'row' : 'row-reverse', gap: 1 }}>
          {(!props.controlledEditor || !isEditing) && <Button
            variant='soft'
            color={DocSelColor}
            size='sm'
            onClick={handleToggleEdit}
            startDecorator={isEditing ? <CloseRoundedIcon /> : <EditRoundedIcon />}
            sx={_styles.button}
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>}
          {isEditing && (
            <Button
              variant={props.controlledEditor ? 'soft' : 'solid'}
              color={showDeleteInstead ? 'danger' : props.controlledEditor ? undefined : 'success'}
              onClick={handleEditApply}
              size='sm'
              startDecorator={showDeleteInstead ? <DeleteForeverIcon /> : props.controlledEditor ? undefined : <CheckRoundedIcon />}
              sx={_styles.button}
            >
              {!showDeleteInstead ? 'Save' : 'Delete'}
            </Button>
          )}
        </Box>
      )}
    </Box>
  ), [handleEditApply, handleFragmentDelete, handleToggleDeleteArmed, handleToggleEdit, isDeleteArmed, isEditing, onFragmentDelete, onFragmentReplace, props.controlledEditor, reverseToolbar, showDeleteInstead]);


  return (
    <RenderCodePanelFrame
      color={DocSelColor}
      contentScaling={props.contentScaling}
      headerRow={headerRow}
      subHeaderInline={!isEditing && liveFileActions}
      toolbarRow={toolbarRow}
      selectedOutline
    >

      {/* Show / Edit the Document Attachment Part */}
      {isEditing ? (
        // Document Editor
        <BlockEdit_TextFragment
          initialText={fragmentDocPart.data.text}
          fragmentId={fragmentId}
          contentScaling={props.contentScaling}
          controlled={props.controlledEditor}
          editedText={editedText}
          setEditedText={props.setEditedText}
          squareTopBorder
          onSubmit={handleEditApply}
          onEscapePressed={handleToggleEdit}
          // endDecorator={editedText ? 'Shift+Enter to save · Escape to cancel.' : 'No changes · Escape to cancel.'}
        />
      ) : (
        // Document viewer, including the collapse/expand state inside
        <Box py={1}>
          <AutoBlocksRenderer
            // text={marshallWrapText(fragmentDocPart.data.text, /*part.meta?.srcFileName || part.ref*/ undefined, 'markdown-code')}
            text={fragmentDocPart.data.text}
            renderAsCodeWithTitle={viewAsCode ? (fragmentDocPart.data?.mimeType || fragmentDocPart.ref || fragmentTitle) : undefined}
            fromRole={props.messageRole}
            contentScaling={props.contentScaling}
            fitScreen={props.isMobile}
            isMobile={props.isMobile}
            codeRenderVariant='plain'
            textRenderVariant={props.disableMarkdownText ? 'text' : 'markdown'}
          />
        </Box>
      )}

    </RenderCodePanelFrame>
  );
}
