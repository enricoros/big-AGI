import * as React from 'react';
import { Box, Button } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { BlocksRenderer } from '~/modules/blocks/BlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageAttachmentFragment, DMessageFragmentId, DMessageRole } from '~/common/stores/chat/chat.message';
import { marshallWrapText } from '~/common/stores/chat/chat.tokens';

import { ContentPartTextEdit } from '../fragments-content/ContentPartTextEdit';


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
  const { fragment, onFragmentDelete, onFragmentReplace } = props;
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleteArmed, setIsDeleteArmed] = React.useState(false);

  const fragmentId = fragment.fId;
  const fragmentTitle = fragment.title;
  const part = fragment.part;

  // handlers

  const handleDeleteFragment = React.useCallback(() => {
    onFragmentDelete(fragmentId);
  }, [fragmentId, onFragmentDelete]);

  const handleReplaceFragment = React.useCallback((newFragment: DMessageAttachmentFragment) => {
    onFragmentReplace(fragmentId, newFragment);
  }, [fragmentId, onFragmentReplace]);


  if (part.pt !== 'text')
    throw new Error('Unexpected part type: ' + part.pt);

  const handleEditToggle = React.useCallback(() => {
    setIsDeleteArmed(false);
    setIsEditing(on => !on);
  }, []);

  const handleEditEnterPressed = React.useCallback(() => {
    // setIsEditing(false);
    // TODO...
  }, []);

  const handleDeleteArmedToggle = React.useCallback(() => {
    setIsEditing(false);
    setIsDeleteArmed(on => !on);
  }, []);


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
        <ContentPartTextEdit
          textPart={part}
          fragmentId={fragmentId}
          contentScaling={props.contentScaling}
          editedText={props.editedText}
          setEditedText={props.setEditedText}
          onEnterPressed={handleEditEnterPressed}
          onEscapePressed={handleEditToggle}
        />
      ) : (
        // Document viewer, including collapse/expand
        <BlocksRenderer
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
            <Button variant='solid' color='neutral' size='sm' onClick={handleDeleteArmedToggle} startDecorator={<CloseRoundedIcon />}>
              Cancel
            </Button>
          ) : (
            <Button variant='plain' color='neutral' size='sm' onClick={handleDeleteArmedToggle} startDecorator={<DeleteOutlineIcon />}>
              Delete
            </Button>
          )}
          {isDeleteArmed && (
            <Button variant='plain' color='danger' size='sm' onClick={handleDeleteFragment} startDecorator={<DeleteForeverIcon />}>
              Delete
            </Button>
          )}
        </Box>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {isEditing ? (
            <Button variant='plain' color='neutral' size='sm' onClick={handleEditToggle} startDecorator={<CloseRoundedIcon />}>
              Cancel
            </Button>
          ) : (
            <Button variant='plain' color='neutral' size='sm' onClick={handleEditToggle} startDecorator={<EditRoundedIcon />}>
              Edit
            </Button>
          )}
          {isEditing && (
            <Button variant='plain' color='success' onClick={undefined} size='sm' startDecorator={<CheckRoundedIcon />}>
              Save
            </Button>
          )}
        </Box>

      </Box>


    </Box>
  );
}