import {useContext, useEffect, useState, ChangeEvent} from "react";
import {shallow} from 'zustand/shallow';

import {FormControl, FormHelperText, Input, Button, Typography, Box, Divider} from '@mui/joy';
import {GoodModal} from '~/common/components/GoodModal';
import DoneIcon from '@mui/icons-material/Done';
import SyncIcon from '@mui/icons-material/Sync';
import SearchIcon from '@mui/icons-material/Search';

import {getBackendCapabilities} from '~/modules/backend/store-backend-capabilities';
import {AlreadySet} from '~/common/components/AlreadySet';
import {FormInputKey} from '~/common/components/forms/FormInputKey';
import {FormLabelStart} from '~/common/components/forms/FormLabelStart';
import {Link} from '~/common/components/Link';

import {useSupabaseSyncStore} from './store-module-supabase-sync';
import {isValidSupabaseConnection, syncAllConversations, getSupabaseClient, getSupabaseUserName, supabaseSignOut} from '~/modules/supabasesync/supabaseSync.client';

export function SupabaseSyncSettings() {
    const [supabaseUserName, setSupabaseUserName] = useState<string | null>(null);
    const [loginDialogIsOpen, setLoginDialogIsOpen] = useState(false);
    
    // const {session, profile} = useContext(UserContext);
    // const userInfo = useSession();

    // external state
    const backendHasSupabaseSync = getBackendCapabilities().hasSupabaseSync;
    const {
        supabaseUrl,
        setSupabaseUrl,
        supabaseAnonKey: supabaseKey,
        setSupabaseAnonKey,
        lastSyncTime,
        setLastSyncTime
    } = useSupabaseSyncStore(state => ({
        supabaseUrl: state.supabaseUrl, setSupabaseUrl: state.setSupabaseUrl,
        supabaseAnonKey: state.supabaseKey, setSupabaseAnonKey: state.setSupabaseKey,
        lastSyncTime: state.lastSyncTime, setLastSyncTime: state.setLastSyncTime,
    }), shallow);


    // derived state
    const isValidUrl = supabaseUrl ? isValidSupabaseConnection(supabaseUrl, supabaseKey) : backendHasSupabaseSync;
    const isValidAnonKey = isValidUrl;
    const [syncAllState, setSyncAllState] = useState<'ok' | 'fail' | null>(null);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    // set sync time from input
    const handleLastSyncTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
        // need to convert e.target.value to a number or 0 if empty or nan
        let value = e.target.value ? Number(e.target.value) : 0;
        if (isNaN(value))
            value = 0;
        setLastSyncTime(value);
    }

    const handleSyncAllConversations = async () => {
        try {
            if (!supabaseUserName) {
                // need to sign in first, just a catch incase UI disable doesn't work
                setSyncAllState('fail');
                setSyncMessage('Please Sign in first.');
                return;
            }
            const syncedCount = await syncAllConversations(setSyncMessage);
            setSyncAllState('ok');
        } catch {
            setSyncAllState('fail');
        }
    }

    const handleLogin = () => {
        // can only call if its valid
        if (isValidAnonKey) {
            setLoginDialogIsOpen(true);
        }
    }

    const handleSupaUserSignIn = () => {
        // must have user and pwd

        // if success close
        setLoginDialogIsOpen(false);
    }

    const handleSignUp = () => {
        if (isValidAnonKey) {
            setLoginDialogIsOpen(true);
        }
    }

    const supaClient = getSupabaseClient();
    if (supaClient && isValidUrl && !supabaseUserName) {
        getSupabaseUserName().then( (name) => {
            setSupabaseUserName(name);
        });
    }

    const handleSignOut = () => {
        supabaseSignOut();
    }

    return <>
            <FormHelperText sx={{display: 'block'}}>
                Configure the Supabase Chat Sync, if you do not have a Supabase account you will need to create
                one <Link
                href='https://supabase.com/' noLinkStyle target='_blank'>here</Link>, or you can use the Sign Up button
                below.
            </FormHelperText>

            <FormInputKey
                autoCompleteId='supabase-url' label='Supabase Url' noKey
                value={supabaseUrl} onChange={setSupabaseUrl}
                rightLabel={<AlreadySet required={!backendHasSupabaseSync}/>}
                required={!backendHasSupabaseSync}
                isError={!isValidUrl && !backendHasSupabaseSync}
                placeholder={backendHasSupabaseSync ? '...' : 'https://...supabase.co (or your self hosted url)'}
            />

            <FormInputKey
                autoCompleteId='supabase-key' label='Supabase Anon Key'
                value={supabaseKey} onChange={setSupabaseAnonKey}
                rightLabel={<AlreadySet required={!backendHasSupabaseSync}/>}
                required={!backendHasSupabaseSync}
                isError={!isValidAnonKey && !backendHasSupabaseSync}
                placeholder={backendHasSupabaseSync ? '...' : 'SUPABASE_ANON_KEY'}
            />

            <FormControl orientation='horizontal' sx={{justifyContent: 'space-between', alignItems: 'center'}}>
                <FormLabelStart title='Last Synced'
                                description=''
                                tooltip='Last Time you synced with the server from this browser'/>
                <Input
                    variant='outlined' placeholder={backendHasSupabaseSync ? '...' : 'missing'} error={!isValidAnonKey}
                    value={lastSyncTime} onChange={handleLastSyncTimeChange}
                    startDecorator={<SearchIcon/>}
                    slotProps={{input: {sx: {width: '100%'}}}}
                    sx={{width: '100%'}}
                />
            </FormControl>
            <FormHelperText sx={{display: 'block'}}>
                WARNING: Resetting Last Synced to 0 will force push all exiting chats to the server and will overwrite
                them.
            </FormHelperText>
            {supabaseUserName && (
                <Typography level='body-sm'>
                    Logged in as {supabaseUserName}
                </Typography>
            )}
            <Box sx={{display: 'flex', justifyContent: 'space-around', width: '100%', gap: 2}}>
                {supabaseUserName && (
                <Button
                    variant='soft'
                    color='primary'
                    sx={{flex: 1, justifyContent: 'center'}}
                    onClick={handleSignOut}
                    >
                    Sign Out
                </Button>
                )}
                {!supabaseUserName && (
                <>
                <Button
                    variant='soft'
                    color='primary'
                    sx={{flex: 1, justifyContent: 'center'}}
                    onClick={handleSignUp}
                    disabled={!isValidAnonKey}
                    >
                    Sign Up (New User)
                </Button>
                <Button
                    variant='soft'
                    color='primary'
                    sx={{flex: 1, justifyContent: 'center'}}
                    onClick={handleLogin}
                    disabled={!isValidAnonKey}
                    >
                    Login
                </Button>
                </>
                )}
                <Button
                    variant='soft'
                    color={syncAllState === 'ok' ? 'success' : syncAllState === 'fail' ? 'warning' : 'primary'}
                    endDecorator={syncAllState === 'ok' ? <DoneIcon/> : syncAllState === 'fail' ? '✘' : <SyncIcon/>}
                    sx={{flex: 1, justifyContent: 'center'}}
                    onClick={handleSyncAllConversations}
                    disabled={!isValidAnonKey}
                >
                    Sync
                </Button>
            </Box>

            {syncMessage && (
                <Typography level='body-sm'>
                    {syncMessage}
                </Typography>
            )}

            {supaClient && (
                <GoodModal
                    title='Supabase Login'
                    aria-labelledby='login-dialog-title'
                    open={loginDialogIsOpen}
                    onClose={() => setLoginDialogIsOpen(false)}
                >
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant='soft'
                        color='primary'
                        sx={{flex: 1, justifyContent: 'center'}}
                        onClick={handleSupaUserSignIn}
                        disabled={!isValidAnonKey}
                        >
                    Login
                </Button>
                <Button
                        variant='soft'
                        color='primary'
                        sx={{flex: 1, justifyContent: 'center'}}
                        onClick={() => setLoginDialogIsOpen(false)}
                        disabled={!isValidAnonKey}
                        >
                    Cancel
                </Button>
          </Box>
                    {/* <Auth
                        supabaseClient={supaClient}
                        appearance={{theme: ThemeSupa}}
                        // for now, only support email login, in future want to use github, google, etc (but need to register app with these providers)
                        providers={[]}
                        view={authMode}
                        redirectTo="http://127.0.0.1:3000"
                    /> */}
                </GoodModal>
            )}
    </>;
}