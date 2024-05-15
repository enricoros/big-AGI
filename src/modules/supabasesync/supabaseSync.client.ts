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

async function syncToServer(supabase: SupabaseClient, conversations: DConversation[]): Promise<void> {
    // find all conversations that have been updated since the last sync

    const lastSyncTime = await getServersLastSyncTime(supabase);

    const updatedConversations = conversations
       .filter(conversation => conversation.updated && conversation.updated > lastSyncTime)
       .map(conversationToJsonV1); // this removes some of the fields we want to sync

    if (updatedConversations.length === 0) {
        console.log('No conversations to sync');
        return;
    }

    console.log(`Syncing ${updatedConversations.length} conversations`);

    const { data, error } = await supabase
       .from('conversation')
       .upsert(updatedConversations);

    if (error) {
        console.error('Error syncing conversations:', error);
        return;
    }

    console.log(`Synced ${updatedConversations.length} conversations`);

}

async function syncFromServerToClient(supabase: SupabaseClient, conversations: DConversation[], lastSyncTime: number): Promise<void> {

    // Find all conversations from the server where the updated field is greater than maxConversationTime
    console.log(`Fetching conversations from server > ${lastSyncTime}`);

    const { data, error } = await supabase
        //.from<SupabaseConversation,"public", SupabaseConversation>('conversation')
        .from('conversation')
        .select("*")
        .gt('updated', lastSyncTime);
    
    if (error) {
        console.error('Error fetching conversations from Server:', error);
        return;
    }

    // map server data into conversations, this will need to be saved back into state

    // if the conversation.id exists then replace  it with the value from the data
    // if the conversation does not exist then we need to add

    if (data && data.length > 0) {
        console.debug(`Found ${data.length} conversations from server`);
        const conversationsFromServer: SupabaseConversation[] = data.map(record => { return {...record}}); // Cross my fingers and hope they map
        
        const importConversation = useChatStore.getState().importConversation;

        // add or update the conversations
        conversationsFromServer.forEach(conversationFromServer => {
            let conversation = conversations.find(conversation => conversation.id === conversationFromServer.id);
            // create a new conversation if existing one not found
            if (conversation === null || conversation === undefined) {
                conversation = createDConversation();
                conversation.id = conversationFromServer.id; // user id from server
                conversation.created = conversationFromServer.created; // use creation date from server
            }

            conversation.updated = conversationFromServer.updated;
            conversation.autoTitle = conversationFromServer.autoTitle;
            conversation.userTitle = conversationFromServer.userTitle;
            conversation.messages = conversationFromServer.messages;
            // do we need to sync the messages individually? No for now

            importConversation(conversation, false);
        });

    } else {
        console.debug('No conversations from server');
    }

}

export async function syncAllConversations() {
    const { lastSyncTime, setLastSyncTime } = useSupabaseSyncStore.getState();

    //const { folders, enableFolders } = useFolderStore.getState(); // ToDo: folder Sync ?
    const conversations = useChatStore.getState().conversations; //.map(conversationToJsonV1);
    const supabase = createSupabase();

    await syncToServer(supabase, conversations);
    
    const updatedSyncTime = Date.now(); // save time now before we sync to allow grace time for another browser syncing while we are reading in
    await syncFromServerToClient(supabase, conversations, lastSyncTime);

    setLastSyncTime(updatedSyncTime);
}