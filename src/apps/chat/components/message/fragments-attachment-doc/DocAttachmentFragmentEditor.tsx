import * as React from 'react';
import { Box, Button, CircularProgress, Tooltip, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { LiveFileIcon } from '~/common/livefile/LiveFileIcon';
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

  const [isLiveFileReloadArmed, setIsLiveFileReloadArmed] = React.useState(false);
  const [isLiveFileReloading, setIsLiveFileReloading] = React.useState(false);


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
      setIsLiveFileReloadArmed(false);
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
      setIsLiveFileReloadArmed(false);
    }
    setIsEditing(on => !on);
  }, [isEditing]);


  // LiveFile
  const hasLiveFile = liveFileInAttachmentFragment(fragment);
  const fileSystemFileHandle = fragment._liveFile?._fsFileHandle || undefined;

  const handleLiveFileReload = React.useCallback(async () => {
    if (!fileSystemFileHandle)
      return;

    setIsLiveFileReloadArmed(false);
    setIsLiveFileReloading(true);

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

    setIsLiveFileReloading(false);

  }, [docPart, fileSystemFileHandle, fragment._liveFile, fragment.caption, fragmentId, fragmentTitle, onFragmentReplace]);

  const handleToggleLiveFileReloadArmed = React.useCallback((event: React.MouseEvent) => {
    // reset other states when entering LiveFileReload
    if (!isLiveFileReloadArmed) {
      setIsDeleteArmed(false);
      // setIsEditing(false);
    }
    if (!isLiveFileReloadArmed && event.shiftKey) // immadiately reload:fragment
      void handleLiveFileReload();
    else
      setIsLiveFileReloadArmed(on => !on);
  }, [handleLiveFileReload, isLiveFileReloadArmed]);


  return (
    <Box sx={{
      backgroundColor: 'background.level1',
      border: '1px solid',
      borderColor: `${DocSelColor}.outlinedBorder`,
      borderRadius: 'sm',
      boxShadow: 'inset 2px 0px 5px -4px var(--joy-palette-background-backdrop)',
      p: 1,
      // layout
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}>

      {/* Ref of the file */}
      {/*<Sheet variant='plain' sx={{ borderRadius: 'sm', mb: 1 }}>*/}
      <Box sx={{
        // backgroundColor: 'background.popup',
        // borderRadius: 'sm',
        p: 0.5,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 1,
      }}>
        <Typography level='title-sm'>
          <Tooltip disableInteractive title={docPart.ref === docPart.meta?.srcFileName ? undefined : docPart.ref} placement='top-start'>
            <span>
              {docPart.meta?.srcFileName || docPart.l1Title || docPart.ref}
            </span>
          </Tooltip>
        </Typography>
        <Typography level='body-xs'>
          {docPart.type}{docPart.data.mimeType && docPart.data.mimeType !== docPart.type ? ` · ${docPart.data.mimeType}` : ''}
          {/*{JSON.stringify({ fn: part.meta?.srcFileName, ref: part.ref, meta: part.meta, mt: part.type, pt: part.data.mimeType })}*/}
        </Typography>
      </Box>
      {/*</Sheet>*/}


      {/* Button Bar Edit / Delete commands */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1 }}>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant={isDeleteArmed ? 'soft' : 'outlined'} color={DocSelColor} size='sm' onClick={handleToggleDeleteArmed} startDecorator={isDeleteArmed ? <CloseRoundedIcon /> : <DeleteOutlineIcon />}>
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
            <Button disabled={isEditing || isLiveFileReloading} variant={isLiveFileReloadArmed ? 'soft' : 'outlined'} color={DocSelColor} size='sm' onClick={handleToggleLiveFileReloadArmed} startDecorator={isLiveFileReloadArmed ? <CloseRoundedIcon /> : <LiveFileIcon />}>
              {isLiveFileReloadArmed ? 'Cancel' : 'Sync File'}
            </Button>
            {isLiveFileReloadArmed && (
              <Button disabled={isLiveFileReloading} variant='solid' color='success' size='sm' onClick={handleLiveFileReload} startDecorator={<LiveFileIcon />}>
                Reload
              </Button>
            )}
            {isLiveFileReloading && <CircularProgress size='sm' />}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant={isEditing ? 'soft' : 'outlined'} color={DocSelColor} size='sm' onClick={handleToggleEdit} startDecorator={isEditing ? <CloseRoundedIcon /> : <EditRoundedIcon />} sx={{ minWidth: 100 }}>
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
          {isEditing && (
            <Button variant='solid' color='success' onClick={handleEditApply} size='sm' startDecorator={<CheckRoundedIcon />} sx={{ minWidth: 100 }}>
              Save
            </Button>
          )}
        </Box>

      </Box>


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
          // text={selectedFragment.part.text}
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