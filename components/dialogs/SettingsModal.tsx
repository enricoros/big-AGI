import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, FormControl, FormHelperText, FormLabel, IconButton, Input, Modal, ModalClose, ModalDialog, ModalOverflow, Radio, RadioGroup, Slider, Stack, Switch, Typography } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { Link } from '@/components/util/Link';
import { useSettingsStore } from '@/lib/store-settings';


export const isValidOpenAIApiKey = (apiKey?: string) =>
  !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;


export function Section(props: { title?: string; collapsible?: boolean, collapsed?: boolean, disclaimer?: string, children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(props.collapsed ?? false);

  return <>

    <Stack direction='row' sx={{ mt: (props.title ? 1 : 0), alignItems: 'center' }}>
      {!!props.title && (
        <FormLabel>
          {props.title}
        </FormLabel>
      )}
      {!!props.collapsible && (
        <IconButton size='sm' variant='plain' color='neutral' onClick={() => setCollapsed(!collapsed)}>
          {!collapsed ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </IconButton>
      )}
    </Stack>

    {!collapsed && <Box sx={{ mt: 1.5, mb: 1.5 }}>
      {props.children}
    </Box>}

    {!!props.disclaimer && (
      <FormHelperText>
        {props.disclaimer}
      </FormHelperText>
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
  const {
    centerMode, setCenterMode,
    renderMarkdown, setRenderMarkdown,
    showPurposeFinder, setShowPurposeFinder,
    zenMode, setZenMode,
    apiKey, setApiKey,
    apiHost, setApiHost,
    apiOrganizationId, setApiOrganizationId,
    modelTemperature, setModelTemperature,
    modelMaxResponseTokens,
    setModelMaxResponseTokens,
  } = useSettingsStore(state => state, shallow);

  const handleCenterModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setCenterMode(event.target.value as 'narrow' | 'wide' | 'full' || 'wide');

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const handleShowSearchBarChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowPurposeFinder(event.target.checked);

  const handleZenModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setZenMode(event.target.value as 'clean' | 'cleaner');

  const handleApiKeyChange = (e: React.ChangeEvent) => setApiKey((e.target as HTMLInputElement).value);

  const handleApiKeyDown = (e: React.KeyboardEvent) => (e.key === 'Enter') && onClose();

  const handleApiHostChange = (e: React.ChangeEvent) => setApiHost((e.target as HTMLInputElement).value);

  const handleApiOrganizationIdChange = (e: React.ChangeEvent) => setApiOrganizationId((e.target as HTMLInputElement).value);

  const handleTemperatureChange = (event: Event, newValue: number | number[]) => setModelTemperature(newValue as number);

  const handleMaxTokensChange = (event: Event, newValue: number | number[]) => setModelMaxResponseTokens(newValue as number);

  const needsApiKey = !!process.env.REQUIRE_USER_API_KEYS;
  const isValidKey = isValidOpenAIApiKey(apiKey);

  const hideOnMobile = { display: { xs: 'none', md: 'flex' } };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalOverflow><ModalDialog sx={{ maxWidth: 500, display: 'flex', p: { xs: 1, sm: 2, lg: '20px' } }}>
        <ModalClose />

        <Typography level='h5' sx={{ mb: 2 }}>Settings</Typography>


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


        <Section>
          <Stack direction='column' sx={{ gap: 3, maxWidth: 400 }}>

            <FormControl orientation='horizontal' sx={{ ...hideOnMobile, alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <FormLabel>Centering</FormLabel>
                <FormHelperText>{centerMode === 'full' ? 'Full screen' : centerMode === 'narrow' ? 'Narrow' : 'Wide'} chat</FormHelperText>
              </Box>
              <RadioGroup orientation='horizontal' value={centerMode} onChange={handleCenterModeChange}>
                <Radio value='narrow' label={<WidthNormalIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
                <Radio value='wide' label={<WidthWideIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
                <Radio value='full' label='Full' />
              </RadioGroup>
            </FormControl>

            <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <FormLabel>Visual Clutter</FormLabel>
                <FormHelperText>{zenMode === 'clean' ? 'Show senders' : 'Hide sender and menus'}</FormHelperText>
              </Box>
              <RadioGroup orientation='horizontal' value={zenMode} onChange={handleZenModeChange}>
                {/*<Radio value='clean' label={<Face6Icon sx={{ width: 24, height: 24, mt: -0.25 }} />} />*/}
                <Radio value='clean' label='Clean' />
                <Radio value='cleaner' label='Empty' />
              </RadioGroup>
            </FormControl>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box>
                <FormLabel>Markdown</FormLabel>
                <FormHelperText>{renderMarkdown ? 'Render markdown' : 'Text only'}</FormHelperText>
              </Box>
              <Switch checked={renderMarkdown} onChange={handleRenderMarkdownChange}
                      endDecorator={renderMarkdown ? 'On' : 'Off'}
                      slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
            </FormControl>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box>
                <FormLabel>Purpose Finder</FormLabel>
                <FormHelperText>{showPurposeFinder ? 'Show search bar' : 'Hide search bar'}</FormHelperText>
              </Box>
              <Switch checked={showPurposeFinder} onChange={handleShowSearchBarChange}
                      endDecorator={showPurposeFinder ? 'On' : 'Off'}
                      slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
            </FormControl>

          </Stack>
        </Section>


        {/* Advanced Settings */}

        <Section title='Advanced AI settings' collapsible collapsed={true} disclaimer='Adjust only if you are familiar with these terms'>
          <Stack direction='column' sx={{ gap: 3, mt: -0.8, maxWidth: 400 }}>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 130 }}>
                <FormLabel>Temperature</FormLabel>
                <FormHelperText>{modelTemperature < 0.33 ? 'More strict' : modelTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}</FormHelperText>
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
              <Box sx={{ minWidth: 130 }}>
                <FormLabel>Max Tokens</FormLabel>
                <FormHelperText>Response size</FormHelperText>
              </Box>
              <Slider
                aria-label='Model Max Tokens' color='neutral'
                min={256} max={4096} step={256} defaultValue={1024}
                value={modelMaxResponseTokens} onChange={handleMaxTokensChange}
                valueLabelDisplay='auto'
                sx={{ py: 1, mt: 1.1 }}
              />
            </FormControl>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 130 }}>
                <FormLabel>
                  API Host
                  {/*<Tooltip title='Change API host for compatibility with services like Helicone' variant='solid'>*/}
                  {/*  <InfoIcon sx={{ ml: 1, cursor: 'pointer' }} />*/}
                  {/*</Tooltip>*/}
                </FormLabel>
                <FormHelperText sx={{ display: 'block' }}>
                  For <Link level='body2' href='https://www.helicone.ai' target='_blank'>Helicone</Link>
                </FormHelperText>
              </Box>
              <Input
                variant='outlined' placeholder='api.openai.com'
                value={apiHost} onChange={handleApiHostChange}
                sx={{ flexGrow: 1 }}
              />
            </FormControl>

            <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 130 }}>
                <FormLabel>
                  Organization ID
                </FormLabel>
                <FormHelperText sx={{ display: 'block' }}>
                  <Link level='body2' href='https://github.com/enricoros/nextjs-chatgpt-app/issues/63' target='_blank'>What is this</Link>
                </FormHelperText>
              </Box>
              <Input
                variant='outlined' placeholder='Optional, for org users'
                value={apiOrganizationId} onChange={handleApiOrganizationIdChange}
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

      </ModalDialog></ModalOverflow>
    </Modal>
  );
}