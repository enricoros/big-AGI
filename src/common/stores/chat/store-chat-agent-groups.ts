import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { SystemPurposeId } from '../../../data';

import type { DConversationParticipant, DConversationTurnTerminationMode } from './chat.conversation';
import { agiUuid } from '~/common/util/idUtils';

export interface DAgentGroupSnapshot {
  id: string;
  name: string;
  systemPurposeId: SystemPurposeId;
  turnTerminationMode: DConversationTurnTerminationMode;
  participants: DConversationParticipant[];
  updatedAt: number;
}

interface AgentGroupsState {
  savedAgentGroups: DAgentGroupSnapshot[];
}

interface AgentGroupsActions {
  saveAgentGroup: (snapshot: Omit<DAgentGroupSnapshot, 'id' | 'updatedAt'>, existingId?: string | null) => string;
  renameAgentGroup: (id: string, name: string) => void;
  deleteAgentGroup: (id: string) => void;
}

type AgentGroupsStore = AgentGroupsState & AgentGroupsActions;

const duplicateParticipants = (participants: DConversationParticipant[]) =>
  participants.map(participant => ({ ...participant }));

export const useChatAgentGroupsStore = create<AgentGroupsStore>()(persist(
  (set, get) => ({
    savedAgentGroups: [],

    saveAgentGroup: (snapshot, existingId) => {
      const id = existingId || agiUuid('chat-agent-group');
      const normalizedName = snapshot.name.trim() || 'Untitled group';
      const nextSnapshot: DAgentGroupSnapshot = {
        ...snapshot,
        id,
        name: normalizedName,
        participants: duplicateParticipants(snapshot.participants),
        updatedAt: Date.now(),
      };

      const existing = get().savedAgentGroups;
      const hasExisting = existing.some(group => group.id === id);
      set({
        savedAgentGroups: hasExisting
          ? existing.map(group => group.id === id ? nextSnapshot : group)
          : [nextSnapshot, ...existing],
      });
      return id;
    },

    renameAgentGroup: (id, name) => set(state => ({
      savedAgentGroups: state.savedAgentGroups.map(group =>
        group.id === id
          ? { ...group, name: name.trim() || group.name, updatedAt: Date.now() }
          : group),
    })),

    deleteAgentGroup: (id) => set(state => ({
      savedAgentGroups: state.savedAgentGroups.filter(group => group.id !== id),
    })),
  }),
  {
    name: 'app-chat-agent-groups',
    version: 1,
  },
));
