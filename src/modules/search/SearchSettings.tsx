import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, FormControl, FormHelperText, FormLabel, Input, Stack, Tooltip } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import SearchIcon from '@mui/icons-material/Search';

import { Section } from '@/common/components/Section';
import { settingsCol1Width, settingsGap } from '@/common/theme';
import { useSettingsStore } from '@/common/state/store-settings';

import { isValidGoogleCloudApiKey, isValidGoogleCseId, requireUserKeyGoogleCse } from './search.client';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Link } from '@/common/components/Link';


export function SearchSettings() {
  // external state
  const { googleCloudApiKey, setGoogleCloudApiKey, googleCSEId, setGoogleCSEId } = useSettingsStore(state => ({
    googleCloudApiKey: state.googleCloudApiKey, setGoogleCloudApiKey: state.setGoogleCloudApiKey,
    googleCSEId: state.googleCSEId, setGoogleCSEId: state.setGoogleCSEId,
  }), shallow);

  const requiresKeys = requireUserKeyGoogleCse;
  const isValidKey = googleCloudApiKey ? isValidGoogleCloudApiKey(googleCloudApiKey) : !requiresKeys;
  const isValidId = googleCSEId ? isValidGoogleCseId(googleCSEId) : !requiresKeys;

  const handleGoogleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleCloudApiKey(e.target.value);

  const handleCseIdChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleCSEId(e.target.value);

  return (
    <Section title='🔍 Google Search' collapsible collapsed disclaimer='EXPERIMENTAL. When configured, the UI will have the option to use Google to search for fresher websites' sx={{ mt: 2 }}>
      <Stack direction='column' sx={{ gap: settingsGap, mt: -0.8 }}>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Tooltip title='Create your Google Cloud "API Key Credential" and enter it here'>
              <FormLabel sx={{ minWidth: settingsCol1Width }}>
                Google Cloud API Key
              </FormLabel>
            </Tooltip>
            <FormHelperText>
              <Link href='https://console.cloud.google.com/apis/credentials' noLinkStyle target='_blank'>Create one here</Link>
            </FormHelperText>
          </Box>
          <Input
            variant='outlined' placeholder={requiresKeys ? 'missing' : '...'} error={!isValidKey}
            value={googleCloudApiKey} onChange={handleGoogleApiKeyChange}
            startDecorator={<KeyIcon />}
            slotProps={{ input: { sx: { width: '100%' } } }}
            sx={{ width: '100%' }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Tooltip title='Create your Google "Programmable Search Engine" and enter its ID here'>
              <FormLabel sx={{ minWidth: settingsCol1Width }}>
                Google CSE ID <InfoOutlinedIcon sx={{ mx: 0.5 }} />
              </FormLabel>
            </Tooltip>
            <FormHelperText>
              <Link href='https://programmablesearchengine.google.com/' noLinkStyle target='_blank'>Get it here</Link>
            </FormHelperText>
          </Box>
          <Input
            variant='outlined' placeholder={requiresKeys ? 'missing' : '...'} error={!isValidId}
            value={googleCSEId} onChange={handleCseIdChange}
            startDecorator={<SearchIcon />}
            slotProps={{ input: { sx: { width: '100%' } } }}
            sx={{ width: '100%' }}
          />
        </FormControl>

      </Stack>
    </Section>
  );
}