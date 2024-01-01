import React, { useState } from 'react';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import {
  ListItem,
  ListItemButton,
  ListItemDecorator,
  ListItemContent,
  Typography,
  IconButton,
  Dropdown,
  Menu,
  MenuButton,
  MenuItem,
  FormLabel,
  RadioGroup,
  Sheet,
  Radio,
  radioClasses,
} from '@mui/joy';
import OutlineFolderIcon from '@mui/icons-material/Folder';
import MoreVert from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import Done from '@mui/icons-material/Done';
import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { DraggingStyle, NotDraggingStyle } from 'react-beautiful-dnd';

// Define the type for your props if you're using TypeScript
type RenderItemProps = {
  folder: DFolder;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  onFolderSelect: (folderId: string | null) => void;
  selectedFolderId: string | null;
  // Include any other props that RenderItem needs
};

const FolderListItem: React.FC<RenderItemProps> = ({ folder, provided, snapshot, onFolderSelect, selectedFolderId }) => {
  // internal state
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteArmedFolderId, setDeleteArmedFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState<string>('');

  // State to control the open state of the Menu
  const [menuOpen, setMenuOpen] = useState(false);

  // external state
  const { folders, moveFolder, updateFolderName, deleteFolder } = useFolderStore((state) => ({
    folders: state.folders,
    moveFolder: state.moveFolder,
    updateFolderName: state.updateFolderName,
    deleteFolder: state.deleteFolder,
  }));

  const { setFolderColor } = useFolderStore((state) => ({
    setFolderColor: state.setFolderColor,
  }));

  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFolderColor(folder.id, event.target.value);
    setMenuOpen(false);
  };

  // Handlers for editing and deleting
  const handleEdit = (event: React.MouseEvent<HTMLElement, MouseEvent>, folderId: string, folderTitle: string) => {
    event.stopPropagation(); // Prevent the ListItemButton's onClick from firing
    setEditingFolderId(folderId);
    setEditingFolderName(folderTitle);
  };

  const handleSaveFolder = (folderId: string) => {
    if (editingFolderName.trim() !== '') {
      updateFolderName(folderId, editingFolderName.trim());
    }
    setEditingFolderId(null); // Exit edit mode
    // Blur the input element if it's currently focused
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingFolderName(event.target.value);
  };

  const handleInputKeyUp = (event: React.KeyboardEvent<HTMLInputElement>, folderId: string) => {
    if (event.key === 'Enter') {
      handleSaveFolder(folderId);
    } else if (event.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleCancelEdit = () => {
    setEditingFolderId(null); // Exit edit mode without saving
    setEditingFolderName(''); // Reset editing name
  };

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

  // Handler to disarm the delete action
  const handleDeleteButtonHide = () => setDeleteArmed(false);

  // Handler to delete the folder
  const handleDeleteConfirmed = (event: React.MouseEvent) => {
    if (deleteArmed) {
      setDeleteArmed(false);
      event.stopPropagation();
      deleteFolder(folder.id);
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
          <OutlineFolderIcon style={{ color: folder.color || 'inherit' }} />
        </ListItemDecorator>

        {editingFolderId === folder.id ? (
          <input
            type="text"
            value={editingFolderName}
            onChange={handleInputChange}
            onKeyUp={(event) => handleInputKeyUp(event, folder.id)}
            onBlur={() => handleSaveFolder(folder.id)}
            autoFocus
            style={{
              // Add styles for the input field
              fontSize: 'inherit',
              fontWeight: 'inherit',
              color: 'inherit',
              background: 'none',
              border: 'none',
              outline: 'none',
              width: '100%', // Ensure the input field expands as needed
            }}
          />
        ) : (
          <ListItemContent
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
            className="menu-icon"
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
                handleEdit(event, folder.id, folder.title); // Pass the folder's title here
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
                <MenuItem onClick={handleDeleteConfirmed} color="danger" sx={{ color: 'danger' }}>
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
                id="folder-color"
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
                aria-labelledby="product-color-attribute"
                defaultValue={folder.color || 'warning'}
                onChange={handleColorChange}
                sx={{ gap: 2, flexWrap: 'wrap', flexDirection: 'row', maxWidth: 180 }}
              >
                {(
                  [
                    '#ff0000',
                    '#ff8700',
                    '#ffd300',
                    '#deff0a',
                    '#a1ff0a',
                    '#8A0000',
                    '#8A3700',
                    '#8A5700',
                    '#7C6A05',
                    '#626906',
                    '#0aff99',
                    '#0aefff',
                    '#147df5',
                    '#580aff',
                    '#be0aff',
                    '#226D40',
                    '#22656D',
                    '#25346A',
                    '#440669',
                    '#6E0569',
                  ] as const
                ).map((color, index) => (
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
                      variant="solid"
                      checkedIcon={<Done />}
                      value={color}
                      color="neutral"
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

export default FolderListItem;
