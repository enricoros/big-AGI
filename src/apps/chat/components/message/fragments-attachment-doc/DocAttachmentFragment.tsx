import * as React from 'react';

import { Box, Button, Switch, Typography } from '@mui/joy';
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
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { DMessageAttachmentFragment, DMessageFragmentId, DVMimeType, isDocPart, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';
import { useContextWorkspaceId } from '~/common/stores/workspace/WorkspaceIdProvider';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

import { BlockEdit_TextFragment } from '../fragments-content/BlockEdit_TextFragment';
import { buttonIconForFragment, DocSelColor } from './DocAttachmentFragmentButton';
import { useLiveFileSync } from './livefile-sync/useLiveFileSync';


function inferInitialViewAsCode(attachmentFragment: DMessageAttachmentFragment) {
  if (!isDocPart(attachmentFragment.part))
    return false;
  // just use the mime of the doc part
  return attachmentFragment.part.vdt === DVMimeType.VndAgiCode;
}


export function DocAttachmentFragment(props: {
  fragment: DMessageAttachmentFragment,
  editedText?: string,
  setEditedText: (fragmentId: DMessageFragmentId, value: string) => void,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  isMobile: boolean,
  zenMode: boolean,
  disableMarkdownText: boolean,
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace: (fragmentId: DMessageFragmentId, newContent: DMessageAttachmentFragment) => void,
}) {

  // state
  const [viewAsCode, setViewAsCode] = React.useState(() => inferInitialViewAsCode(props.fragment));

  // external state
  const workspaceId = useContextWorkspaceId();
  const { skipNextAutoScroll } = useScrollToBottom();

  // derived state
  const { editedText, fragment, onFragmentDelete, onFragmentReplace } = props;
  const [isDeleteArmed, setIsDeleteArmed] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);


  const fragmentId = fragment.fId;
  const fragmentDocPart = fragment.part;

  if (!isDocPart(fragmentDocPart))
    throw new Error('Unexpected part type: ' + fragmentDocPart.pt);

  const fragmentTitle = fragmentDocPart.l1Title || fragment.title;


  // hooks

  const handleReplaceDocFragmentText = React.useCallback((newText: string) => {
    // replacement fragment (same fId)
    const newFragment = updateFragmentWithEditedText(fragment, newText);

    // if not replaced, ignore the change
    if (!newFragment) return;

    // Note: this reuses the same fragment ID, which makes the screen not flash (otherwise the whole editor would disappear as the ID does not exist anymore)
    onFragmentReplace(fragmentId, newFragment as DMessageAttachmentFragment);
  }, [fragment, fragmentId, onFragmentReplace]);

  const handleReplaceFragmentLiveFileId = React.useCallback((liveFileId: LiveFileId) => {
    onFragmentReplace(fragmentId, { ...fragment, liveFileId: liveFileId });
  }, [fragment, fragmentId, onFragmentReplace]);


  // LiveFile sync

  const { liveFileControlButton, liveFileActions } = useLiveFileSync(
    fragment.liveFileId ?? null,
    workspaceId,
    props.isMobile,
    fragmentDocPart.data.text,
    handleReplaceFragmentLiveFileId,
    handleReplaceDocFragmentText,
  );


  // delete

  const handleFragmentDelete = React.useCallback(() => {
    onFragmentDelete(fragmentId);
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
    if (editedText === undefined)
      return;

    if (editedText.length > 0) {
      handleReplaceDocFragmentText(editedText);
      setIsEditing(false);
    } else {
      // if the user deleted all text, let's remove the part
      handleFragmentDelete();
    }
  }, [editedText, handleFragmentDelete, handleReplaceDocFragmentText]);

  const handleToggleEdit = React.useCallback(() => {
    // reset other states when entering Edit
    if (!isEditing) {
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
    </Box>
  ), [fragment.title, fragmentDocPart, fragmentId]);


  const headerRow = React.useMemo(() => {
    const TitleIcon = buttonIconForFragment(fragmentDocPart);

    const titleEndText =
      !viewAsCode ? (fragmentDocPart.vdt ? 'text' : '(unknown)')
        : (fragmentDocPart.data.mimeType && fragmentDocPart.data.mimeType !== fragmentDocPart.vdt) ? fragmentDocPart.data.mimeType || ''
          : '';

    return <>
      <TooltipOutlined color='neutral' placement='top-start' slowEnter title={headerTooltipContents}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {TitleIcon && <TitleIcon />}
          <Typography level='title-sm'>
            {fragmentDocPart.meta?.srcFileName || fragmentDocPart.l1Title || fragmentDocPart.ref}
          </Typography>
        </Box>
      </TooltipOutlined>

      {/* Live File Control button */}
      {!isEditing && liveFileControlButton}

      {/* Text / Code render switch (auto-detected) */}
      {!props.zenMode && (
        <Switch
          size='sm'
          variant='solid'
          color='neutral'
          checked={viewAsCode}
          onChange={handleToggleViewAsCode}
          startDecorator={
            <Typography level='body-xs'>
              {titleEndText}
            </Typography>
          }
        />
      )}
    </>;
  }, [fragmentDocPart, handleToggleViewAsCode, headerTooltipContents, isEditing, liveFileControlButton, props.zenMode, viewAsCode]);


  const toolbarRow = React.useMemo(() => (
    <Box sx={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 1,
    }}>

      {/* Delete / Confirm */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant='outlined' color={isDeleteArmed ? 'neutral' : DocSelColor} size='sm' onClick={handleToggleDeleteArmed} startDecorator={isDeleteArmed ? <CloseRoundedIcon /> : <DeleteOutlineIcon />}>
          {isDeleteArmed ? 'Cancel' : 'Delete'}
        </Button>
        {isDeleteArmed && (
          <Button variant='solid' color='danger' size='sm' onClick={handleFragmentDelete} startDecorator={<DeleteForeverIcon />}>
            Delete
          </Button>
        )}
      </Box>

      {/* Edit / Save */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant='outlined' color={isEditing ? 'neutral' : DocSelColor} size='sm' onClick={handleToggleEdit} startDecorator={isEditing ? <CloseRoundedIcon /> : <EditRoundedIcon />}>
          {isEditing ? 'Cancel' : 'Edit'}
        </Button>
        {isEditing && (
          <Button variant='solid' color='success' onClick={handleEditApply} size='sm' startDecorator={<CheckRoundedIcon />}>
            Save
          </Button>
        )}
      </Box>
    </Box>
  ), [handleEditApply, handleFragmentDelete, handleToggleDeleteArmed, handleToggleEdit, isDeleteArmed, isEditing]);


  return (
    <RenderCodePanelFrame
      color={DocSelColor}
      contentScaling={props.contentScaling}
      headerRow={headerRow}
      subHeaderInline={!isEditing && liveFileActions}
      toolbarRow={toolbarRow}
    >

      {/* Show / Edit the Document Attachment Part */}
      {isEditing ? (
        // Document Editor
        <BlockEdit_TextFragment
          initialText={fragmentDocPart.data.text}
          fragmentId={fragmentId}
          contentScaling={props.contentScaling}
          editedText={editedText}
          setEditedText={props.setEditedText}
          onSubmit={handleEditApply}
          onEscapePressed={handleToggleEdit}
          // endDecorator={editedText ? 'Shift+Enter to save · Escape to cancel.' : 'No changes · Escape to cancel.'}
        />
      ) : (
        // Document viewer, including the collapse/expand state inside
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
      )}

    </RenderCodePanelFrame>
  );
}
