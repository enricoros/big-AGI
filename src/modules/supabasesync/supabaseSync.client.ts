import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { useSupabaseSyncStore } from './store-module-supabase-sync';
import { conversationToJsonV1 } from '~/modules/trade/trade.client';
import { DConversation, DMessage, useChatStore, createDConversation } from '~/common/state/store-chats';
import { SystemPurposeId } from '../../data';

type SupabaseConversation = {
    id: string;
    messages: DMessage[];
    systemPurposeId: SystemPurposeId;
    userTitle?: string;
    autoTitle?: string;
    tokenCount: number;
    created: number;
    updated: number | null;
}

export const isValidSupabaseConnection = (url?: string, key?: string) => !!url && !!key;

const superbase_conversation_tablename = 'user_conversation'; // old sync it was conversation

function logInfo(message: string) {
    console.log(`[INFO]: ${message}`);
}

function logError(message: string, error: any) {
    console.error(`[ERROR]: ${message}`, error);
}

// Singleton instance of Supabase Client, recreate when api key changes
let supabaseClientInstance: SupabaseClient<any, "public", any> | null = null;
let lastSupabaseClientKey: string | null = null;
let supabaseSession: Session | null = null;


// Singleton instance of Supabase Realtime, recreate when api key changes
export function getSupabaseClient(): SupabaseClient<any, "public", any> | null {
    const { supabaseUrl, supabaseKey } = useSupabaseSyncStore.getState();

    if (!isValidSupabaseConnection(supabaseUrl, supabaseKey)) {
        return null;
    }

    // if the url or key is not set the return null
    if (supabaseClientInstance && lastSupabaseClientKey === supabaseKey) {
        return supabaseClientInstance;
    } else {

        // dispose of the previous instance if it exists
        // if (supabaseClientInstance) {
        //     await supabaseClientInstance.auth.signOut();
        //     supabaseClientInstance = null;
        // }

        supabaseClientInstance = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        lastSupabaseClientKey = supabaseKey;
        //supabaseClientInstance.auth.getSession(); // are we logged in?
        //supabaseClientInstance.auth.getUser
        return supabaseClientInstance;
    }
}

export async function getSupabaseSession(): Promise<Session | null> {

    if (supabaseSession) {
        return supabaseSession;
    }

    const supaClient = getSupabaseClient();
    if (!supaClient) {
        return null;
    }

    // auto sign-in if we can
    const { data: { session } } = await supaClient.auth.getSession();
    supabaseSession = session;
    return supabaseSession;
}

export async function supabaseSignOut(): Promise<void> {
    const supaClient = getSupabaseClient();
    if (supaClient) {
        await supaClient.auth.signOut();
    }
    supabaseSession = null;
}

export async function getSupabaseUserName(): Promise<string | null> {
    // auto sign-in if we can
    const session = await getSupabaseSession();
    return session?.user.email ?? null;
}

export async function supabaseSignIn(email: string, password: string): Promise<string> {
    const supaClient = getSupabaseClient();
    if (!supaClient) {
        throw new Error('Invalid Supabase Connection');
    }

    try {
        const response = await supaClient.auth.signInWithPassword({
            email,
            password,
        });

        if (response.error) {
            throw response.error;
        }

        supabaseSession = response.data.session;
        return supabaseSession.user.email ?? "";
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('CORS')) {
                throw new Error('CORS error: Ensure your application domain is allowed in Supabase settings and you\'re using HTTPS.');
            } else if (error.message.includes('NetworkError')) {
                throw new Error('Network error: Check your internet connection and ensure Supabase URL is correct.');
            }
        }
        throw error;
    }
}

async function syncToServer(supabase: SupabaseClient, conversations: DConversation[], lastSyncTime: number): Promise<number> {
    // find all conversations that have been updated since the last sync

    // not the last time the server was synced as we may have changes that were before another client synced and those would get missed
    // sync time needs to be the last time this instance synced with the server

    const updatedConversations = conversations
        .filter(conversation => conversation.updated && conversation.updated > lastSyncTime && conversation.messages.length > 0)
        .map(conversationToJsonV1); // this removes some of the fields we want to sync

    if (updatedConversations.length === 0) {
        return 0;
    }

    console.log(`Syncing ${updatedConversations.length} conversations`);

    const { data, error } = await supabase
        .from(superbase_conversation_tablename)
        .upsert(updatedConversations);

    if (error) {
        console.error('Error syncing conversations:', error);
        return 0;
    }

    //console.log(`Synced ${updatedConversations.length} conversations`);
    return updatedConversations.length;
}

