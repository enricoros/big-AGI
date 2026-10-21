import * as React from 'react';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { closestCenter, DndContext, DragEndEvent } from '@dnd-kit/core';

import type { MuiCancellableEvent } from '@mui/base/utils/MuiCancellableEvent';
import { Box, Button, Checkbox, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined';
import Face6Icon from '@mui/icons-material/Face6';

import { dndDragEndReorder } from '~/common/components/dnd/dndDragEndReorder';
import { dndModifiersParentVertical } from '~/common/components/dnd/dnd.config';
import { useDndDefaultSensors } from '~/common/components/dnd/useDndDefaultSensors';
import { useDndDragHandleSortable } from '~/common/components/dnd/useDndDragHandleSortable';

import { normalizeUserFragmentGroupsOrder, USER_MESSAGE_ATTACHMENTS_MARKER, UserMessageFragmentGroup } from '~/common/stores/chat/chat.fragment-order';

import { setUserMessageAttachmentsMarker, setUserMessageFragmentOrder, useUserMessageFragmentPlacement } from '../../../store-app-chat';


const _GROUPS = {
  images: { label: 'Images', description: 'Images, video, and live frames', Icon: InsertPhotoOutlinedIcon },
  documents: { label: 'Documents', description: 'Files and pasted documents', Icon: DescriptionOutlinedIcon },
  text: { label: 'Prompt', description: 'What you type', Icon: Face6Icon, isUser: true },
} as const satisfies Record<UserMessageFragmentGroup, { label: string, description: string, Icon?: React.ElementType, isUser?: true }>;

// Rows span the menu item width and reuse the menu's ListItem vars, so icons and labels line up with the items below
const _styles = {
  block: {
    px: 0.5,
    pb: 0.75,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    minHeight: '2rem',
    mb: 0.5,
    pl: 1,
  },
  reset: {
    minHeight: 0,
    px: 'var(--ListItem-paddingX)',
    fontSize: 'xs',
    fontWeight: 'md',
  },
  list: {
    display: 'grid',
    gap: 0.5,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--ListItem-gap)',
    minHeight: 'var(--ListItem-minHeight)',
    pl: 'calc(var(--ListItem-paddingX) - 1px)', // minus the border
    pr: '1px', // keeps the handle close to the right edge
    border: '1px solid',
    borderColor: 'neutral.outlinedBorder',
    borderRadius: 'sm',
    backgroundColor: 'background.surface',
    fontSize: 'sm',
    boxShadow: 'inset 1px 1px 4px -2px rgba(0, 0, 0, 0.2)',
    '&[data-group="text"]': {
      '--Icon-color': 'var(--joy-palette-primary-softColor)',
      backgroundColor: 'primary.softBg'
    },
    '&:has([aria-pressed="true"])': {
      boxShadow: 'md',
    }, // lift while dragged: dnd-kit marks the handle pressed
    transition: 'margin-left 0.12s ease',
    '&[data-inner="true"]': {
      ml: 1,
    },
  },
  rowLabel: {
    flex: 1,
  },
  markerSymbol: {
    fontFamily: 'code',
    fontSize: 'xs',
  },
} as const;


function SortableGroupRow(props: { group: UserMessageFragmentGroup, inner: boolean }) {

  // external state
  const { dragContainerSetRef, dragContainerStyle, dragHandle } = useDndDragHandleSortable(props.group, false);

  // derived
  const { group, inner } = props;
  const { label, Icon } = _GROUPS[group];

  return (
    <Box ref={dragContainerSetRef} data-group={group} data-inner={inner} sx={_styles.row} style={dragContainerStyle}>
      <ListItemDecorator>{!Icon ? undefined : <Icon />}</ListItemDecorator>
      <Box sx={_styles.rowLabel}>{label}</Box>
      {dragHandle}
    </Box>
  );
}


/** Shared by composer attachment menus, including live-image-only inputs. */
export function MessageFragmentOrderControl() {

  // external state
  const sensors = useDndDefaultSensors();
  const { order: userMessageFragmentOrder, splitAtMarker } = useUserMessageFragmentPlacement();

  // memo normalized
  const order = React.useMemo(() => {
    return normalizeUserFragmentGroupsOrder(userMessageFragmentOrder);
  }, [userMessageFragmentOrder]);


  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    dndDragEndReorder(event, order, ids => setUserMessageFragmentOrder(normalizeUserFragmentGroupsOrder(ids)));
  }, [order]);

  const handleReset = React.useCallback(() => {
    setUserMessageFragmentOrder(undefined);
    setUserMessageAttachmentsMarker(false);
  }, []);


  return <>
    <Box
      role='group'
      onKeyDown={(event: React.KeyboardEvent & MuiCancellableEvent) => {
        // Keyboard drag (dnd-kit marks the handle pressed): its keys must reach dnd-kit's document listener, so only opt the menu out
        if (event.target instanceof Element && event.target.getAttribute('aria-pressed') === 'true')
          event.defaultMuiPrevented = true;
        // Otherwise Space/Enter/arrows/typeahead stay here; only Escape belongs to the enclosing menu
        else if (event.key !== 'Escape')
          event.stopPropagation();
      }}
      sx={_styles.block}
    >
      <Box sx={_styles.header}>
        <Typography level='title-sm' flex={1}>Attachment order</Typography>
        {(!!userMessageFragmentOrder || splitAtMarker) && (
          <Button size='sm' variant='plain' color='neutral' onClick={handleReset} sx={_styles.reset}>
            Reset
          </Button>
        )}
      </Box>

      <Box sx={_styles.list}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={dndModifiersParentVertical} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            {order.map(group => <SortableGroupRow key={group} group={group} inner={splitAtMarker && group !== 'text'} />)}
          </SortableContext>
        </DndContext>
      </Box>

    </Box>

    {/* Not extra good looking but not bad either */}
    {/*<ListDivider />*/}

    {/* The marker overrides the order: the prompt splits around the attachments. Checkbox in the decorator, as AttachmentDraftMenu */}
    <MenuItem onClick={() => setUserMessageAttachmentsMarker(!splitAtMarker)} sx={{ mx: 0.375, mt: 1 }}>
      <ListItemDecorator><Checkbox color='neutral' variant={splitAtMarker ? 'plain' : 'outlined'} checked={splitAtMarker} /></ListItemDecorator>
      <Box sx={{ fontSize: 'sm' }}>Place at <Box component='span' sx={_styles.markerSymbol}>{USER_MESSAGE_ATTACHMENTS_MARKER}</Box> in prompt</Box>
    </MenuItem>
  </>;
}
