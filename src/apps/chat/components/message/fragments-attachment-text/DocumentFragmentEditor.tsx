import * as React from 'react';
import { Box, Button } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { createTextAttachmentFragment, DMessageAttachmentFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { marshallWrapText } from '~/common/stores/chat/chat.tokens';

import { PartTextEdit } from '../fragments-content/PartTextEdit';


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
  const fragmentTitle = fragment.title;
  const part = fragment.part;

  if (part.pt !== 'text')
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
    if (editedText?.length > 0) {
      onFragmentReplace(fragmentId, createTextAttachmentFragment(fragmentTitle, editedText));
      // NOTE: since the former function changes the ID of the fragment, the
      // whole editor will disappear as a side effect
    } else
      handleFragmentDelete();
  }, [editedText, fragmentId, fragmentTitle, handleFragmentDelete, onFragmentReplace]);


  return (
    <Box sx={{
      backgroundColor: 'background.level2',
      border: '1px solid',
      borderColor: 'neutral.outlinedBorder',
      borderRadius: 'sm',
      boxShadow: 'inset 2px 0px 5px -4px var(--joy-palette-background-backdrop)',
      p: 1,
      mt: 0.5,
    }}>

      {isEditing ? (
        // Document Editor
        <PartTextEdit
          textPartText={part.text}
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
          text={marshallWrapText(part.text, '', 'markdown-code')}
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
            <Button variant='solid' color='neutral' size='sm' onClick={handleToggleDeleteArmed} startDecorator={<CloseRoundedIcon />}>
              Cancel
            </Button>
          ) : (
            <Button variant='plain' color='neutral' size='sm' onClick={handleToggleDeleteArmed} startDecorator={<DeleteOutlineIcon />}>
              Delete
            </Button>
          )}
          {isDeleteArmed && (
            <Button variant='plain' color='danger' size='sm' onClick={handleFragmentDelete} startDecorator={<DeleteForeverIcon />}>
              Delete
            </Button>
          )}
        </Box>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {isEditing ? (
            <Button variant='plain' color='neutral' size='sm' onClick={handleToggleEdit} startDecorator={<CloseRoundedIcon />}>
              Cancel
            </Button>
          ) : (
            <Button variant='plain' color='neutral' size='sm' onClick={handleToggleEdit} startDecorator={<EditRoundedIcon />}>
              Edit
            </Button>
          )}
          {isEditing && (
            <Button variant='plain' color='success' onClick={handleEditApply} size='sm' startDecorator={<CheckRoundedIcon />}>
              Save
            </Button>
          )}
        </Box>
      </Box>

    </Box>
  );
}