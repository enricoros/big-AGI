import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, FormHelperText, Input, Button, Typography } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import SyncIcon from '@mui/icons-material/Sync';
import KeyIcon from '@mui/icons-material/Key';
import SearchIcon from '@mui/icons-material/Search';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { Link } from '~/common/components/Link';

import { isValidSupabaseConnection } from './supabaseSync.client';
import { useSupabaseSyncStore } from './store-module-supabase-sync';
import { syncAllConversations } from '~/modules/supabasesync/supabaseSync.client';

export function SupabaseSyncSettings() {

  // external state
  const backendHasSupabaseSync = getBackendCapabilities().hasSupabaseSync;
  const { supabaseUrl, setSupabaseUrl, supabaseAnonKey: supabaseKey, setSupabaseAnonKey, lastSyncTime, setLastSyncTime } = useSupabaseSyncStore(state => ({
    supabaseUrl: state.supabaseUrl, setSupabaseUrl: state.setSupabaseUrl,
    supabaseAnonKey: state.supabaseKey, setSupabaseAnonKey: state.setSupabaseKey,
    lastSyncTime: state.lastSyncTime, setLastSyncTime: state.setLastSyncTime,
  }), shallow);


  // derived state
  const isValueUrl = supabaseUrl ? isValidSupabaseConnection(supabaseUrl, supabaseKey) : backendHasSupabaseSync;
  const isValidAnonKey = isValueUrl;
  const [syncAllState, setSyncAllState] = React.useState<'ok' | 'fail' | null>(null);
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null);

  const handleSupabaseSyncChange = (e: React.ChangeEvent<HTMLInputElement>) => setSupabaseUrl(e.target.value);

  const handleSupabaseAnonKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setSupabaseAnonKey(e.target.value);

  // set sync time from input
  const handleLastSyncTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // need to convert e.target.value to a number or 0 if empty or nan
    let value = e.target.value? Number(e.target.value) : 0;
    if (isNaN(value))
      value = 0;
    setLastSyncTime(value);
  }

  const handleSyncAllConversations = async () => {
    try {
      const syncedCount = await syncAllConversations(setSyncMessage);
      setSyncAllState('ok');
    } catch {
      setSyncAllState('fail');
    }
  }

  return <>

    <FormHelperText sx={{ display: 'block' }}>
      Configure the Supabase Chat Sync, if you do not have a Supabase account you will need to create one.
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
        value={supabaseKey} onChange={handleSupabaseAnonKeyChange}
        startDecorator={<SearchIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Last Synced'
                      description=''
                      tooltip='Last Time you synced with the server from this browser' />
      <Input
        variant='outlined' placeholder={backendHasSupabaseSync ? '...' : 'missing'} error={!isValidAnonKey}
        value={lastSyncTime} onChange={handleLastSyncTimeChange}
        startDecorator={<SearchIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>
    <FormHelperText sx={{ display: 'block' }}>
      WARNING: Resetting Last Synced to 0 will force push all exiting chats to the server and will overwrite them.
    </FormHelperText>
    {(lastSyncTime === 0) && (
      <Button
        variant='soft'
        color={syncAllState === 'ok' ? 'success' : syncAllState === 'fail' ? 'warning' : 'primary'}
        endDecorator={syncAllState === 'ok' ? <DoneIcon /> : syncAllState === 'fail' ? '✘' : <SyncIcon />}
        sx={{ minWidth: 240, justifyContent: 'space-between' }}
        onClick={handleSyncAllConversations}
      >
        Sync
      </Button>     
    )}
    {syncMessage && (
      <Typography level='body-sm'>
        {syncMessage}
      </Typography>
    )} 

  </>;
}