import * as React from 'react';

import { Container, useTheme } from '@mui/joy';

import { ChatArea } from '@/components/ChatArea';
import { NoSSR } from '@/components/util/NoSSR';
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
    /**
     * Note the global NoSSR wrapper
     *  - Even the overall container could have hydration issues when using localStorage and non-default maxWidth
     */
    <NoSSR>

      <Container maxWidth='xl' disableGutters sx={{
        boxShadow: { xs: 'none', xl: theme.vars.shadow.lg },
      }}>

        <ChatArea onShowSettings={() => setSettingsShown(true)} />

        <SettingsModal open={settingsShown} onClose={() => setSettingsShown(false)} />

      </Container>

    </NoSSR>
  );
}