import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface ModuleSupabaseSyncStore {

  // Supabase Sync Settings

  supabaseUrl: string;
  setSupabaseUrl: (supaUrl: string) => void;

  supabaseKey: string;
  setSupabaseKey: (key: string) => void;

}

export const useSupabaseSyncStore = create<ModuleSupabaseSyncStore>()(
  persist(
    (set) => ({

      // Supabase Sync Settings

      supabaseUrl: '',
      setSupabaseUrl: (supaUrl: string) => set({ supabaseUrl: supaUrl }),

      supabaseKey: '',
      setSupabaseKey: (key: string) => set({ supabaseKey: key }),

    }),
    {
      name: 'app-module-supabase-sync',
    }),
);