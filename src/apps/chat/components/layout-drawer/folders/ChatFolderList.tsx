import * as React from 'react';
import { DragDropContext, Draggable, DropResult } from 'react-beautiful-dnd';

import type { SxProps } from '@mui/joy/styles/types';
import { List, ListItem, ListItemButton, ListItemDecorator, Sheet } from '@mui/joy';
import FolderIcon from '@mui/icons-material/Folder';

import { ContentScaling, themeScalingMap } from '~/common/app.theme';
import { DFolder, useFolderStore } from '~/common/stores/folders/store-chat-folders';
import { StrictModeDroppable } from '~/common/components/StrictModeDroppable';

import { AddFolderButton } from './AddFolderButton';
import { FolderListItem } from './FolderListItem';


export function ChatFolderList(props: {
  folders: DFolder[];
  contentScaling: ContentScaling;
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  sx?: SxProps;
}) {

  // derived props
  const { folders, onFolderSelect, activeFolderId } = props;

  // handlers

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    useFolderStore.getState().moveFolder(result.source.index, result.destination.index);
  };


  return (
    <Sheet variant='soft' sx={props.sx}>
      <List
        variant='plain'
        sx={(theme) => ({
          // added to be responsive to parent's layout sizing
          height: '100%',
          overflowY: 'auto',

          // original list properties
          '& ul': {
            '--List-gap': '0px',
            bgcolor: 'background.popup',
            '& > li:first-of-type > [role="button"]': {
              borderTopRightRadius: 'var(--List-radius)',
              borderTopLeftRadius: 'var(--List-radius)',
            },
            '& > li:last-child > [role="button"]': {
              borderBottomRightRadius: 'var(--List-radius)',
              borderBottomLeftRadius: 'var(--List-radius)',
            },
          },
          // copied from the former PageDrawerList as this was contained
          '--Icon-fontSize': 'var(--joy-fontSize-xl2)',

          // dynamic sizing
          ...themeScalingMap[props.contentScaling].chatDrawerItemFolderSx,
          // '--ListItemDecorator-size': '2.75rem',
          // '--ListItem-minHeight': '2.75rem',

          '--List-radius': '8px',
          '--List-gap': '1rem',
          '--ListDivider-gap': '0px',
          // '--ListItem-paddingY': '0.5rem',
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
          boxShadow: 'sm',
        })}
      >
        <ListItem nested>
          <DragDropContext onDragEnd={onDragEnd}>
            <StrictModeDroppable
              droppableId='folder'
              renderClone={(provided, snapshot, rubric) => (
                <FolderListItem
                  activeFolderId={activeFolderId}
                  folder={folders[rubric.source.index]}
                  onFolderSelect={onFolderSelect}
                  provided={provided}
                  snapshot={snapshot}
                />
              )}
            >
              {(provided) => (
                <List ref={provided.innerRef} {...provided.droppableProps}>

                  {/* First item is the 'All' button */}
                  <ListItem>
                    <ListItemButton
                      // handle folder select
                      onClick={(event) => {
                        event.stopPropagation(); // Prevent the ListItemButton's onClick from firing
                        onFolderSelect(null);
                      }}
                      selected={!activeFolderId}
                      sx={{ border: 0 }}
                    >
                      <ListItemDecorator>
                        <FolderIcon />
                      </ListItemDecorator>
                      All
                    </ListItemButton>
                  </ListItem>

                  {folders.map((folder, index) => (
                    <Draggable key={folder.id} draggableId={folder.id} index={index}>
                      {(provided, snapshot) => (
                        <FolderListItem
                          activeFolderId={activeFolderId}
                          folder={folder}
                          onFolderSelect={onFolderSelect}
                          provided={provided}
                          snapshot={snapshot}
                        />
                      )}
                    </Draggable>
                  ))}

                  {provided.placeholder}

                  <AddFolderButton />
                </List>
              )}
            </StrictModeDroppable>
          </DragDropContext>
        </ListItem>
      </List>

     </Sheet>
  );
}
