import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { FormControl, FormHelperText, FormLabel, Input, Option, Select, Typography } from '@mui/joy';

import { hasServerConf } from '~/common/app.serverconf';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { GoogleSearchSettings } from '~/modules/google/GoogleSearchSettings';

import { isValidContextSearchDomain } from './search.validation';
import { useWebSearchStore } from './store-module-websearch';


export function WebSearchSettings() {
  const { providerId, setProviderId, contextApiKey, setContextApiKey, contextRestrictToDomain, setContextRestrictToDomain } = useWebSearchStore(useShallow(state => ({
    providerId: state.providerId, setProviderId: state.setProviderId,
    contextApiKey: state.contextApiKey, setContextApiKey: state.setContextApiKey,
    contextRestrictToDomain: state.contextRestrictToDomain, setContextRestrictToDomain: state.setContextRestrictToDomain,
  })));
  const backendHasContext = hasServerConf('hasContextSearch');
  const invalidDomain = !isValidContextSearchDomain(contextRestrictToDomain);

  return <>
    <Typography level='body-sm'>
      Choose the web search provider for the <code>/react</code> command. The Search button in chat uses your model&apos;s native search.
    </Typography>

    <FormControl>
      <FormLabel>Search provider</FormLabel>
      <Select value={providerId} onChange={(_event, value) => value && setProviderId(value)}>
        <Option value='google'>Google Programmable Search</Option>
        <Option value='context'>Context.dev</Option>
      </Select>
    </FormControl>

    {providerId === 'google' ? <GoogleSearchSettings /> : <>
      <FormInputKey
        autoCompleteId='context-search-key' label='Context.dev API key'
        value={contextApiKey} onChange={setContextApiKey}
        rightLabel={<AlreadySet required={!backendHasContext} overridden={!!contextApiKey.trim()} />}
        required={!backendHasContext}
        description={<>Get an API key from <ExternalLink href='https://context.dev' level='inherit'>Context.dev</ExternalLink></>}
      />
      <FormControl error={invalidDomain}>
        <FormLabel>Restrict to domain</FormLabel>
        <Input
          value={contextRestrictToDomain} onChange={event => setContextRestrictToDomain(event.target.value)}
          placeholder='example.com'
        />
        <FormHelperText>
          {invalidDomain ? 'Enter a domain such as example.com, without https:// or a path.' : 'Optional. Enter a domain without a URL path.'}
        </FormHelperText>
      </FormControl>
    </>}
  </>;
}
