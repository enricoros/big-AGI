import * as React from 'react';

import { Button, Card, CardActions, CardContent, Typography } from '@mui/joy';

import { PreferencesTab, useOptimaLayout } from '~/common/layout/optima/useOptimaLayout';


export function DrawUnconfigured() {

  // external state
  const { openPreferencesTab } = useOptimaLayout();

  const handleConfigure = () => openPreferencesTab(PreferencesTab.Draw);

  return (
    <Card variant='outlined' color='warning'>
      <CardContent>
        <Typography>
          <strong>Text-to-Image</strong> does not seem available.
          Please configure one service, such as an OpenAI LLM service, or the Prodia service.
        </Typography>
      </CardContent>
      <CardActions buttonFlex='0'>
        <Button onClick={handleConfigure} sx={{ minWidth: '160px' }}>
          Configure
        </Button>
      </CardActions>
    </Card>
  );
}