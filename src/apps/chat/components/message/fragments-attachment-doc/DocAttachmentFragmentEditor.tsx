import * as React from 'react';
import { Box, Button, Sheet, Typography } from '@mui/joy';
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
import { createDMessageDataInlineText, createDocAttachmentFragment, DMessageAttachmentFragment, DMessageFragmentId, isDocPart } from '~/common/stores/chat/chat.fragments';
import { marshallWrapText } from '~/common/stores/chat/chat.tokens';
import { useLiveFileComparison } from '~/common/livefile/useLiveFileComparison';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

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

  // external state
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
    const newAttachment = createDocAttachmentFragment(fragmentTitle, fragment.caption, fragmentDocPart.type, newData, fragmentDocPart.ref, fragmentDocPart.meta, fragment.liveFileId);

    // reuse the same fragment ID, which makes the screen not flash (otherwise the whole editor would disappear as the ID does not exist anymore)
    newAttachment.fId = fragmentId;

    // replace this fragment with the new one
    onFragmentReplace(fragmentId, newAttachment);
  }, [fragment.caption, fragment.liveFileId, fragmentDocPart, fragmentId, fragmentTitle, onFragmentReplace]);

  const handleReplaceFragmentLiveFileId = React.useCallback((liveFileId: LiveFileId) => {
    onFragmentReplace(fragmentId, { ...fragment, liveFileId: liveFileId });
  }, [fragment, fragmentId, onFragmentReplace]);


  // LiveFile

  const { liveFileSyncButton, liveFileActionBox } = useLiveFileComparison(
    fragment.liveFileId ?? null,
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
        minHeight: '2.25rem',
        px: 1,
        // layout
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1,
      }}>
        <Typography level='title-sm'>
          <TooltipOutlined placement='top-start' color='neutral' title={fragmentDocPart.ref === fragmentDocPart.meta?.srcFileName ? undefined
            : <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1, rowGap: 0.5, '& > :nth-of-type(odd)': { color: 'text.tertiary', fontSize: 'xs' } }}>
              <div>Title</div>
              <div>{fragmentTitle}</div>
              <div>Identifier</div>
              <div>{fragmentDocPart.ref}</div>
              <div>Render type</div>
              <div>{fragmentDocPart.type}</div>
              <div>Text Mime type</div>
              <div>{fragmentDocPart.data?.mimeType || '(unknown)'}</div>
              <div>Text Buffer Id</div>
              <div>{fragmentId}</div>
            </Box>
          }>
            <span>{fragmentDocPart.meta?.srcFileName || fragmentDocPart.l1Title || fragmentDocPart.ref}</span>
          </TooltipOutlined>
        </Typography>
        <Typography level='body-xs' sx={{ opacity: 0.5 }}>
          {fragmentDocPart.data.mimeType && fragmentDocPart.data.mimeType !== fragmentDocPart.type ? fragmentDocPart.data.mimeType || '' : ''}
          {/*{fragmentId}*/}
          {/*{JSON.stringify({ fn: part.meta?.srcFileName, ref: part.ref, meta: part.meta, mt: part.type, pt: part.data.mimeType })}*/}
        </Typography>
      </Box>


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

        {!isEditing && liveFileActionBox}

        {/* Buttons Row */}
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 1,
        }}>


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

          {!isEditing && liveFileSyncButton}

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
          onEnterPressed={handleEditApply}
          onEscapePressed={handleToggleEdit}
        />
      ) : (
        // Document viewer, including the collapse/expand state inside
        <AutoBlocksRenderer
          // text={marshallWrapText(part.data.text, /*fragmentTitle ||*/ JSON.stringify({ fn: part.meta?.srcFileName, ref: part.ref, meta: part.meta, mt: part.type, pt: part.data.mimeType }), 'markdown-code')}
          text={marshallWrapText(fragmentDocPart.data.text, /*part.meta?.srcFileName || part.ref*/ undefined, 'markdown-code')}
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
