import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Input, Modal, ModalClose, ModalDialog, Option, Select, Typography } from '@mui/joy';

import { Link } from './Link';
import { useSettingsStore } from '../utilities/store';
import { NoSSR } from './NoSSR';


/// ChatGptModel configuration

export type GptChatModel = 'gpt-4' | 'gpt-3.5-turbo';

export const ChatGptModelData: { [key in GptChatModel]: { description: string | JSX.Element, title: string } } = {
  'gpt-4': {
    description: 'Most insightful, larger problems, but slow, expensive, and may be unavailable',
    title: 'GPT-4',
  },
  'gpt-3.5-turbo': {
    description: 'A good balance between speed and insight',
    title: '3.5-Turbo',
  },
};


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
  !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;


/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 *
 * @param {boolean} open Whether the Settings modal is open
 * @param {() => void} onClose Call this to close the dialog from outside
 */
export function Settings({ open, onClose }: { open: boolean, onClose: () => void; }) {
  const [apiKey, setApiKey] = React.useState<string>(loadOpenAIApiKey());
  const { chatModel, setChatModel } = useSettingsStore(state => ({ chatModel: state.chatModel, setChatModel: state.setChatModel }), shallow);

  const handleApiKeyChange = (e: React.ChangeEvent) =>
    setApiKey((e.target as HTMLInputElement).value);

  const handleGptModelChange = (e: React.FocusEvent | React.MouseEvent | React.KeyboardEvent | null, value: string | null) =>
    setChatModel((value || 'gpt-4') as GptChatModel);

  const handleApiKeyDown = (e: React.KeyboardEvent) =>
    (e.key === 'Enter') && handleSaveClicked();

  const handleSaveClicked = () => {
    storeOpenAIApiKey(apiKey);
    onClose();
  };

  const needsApiKey = !!process.env.REQUIRE_USER_API_KEYS;
  const isValidKey = isValidOpenAIApiKey(apiKey);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ minWidth: '40vw' }}>
        <ModalClose />
        <Typography level='h5'>Settings</Typography>

        <Box sx={{ mt: 3, minWidth: 300 }}>

          <Typography sx={{ mb: 1 }}>
            Enter <Link href='https://platform.openai.com/account/api-keys'>OpenAI API Key</Link> {needsApiKey ? '(required)' : '(not required)'}
          </Typography>

          <Input variant='outlined' placeholder={'sk-...'} error={needsApiKey && !isValidKey}
                 value={apiKey} onChange={handleApiKeyChange} onKeyDown={handleApiKeyDown} />

          {!needsApiKey && (
            <Typography level='body2' sx={{ mt: 1, mb: 1 }}>
              This box lets you override the default API key
            </Typography>
          )}

          <Typography sx={{ mt: 3, mb: 1 }}>
            Select Model
          </Typography>

          <NoSSR>
            <Select
              variant='outlined'
              value={chatModel}
              onChange={handleGptModelChange}
            >
              <Option value={'gpt-4'}>GPT-4</Option>
              <Option value={'gpt-3.5-turbo'}>GPT-3.5 Turbo</Option>
              {/*<Option value={'gpt-4-32k'}>GPT-4-32k (not out yet)</Option>*/}
            </Select>

            {(chatModel in ChatGptModelData) && (
              <Typography level='body2' sx={{ mt: 1, mb: 1 }}>
                {ChatGptModelData[chatModel].description}
              </Typography>
            )}
          </NoSSR>

          <Button variant='solid' color={isValidKey ? 'primary' : 'neutral'} sx={{ mt: 3 }} onClick={handleSaveClicked}>
            Save
          </Button>

        </Box>

      </ModalDialog>
    </Modal>
  );
}