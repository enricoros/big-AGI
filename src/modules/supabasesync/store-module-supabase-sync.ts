import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface ModuleSupabaseSyncStore {

  // Supabase Sync Settings

  supabaseUrl: string;
  setSupabaseUrl: (supaUrl: string) => void;

  supabaseAnonKey: string;
  setSupabaseAnonKey: (anonKey: string) => void;

}

export const useSupabaseSyncStore = create<ModuleSupabaseSyncStore>()(
  persist(
    (set) => ({

      // Supabase Sync Settings

      supabaseUrl: '',
      setSupabaseUrl: (supaUrl: string) => set({ supabaseUrl: supaUrl }),

      supabaseAnonKey: '',
      setSupabaseAnonKey: (anonKey: string) => set({ supabaseAnonKey: anonKey }),

    }),
    {
      name: 'app-module-supabase-sync',
    }),
);