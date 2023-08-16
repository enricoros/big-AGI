import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Card, CardContent, Container, Switch, Typography } from '@mui/joy';
import ScienceIcon from '@mui/icons-material/Science';

import { Link } from '~/common/components/Link';
import { useUIPreferencesStore } from '~/common/state/store-ui';


export function AppLabs() {

  // external state
  const { experimentalLabs, setExperimentalLabs } = useUIPreferencesStore(state => ({
    experimentalLabs: state.experimentalLabs, setExperimentalLabs: state.setExperimentalLabs,
  }), shallow);

  const handleLabsChange = (event: React.ChangeEvent<HTMLInputElement>) => setExperimentalLabs(event.target.checked);

  return (

    <Box sx={{
      backgroundColor: 'background.level1',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flexGrow: 1,
      overflowY: 'auto',
      minHeight: 96,
      p: { xs: 3, md: 6 },
      gap: 4,
    }}>

      <Typography level='h1' sx={{ fontSize: '3.6rem' }}>
        Labs <ScienceIcon sx={{ fontSize: '3.3rem' }} />
      </Typography>

      <Switch checked={experimentalLabs} onChange={handleLabsChange}
              endDecorator={experimentalLabs ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />

      <Container disableGutters maxWidth='sm'>
        <Card>
          <CardContent>
            <Typography>
              The Labs section is where we experiment with new features and ideas.
            </Typography>
            <Typography level='title-md' sx={{ mt: 2 }}>
              Features {experimentalLabs ? 'enabled' : 'disabled'}:
            </Typography>
            <ul style={{ marginTop: 8, marginBottom: 8, paddingInlineStart: 32 }}>
              <li><b>YouTube persona synthesizer</b> - 90% complete</li>
              <li><b>Chat mode: Follow-up augmentation</b> - almost done</li>
              <li><b>Relative chats size</b> - complete</li>
            </ul>
            <Typography sx={{ mt: 2 }}>
              For any questions and creative idea, please join us on Discord, and let&apos;s talk!
            </Typography>
          </CardContent>
        </Card>
      </Container>

      <Button variant='solid' color='neutral' size='lg' component={Link} href='/' noLinkStyle>
        Got it!
      </Button>

    </Box>
  );
}