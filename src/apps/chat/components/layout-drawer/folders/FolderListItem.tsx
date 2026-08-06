import * as React from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

import { FormLabel, IconButton, ListItem, ListItemButton, ListItemContent, ListItemDecorator, MenuItem, Radio, RadioGroup, Sheet } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Done from '@mui/icons-material/Done';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { CloseablePopup } from '~/common/components/CloseablePopup';
import { DFolder, FOLDERS_COLOR_PALETTE, useFolderStore } from '~/common/stores/folders/store-chat-folders';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { themeZIndexOverMobileDrawer } from '~/common/app.theme';


const _styles = {

  menuButton: {
    visibility: 'hidden',
  } as const,

  itemButton: {
    border: 0,
  } as const,

  itemTextArea: {
    ml: -1.5,
    mr: -0.5,
    flexGrow: 1,
  } as const,

} as const;


export function FolderListItem(props: {
  folder: DFolder;
  chatCount?: number;
  isActive: boolean;
  onFolderSelect: (folderId: string | null) => void;
}) {

  // props
  const { isActive, onFolderSelect, chatCount } = props;
  const { id: folderId, color: folderColor, title: folderTitle } = props.folder;

  // state
  const [deleteArmed, setDeleteArmed] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLAnchorElement>(null);

  // DnD Kit sortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folderId });


  // handlers

  const handleFolderActivate = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onFolderSelect(folderId);
  }, [folderId, onFolderSelect]);


  // menu handlers

  const handleMenuToggle = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    event.stopPropagation(); // keep the focus on the menu that's opening
    setDeleteArmed(false); // Reset delete armed state
    setMenuAnchorEl(anchor => anchor ? null : event.currentTarget);
  }, []);

  const handleMenuClose = React.useCallback(() => setMenuAnchorEl(null), []);


  // Edit Title

  const handleEditTitle = React.useCallback((event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.stopPropagation(); // Prevent the ListItemButton's onClick from firing
    setIsEditing(true);
  }, []);

  const handleCancelEditTitle = React.useCallback(() => setIsEditing(false), []);

  const handleSetTitle = React.useCallback((newTitle: string, folderId: string) => {
    if (newTitle.trim())
      useFolderStore.getState().setFolderName(folderId, newTitle.trim());
    setIsEditing(false); // Exit edit mode
    // Blur the input element if it's currently focused
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);


  // Deletion

  const handleDeleteButtonShow = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteArmed(true);
  }, []);

  const handleDeleteConfirmed = React.useCallback((event: React.MouseEvent) => {
    if (!deleteArmed) return;
    setDeleteArmed(false);
    event.stopPropagation();
    useFolderStore.getState().deleteFolder(folderId);
    handleMenuClose();
  }, [deleteArmed, folderId, handleMenuClose]);

  const handleDeleteCanceled = React.useCallback((event: React.MouseEvent) => {
    if (!deleteArmed) return;
    setDeleteArmed(false);
    event.stopPropagation();
  }, [deleteArmed]);


  // Color

  const handleColorChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    useFolderStore.getState().setFolderColor(folderId, event.target.value);
    handleMenuClose();
  }, [folderId, handleMenuClose]);


  return (
    <ListItem
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        userSelect: 'none',
        zIndex: isDragging ? 1 : undefined,

        // we had this before, but it wasn't working properly, so we reduced to a handle (folder icon) on mobile
        // touchAction: 'none', // DnD prevent scrolling on mobile

        // shows the menu icon on hover
        '&:hover .menu-icon': {
          visibility: 'visible',
        },
      }}
      endAction={!isEditing &&
        <IconButton
          size='sm'
          // variant='plain'
          onClick={handleMenuToggle}
          onContextMenu={handleMenuToggle}
          sx={!isActive ? _styles.menuButton : undefined}
          className='menu-icon'
        >
          <MoreVertIcon />
        </IconButton>
      }
    >
      <ListItemButton
        selected={isActive}
        onClick={handleFolderActivate}
        sx={_styles.itemButton}
      >
        {/* Folder icon is the drag handle - only this part is draggable */}
        <ListItemDecorator
          {...attributes}
          {...listeners}
          sx={{
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none', // Prevent scrolling on mobile when dragging
          }}
        >
          <FolderIcon style={{ color: folderColor || 'inherit' }} />
        </ListItemDecorator>

        {isEditing ? (
          <InlineTextarea
            initialText={folderTitle}
            onEdit={newTitle => handleSetTitle(newTitle, folderId)}
            onCancel={handleCancelEditTitle}
            sx={_styles.itemTextArea}
          />
        ) : (
          <ListItemContent onDoubleClick={handleEditTitle}>
            {folderTitle}
            {chatCount !== undefined && chatCount > 0 && <span style={{ opacity: 0.6, fontSize: '0.75rem', marginLeft: '0.5rem' }}> {chatCount}</span>}
          </ListItemContent>
        )}

        {/* Folder Options Menu */}
        {!!menuAnchorEl && (
          <CloseablePopup
            menu anchorEl={menuAnchorEl} onClose={handleMenuClose}
            dense
            placement='top'
            zIndex={themeZIndexOverMobileDrawer /* need to be on top of the Modal on Mobile */}
          >

            <MenuItem
              onClick={(event) => {
                handleEditTitle(event);
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
                defaultValue={folderColor || 'warning'}
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
                            // '--variant-borderWidth': '2px',
                          },
                        },
                      }}
                      // sx={{
                      //   '--joy-focus-outlineOffset': '4px',
                      //   '--joy-palette-focusVisible': color,
                      //   [`& .${radioClasses.action}.${radioClasses.focusVisible}`]: {
                      //     outlineWidth: '2px',
                      //   },
                      // }}
                    />
                  </Sheet>
                ))}
              </RadioGroup>
            </MenuItem>

          </CloseablePopup>
        )}

      </ListItemButton>
    </ListItem>
  );
}
