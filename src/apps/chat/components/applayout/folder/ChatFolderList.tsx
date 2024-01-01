import * as React from 'react';

import Sheet, { sheetClasses } from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import { List, ListItem, ListItemButton, ListItemContent, ListItemDecorator } from '@mui/joy';
import OutlineFolderIcon from '@mui/icons-material/Folder';
import { DragDropContext, Draggable, DropResult } from 'react-beautiful-dnd';

import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { DConversation } from '~/common/state/store-chats';

import { AddFolderButton } from './AddFolderButton';
import FolderListItem from './FolderListItem';

import { StrictModeDroppable } from './StrictModeDroppable';

export function ChatFolderList({
    onFolderSelect,
    folders,
    selectedFolderId,
  }: {
    onFolderSelect: (folderId: string | null) => void;
    folders: DFolder[];
    selectedFolderId: string | null;
    conversationsByFolder: DConversation[];
  }) {
  // local state

  // external state
    const { moveFolder } = useFolderStore((state) => ({
        moveFolder: state.moveFolder,
    }));

  // handlers
  
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

      <AddFolderButton />
    </Sheet>
  );
}
