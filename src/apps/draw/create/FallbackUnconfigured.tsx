import * as React from 'react';

import { Button, Card, CardActions, CardContent, Typography } from '@mui/joy';

import { PreferencesTab, useOptimaLayout } from '~/common/layout/optima/useOptimaLayout';


export function FallbackUnconfigured() {

  // external state
  const { openPreferencesTab } = useOptimaLayout();

  const handleConfigureDrawing = () => openPreferencesTab(PreferencesTab.Draw);

  return (
    <Card variant='outlined' color='neutral' sx={{
      m: 'auto',
      boxShadow: 'sm',
      maxWidth: 'max(60%, 320px)',
    }}>
      <CardContent>
        <Typography>
          <strong>AI Text-to-Image</strong> does not seem available.<br />
          Please configure one service, such as an OpenAI LLM service, or the Prodia service.
        </Typography>
      </CardContent>
      <CardActions buttonFlex='0'>
        <Button color='danger' onClick={handleConfigureDrawing} sx={{ minWidth: '160px' }}>
          Configure
        </Button>
      </CardActions>
    </Card>
  );
}