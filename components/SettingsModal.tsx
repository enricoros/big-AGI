import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Grid, Input, Modal, ModalClose, ModalDialog, Slider, Stack, Typography } from '@mui/joy';

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
  // state
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // global state
  const { apiKey, setApiKey, modelTemperature, setModelTemperature, modelMaxTokens, setModelMaxTokens } = useSettingsStore(state => ({
    apiKey: state.apiKey, setApiKey: state.setApiKey,
    modelTemperature: state.modelTemperature, setModelTemperature: state.setModelTemperature,
    modelMaxTokens: state.modelMaxTokens, setModelMaxTokens: state.setModelMaxTokens,
  }), shallow);

  const handleApiKeyChange = (e: React.ChangeEvent) =>
    setApiKey((e.target as HTMLInputElement).value);

  const handleApiKeyDown = (e: React.KeyboardEvent) =>
    (e.key === 'Enter') && onClose();

  const handleTemperatureChange = (event: Event, newValue: number | number[]) => setModelTemperature(newValue as number);

  const handleMaxTokensChange = (event: Event, newValue: number | number[]) => setModelMaxTokens(newValue as number);

  const needsApiKey = !!process.env.REQUIRE_USER_API_KEYS;
  const isValidKey = isValidOpenAIApiKey(apiKey);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ minWidth: '35vw' }}>
        <ModalClose />
        <Typography level='h5'>Settings</Typography>

        <Box sx={{ mt: 3, minWidth: 320 }}>


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


          <Stack direction='row' sx={{ mt: 3, gap: 2, alignItems: 'center' }}>
            <Typography>
              Advanced AI settings
            </Typography>
            <Button variant='plain' color='neutral' onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? 'hide' : 'show'}
            </Button>
          </Stack>
          {showAdvanced && (
            <Grid container spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Grid xs={6} md={5} xl={4}>
                <Typography level='body2' sx={{ textAlign: 'right', mr: 1 }}>
                  Temperature
                </Typography>
              </Grid>
              <Grid xs={6} md={7} xl={8}>
                <Slider
                  aria-label='Model Temperature' color='neutral'
                  min={0} max={1} step={0.1} defaultValue={0.5}
                  value={modelTemperature} onChange={handleTemperatureChange}
                  valueLabelDisplay='auto'
                  sx={{ py: 1, mt: 1.1 }}
                />
              </Grid>

              <Grid xs={6} md={5} xl={4}>
                <Typography level='body2' sx={{ textAlign: 'right', mr: 1 }}>
                  Max. tokens
                </Typography>
              </Grid>
              <Grid xs={6} md={7} xl={8}>
                <Slider
                  aria-label='Model Temperature' color='neutral'
                  min={512} max={8192} step={512} defaultValue={2048}
                  value={modelMaxTokens} onChange={handleMaxTokensChange}
                  valueLabelDisplay='auto'
                  sx={{ py: 1, mt: 1.1 }}
                />
              </Grid>
            </Grid>
          )}
          <Typography level='body2' sx={{ mb: 1 }}>
            No need to change unless you know what they are
          </Typography>

          <Button variant='solid' color={isValidKey ? 'primary' : 'neutral'} sx={{ mt: 4 }} onClick={onClose}>
            Close
          </Button>

        </Box>

      </ModalDialog>
    </Modal>
  );
}