import * as React from 'react';
import { Box, Button, Tooltip, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { createDMessageDataInlineText, createDocAttachmentFragment, DMessageAttachmentFragment, DMessageFragmentId, isDocPart } from '~/common/stores/chat/chat.fragments';
import { marshallWrapText } from '~/common/stores/chat/chat.tokens';

import { ContentPartTextEditor } from '../fragments-content/ContentPartTextEditor';


export function DocumentFragmentEditor(props: {
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
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleteArmed, setIsDeleteArmed] = React.useState(false);

  const fragmentId = fragment.fId;
  const fragmentTitle = (isDocPart(fragment.part) ? fragment.part.l1Title : '') || fragment.title;
  const fragmentCaption = fragment.caption;
  const part = fragment.part;

  if (!isDocPart(part))
    throw new Error('Unexpected part type: ' + part.pt);

  // delete

  const handleToggleDeleteArmed = React.useCallback(() => {
    // setIsEditing(false);
    setIsDeleteArmed(on => !on);
  }, []);

  const handleFragmentDelete = React.useCallback(() => {
    onFragmentDelete(fragmentId);
  }, [fragmentId, onFragmentDelete]);


  // edit

  const handleToggleEdit = React.useCallback(() => {
    setIsDeleteArmed(false);
    setIsEditing(on => !on);
  }, []);

  const handleEditApply = React.useCallback(() => {
    setIsDeleteArmed(false);
    if (editedText === undefined)
      return;

    // only edit DOCs
    if (!isDocPart(fragment.part)) {
      console.warn('handleEditApply: unexpected part type:', fragment.part.pt);
      return;
    }

    if (editedText.length > 0) {
      const newData = createDMessageDataInlineText(editedText, fragment.part.data.mimeType);
      const newAttachment = createDocAttachmentFragment(fragmentTitle, fragment.caption, fragment.part.type, newData, fragment.part.ref, fragment.part.meta, fragment._liveFile);
      // reuse the same fragment ID, which makes the screen not flash (otherwise the whole editor would disappear as the ID does not exist anymore)
      newAttachment.fId = fragmentId;
      onFragmentReplace(fragmentId, newAttachment);
      setIsEditing(false);
    } else {
      // if the user deleted all text, let's remove the part
      handleFragmentDelete();
    }
  }, [editedText, fragment._liveFile, fragment.caption, fragment.part, fragmentId, fragmentTitle, handleFragmentDelete, onFragmentReplace]);


  return (
    <Box sx={{
      backgroundColor: 'background.level1',
      border: '1px solid',
      borderColor: 'neutral.outlinedBorder',
      borderRadius: 'sm',
      boxShadow: 'inset 2px 0px 5px -4px var(--joy-palette-background-backdrop)',
      p: 1,
      mt: 0.5,
    }}>

      {/* Ref of the file */}
      {/*<Sheet variant='plain' sx={{ borderRadius: 'sm', mb: 1 }}>*/}
      <Box sx={{
        // backgroundColor: 'background.popup',
        // borderRadius: 'sm',
        p: 0.5,
        mb: 1,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 1,
      }}>
        <Typography level='title-sm'>
          <Tooltip disableInteractive title={part.ref === part.meta?.srcFileName ? undefined : part.ref} placement='top-start'>
            <div>
              {part.meta?.srcFileName || part.l1Title || part.ref}
            </div>
          </Tooltip>
        </Typography>
        <Typography level='body-sm'>
          {part.type}{part.data.mimeType && part.data.mimeType !== part.type ? ` · ${part.data.mimeType}` : ''}
          {/*{JSON.stringify({ fn: part.meta?.srcFileName, ref: part.ref, meta: part.meta, mt: part.type, pt: part.data.mimeType })}*/}
        </Typography>
      </Box>
      {/*</Sheet>*/}


      {isEditing ? (
        // Document Editor
        <ContentPartTextEditor
          textPartText={part.data.text}
          fragmentId={fragmentId}
          contentScaling={props.contentScaling}
          editedText={props.editedText}
          setEditedText={props.setEditedText}
          onEnterPressed={handleEditApply}
          onEscapePressed={handleToggleEdit}
        />
      ) : (
        // Document viewer, including collapse/expand
        <AutoBlocksRenderer
          // text={marshallWrapText(part.data.text, /*fragmentTitle ||*/ JSON.stringify({ fn: part.meta?.srcFileName, ref: part.ref, meta: part.meta, mt: part.type, pt: part.data.mimeType }), 'markdown-code')}
          text={marshallWrapText(part.data.text, /*part.meta?.srcFileName || part.ref*/ undefined, 'markdown-code')}
          // text={part.data.text}
          // text={selectedFragment.part.text}
          fromRole={props.messageRole}
          contentScaling={props.contentScaling}
          fitScreen={props.isMobile}
          specialCodePlain
          renderTextAsMarkdown={props.renderTextAsMarkdown}
        />
      )}

      {/* Edit / Delete commands */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', mt: 1 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isDeleteArmed ? (
            <Button variant='soft' color='neutral' size='sm' onClick={handleToggleDeleteArmed} startDecorator={<CloseRoundedIcon />}>
              Cancel
            </Button>
          ) : (
            <Button variant='soft' color='neutral' size='sm' onClick={handleToggleDeleteArmed} startDecorator={<DeleteOutlineIcon />}>
              Delete
            </Button>
          )}
          {isDeleteArmed && (
            <Button variant='solid' color='danger' size='sm' onClick={handleFragmentDelete} startDecorator={<DeleteForeverIcon />}>
              Delete
            </Button>
          )}
        </Box>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {isEditing ? (
            <Button variant='soft' color='neutral' size='sm' onClick={handleToggleEdit} startDecorator={<CloseRoundedIcon />}>
              Cancel
            </Button>
          ) : (
            <Button variant='soft' color='neutral' size='sm' onClick={handleToggleEdit} startDecorator={<EditRoundedIcon />}>
              Edit
            </Button>
          )}
          {isEditing && (
            <Button variant='solid' color='success' onClick={handleEditApply} size='sm' startDecorator={<CheckRoundedIcon />} sx={{ minWidth: 100 }}>
              Save
            </Button>
          )}
        </Box>
      </Box>

    </Box>
  );
}