import React, { useState } from 'react';
import { DraggableProvided, DraggableStateSnapshot, DraggingStyle, NotDraggingStyle } from 'react-beautiful-dnd';

import { Dropdown, FormLabel, IconButton, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Menu, MenuButton, MenuItem, Radio, radioClasses, RadioGroup, Sheet, Typography } from '@mui/joy';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Done from '@mui/icons-material/Done';
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVert from '@mui/icons-material/MoreVert';

import { DFolder, FOLDERS_COLOR_PALETTE, useFolderStore } from '~/common/state/store-folders';
import { InlineTextarea } from '~/common/components/InlineTextarea';


// Define the type for your props if you're using TypeScript
type RenderItemProps = {
  folder: DFolder;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  onFolderSelect: (folderId: string | null) => void;
  selectedFolderId: string | null;
  // Include any other props that RenderItem needs
};

export const FolderListItem: React.FC<RenderItemProps> = ({ folder, provided, snapshot, onFolderSelect, selectedFolderId }) => {

  // internal state
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // State to control the open state of the Menu
  const [menuOpen, setMenuOpen] = useState(false);


  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    useFolderStore.getState().setFolderColor(folder.id, event.target.value);
    setMenuOpen(false);
  };


  // Edit Title
  const handleEditTitle = (event: React.MouseEvent<HTMLElement, MouseEvent>, folderId: string) => {
    event.stopPropagation(); // Prevent the ListItemButton's onClick from firing
    setEditingFolderId(folderId);
  };

  const handleCancelEditTitle = () => {
    setEditingFolderId(null);
  };

  const handleSaveFolder = (newTitle: string, folderId: string) => {
    if (newTitle.trim())
      useFolderStore.getState().setFolderName(folderId, newTitle.trim());
    setEditingFolderId(null); // Exit edit mode
    // Blur the input element if it's currently focused
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };


  // Deletion

  // Modified handler to arm the delete action and keep the menu open
  const handleDeleteButtonShow = (event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteArmed(true);
    setMenuOpen(true); // Keep the menu open
  };

  // Handler to close the menu
  const handleCloseMenu = () => {
    setMenuOpen(false);
    setDeleteArmed(false); // Reset delete armed state
  };

  // Handler to delete the folder
  const handleDeleteConfirmed = (event: React.MouseEvent) => {
    if (deleteArmed) {
      setDeleteArmed(false);
      event.stopPropagation();
      useFolderStore.getState().deleteFolder(folder.id);
      setMenuOpen(false);
    }
  };

  // Toggle the menu's open state
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
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

  const getListItemContentStyle = (isDragging: boolean, draggableStyle: DraggingStyle | NotDraggingStyle | undefined) => ({
    ...(isDragging && {
      // Apply any drag-specific styles here
      marginLeft: '20px',
    }),
  });

  const getListItemDecoratorStyle = (isDragging: boolean, draggableStyle: DraggingStyle | NotDraggingStyle | undefined) => ({
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
        selected={folder.id === selectedFolderId}
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
            onEdit={newTitle => handleSaveFolder(newTitle, folder.id)}
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
            <Typography>{folder.title}</Typography>
          </ListItemContent>
        )}

        <Dropdown>
          <MenuButton
            className='menu-icon'
            sx={{ visibility: 'hidden' }}
            slots={{ root: IconButton }}
            slotProps={{ root: { variant: 'outlined', color: 'neutral' } }}
            onClick={toggleMenu}
          >
            <MoreVert />
          </MenuButton>
          <Menu open={menuOpen} onClose={handleCloseMenu}>
            <MenuItem
              onClick={(event) => {
                handleEditTitle(event, folder.id);
                handleCloseMenu();
              }}
            >
              <EditIcon />
              Edit
            </MenuItem>
            {!deleteArmed ? (
              <MenuItem onClick={handleDeleteButtonShow}>
                <DeleteOutlineIcon />
                Delete
              </MenuItem>
            ) : (
              <>
                <MenuItem onClick={handleDeleteConfirmed} color='danger' sx={{ color: 'danger' }}>
                  <DeleteOutlineIcon />
                  Confirm Delete
                </MenuItem>
                <MenuItem onClick={handleCloseMenu}>
                  <CloseIcon />
                  Cancel
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
                  fontWeight: 'xl',
                  textTransform: 'uppercase',
                  fontSize: 'xs',
                  letterSpacing: '0.1em',
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
          </Menu>
        </Dropdown>
      </ListItemButton>
    </ListItem>
  );
};
