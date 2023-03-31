import * as React from 'react';

import { Container, useTheme } from '@mui/joy';

import { Chat } from '@/components/Chat';
import { NoSSR } from '@/components/util/NoSSR';
import { isValidOpenAIApiKey, SettingsModal } from '@/components/SettingsModal';
import { useSettingsStore } from '@/lib/store';


export default function Home() {
  // state
  const [settingsShown, setSettingsShown] = React.useState(false);

  // external state
  const theme = useTheme();
  const apiKey = useSettingsStore(state => state.apiKey);
  const wideMode = useSettingsStore(state => state.wideMode);


  // show the Settings Dialog at startup if the API key is required but not set
  React.useEffect(() => {
    if (!!process.env.REQUIRE_USER_API_KEYS && !isValidOpenAIApiKey(apiKey))
      setSettingsShown(true);
  }, [apiKey]);


  return (
    /**
     * Note the global NoSSR wrapper
     *  - Even the overall container could have hydration issues when using localStorage and non-default maxWidth
     */
    <NoSSR>

      <Container maxWidth={wideMode ? false : 'xl'} disableGutters sx={{
        boxShadow: { xs: 'none', xl: wideMode ? 'none' : theme.vars.shadow.lg },
      }}>

        <Chat onShowSettings={() => setSettingsShown(true)} />

        <SettingsModal open={settingsShown} onClose={() => setSettingsShown(false)} />

      </Container>

    </NoSSR>
  );
}