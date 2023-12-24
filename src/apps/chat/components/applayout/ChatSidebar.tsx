import * as React from 'react';
import { useEffect, useState } from 'react';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemButton from '@mui/joy/ListItemButton';
import ListItemContent from '@mui/joy/ListItemContent';
import ListItemDecorator from '@mui/joy/ListItemDecorator';
import IconButton from '@mui/joy/IconButton';
import Box from '@mui/joy/Box';
import Sheet, { sheetClasses } from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import Radio, { radioClasses } from '@mui/joy/Radio';

import { DFolder, useFolderStore } from '~/common/state/store-folders';
import {
  DragDropContext,
  Droppable,
  DroppableProps,
  Draggable,
  DropResult,
  DraggingStyle,
  NotDraggingStyle,
  DraggableProvided,
  DraggableStateSnapshot,
} from 'react-beautiful-dnd';
import OutlineFolderIcon from '@mui/icons-material/Folder';
import { Dropdown, FormLabel, Menu, MenuButton, MenuItem, RadioGroup } from '@mui/joy';
import MoreVert from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import Done from '@mui/icons-material/Done';
import FolderListItem from './FolderListItem';
import { DConversation } from '~/common/state/store-chats';

export default function ChatSidebar({
  onFolderSelect,
  folders,
  selectedFolderId,
  conversationsByFolder,
}: {
  onFolderSelect: (folderId: string | null) => void;
  folders: DFolder[];
  selectedFolderId: string | null;
  conversationsByFolder: DConversation[];
}) {
  const { moveFolder, updateFolderName } = useFolderStore((state) => ({
    folders: state.folders,
    moveFolder: state.moveFolder,
    updateFolderName: state.updateFolderName,
  }));

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    moveFolder(result.source.index, result.destination.index);
  };

  return (
    <Sheet variant="soft" sx={{ width: 343, p: 2, borderRadius: 'sm' }}>
      <Typography level="h3" fontSize="xl" fontWeight="xl" mb={1}>
        Folders
      </Typography>

      <List
        aria-labelledby="ios-example-demo"
        sx={(theme) => ({
          '& ul': {
            '--List-gap': '0px',
            bgcolor: 'background.surface',
            '& > li:first-of-type > [role="button"]': {
              borderTopRightRadius: 'var(--List-radius)',
              borderTopLeftRadius: 'var(--List-radius)',
            },
            '& > li:last-child > [role="button"]': {
              borderBottomRightRadius: 'var(--List-radius)',
              borderBottomLeftRadius: 'var(--List-radius)',
            },
          },
          '--List-radius': '8px',
          '--List-gap': '1rem',
          '--ListDivider-gap': '0px',
          '--ListItem-paddingY': '0.5rem',
          // override global variant tokens
          '--joy-palette-neutral-plainHoverBg': 'rgba(0 0 0 / 0.08)',
          '--joy-palette-neutral-plainActiveBg': 'rgba(0 0 0 / 0.12)',
          [theme.getColorSchemeSelector('light')]: {
            '--joy-palette-divider': 'rgba(0 0 0 / 0.08)',
          },
          [theme.getColorSchemeSelector('dark')]: {
            '--joy-palette-neutral-plainHoverBg': 'rgba(255 255 255 / 0.1)',
            '--joy-palette-neutral-plainActiveBg': 'rgba(255 255 255 / 0.16)',
          },
        })}
      >
        <ListItem nested>
          <DragDropContext onDragEnd={onDragEnd}>
            <StrictModeDroppable
              droppableId="folder"
              renderClone={(provided, snapshot, rubric) => (
                <FolderListItem
                  folder={folders[rubric.source.index]}
                  provided={provided}
                  snapshot={snapshot}
                  onFolderSelect={onFolderSelect}
                  selectedFolderId={selectedFolderId}
                />
              )}
            >
              {(provided) => (
                <List ref={provided.innerRef} {...provided.droppableProps}>
                  <ListItem>
                    <ListItemButton
                      // handle folder select
                      onClick={(event) => {
                        event.stopPropagation(); // Prevent the ListItemButton's onClick from firing
                        onFolderSelect(null);
                      }}
                      selected={selectedFolderId === null}
                      sx={{
                        justifyContent: 'space-between',
                        '&:hover .menu-icon': {
                          visibility: 'visible', // Hide delete icon for default folder
                        },
                      }}
                    >
                      <ListItemDecorator>
                        <OutlineFolderIcon style={{ color: 'inherit' }} />
                      </ListItemDecorator>

                      <ListItemContent>
                        <Typography>All</Typography>
                      </ListItemContent>
                    </ListItemButton>
                  </ListItem>

                  {folders.map((folder, index) => (
                    <Draggable key={folder.id} draggableId={folder.id} index={index}>
                      {(provided, snapshot) => (
                        <React.Fragment>
                          <FolderListItem
                            folder={folder}
                            provided={provided}
                            snapshot={snapshot}
                            onFolderSelect={onFolderSelect}
                            selectedFolderId={selectedFolderId}
                          />
                        </React.Fragment>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </List>
              )}
            </StrictModeDroppable>
          </DragDropContext>
        </ListItem>
      </List>
    </Sheet>
  );
}

export const StrictModeDroppable = ({ children, ...props }: DroppableProps) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));

    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return <Droppable {...props}>{children}</Droppable>;
};
