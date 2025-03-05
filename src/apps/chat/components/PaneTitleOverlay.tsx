import * as React from 'react';

import { Box, IconButton, Sheet } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { useConversationTitle } from '~/common/stores/chat/hooks/useConversationTitle';

import { panesManagerActions } from './panes/store-panes-manager';


// configuration
const ENABLE_DELETE = false;


const _styles = {
  tileBar: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    padding: '0 0.125rem 0.125rem',
    fontSize: 'sm',
    fontWeight: 'md',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px',
    // boxShadow: 'xs',
    // border: '1px solid',
    // borderColor: 'background.popup',
    borderTop: 'none',
    maxWidth: '78%',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  } as const,
  title: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as const,
  toolButton: {
    '--IconButton-size': '1.5rem',
    backgroundColor: 'transparent',
    opacity: 0.5,
    transition: 'opacity 0.1s',
    '&:hover': {
      opacity: 1,
    },
  } as const,
  toolIcon: {} as const,
  toolIconLg: {
    fontSize: 'lg',
  } as const,
} as const;


export function PaneTitleOverlay(props: {
  paneIdx: number,
  conversationId: DConversationId | null,
  isFocused: boolean,
  onConversationDelete: (conversationIds: DConversationId[], bypassConfirmation: boolean) => void,
}) {

  // state
  const [editingTitle, setEditingTitle] = React.useState(false);

  // external state
  const { title, setUserTitle } = useConversationTitle(props.conversationId);
  // if (!title || title?.length < 3)
  //   return null;


  // close tabs handlers

  const handleCloseThis = React.useCallback(() => {
    panesManagerActions().removePane(props.paneIdx);
  }, [props.paneIdx]);

  const handleCloseOthers = React.useCallback(() => {
    panesManagerActions().removeOtherPanes(props.paneIdx);
  }, [props.paneIdx]);


  // title handles

  const handleTitleEditBegin = React.useCallback(() => {
    setEditingTitle(true);
  }, []);

  const handleTitleEditChange = React.useCallback((newTitle: string) => {
    setUserTitle(newTitle);
    setEditingTitle(false);
  }, [setUserTitle]);

  const handleTitleEditEnd = React.useCallback(() => {
    setEditingTitle(false);
  }, []);


  // delete handlers

  const { onConversationDelete } = props;

  const handleDeleteClicked = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (props.conversationId)
      onConversationDelete([props.conversationId], event.shiftKey);
  }, [onConversationDelete, props.conversationId]);


  // don't render if not focused
  // if (!props.isFocused)
  //   return null;

  const hasTitle = title && title.length > 0;
  const color = props.isFocused ? 'primary' : 'neutral';
  const variantO = props.isFocused ? 'solid' : 'outlined';
  const variantP = props.isFocused ? 'solid' : 'plain';

  return (
    <Sheet
      color={color}
      variant={variantO}
      sx={_styles.tileBar}
    >
      {/* Close Others*/}
      {/*<TooltipOutlined title='Close Other Tabs'>*/}
      {!editingTitle && <IconButton title='Close Other Tabs' size='sm' color={color} variant={variantP} onClick={handleCloseOthers} sx={_styles.toolButton}>
        <OpenInFullIcon sx={_styles.toolIcon} />
      </IconButton>}
      {/*</TooltipOutlined>*/}

      {/* Title */}
      {editingTitle ? (
        <InlineTextarea
          initialText={title || ''}
          placeholder='Chat title...'
          invertedColors
          centerText
          onEdit={handleTitleEditChange}
          onCancel={handleTitleEditEnd}
          sx={{
            // flexGrow: 1,
            // minWidth: 120,
            mx: { md: 1 },
          }}
        />
      ) : hasTitle ? (
        <Box sx={_styles.title} onDoubleClick={handleTitleEditBegin}>
          {title}
        </Box>
      ) : !!props.conversationId && (
        <IconButton title='Edit Chat Title' size='sm' color={color} variant={variantP} onClick={handleTitleEditBegin} sx={_styles.toolButton}>
          <EditRoundedIcon sx={_styles.toolIcon} />
        </IconButton>
      )}

      {/* Delete This */}
      {ENABLE_DELETE && hasTitle && !!props.conversationId && (
        <TooltipOutlined title='Delete Chat (Shift+Click to bypass confirmation)'>
          <IconButton size='sm' variant={variantP} onClick={handleDeleteClicked} sx={_styles.toolButton}>
            <DeleteForeverIcon />
          </IconButton>
        </TooltipOutlined>
      )}

      {/* Close This */}
      {/*<TooltipOutlined title='Close'>*/}
      {!editingTitle && <IconButton title='Close Tab' size='sm' color={color} variant={variantP} onClick={handleCloseThis} sx={_styles.toolButton}>
        <ClearIcon sx={_styles.toolIconLg} />
      </IconButton>}
      {/*</TooltipOutlined>*/}
    </Sheet>
  );
}