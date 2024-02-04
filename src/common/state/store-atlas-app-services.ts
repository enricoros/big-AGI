import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// App State

interface AppServicesStateData {
  token: String;
  setToken: (s:String) => void;
}


export const useAppServicesStore = create<AppServicesStateData>()(
  persist(
    (set,get) => ({
      token: "init-magic:"+Math.random().toString(16).slice(2),
      setToken: (newToken:String) => set({ token: String(newToken) }),
    }),
    {
      name: 'atlas-app-services-state',
    },
  ),
);

