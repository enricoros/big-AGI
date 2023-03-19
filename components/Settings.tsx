import * as React from 'react';
import { Box, Button, Input, Modal, ModalClose, ModalDialog, Typography } from '@mui/joy';


/// localStorage (your browser) : API Key

const LOCALSTORAGE_KEY_OPENAI_API_KEY = 'app-settings-openai-api-key';

export const loadOpenAIApiKey = (): string => {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(LOCALSTORAGE_KEY_OPENAI_API_KEY) || '';
};

const storeOpenAIApiKey = (apiKey: string) => {
  if (typeof localStorage === 'undefined') return;
  if (apiKey) localStorage.setItem(LOCALSTORAGE_KEY_OPENAI_API_KEY, apiKey);
  else localStorage.removeItem(LOCALSTORAGE_KEY_OPENAI_API_KEY);
};

export const isValidOpenAIApiKey = (apiKey?: string) =>
  apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;


/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 *
 * @param {boolean} open Whether the Settings modal is open
 * @param {() => void} onClose Call this to close the dialog from outside
 */
export function Settings({ open, onClose }: { open: boolean, onClose: () => void; }) {
  const [apiKey, setApiKey] = React.useState(loadOpenAIApiKey());

  const handleApiKeyChange = (e: React.ChangeEvent) =>
    setApiKey((e.target as HTMLInputElement).value);

  const handleApiKeyDown = (e: React.KeyboardEvent) =>
    (e.key === 'Enter') && handleSaveClicked();

  const handleSaveClicked = () => {
    storeOpenAIApiKey(apiKey);
    onClose();
  };

  const isValidKey = isValidOpenAIApiKey(apiKey);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ minWidth: '40vw' }}>
        <ModalClose />
        <Typography level='h5'>Settings</Typography>

        <Box sx={{ mt: 2, minWidth: 300 }}>

          <Typography sx={{ mb: 1 }}>
            Enter OpenAI API Key (required)
          </Typography>

          <Input variant='outlined' placeholder={'sk-...'} error={!isValidKey}
                 value={apiKey} onChange={handleApiKeyChange} onKeyDown={handleApiKeyDown} />

          <Button variant='solid' color={isValidKey ? 'primary' : 'neutral'} sx={{ mt: 2 }} onClick={handleSaveClicked}>
            Save
          </Button>

        </Box>

      </ModalDialog>
    </Modal>
  );
}