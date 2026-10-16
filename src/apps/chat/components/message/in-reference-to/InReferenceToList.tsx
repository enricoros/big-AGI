import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { DMetaReferenceItem } from '~/common/stores/chat/chat.message';
import type { Immutable } from '~/common/types/immutable.types';

import { InReferenceToBubble } from './InReferenceToBubble';


const inReferenceToGroupSx: SxProps = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
};


export function InReferenceToList(props: { items: Immutable<DMetaReferenceItem[]> }) {
  return (
    <Box sx={inReferenceToGroupSx}>
      {props.items.map((item, index) => (
        <InReferenceToBubble
          key={'irt-' + index}
          item={item}
          bubbleVariant='message'
        />
      ))}
    </Box>
  );
}