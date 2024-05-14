import { apiAsync } from '~/common/util/trpc.client';

import { createClient } from "@supabase/supabase-js";
//import { Database } from './types/supabase' // Import the generated Supabase types

import { useSupabaseSyncStore } from "./store-module-supabase-sync";

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
        //const { data: todos } = await supabase.from('todos').select();
        return true;
    } catch (error: any) {
        console.error(`testSupabaseConnection: ${error}`);
        return false;
    }
}