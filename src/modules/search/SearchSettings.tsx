import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, FormControl, FormHelperText, FormLabel, Input, Stack } from '@mui/joy';
import SearchIcon from '@mui/icons-material/Search';
import KeyIcon from '@mui/icons-material/Key';

import { Section } from '@/common/components/Section';
import { settingsGap } from '@/common/theme';
import { useSettingsStore } from '@/common/state/store-settings';

import { Search } from './search.types';
import { isValidGoogleApiKey, isValidCseId, requireUserKeyGoogleApi, requireUserKeyCseId } from './search.client';


export function SearchSettings() {
  // external state
  const { googleApiKey, setGoogleApiKey, cseId, setCseId } = useSettingsStore(state => ({
    googleApiKey: state.googleApiKey, setGoogleApiKey: state.setGoogleApiKey,
    cseId: state.cseId, setCseId: state.setCseId,
  }), shallow);

  const requiresGoogleApiKey = requireUserKeyGoogleApi;
  const requiresCseId = requireUserKeyCseId;
  const isValidKey = googleApiKey ? isValidGoogleApiKey(googleApiKey) : !requiresGoogleApiKey;
  const isValidId = cseId ? isValidCseId(cseId) : !requiresCseId;

  const handleGoogleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleApiKey(e.target.value);
  const handleCseIdChange = (e: React.ChangeEvent<HTMLInputElement>) => setCseId(e.target.value);

  const colWidth = 150;

  return (
    <Section title='🔍 Search' collapsible collapsed sx={{ mt: 2 }}>
      <Stack direction='column' sx={{ gap: settingsGap, mt: -0.8 }}>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <FormLabel sx={{ minWidth: colWidth }}>
              Google API Key
            </FormLabel>
            <FormHelperText>
              {requiresGoogleApiKey ? '(required)' : '(optional)'}
            </FormHelperText>
          </Box>
          <Input
            variant='outlined' placeholder={requiresGoogleApiKey ? 'required' : '...'} error={!isValidKey}
            value={googleApiKey} onChange={handleGoogleApiKeyChange}
            startDecorator={<KeyIcon />}
            slotProps={{ input: { sx: { width: '100%' } } }}
            sx={{ width: '100%' }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <FormLabel sx={{ minWidth: colWidth }}>
              CSE ID
            </FormLabel>
            <FormHelperText>
              {requiresCseId ? '(required)' : '(optional)'}
            </FormHelperText>
          </Box>
          <Input
            variant='outlined' placeholder={requiresCseId ? 'required' : '...'} error={!isValidId}
            value={cseId} onChange={handleCseIdChange}
            startDecorator={<SearchIcon />}
            slotProps={{ input: { sx: { width: '100%' } } }}
            sx={{ width: '100%' }}
          />
        </FormControl>

      </Stack>
    </Section>
  );
}