import * as React from 'react';
import { create } from 'zustand';

// export type ApplicationBarAction = {
//   id: string;
//   label: string;
//   icon: JSX.Element;
//   onClick: () => void;
// };

type ApplicationBarState = {

  centerItems: React.JSX.Element | null;
  appMenuBadge: number | null;
  appMenuItems: React.JSX.Element | null;
  contextMenuItems: React.JSX.Element | null;

  register: (center: React.JSX.Element, appMenuBadge: number, appMenuItems: React.JSX.Element, contextMenuItems: React.JSX.Element) => void;
  unregister: () => void;

};

export const useApplicationBarStore = create<ApplicationBarState>()(
  (set) => ({

    centerItems: null,
    appMenuBadge: null,
    appMenuItems: null,
    contextMenuItems: null,

    register: (centerItems, appMenuBadge, appMenuItems, contextMenuItems) => set({ centerItems, appMenuBadge, appMenuItems, contextMenuItems }),
    unregister: () => set({ centerItems: null, appMenuBadge: null, appMenuItems: null, contextMenuItems: null }),

  }),
);
