import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, FormHelperText, Input } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import SearchIcon from '@mui/icons-material/Search';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { Link } from '~/common/components/Link';

import { isValidSupabaseConnection } from './supabaseSync.client';
import { useSupabaseSyncStore } from './store-module-supabase-sync';


export function SupabaseSyncSettings() {

  // external state
  const backendHasSupabaseSync = getBackendCapabilities().hasSupabaseSync;
  const { supabaseUrl, setSupabaseUrl, supabaseAnonKey: supabaseKey, setSupabaseAnonKey } = useSupabaseSyncStore(state => ({
    supabaseUrl: state.supabaseUrl, setSupabaseUrl: state.setSupabaseUrl,
    supabaseAnonKey: state.supabaseKey, setSupabaseAnonKey: state.setSupabaseKey,
  }), shallow);


  // derived state
  const isValueUrl = supabaseUrl ? isValidSupabaseConnection(supabaseUrl, supabaseKey) : backendHasSupabaseSync;
  const isValidAnonKey = isValueUrl;

  const handleSupabaseSyncChange = (e: React.ChangeEvent<HTMLInputElement>) => setSupabaseUrl(e.target.value);

  const handleSupabaseAnonKeyChane = (e: React.ChangeEvent<HTMLInputElement>) => setSupabaseAnonKey(e.target.value);


  return <>

    <FormHelperText sx={{ display: 'block' }}>
      Configure the Supabase Chat Sync, if you don't have a Supabase account you will need to create one.
    </FormHelperText>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Supabase Url'
                      description={<>Create one <Link href='https://supabase.com/' noLinkStyle target='_blank'>here</Link></>}
                      tooltip='Create your Supabase Database and enter the url here' />
      <Input
        variant='outlined' placeholder={backendHasSupabaseSync ? '...' : 'missing'} error={!isValueUrl}
        value={supabaseUrl} onChange={handleSupabaseSyncChange}
        startDecorator={<KeyIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Key'
                      description=''
                      tooltip='Your database connection Key' />
      <Input
        variant='outlined' placeholder={backendHasSupabaseSync ? '...' : 'missing'} error={!isValidAnonKey}
        value={supabaseKey} onChange={handleSupabaseAnonKeyChane}
        startDecorator={<SearchIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

  </>;
}