import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, FormControl, Input, Stack, Typography } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import SearchIcon from '@mui/icons-material/Search';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { backendCaps } from '~/modules/backend/state-backend';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { Link } from '~/common/components/Link';
import { settingsGap } from '~/common/app.theme';

import { isValidGoogleCloudApiKey, isValidGoogleCseId } from './search.client';
import { useGoogleSearchStore } from './store-google';


export function GoogleSearchSettings() {

  // external state
  const backendHasGoogle = backendCaps().hasGoogleCustomSearch;
  const { googleCloudApiKey, setGoogleCloudApiKey, googleCSEId, setGoogleCSEId } = useGoogleSearchStore(state => ({
    googleCloudApiKey: state.googleCloudApiKey, setGoogleCloudApiKey: state.setGoogleCloudApiKey,
    googleCSEId: state.googleCSEId, setGoogleCSEId: state.setGoogleCSEId,
  }), shallow);


  // derived state
  const isValidKey = googleCloudApiKey ? isValidGoogleCloudApiKey(googleCloudApiKey) : backendHasGoogle;
  const isValidId = googleCSEId ? isValidGoogleCseId(googleCSEId) : backendHasGoogle;


  const handleGoogleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleCloudApiKey(e.target.value);

  const handleCseIdChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleCSEId(e.target.value);


  return (
    <Stack direction='column' sx={{ gap: settingsGap }}>

      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        <SearchIcon />
        <Typography>
          Google Search
        </Typography>
      </Box>

      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='Google Cloud API Key'
                        description={<>Create one <Link href='https://console.cloud.google.com/apis/credentials' noLinkStyle target='_blank'>here</Link></>}
                        tooltip='Create your Google Cloud "API Key Credential" and enter it here' />
        <Input
          variant='outlined' placeholder={backendHasGoogle ? '...' : 'missing'} error={!isValidKey}
          value={googleCloudApiKey} onChange={handleGoogleApiKeyChange}
          startDecorator={<KeyIcon />}
          slotProps={{ input: { sx: { width: '100%' } } }}
          sx={{ width: '100%' }}
        />
      </FormControl>

      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title={<>Google CSE ID <InfoOutlinedIcon sx={{ mx: 0.5 }} /></>}
                        description={<>Get it <Link href='https://programmablesearchengine.google.com/' noLinkStyle target='_blank'>here</Link></>}
                        tooltip='Create your Google "Programmable Search Engine" and enter its ID here' />
        <Input
          variant='outlined' placeholder={backendHasGoogle ? '...' : 'missing'} error={!isValidId}
          value={googleCSEId} onChange={handleCseIdChange}
          startDecorator={<SearchIcon />}
          slotProps={{ input: { sx: { width: '100%' } } }}
          sx={{ width: '100%' }}
        />
      </FormControl>

    </Stack>
  );
}