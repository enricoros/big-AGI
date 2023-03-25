import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Input, Modal, ModalClose, ModalDialog, Option, Select, Typography } from '@mui/joy';

import { GptChatModelId, GptChatModels, useSettingsStore } from '../utilities/store';
import { Link } from './util/Link';
import { NoSSR } from './util/NoSSR';


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
  const { apiKey, setApiKey, chatModelId, setChatModelId } = useSettingsStore(state => ({
    apiKey: state.apiKey, setApiKey: state.setApiKey,
    chatModelId: state.chatModelId, setChatModelId: state.setChatModelId,
  }), shallow);

  const handleApiKeyChange = (e: React.ChangeEvent) =>
    setApiKey((e.target as HTMLInputElement).value);

  const handleGptModelChange = (e: React.FocusEvent | React.MouseEvent | React.KeyboardEvent | null, value: string | null) =>
    setChatModelId((value || 'gpt-4') as GptChatModelId);

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
              value={chatModelId}
              onChange={handleGptModelChange}
            >
              <Option value={'gpt-4'}>GPT-4</Option>
              <Option value={'gpt-3.5-turbo'}>GPT-3.5 Turbo</Option>
              {/*<Option value={'gpt-4-32k'}>GPT-4-32k (not out yet)</Option>*/}
            </Select>

            {(chatModelId in GptChatModels) && (
              <Typography level='body2' sx={{ mt: 1, mb: 1 }}>
                {GptChatModels[chatModelId].description}
              </Typography>
            )}
          </NoSSR>

          <Button variant='solid' color={isValidKey ? 'primary' : 'neutral'} sx={{ mt: 3 }} onClick={onClose}>
            Close
          </Button>

        </Box>

      </ModalDialog>
    </Modal>
  );
}