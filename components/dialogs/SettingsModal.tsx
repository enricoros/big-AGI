import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, FormControl, FormHelperText, FormLabel, IconButton, Input, Modal, ModalClose, ModalDialog, Slider, Stack, Switch, Typography } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

import { Link } from '@/components/util/Link';
import { useSettingsStore } from '@/lib/store-settings';


export const isValidOpenAIApiKey = (apiKey?: string) =>
  !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;


function Section(props: { title?: string; collapsible?: boolean, collapsed?: boolean, disclaimer?: string, children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(props.collapsed ?? false);

  return <>

    <Stack direction='row' sx={{ mt: (props.title ? 2 : 2), alignItems: 'center' }}>
      {!!props.title && (
        <Typography level='body2'>
          {props.title}
        </Typography>
      )}
      {!!props.collapsible && (
        <IconButton size='sm' variant='plain' color='neutral' onClick={() => setCollapsed(!collapsed)}>
          {!collapsed ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </IconButton>
      )}
    </Stack>

    {!collapsed && <Box sx={{ mt: 1, mb: 1 }}>
      {props.children}
    </Box>}

    {!!props.disclaimer && (
      <Typography level='body3' sx={{ mb: 1.5 }}>
        {props.disclaimer}
      </Typography>
    )}

  </>;
}

/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 *
 * @param {boolean} open Whether the Settings modal is open
 * @param {() => void} onClose Call this to close the dialog from outside
 */
export function SettingsModal({ open, onClose }: { open: boolean, onClose: () => void; }) {
  // external state
  const { renderMarkdown, setRenderMarkdown, apiKey, setApiKey, modelTemperature, setModelTemperature, modelMaxResponseTokens, setModelMaxResponseTokens, modelApiHost, setModelApiHost } = useSettingsStore(state => ({
    renderMarkdown: state.renderMarkdown, setRenderMarkdown: state.setRenderMarkdown,
    apiKey: state.apiKey, setApiKey: state.setApiKey,
    modelTemperature: state.modelTemperature, setModelTemperature: state.setModelTemperature,
    modelMaxResponseTokens: state.modelMaxResponseTokens, setModelMaxResponseTokens: state.setModelMaxResponseTokens,
    modelApiHost: state.modelApiHost, setModelApiHost: state.setModelApiHost,
  }), shallow);

  const handleApiKeyChange = (e: React.ChangeEvent) =>
    setApiKey((e.target as HTMLInputElement).value);

  const handleApiKeyDown = (e: React.KeyboardEvent) =>
    (e.key === 'Enter') && onClose();

  const handleTemperatureChange = (event: Event, newValue: number | number[]) => setModelTemperature(newValue as number);

  const handleMaxTokensChange = (event: Event, newValue: number | number[]) => setModelMaxResponseTokens(newValue as number);

  const handleModelApiHostChange = (e: React.ChangeEvent) => setModelApiHost((e.target as HTMLInputElement).value);

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const needsApiKey = !!process.env.REQUIRE_USER_API_KEYS;
  const isValidKey = isValidOpenAIApiKey(apiKey);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 500, display: 'flex' }}>
        <ModalClose />

        <Typography level='h5'>Settings</Typography>


        <Section>

          <FormControl>
            <FormLabel>
              OpenAI API Key {needsApiKey ? '' : '(optional)'}
            </FormLabel>
            <Input
              variant='outlined' type='password' placeholder={needsApiKey ? 'required' : 'sk-...'} error={needsApiKey && !isValidKey}
              value={apiKey} onChange={handleApiKeyChange} onKeyDown={handleApiKeyDown}
              startDecorator={<KeyIcon />}
            />
            <FormHelperText sx={{ display: 'block', lineHeight: 1.75 }}>
              {needsApiKey
                ? <><Link level='body2' href='https://platform.openai.com/account/api-keys' target='_blank'>Create Key</Link>, then apply to
                  the <Link level='body2' href='https://openai.com/waitlist/gpt-4-api' target='_blank'>GPT-4 waitlist</Link></>
                : `This key will take precedence over the server's.`} <Link level='body2' href='https://platform.openai.com/account/usage' target='_blank'>Check usage here</Link>.
            </FormHelperText>
          </FormControl>

        </Section>


        <Section title={'User Interface'}>
          <Stack direction='column' sx={{ gap: 2, maxWidth: 400 }}>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box>
                <FormLabel>Markdown</FormLabel>
                <FormHelperText>{renderMarkdown ? 'Best looks' : 'Raw text'}</FormHelperText>
              </Box>
              <Switch checked={renderMarkdown} onChange={handleRenderMarkdownChange}
                      endDecorator={renderMarkdown ? 'On' : 'Off'}
                      slotProps={{ endDecorator: { sx: { minWidth: 24 } } }} />
            </FormControl>

          </Stack>
        </Section>


        {/* Advanced Settings */}

        <Section title='Advanced AI settings' collapsible collapsed={true} disclaimer='Adjust only if you are familiar with these terms'>
          <Stack direction='column' sx={{ gap: 1, mt: -0.8, maxWidth: 400 }}>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 140 }}>
                <FormLabel>Temperature</FormLabel>
                <FormHelperText>Creative freedom</FormHelperText>
              </Box>
              <Slider
                aria-label='Model Temperature' color='neutral'
                min={0} max={1} step={0.1} defaultValue={0.5}
                value={modelTemperature} onChange={handleTemperatureChange}
                valueLabelDisplay='auto'
                sx={{ py: 1, mt: 1.1 }}
              />
            </FormControl>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 140 }}>
                <FormLabel>Max-Tokens</FormLabel>
                <FormHelperText>Response length</FormHelperText>
              </Box>
              <Slider
                aria-label='Model Temperature' color='neutral'
                min={512} max={8192} step={512} defaultValue={2048}
                value={modelMaxResponseTokens} onChange={handleMaxTokensChange}
                valueLabelDisplay='auto'
                sx={{ py: 1, mt: 1.1 }}
              />
            </FormControl>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 140 }}>
                <FormLabel>
                  API host
                  {/*<Tooltip title='Change API host for compatibility with services like Helicone' variant='solid'>*/}
                  {/*  <InfoIcon sx={{ ml: 1, cursor: 'pointer' }} />*/}
                  {/*</Tooltip>*/}
                </FormLabel>
                <FormHelperText sx={{ display: 'block' }}>
                  E.g. for <Link level='body2' href='https://www.helicone.ai' target='_blank'>Helicone</Link>
                </FormHelperText>
              </Box>
              <Input
                variant='outlined' placeholder='api.openai.com'
                value={modelApiHost} onChange={handleModelApiHostChange}
                sx={{ flexGrow: 1 }}
              />
            </FormControl>

          </Stack>
        </Section>

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant='solid' color={isValidKey ? 'primary' : 'neutral'} onClick={onClose}>
            Close
          </Button>
        </Box>

      </ModalDialog>
    </Modal>
  );
}