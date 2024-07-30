import * as React from 'react';

import { Box, Container, ListDivider, Typography } from '@mui/joy';

import { OptimaPortalIn } from '~/common/layout/optima/portals/OptimaPortalIn';

import { Creator } from './creator/Creator';
import { CreatorDrawer } from './creator/CreatorDrawer';
import { Viewer } from './creator/Viewer';


export function AppPersonas() {

  // state
  const [selectedSimplePersonaId, setSelectedSimplePersonaId] = React.useState<string | null>(null);


  // pluggable UI

  const drawerContent = React.useMemo(() => {
    return (
      <CreatorDrawer
        selectedSimplePersonaId={selectedSimplePersonaId}
        setSelectedSimplePersonaId={setSelectedSimplePersonaId}
      />
    );
  }, [selectedSimplePersonaId]);

  return <>
    <OptimaPortalIn targetPortalId='optima-portal-drawer'>{drawerContent}</OptimaPortalIn>

    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',
      p: { xs: 3, md: 6 },
    }}>

      <Container disableGutters maxWidth='md' sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

        <Typography level='title-lg' sx={{ textAlign: 'center' }}>
          AI Personas Creator
        </Typography>

        <ListDivider sx={{ my: 2 }} />

        {!!selectedSimplePersonaId && <Viewer selectedSimplePersonaId={selectedSimplePersonaId} />}

        <Creator display={!selectedSimplePersonaId} />

      </Container>

    </Box>
  </>;
}