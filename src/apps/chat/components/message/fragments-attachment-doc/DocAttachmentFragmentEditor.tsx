import * as React from 'react';
import { Box, Button, Sheet, Switch, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { createDMessageDataInlineText, createDocAttachmentFragment, DMessageAttachmentFragment, DMessageFragmentId, DVMimeType, isDocPart } from '~/common/stores/chat/chat.fragments';
import { useContextWorkspaceId } from '~/common/stores/workspace/WorkspaceIdProvider';
import { useLiveFileComparison } from '~/common/livefile/useLiveFileComparison';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

import { ContentPartTextEditor } from '../fragments-content/ContentPartTextEditor';
import { buttonIconForFragment, DocSelColor } from './DocAttachmentFragmentButton';


function inferInitialViewAsCode(attachmentFragment: DMessageAttachmentFragment) {
  if (!isDocPart(attachmentFragment.part))
    return false;
  // just use the mime of the doc part
  return attachmentFragment.part.vdt === DVMimeType.VndAgiCode;
}


export function DocAttachmentFragmentEditor(props: {
  fragment: DMessageAttachmentFragment,
  editedText?: string,
  setEditedText: (fragmentId: DMessageFragmentId, value: string) => void,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  isMobile?: boolean,
  zenMode: boolean,
  renderTextAsMarkdown: boolean,
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
  const fragmentTitle = (isDocPart(fragment.part) ? fragment.part.l1Title : '') || fragment.title;
  const fragmentDocPart = fragment.part;

  if (!isDocPart(fragmentDocPart))
    throw new Error('Unexpected part type: ' + fragmentDocPart.pt);


  // hooks

  const handleReplaceDocFragmentText = React.useCallback((newText: string) => {
    // create a new Doc Attachment Fragment
    const newData = createDMessageDataInlineText(newText, fragmentDocPart.data.mimeType);
    const newAttachment = createDocAttachmentFragment(fragmentTitle, fragment.caption, fragmentDocPart.vdt, newData, fragmentDocPart.ref, fragmentDocPart.meta, fragment.liveFileId);

    // reuse the same fragment ID, which makes the screen not flash (otherwise the whole editor would disappear as the ID does not exist anymore)
    newAttachment.fId = fragmentId;

    // replace this fragment with the new one
    onFragmentReplace(fragmentId, newAttachment);
  }, [fragment.caption, fragment.liveFileId, fragmentDocPart, fragmentId, fragmentTitle, onFragmentReplace]);

  const handleReplaceFragmentLiveFileId = React.useCallback((liveFileId: LiveFileId) => {
    onFragmentReplace(fragmentId, { ...fragment, liveFileId: liveFileId });
  }, [fragment, fragmentId, onFragmentReplace]);


  // LiveFile

  const { liveFileControlButton, liveFileActions } = useLiveFileComparison(
    fragment.liveFileId ?? null,
    workspaceId,
    props.isMobile === true,
    fragmentDocPart.data.text,
    handleReplaceDocFragmentText,
    handleReplaceFragmentLiveFileId,
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


  // messaging
  const titleEndText =
    !viewAsCode ? (fragmentDocPart.vdt ? 'text' : '(unknown)')
      : (fragmentDocPart.data.mimeType && fragmentDocPart.data.mimeType !== fragmentDocPart.vdt) ? fragmentDocPart.data.mimeType || ''
        : '';

  const TitleIcon = buttonIconForFragment(fragment);

  return (
    <Box sx={{
      mt: 0.5,
      backgroundColor: 'background.surface',
      border: '1px solid',
      borderColor: `${DocSelColor}.outlinedBorder`,
      borderRadius: 'sm',
      // contain: 'paint',
      boxShadow: 'sm',
      // boxShadow: 'inset 2px 0px 5px -4px var(--joy-palette-background-backdrop)',
    }}>

      {/* Ref of the file */}
      <Box sx={{
        minHeight: '2.75rem',
        px: 1,
        // layout
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1,
      }}>
        <Typography level='title-sm' startDecorator={TitleIcon ? <TitleIcon /> : null}>
          <TooltipOutlined placement='top-start' color='neutral' title={fragmentDocPart.ref === fragmentDocPart.meta?.srcFileName ? undefined
            : <Box sx={{ p: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1, rowGap: 1, '& > :nth-of-type(odd)': { color: 'text.tertiary', fontSize: 'xs' } }}>
              <div>Title</div>
              <div>{fragmentTitle}</div>
              <div>Identifier</div>
              <div>{fragmentDocPart.ref}</div>
              <div>Render type</div>
              <div>{fragmentDocPart.vdt}</div>
              <div>Text Mime type</div>
              <div>{fragmentDocPart.data?.mimeType || '(unknown)'}</div>
              <div>Text Buffer Id</div>
              <div>{fragmentId}</div>
            </Box>
          }>
            <span>{fragmentDocPart.meta?.srcFileName || fragmentDocPart.l1Title || fragmentDocPart.ref}</span>
          </TooltipOutlined>
        </Typography>

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

      </Box>

      {/* LiveFile  */}
      {!isEditing && liveFileActions}

      {/* Button Bar Edit / Delete commands */}
      <Sheet color='primary' variant='soft' sx={theme => ({
        backgroundColor: theme.palette.mode === 'light' ? 'primary.50' : 'primary.900',
        borderBottom: '1px solid',
        borderBottomColor: isEditing ? 'transparent' : 'primary.outlinedBorder',
        borderTop: '1px solid',
        borderTopColor: 'primary.outlinedBorder',
        p: 1,
        // layout
        display: 'grid',
        gap: 1,
      })}>

        {/* Buttons Row */}
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

      </Sheet>

      {isEditing ? (
        // Document Editor
        <ContentPartTextEditor
          textPartText={fragmentDocPart.data.text}
          fragmentId={fragmentId}
          contentScaling={props.contentScaling}
          editedText={props.editedText}
          setEditedText={props.setEditedText}
          onSubmit={handleEditApply}
          onEscapePressed={handleToggleEdit}
          endDecorator={editedText ? 'Shift+Enter to save · Escape to cancel.' : 'No changes · Escape to cancel.'}
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
          specialCodePlain
          renderTextAsMarkdown={props.renderTextAsMarkdown}
        />
      )}

    </Box>
  );
}
