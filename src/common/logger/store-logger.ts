import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { Release } from '~/common/app.release';
import { agiUuid } from '~/common/util/idUtils';

import type { LogEntry } from './logger.types';

//
// Note: right now it's not persisted - to persist uncomment the persistence code below
//

// configuration
const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_PERSISTED = 100;
const DEBUG_NEW_LOG = Release.IsNodeDevBuild;


const _checkPendingActions = (entry: LogEntry): boolean => {
  return !!entry.actions?.some(a => !a.completed) && !entry.dismissed;
};


// --- Logger Store ---

interface LoggerState {

  entries: LogEntry[];
  maxEntries: number;

}

export interface LoggerActions {

  // internal actions
  _addEntry: (entry: Omit<LogEntry, 'id' | 'timestamp' | 'hasPendingActions'>) => string;
  _updateEntry: (id: string, update: Partial<LogEntry>) => void;

  // queries
  getEntry: (id: string) => LogEntry | undefined;
  getPendingActionEntries: () => LogEntry[];

  // public actions
  markShown: (id: string) => void;
  markDismissed: (id: string) => void;
  markActionCompleted: (id: string, actionId?: string) => void;
  clearAll: () => void;

}

export const useLoggerStore = create<LoggerState & LoggerActions>()(
  persist(
    (set, get) => ({

      // initial state

      entries: [],
      maxEntries: DEFAULT_MAX_ENTRIES,


      // actions

      _addEntry: (entryData) => {

        // assign default action IDs, if missing
        let actions = entryData.actions;
        if (actions?.length)
          actions = actions.map((a, index) => ({
            ...a,
            id: a.id || `action_${index}`,
          }));

        // create the log entry
        const id = agiUuid('logger');
        const timestamp = Date.now();
        const newEntry: LogEntry = {
          ...entryData,
          id,
          timestamp,
          actions,
        };

        newEntry.hasPendingActions = _checkPendingActions(newEntry);

        // prepend the entry
        set((state) => ({
          entries: [newEntry, ...state.entries].slice(0, state.maxEntries),
        }));

        // console output in DEV mode
        if (DEBUG_NEW_LOG) {
          const consoleMethod = {
            DEV: console.warn, // messages for developers - they represent unexpected behaviors which should be addressed
            debug: console.log, // upping this, because otherwise no output
            info: console.info, warn: console.warn,
            error: console.error, critical: console.error,
          }[newEntry.level] || console.log;
          consoleMethod(`[${newEntry.source || 'client'}] ${newEntry.message}`, newEntry.details || '', newEntry.actions ? '(Actionable)' : '');
        }

        return id;
      },

      _updateEntry: (id, update) => {
        set((state) => {

          // find entry
          const index = state.entries.findIndex(e => e.id === id);
          if (index === -1) return state;

          const updatedEntries = [...state.entries];
          const existingEntry = updatedEntries[index];
          const updatedEntry = {
            ...existingEntry,
            ...update,
            // Ensure actions array exists if updating it
            actions: ('actions' in update && update.actions)
              ? [...update.actions]
              : existingEntry.actions ? [...existingEntry.actions]
                : undefined,
          };

          // Recalculate pending status if actions or dismissed status changed
          if ('actions' in update || 'dismissed' in update)
            updatedEntry.hasPendingActions = _checkPendingActions(updatedEntry);

          updatedEntries[index] = updatedEntry;
          return { entries: updatedEntries };
        });
      },

      markShown: (id) => get()._updateEntry(id, { shown: true }),

      markDismissed: (id) => get()._updateEntry(id, { dismissed: true }),

      markActionCompleted: (id, actionId) => {

        const entry = get().getEntry(id);
        if (!entry?.actions) return;

        let actionMarked = false;
        const updatedActions = entry.actions.map(a => {
          // mark specific action or the first pending one if no ID provided
          if (!a.completed && ((actionId && a.id === actionId) || (!actionId))) {
            actionMarked = true;
            return { ...a, completed: true, completedTimestamp: Date.now() };
          }
          return a;
        });

        // only update if an action was actually marked
        if (actionMarked)
          get()._updateEntry(id, { actions: updatedActions });
      },

      clearAll: () => set({ entries: [] }),

      getEntry: (id) => get().entries.find(e => e.id === id),

      getPendingActionEntries: () => get().entries.filter(e => e.hasPendingActions),

    }),
    {

      name: 'agi-logger-log',

      // persist non-debug, non-dismissed entries, or those with pending actions
      partialize: (state) => ({
        ...state,
        entries: state.entries
          .filter(e => e.level !== 'debug' && !e.dismissed)
          .slice(0, DEFAULT_MAX_PERSISTED)
          .map(e => {
            // remove any actions
            const { actions, hasPendingActions, ...rest } = e;
            return rest;
          }),
      }),

    },
  ),
);
