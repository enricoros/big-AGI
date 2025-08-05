import * as React from 'react';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, List, ListItem, ListItemButton, ListItemDecorator, Typography } from '@mui/joy';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';

import { ContentScaling, themeScalingMap } from '~/common/app.theme';
import { DFolder, useFolderStore } from '~/common/stores/folders/store-chat-folders';

import { AddFolderButton } from './AddFolderButton';
import { FolderListItem } from './FolderListItem';


const _styles = {
  listBase: {

    // show scrollbars when shrunk
    height: '100%',
    overflowY: 'auto',

    // style
    // borderRadius: 'sm',
    backgroundColor: 'background.popup',
    boxShadow: 'sm',

    // original list properties
    '--List-gap': 0,
    '--List-radius': '0.5rem',
    '--ListDivider-gap': 0,

    // copied from the former PageDrawerList as this was contained
    '--Icon-fontSize': 'var(--joy-fontSize-xl2)',

    // override global variant tokens
    // '--joy-palette-neutral-plainHoverBg': 'rgba(0 0 0 / 0.08)',
    // '--joy-palette-neutral-plainActiveBg': 'rgba(0 0 0 / 0.12)',
    // [theme.getColorSchemeSelector('dark')]: {
    //   '--joy-palette-neutral-plainHoverBg': 'rgba(255 255 255 / 0.1)',
    //   '--joy-palette-neutral-plainActiveBg': 'rgba(255 255 255 / 0.16)',
    // },
  } as const,

  allItem: {
    border: 0,
  } as const,
} as const;

const _dndModifiers = [restrictToVerticalAxis, restrictToParentElement];


export function ChatFolderList(props: {
  folders: DFolder[];
  folderChatCounts?: Record<DFolder['id'], number>;
  contentScaling: ContentScaling;
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  sx?: SxProps;
}) {

  // derived props
  const { folders, folderChatCounts, onFolderSelect, activeFolderId } = props;

  // DnD Kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );


  // memos

  const folderIds = React.useMemo(() => {
    return folders.map(f => f.id);
  }, [folders]);

  const listSx = React.useMemo(() => ({
    ..._styles.listBase,
    ...themeScalingMap[props.contentScaling].chatDrawerItemFolderSx,
  }), [props.contentScaling]);


  // handlers

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = folderIds.findIndex(fId => fId === active.id);
    const newIndex = folderIds.findIndex(fId => fId === over.id);
    if (oldIndex !== -1 && newIndex !== -1)
      useFolderStore.getState().moveFolder(oldIndex, newIndex);
  }, [folderIds]);


  return (
    <Box sx={props.sx}>

      <List
        variant='plain'
        sx={listSx}
      >

        {/* Zero State message */}
        {!folders.length && (
          <ListItem sx={{ flexDirection: 'column', textAlign: 'center', px: 2, py: 3 }}>
            <FolderOutlinedIcon sx={{ fontSize: 'xl2' }} />
            <Typography level='body-sm'>
              Create folders to organize your chats
            </Typography>
          </ListItem>
        )}

        {/* 'All' Button */}
        {(!!activeFolderId || !!folders.length) && (
          <ListItem>
            <ListItemButton
              selected={!activeFolderId}
              onClick={(event) => {
                event.stopPropagation(); // Prevent the ListItemButton's onClick from firing
                onFolderSelect(null);
              }}
              sx={_styles.allItem}
            >
              <ListItemDecorator>{!activeFolderId ? <FolderOpenOutlinedIcon /> : <FolderOutlinedIcon />}</ListItemDecorator>
              <Box sx={{ flex: 1 }}>All Chats</Box>
            </ListItemButton>
          </ListItem>
        )}

        {/* Sortable folders */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={_dndModifiers}
        >
          <SortableContext
            items={folderIds}
            strategy={verticalListSortingStrategy}
          >

            {/* Folder Items */}
            {folders.map((folder) => (
              <FolderListItem
                key={folder.id}
                folder={folder}
                chatCount={folderChatCounts?.[folder.id] || 0}
                isActive={folder.id === activeFolderId}
                onFolderSelect={onFolderSelect}
              />
            ))}

          </SortableContext>
        </DndContext>

        {/* 'Add Folder' Button */}
        <AddFolderButton />

      </List>
    </Box>
  );
}
