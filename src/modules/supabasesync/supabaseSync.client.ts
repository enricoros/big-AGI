//import { apiAsync } from '~/common/util/trpc.client';
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useSupabaseSyncStore } from "./store-module-supabase-sync";
import { DModelSource, useModelsStore } from '~/modules/llms/store-llms';
import { conversationToJsonV1 } from '~/modules/trade/trade.client';
import { conversationTitle, DConversation, type DConversationId, DMessage, useChatStore, createDConversation } from '~/common/state/store-chats';
//import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { shallow } from 'zustand/shallow';
import { defaultSystemPurposeId, SystemPurposeId, SystemPurposes } from '../../data';

type SupabaseConversation = {
    id: string;
    messages: DMessage[];
    systemPurposeId: SystemPurposeId;
    userTitle?: string;
    autoTitle?: string;
    created: number;
    updated: number | null;
  }

export const isValidSupabaseConnection = (url?: string, key?: string) => !!url && !!key;

function logInfo(message: string) {
    console.log(`[INFO]: ${message}`);
}

function logError(message: string, error: any) {
    console.error(`[ERROR]: ${message}`, error);
}

/**
 * This function tests the Supabase connection
 * @param url 
 * @param key 
 * @returns true if the connection is valid, false otherwise
 */
export async function testSupabaseConnection(url: string, key: string): Promise<boolean> {

    // get the keys (empty if they're on server)
    const { supabaseUrl, supabaseKey } = useSupabaseSyncStore.getState();
    
    try {
        console.log('test Connection');
        //const supabase = createClient(supabaseUrl, supabaseKey);
        //supabase.
        //await supabase.auth.api.getUser();
        //const { data: Conversations } = await supabase.from('Conversation').select();
        return true;
    } catch (error: any) {
        console.error(`testSupabaseConnection: ${error}`);
        return false;
    }
}

function createSupabase(): SupabaseClient {
    const { supabaseUrl, supabaseKey } = useSupabaseSyncStore.getState();
    const supabase = createClient(supabaseUrl, supabaseKey);
    return supabase;
}

async function getServersLastSyncTime(supabase: SupabaseClient): Promise<number> {
    const { data, error } = await supabase
        .from('conversation')
        .select('updated')
        .order('updated', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error fetching lastSyncTime:', error);
        return 0;
    }

    if (data && data.length > 0) {
        return data[0].updated;
    } else {
        return 0;
    }
}

async function syncToServer(supabase: SupabaseClient, conversations: DConversation[]): Promise<number> {
    // find all conversations that have been updated since the last sync

    const lastSyncTime = await getServersLastSyncTime(supabase);

    const updatedConversations = conversations
       .filter(conversation => conversation.updated && conversation.updated > lastSyncTime)
       .map(conversationToJsonV1); // this removes some of the fields we want to sync

    if (updatedConversations.length === 0) {
        return 0;
    }

    console.log(`Syncing ${updatedConversations.length} conversations`);

    const { data, error } = await supabase
       .from('conversation')
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
        .from('conversation')
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

        conversationsFromServer.forEach(conversationFromServer => {
            let conversation = conversations.find(conversation => conversation.id === conversationFromServer.id);
            if (conversation) {
                // is it already updated (e.g. did we just push that to the server?)
                if (conversation.updated && conversation.updated > (conversationFromServer.updated ?? 0)) {
                    return; // the same, don't touch
                }
            } else {
                conversation = createDConversation();
                conversation.id = conversationFromServer.id;
                conversation.created = conversationFromServer.created;
            }

            conversation.updated = conversationFromServer.updated;
            conversation.autoTitle = conversationFromServer.autoTitle;
            conversation.userTitle = conversationFromServer.userTitle;
            conversation.messages = conversationFromServer.messages;

            importConversation(conversation, false);
        });

        return conversationsFromServer.length;
    } else {
        console.debug('No conversations from server');
    }

    return 0;
}

export async function syncAllConversations(setMessage?: (message: string | null) => void): Promise<number> {
    const { lastSyncTime, setLastSyncTime } = useSupabaseSyncStore.getState();
    const conversations = useChatStore.getState().conversations;
    const supabase = createSupabase();

    //const { folders, enableFolders } = useFolderStore.getState(); // ToDo: folder Sync ?
    try {
        logInfo('Starting sync to server...');
        const pushedCount = await syncToServer(supabase, conversations);
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