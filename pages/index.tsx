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
      boxShadow: { xs: 'none', xl: theme.vars.shadow.lg },
    }}>

      {/*`Sidebar`: A component to display the list of conversations and allow users to switch between them.*/}
      {/*- `ConversationList`: A component to display the list of conversations.*/}
      {/*- `ConversationListItem`: A component to display a single conversation with its details (e.g., name, last message, etc.).*/}

      <ChatArea onShowSettings={() => setSettingsShown(true)} />

      <SettingsModal open={settingsShown} onClose={() => setSettingsShown(false)} />

    </Container>
  );
}