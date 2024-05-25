import {create} from 'zustand';
import {persist} from 'zustand/middleware';

interface ModuleSupabaseSyncStore {

    // Supabase Sync Settings

    supabaseUrl: string;
    setSupabaseUrl: (supabaseUrl: string) => void;

    supabaseKey: string;
    setSupabaseKey: (key: string) => void;

    lastSyncTime: number;
    setLastSyncTime: (lastSyncTime: number) => void;

    userEmail: string;
    setUserEmail: (userEmail: string) => void;

}

export const useSupabaseSyncStore = create<ModuleSupabaseSyncStore>()(
    persist(
        (set) => ({

            // Supabase Sync Settings

            supabaseUrl: '',
            setSupabaseUrl: (supabaseUrl: string) => set({supabaseUrl: supabaseUrl}),

            supabaseKey: '',
            setSupabaseKey: (key: string) => set({supabaseKey: key}),

            lastSyncTime: 0,
            setLastSyncTime: (lastSyncTime: number) => set({lastSyncTime: lastSyncTime}),

            userEmail: '',
            setUserEmail: (userEmail: string) => set({userEmail: userEmail}),

        }),
        {
            name: 'app-module-supabase-sync',
        }),
);