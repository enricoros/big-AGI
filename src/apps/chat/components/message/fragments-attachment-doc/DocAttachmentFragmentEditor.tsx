import * as React from 'react';
import { Box, Button, CircularProgress, Sheet, Tooltip, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { LiveFileIcon, LiveFileReloadIcon } from '~/common/livefile/LiveFileIcon';
import { addSnackbar } from '~/common/components/useSnackbarsStore';
import { createDMessageDataInlineText, createDocAttachmentFragment, DMessageAttachmentFragment, DMessageFragmentId, isDocPart } from '~/common/stores/chat/chat.fragments';
import { liveFileInAttachmentFragment } from '~/common/livefile/liveFile';
import { marshallWrapText } from '~/common/stores/chat/chat.tokens';

import { ContentPartTextEditor } from '../fragments-content/ContentPartTextEditor';
import { DocSelColor } from './DocAttachmentFragmentButton';


export function DocAttachmentFragmentEditor(props: {
  fragment: DMessageAttachmentFragment,
  editedText?: string,
  setEditedText: (fragmentId: DMessageFragmentId, value: string) => void,
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  isMobile?: boolean,
  renderTextAsMarkdown: boolean,
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace: (fragmentId: DMessageFragmentId, newContent: DMessageAttachmentFragment) => void,
}) {

  // derived state
  const { editedText, fragment, onFragmentDelete, onFragmentReplace } = props;
  const [isDeleteArmed, setIsDeleteArmed] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);

  const [isLiveFileArmed, setIsLiveFileArmed] = React.useState(false);
  const [isLiveFileWorking, setIsLiveFileWorking] = React.useState(false);


  const fragmentId = fragment.fId;
  const fragmentTitle = (isDocPart(fragment.part) ? fragment.part.l1Title : '') || fragment.title;
  const docPart = fragment.part;

  if (!isDocPart(docPart))
    throw new Error('Unexpected part type: ' + docPart.pt);


  // delete

  const handleFragmentDelete = React.useCallback(() => {
    onFragmentDelete(fragmentId);
  }, [fragmentId, onFragmentDelete]);

  const handleToggleDeleteArmed = React.useCallback((event: React.MouseEvent) => {
    // reset other states when entering Delete
    if (!isDeleteArmed) {
      setIsLiveFileArmed(false);
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
      const newData = createDMessageDataInlineText(editedText, docPart.data.mimeType);
      const newAttachment = createDocAttachmentFragment(fragmentTitle, fragment.caption, docPart.type, newData, docPart.ref, docPart.meta, fragment._liveFile);
      // reuse the same fragment ID, which makes the screen not flash (otherwise the whole editor would disappear as the ID does not exist anymore)
      newAttachment.fId = fragmentId;
      onFragmentReplace(fragmentId, newAttachment);
      setIsEditing(false);
    } else {
      // if the user deleted all text, let's remove the part
      handleFragmentDelete();
    }
  }, [docPart, editedText, fragment._liveFile, fragment.caption, fragmentId, fragmentTitle, handleFragmentDelete, onFragmentReplace]);

  const handleToggleEdit = React.useCallback(() => {
    // reset other states when entering Edit
    if (!isEditing) {
      setIsDeleteArmed(false);
      setIsLiveFileArmed(false);
    }
    setIsEditing(on => !on);
  }, [isEditing]);


  // LiveFile
  const hasLiveFile = liveFileInAttachmentFragment(fragment);
  const fileSystemFileHandle = fragment._liveFile?._fsFileHandle || undefined;

  const handleLiveFileReload = React.useCallback(async () => {
    if (!fileSystemFileHandle)
      return;

    setIsLiveFileArmed(false);
    setIsLiveFileWorking(true);

    try {

      // Read the file content
      const file = await fileSystemFileHandle.getFile();
      const reloadedText = await file.text();

      // Update the fragment
      const newData = createDMessageDataInlineText(reloadedText, docPart.data.mimeType);
      const newAttachment = createDocAttachmentFragment(fragmentTitle, fragment.caption, docPart.type, newData, docPart.ref, docPart.meta, fragment._liveFile);
      // reuse the same fragment ID, which makes the screen not flash (otherwise the whole editor would disappear as the ID does not exist anymore)
      newAttachment.fId = fragmentId;
      onFragmentReplace(fragmentId, newAttachment);

      // signal the success
      addSnackbar({ key: 'chat-attachment-doc-reload-ok', message: 'Reloaded from the file system.', type: 'success', overrides: { autoHideDuration: 2000 } });

    } catch (error: any) {
      addSnackbar({ key: 'chat-attachment-doc-reload-fail', message: `Error reloading the file: ${error?.message || error || 'error unknown.'}`, type: 'issue' });
    }

    setIsLiveFileWorking(false);

  }, [docPart, fileSystemFileHandle, fragment._liveFile, fragment.caption, fragmentId, fragmentTitle, onFragmentReplace]);

  const handleToggleLiveFileReloadArmed = React.useCallback((event: React.MouseEvent) => {
    // reset other states when entering LiveFileReload
    if (!isLiveFileArmed) {
      setIsDeleteArmed(false);
      // setIsEditing(false);
    }
    if (!isLiveFileArmed && event.shiftKey) // immadiately reload:fragment
      void handleLiveFileReload();
    else
      setIsLiveFileArmed(on => !on);
  }, [handleLiveFileReload, isLiveFileArmed]);


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
        borderBottom: '1px solid',
        borderBottomColor: 'primary.outlinedBorder',
        // borderBottomColor: 'divider',
        p: 1,
        // layout
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 1,
      }}>
        <Typography level='title-sm'>
          <Tooltip disableInteractive title={docPart.ref === docPart.meta?.srcFileName ? undefined : <>Document identifier: {docPart.ref}<br />Render type: {docPart.type}</>} placement='top-start'>
            <span>{docPart.meta?.srcFileName || docPart.l1Title || docPart.ref}</span>
          </Tooltip>
        </Typography>
        <Typography level='body-xs' sx={{ opacity: 0.5 }}>
          {docPart.data.mimeType && docPart.data.mimeType !== docPart.type ? docPart.data.mimeType || '' : ''}
          {/*{JSON.stringify({ fn: part.meta?.srcFileName, ref: part.ref, meta: part.meta, mt: part.type, pt: part.data.mimeType })}*/}
        </Typography>
      </Box>


      {/* Button Bar Edit / Delete commands */}
      <Sheet color='primary' variant='soft' sx={theme => ({
        backgroundColor: theme.palette.mode === 'light' ? 'primary.50' : 'primary.900',
        borderBottom: '1px solid',
        borderBottomColor: isEditing ? 'transparent' : 'primary.outlinedBorder',
        p: 1,
        // layout
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 1,
      })}>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant='outlined' color={DocSelColor} size='sm' onClick={handleToggleDeleteArmed} startDecorator={isDeleteArmed ? <CloseRoundedIcon /> : <DeleteOutlineIcon />}>
            {isDeleteArmed ? 'Cancel' : 'Delete'}
          </Button>
          {isDeleteArmed && (
            <Button variant='solid' color='danger' size='sm' onClick={handleFragmentDelete} startDecorator={<DeleteForeverIcon />}>
              Delete
            </Button>
          )}
        </Box>

        {hasLiveFile && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant={isLiveFileArmed ? 'outlined' : 'soft'} color={isLiveFileArmed ? 'primary' : 'success'} size='sm' disabled={isEditing || isLiveFileWorking} onClick={handleToggleLiveFileReloadArmed} startDecorator={isLiveFileArmed ? <CloseRoundedIcon /> : <LiveFileIcon />}>
              {isLiveFileArmed ? 'Cancel' : 'File Sync'}
            </Button>
            {isLiveFileArmed && (
              <Button variant='solid' color='success' size='sm' disabled={isLiveFileWorking} onClick={handleLiveFileReload} startDecorator={<LiveFileReloadIcon />}>
                Reload
              </Button>
            )}
            {/*{isLiveFileArmed && (*/}
            {/*  <Button variant='soft' color='success' size='sm' disabled={isLiveFileWorking} onClick={handleLiveFileReload} startDecorator={<LiveFileSaveIcon />}>*/}
            {/*    Save*/}
            {/*  </Button>*/}
            {/*)}*/}
            {isLiveFileWorking && <CircularProgress size='sm' />}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant='outlined' color={DocSelColor} size='sm' onClick={handleToggleEdit} startDecorator={isEditing ? <CloseRoundedIcon /> : <EditRoundedIcon />}>
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
          {isEditing && (
            <Button variant='solid' color='success' onClick={handleEditApply} size='sm' startDecorator={<CheckRoundedIcon />}>
              Save
            </Button>
          )}
        </Box>

      </Sheet>

      {isEditing ? (
        // Document Editor
        <ContentPartTextEditor
          textPartText={docPart.data.text}
          fragmentId={fragmentId}
          contentScaling={props.contentScaling}
          editedText={props.editedText}
          setEditedText={props.setEditedText}
          onEnterPressed={handleEditApply}
          onEscapePressed={handleToggleEdit}
        />
      ) : (
        // Document viewer, including the collapse/expand state inside
        <AutoBlocksRenderer
          // text={marshallWrapText(part.data.text, /*fragmentTitle ||*/ JSON.stringify({ fn: part.meta?.srcFileName, ref: part.ref, meta: part.meta, mt: part.type, pt: part.data.mimeType }), 'markdown-code')}
          text={marshallWrapText(docPart.data.text, /*part.meta?.srcFileName || part.ref*/ undefined, 'markdown-code')}
          // text={part.data.text}
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