async function syncFromServerToClient(supabase: SupabaseClient, conversations: DConversation[], lastSyncTime: number): Promise<number> {
    console.log(`Fetching conversations from server > ${lastSyncTime}`);

    const { data, error } = await supabase
        .from(superbase_conversation_tablename)
        .select("*")
        .gt('updated', lastSyncTime);

    if (error) {
        console.error('Error fetching conversations from Server:', error);
        return 0;
    }

    if (data && data.length > 0) {
        console.debug(`Found ${data.length} conversations from server`);
        const conversationsFromServer: SupabaseConversation[] = data.map(record => ({ ...record }));

        const importConversation = useChatStore.getState().importConversation;
        let importCount = 0;
        conversationsFromServer.forEach(conversationFromServer => {
            let conversation = conversations.find(conversation => conversation.id === conversationFromServer.id);

            if (conversation) {
                // we may have just sent this to the server, in which case we don't need to update it
                // is it already updated (e.g. did we just push that to the server?)
                if (conversation.updated && conversation.updated >= (conversationFromServer.updated ?? 0)) {
                    return; // the same, don't touch
                }
            } else {
                conversation = createDConversation();
                conversation.id = conversationFromServer.id;
                conversation.created = conversationFromServer.created;

                //conversations.push(conversation); // insert the new conversation into the current working array
            }

            conversation.updated = conversationFromServer.updated;
            conversation.autoTitle = conversationFromServer.autoTitle;
            conversation.userTitle = conversationFromServer.userTitle;
            conversation.messages = conversationFromServer.messages;

            importConversation(conversation, false);
            importCount++;
        });

        return importCount;
    } else {
        console.debug('No conversations from server');
    }

    return 0;
}

async function isValidSupabaseDatabase(supabase: SupabaseClient<any, "public", any> | null): Promise<string> {
    if (!supabase) {
        return 'Please configure Supabase and log in before Syncing';
    }

    try {
        const { data, error } = await supabase
            .from(superbase_conversation_tablename)
            .select('*')
            .limit(1);

        // could validate schema as well?
        if (error)
            return `Database Setup Error: ${error.message}`;

        return '';
    } catch (error) {
        return `Database Setup Exception: ${error}`;
    }
}

export async function syncAllConversations(setMessage?: (message: string | null) => void): Promise<number> {
    const { lastSyncTime, setLastSyncTime } = useSupabaseSyncStore.getState();
    const conversations = useChatStore.getState().conversations;
    const supabase = getSupabaseClient();

    //const { folders, enableFolders } = useFolderStore.getState(); // ToDo: folder Sync ?
    try {
        const invalidDbMessage = await isValidSupabaseDatabase(supabase);
        if (invalidDbMessage !== '') {
            setMessage?.(invalidDbMessage);
            return 0;
        }
        const session = await getSupabaseSession();
        if (!session) {
            setMessage?.('Please log in before Syncing');
            return 0;
        }
        logInfo('Starting sync to server...');
        const pushedCount = await syncToServer(supabase, conversations, lastSyncTime);
        logInfo('Sync to server completed.');

        const updatedSyncTime = Date.now();
        logInfo('Starting sync from server to client...');
        const pulledCount = await syncFromServerToClient(supabase, conversations, lastSyncTime);
        logInfo('Sync from server to client completed.');

        setLastSyncTime(updatedSyncTime);
        logInfo(`Sync completed. Last sync time updated to ${updatedSyncTime}.`);
        setMessage?.(`Sync Successful, ${pushedCount} pushed, ${pulledCount} pulled`);

        // Return the number of conversations synced
        return pushedCount + pulledCount;
    } catch (error) {
        logError('Error during syncAllConversations', error);
        setMessage?.(`Failed to sync conversations: ${error}`);
        return 0;
    }
}