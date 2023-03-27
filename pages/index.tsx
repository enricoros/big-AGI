import * as React from 'react';

import { Container, useTheme } from '@mui/joy';

import { ChatArea } from '@/components/ChatArea';
import { isValidOpenAIApiKey, SettingsModal } from '@/components/SettingsModal';
import { useSettingsStore } from '@/lib/store';


export default function Home() {
  const theme = useTheme();

  const apiKey = useSettingsStore(state => state.apiKey);
  const [settingsShown, setSettingsShown] = React.useState(false);

  React.useEffect(() => {
    // show the settings at startup if the API key is not present
    if (!!process.env.REQUIRE_USER_API_KEYS && !isValidOpenAIApiKey(apiKey))
      setSettingsShown(true);
  }, [apiKey]);

  return (
    <Container maxWidth='xl' disableGutters sx={{
      boxShadow: theme.vars.shadow.lg,
    }}>

      <ChatArea onShowSettings={() => setSettingsShown(true)} />

      <SettingsModal open={settingsShown} onClose={() => setSettingsShown(false)} />

    </Container>
  );
}