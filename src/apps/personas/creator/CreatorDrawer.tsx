import * as React from 'react';

import { Box, ListItemButton, ListItemDecorator, Typography } from '@mui/joy';
import Diversity2Icon from '@mui/icons-material/Diversity2';

import { PageDrawerList } from '~/common/layout/optima/components/PageDrawerList';

import { CreatorDrawerItem } from './CreatorDrawerItem';
import { deleteSimplePersona, useSimplePersonas } from '../store-app-personas';


export function CreatorDrawer(props: {
  selectedSimplePersonaId: string | null,
  setSelectedSimplePersonaId: (simplePersonaId: string | null) => void,
}) {

  // external state
  const { simplePersonas } = useSimplePersonas();


  const { setSelectedSimplePersonaId } = props;
  const handleDeselect = React.useCallback(() => {
    setSelectedSimplePersonaId(null);
  }, [setSelectedSimplePersonaId]);


  const handleSimplePersonaDelete = React.useCallback((simplePersonaId: string) => {
    deleteSimplePersona(simplePersonaId);
    handleDeselect();
  }, [handleDeselect]);

  return <>

    <PageDrawerList
      variant='plain'
      noTopPadding noBottomPadding tallRows
      onClick={handleDeselect}
    >

      {/* Create Button */}
      <ListItemButton
        variant={props.selectedSimplePersonaId ? 'plain' : 'soft'}
        onClick={handleDeselect}
      >
        <ListItemDecorator>
          <Diversity2Icon />
        </ListItemDecorator>
        <Typography level='title-sm' sx={!props.selectedSimplePersonaId ? { fontWeight: 600 } : undefined}>
          Create
        </Typography>
      </ListItemButton>

      {/* Personas [] */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {simplePersonas.map(item =>
          <CreatorDrawerItem
            key={item.id}
            item={item}
            isActive={item.id === props.selectedSimplePersonaId}
            onClick={(event) => {
              event.stopPropagation();
              props.setSelectedSimplePersonaId(item.id);
            }}
            onDelete={handleSimplePersonaDelete}
          />,
        )}
      </Box>

    </PageDrawerList>

  </>;
}