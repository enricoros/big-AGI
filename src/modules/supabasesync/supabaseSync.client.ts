import { apiAsync } from '~/common/util/trpc.client';
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useSupabaseSyncStore } from "./store-module-supabase-sync";
import { DModelSource, useModelsStore } from '~/modules/llms/store-llms';
import { conversationToJsonV1 } from '~/modules/trade/trade.client';
import { conversationTitle, DConversation, type DConversationId, DMessage, useChatStore } from '~/common/state/store-chats';
import { DFolder, useFolderStore } from '~/common/state/store-folders';

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

async function getLastSyncTime(supabase: SupabaseClient): Promise<number> {
    const { data, error } = await supabase
        .from('Conversation')
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

export async function syncAllConversations() {
    console.log('syncAllConversations');

    const { folders, enableFolders } = useFolderStore.getState();
    const conversations = useChatStore.getState().conversations; //.map(conversationToJsonV1);

    const supabase = createSupabase();
    const lastSyncTime = await getLastSyncTime(supabase);

    // find all conversations that have been updated since the last sync
    const updatedConversations = conversations
       .filter(conversation => conversation.updated && conversation.updated > lastSyncTime)
       .map(conversationToJsonV1);

    if (updatedConversations.length === 0) {
        console.log('No conversations to sync');
        return;
    }

    console.log(`Syncing ${updatedConversations.length} conversations`);

    const { data, error } = await supabase
       .from('Conversation')
       .upsert(updatedConversations, { returning:'minimal' });

    if (error) {
        console.error('Error syncing conversations:', error);
        return;
    }

    console.log(`Synced ${updatedConversations.length} conversations`);

}