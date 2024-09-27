import React, { useState } from 'react';
import type { DraggableProvided, DraggableStateSnapshot, DraggingStyle, NotDraggingStyle } from 'react-beautiful-dnd';

import { FormLabel, IconButton, ListItem, ListItemButton, ListItemContent, ListItemDecorator, MenuItem, Radio, radioClasses, RadioGroup, Sheet } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Done from '@mui/icons-material/Done';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { DFolder, FOLDERS_COLOR_PALETTE, useFolderStore } from '~/common/state/store-folders';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';


export function FolderListItem(props: {
  activeFolderId: string | null;
  folder: DFolder;
  onFolderSelect: (folderId: string | null) => void;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
}) {

  // internal state
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // State to control the open state of the Menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLAnchorElement>(null);


  // derived props
  const { activeFolderId, folder, onFolderSelect, provided, snapshot } = props;


  // Menu
  const handleMenuToggle = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    setMenuAnchorEl(anchor => anchor ? null : event.currentTarget);
    setDeleteArmed(false); // Reset delete armed state
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };


  // Edit Title

  const handleEditTitle = (event: React.MouseEvent<HTMLElement, MouseEvent>, folderId: string) => {
    event.stopPropagation(); // Prevent the ListItemButton's onClick from firing
    setEditingFolderId(folderId);
  };

  const handleCancelEditTitle = () => {
    setEditingFolderId(null);
  };

  const handleSetTitle = (newTitle: string, folderId: string) => {
    if (newTitle.trim())
      useFolderStore.getState().setFolderName(folderId, newTitle.trim());
    setEditingFolderId(null); // Exit edit mode
    // Blur the input element if it's currently focused
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };


  // Deletion

  const handleDeleteButtonShow = (event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteArmed(true);
  };

  const handleDeleteConfirmed = (event: React.MouseEvent) => {
    if (deleteArmed) {
      setDeleteArmed(false);
      event.stopPropagation();
      useFolderStore.getState().deleteFolder(folder.id);
      handleMenuClose();
    }
  };

  const handleDeleteCanceled = (event: React.MouseEvent) => {
    if (deleteArmed) {
      setDeleteArmed(false);
      event.stopPropagation();
    }
  };


  // Color

  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    useFolderStore.getState().setFolderColor(folder.id, event.target.value);
    handleMenuClose();
  };


  const getItemStyle = (isDragging: boolean, draggableStyle: DraggingStyle | NotDraggingStyle | undefined) => ({
    userSelect: 'none',
    borderRadius: '8px',
    backgroundColor: isDragging ? 'rgba(0, 80, 80, 0.18)' : 'transparent',

    ...draggableStyle,

    // Any additional styles you want to apply during dragging
    ...(isDragging &&
      {
        // Apply any drag-specific styles here
        // marginLeft: '12px',
      }),
  });

  const getListItemContentStyle = (isDragging: boolean, _draggableStyle: DraggingStyle | NotDraggingStyle | undefined) => ({
    ...(isDragging && {
      // Apply any drag-specific styles here
      marginLeft: '20px',
    }),
  });

  const getListItemDecoratorStyle = (isDragging: boolean, _draggableStyle: DraggingStyle | NotDraggingStyle | undefined) => ({
    ...(isDragging && {
      // Apply any drag-specific styles here
      marginLeft: '12px',
    }),
  });

  const handleFolderSelect = (folderId: string | null) => {
    onFolderSelect(folderId);
  };

  return (
    <ListItem
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={{
        ...getItemStyle(snapshot.isDragging, provided.draggableProps.style),
        userSelect: 'none',
      }}
    >
      <ListItemButton
        // handle folder select
        onClick={(event) => {
          event.stopPropagation(); // Prevent the ListItemButton's onClick from firing
          handleFolderSelect(folder.id);
        }}
        selected={folder.id === activeFolderId}
        sx={{
          border: 0,
          justifyContent: 'space-between',
          '&:hover .menu-icon': {
            visibility: 'visible', // Hide delete icon for default folder
          },
        }}
      >
        <ListItemDecorator
          style={{
            ...getListItemDecoratorStyle(snapshot.isDragging, provided.draggableProps.style),
            userSelect: 'none',
          }}
        >
          <FolderIcon style={{ color: folder.color || 'inherit' }} />
        </ListItemDecorator>

        {editingFolderId === folder.id ? (
          <InlineTextarea
            initialText={folder.title}
            onEdit={newTitle => handleSetTitle(newTitle, folder.id)}
            onCancel={handleCancelEditTitle}
            sx={{ ml: -1.5, mr: -0.5, flexGrow: 1 }}
          />
        ) : (
          <ListItemContent
            onDoubleClick={event => handleEditTitle(event, folder.id)}
            style={{
              ...getListItemContentStyle(snapshot.isDragging, provided.draggableProps.style),
              userSelect: 'none',
            }}
          >
            {folder.title}
          </ListItemContent>
        )}

        {/* Icon to show the Popup menu */}
        <IconButton
          size='sm'
          variant='outlined'
          className='menu-icon'
          onClick={handleMenuToggle}
          onContextMenu={handleMenuToggle}
          sx={{
            visibility: 'hidden',
            my: '-0.25rem', /* absorb the button padding */
          }}
        >
          <MoreVertIcon />
        </IconButton>

        {!!menuAnchorEl && (
          <CloseableMenu
            dense placement='top'
            open anchorEl={menuAnchorEl} onClose={handleMenuClose}
            zIndex={themeZIndexOverMobileDrawer /* need to be on top of the Modal on Mobile */}
            sx={{ minWidth: 200 }}
          >

            <MenuItem
              onClick={(event) => {
                handleEditTitle(event, folder.id);
                handleMenuClose();
              }}
            >
              <ListItemDecorator>
                <EditRoundedIcon />
              </ListItemDecorator>
              Edit
            </MenuItem>

            {!deleteArmed ? (
              <MenuItem onClick={handleDeleteButtonShow}>
                <ListItemDecorator>
                  <DeleteOutlineIcon />
                </ListItemDecorator>
                Delete
              </MenuItem>
            ) : (
              <>
                <MenuItem onClick={handleDeleteCanceled}>
                  <ListItemDecorator>
                    <CloseRoundedIcon />
                  </ListItemDecorator>
                  Cancel
                </MenuItem>
                <MenuItem onClick={handleDeleteConfirmed} color='danger' sx={{ color: 'danger' }}>
                  <ListItemDecorator>
                    <DeleteOutlineIcon />
                  </ListItemDecorator>
                  Confirm Deletion
                </MenuItem>
              </>
            )}

            <MenuItem
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                p: 2,
                minWidth: 200,
              }}
            >
              <FormLabel
                id='folder-color'
                sx={{
                  mb: 1.5,
                  fontSize: 'xs',
                  fontWeight: 'xl', /* 700: this COLOR labels stands out positively */
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Color
              </FormLabel>
              <RadioGroup
                aria-labelledby='product-color-attribute'
                defaultValue={folder.color || 'warning'}
                onChange={handleColorChange}
                sx={{ gap: 2, flexWrap: 'wrap', flexDirection: 'row', maxWidth: 240 }}
              >
                {FOLDERS_COLOR_PALETTE.map((color, index) => (
                  <Sheet
                    key={index}
                    sx={{
                      position: 'relative',
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      bgcolor: `${color}`,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Radio
                      overlay
                      variant='solid'
                      checkedIcon={<Done />}
                      value={color}
                      color='neutral'
                      slotProps={{
                        input: { 'aria-label': color },
                        radio: {
                          sx: {
                            display: 'contents',
                            '--variant-borderWidth': '2px',
                          },
                        },
                      }}
                      sx={{
                        '--joy-focus-outlineOffset': '4px',
                        '--joy-palette-focusVisible': color,
                        [`& .${radioClasses.action}.${radioClasses.focusVisible}`]: {
                          outlineWidth: '2px',
                        },
                      }}
                    />
                  </Sheet>
                ))}
              </RadioGroup>
            </MenuItem>

          </CloseableMenu>
        )}

      </ListItemButton>
    </ListItem>
  );
}
