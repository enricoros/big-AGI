import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { FormControl, Input, Typography } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import SearchIcon from '@mui/icons-material/Search';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { ExternalLink } from '~/common/components/ExternalLink';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { Link } from '~/common/components/Link';

import { isValidGoogleCloudApiKey, isValidGoogleCseId } from './search.client';
import { useGoogleSearchStore } from './store-module-google';


export function GoogleSearchSettings() {

  // external state
  const backendHasGoogle = getBackendCapabilities().hasGoogleCustomSearch;
  const { googleCloudApiKey, setGoogleCloudApiKey, googleCSEId, setGoogleCSEId, restrictToDomain, setRestrictToDomain } = useGoogleSearchStore(useShallow(state => ({
    googleCloudApiKey: state.googleCloudApiKey, setGoogleCloudApiKey: state.setGoogleCloudApiKey,
    googleCSEId: state.googleCSEId, setGoogleCSEId: state.setGoogleCSEId,
    restrictToDomain: state.restrictToDomain, setRestrictToDomain: state.setRestrictToDomain,
  })));


  // derived state
  const isValidKey = googleCloudApiKey ? isValidGoogleCloudApiKey(googleCloudApiKey) : backendHasGoogle;
  const isValidId = googleCSEId ? isValidGoogleCseId(googleCSEId) : backendHasGoogle;


  const handleGoogleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleCloudApiKey(e.target.value);

  const handleCseIdChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleCSEId(e.target.value);

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => setRestrictToDomain(e.target.value);


  return <>

    <Typography level='body-sm'>
      For custom search engines or domain-specific searches. Most models have native search capabilities. Uses the Google <ExternalLink href='https://developers.google.com/custom-search/v1/overview'>Programmable Search Engine</ExternalLink> API.
    </Typography>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='GCP API Key'
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
      <FormLabelStart title='Search Engine ID'
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

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Restrict to Domain'
                      description='Optional'
                      tooltip='Limit searches to a specific domain (e.g., "wikipedia.org")' />
      <Input
        variant='outlined' placeholder='example.com'
        value={restrictToDomain} onChange={handleDomainChange}
        // startDecorator={<LanguageIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

  </>;
}