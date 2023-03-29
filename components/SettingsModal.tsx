import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Input, Modal, ModalClose, ModalDialog, Typography } from '@mui/joy';

import { Link } from './util/Link';
import { useSettingsStore } from '@/lib/store';


export const isValidOpenAIApiKey = (apiKey?: string) =>
  !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;


/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 *
 * @param {boolean} open Whether the Settings modal is open
 * @param {() => void} onClose Call this to close the dialog from outside
 */
export function SettingsModal({ open, onClose }: { open: boolean, onClose: () => void; }) {
  const { apiKey, setApiKey } = useSettingsStore(state => ({
    apiKey: state.apiKey, setApiKey: state.setApiKey,
  }), shallow);

  const handleApiKeyChange = (e: React.ChangeEvent) =>
    setApiKey((e.target as HTMLInputElement).value);

  const handleApiKeyDown = (e: React.KeyboardEvent) =>
    (e.key === 'Enter') && onClose();

  const needsApiKey = !!process.env.REQUIRE_USER_API_KEYS;
  const isValidKey = isValidOpenAIApiKey(apiKey);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ minWidth: '40vw' }}>
        <ModalClose />
        <Typography level='h5'>Settings</Typography>

        <Box sx={{ mt: 3, minWidth: 300 }}>

          <Typography level='body1' sx={{ mb: 1 }}>
            Personal <Link href='https://platform.openai.com/account/api-keys'>OpenAI API Key</Link> {needsApiKey ? '(required)' : '(not required)'}
          </Typography>

          <Input variant='outlined' placeholder={'sk-...'} error={needsApiKey && !isValidKey}
                 value={apiKey} onChange={handleApiKeyChange} onKeyDown={handleApiKeyDown} />

          {!needsApiKey && (
            <Typography level='body2' sx={{ mt: 1, mb: 1 }}>
              This box lets you override the default API key
            </Typography>
          )}

          <Button variant='solid' color={isValidKey ? 'primary' : 'neutral'} sx={{ mt: 3 }} onClick={onClose}>
            Close
          </Button>

        </Box>

      </ModalDialog>
    </Modal>
  );
}