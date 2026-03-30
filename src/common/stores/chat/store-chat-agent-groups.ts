import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { defaultSystemPurposeId, sanitizeSystemPurposeId } from '../../../data';
import type { SystemPurposeId } from '../../../data';

import type { DConversationParticipant, DConversationTurnTerminationMode, DConversationTurnsOrder } from './chat.conversation';
import {
  sanitizeConversationTurnsOrder,
  sanitizeConversationTurnTerminationMode,
  sanitizeCouncilMaxRounds,
  sanitizeCouncilTraceAutoCollapsePreviousRounds,
  sanitizeCouncilTraceAutoExpandNewestRound,
} from './chat.conversation';
import { agiUuid } from '~/common/util/idUtils';

export interface DAgentGroupSnapshot {
  id: string;
  name: string;
  systemPurposeId: SystemPurposeId;
  turnTerminationMode: DConversationTurnTerminationMode;
  turnsOrder: DConversationTurnsOrder;
  councilMaxRounds?: number | null;
  councilTraceAutoCollapsePreviousRounds?: boolean;
  councilTraceAutoExpandNewestRound?: boolean;
  participants: DConversationParticipant[];
  updatedAt: number;
}

export interface DAgentSnapshot {
  id: string;
  name: string;
  participant: DConversationParticipant;
  updatedAt: number;
}

interface AgentGroupsState {
  savedAgentGroups: DAgentGroupSnapshot[];
  savedAgents: DAgentSnapshot[];
}

interface AgentGroupsActions {
  saveAgentGroup: (snapshot: Omit<DAgentGroupSnapshot, 'id' | 'updatedAt'>, existingId?: string | null) => string;
  renameAgentGroup: (id: string, name: string) => void;
  deleteAgentGroup: (id: string) => void;
  importAgentGroups: (snapshots: DAgentGroupSnapshot[]) => number;
  saveAgent: (snapshot: Omit<DAgentSnapshot, 'id' | 'updatedAt'>, existingId?: string | null) => string;
  renameAgent: (id: string, name: string) => void;
  deleteAgent: (id: string) => void;
}

type AgentGroupsStore = AgentGroupsState & AgentGroupsActions;

const duplicateParticipants = (participants: DConversationParticipant[]) =>
  participants.map(participant => ({ ...participant }));

const normalizeParticipant = (participant: DConversationParticipant): DConversationParticipant =>
  participant.kind !== 'assistant'
    ? { ...participant }
    : {
      ...participant,
      personaId: sanitizeSystemPurposeId(participant.personaId),
    };

const normalizeAgentGroupSnapshot = (snapshot: Partial<DAgentGroupSnapshot> & Record<string, unknown>): DAgentGroupSnapshot => ({
  id: typeof snapshot.id === 'string' && snapshot.id ? snapshot.id : agiUuid('chat-agent-group'),
  name: typeof snapshot.name === 'string' && snapshot.name.trim() ? snapshot.name.trim() : 'Untitled group',
  systemPurposeId: sanitizeSystemPurposeId(snapshot.systemPurposeId),
  turnTerminationMode: sanitizeConversationTurnTerminationMode(snapshot.turnTerminationMode),
  turnsOrder: sanitizeConversationTurnsOrder(snapshot.turnsOrder),
  councilMaxRounds: sanitizeCouncilMaxRounds(snapshot.councilMaxRounds ?? snapshot.consensusMaxRounds),
  councilTraceAutoCollapsePreviousRounds: sanitizeCouncilTraceAutoCollapsePreviousRounds(snapshot.councilTraceAutoCollapsePreviousRounds),
  councilTraceAutoExpandNewestRound: sanitizeCouncilTraceAutoExpandNewestRound(snapshot.councilTraceAutoExpandNewestRound),
  participants: Array.isArray(snapshot.participants)
    ? snapshot.participants.map(normalizeParticipant)
    : [],
  updatedAt: typeof snapshot.updatedAt === 'number' && Number.isFinite(snapshot.updatedAt) ? snapshot.updatedAt : Date.now(),
});

const duplicateAgentGroupSnapshot = (snapshot: DAgentGroupSnapshot): DAgentGroupSnapshot => ({
  ...snapshot,
  participants: duplicateParticipants(snapshot.participants),
});

const duplicateAgentSnapshot = (snapshot: DAgentSnapshot): DAgentSnapshot => ({
  ...snapshot,
  participant: normalizeParticipant(snapshot.participant),
});

export function migratePersistedAgentGroupsState(persistedState: unknown, version: number): AgentGroupsState {
  const state = (persistedState ?? {}) as Partial<AgentGroupsState>;
  return {
    savedAgentGroups: Array.isArray(state.savedAgentGroups)
      ? state.savedAgentGroups.map(snapshot => normalizeAgentGroupSnapshot(snapshot as DAgentGroupSnapshot & Record<string, unknown>))
      : [],
    savedAgents: version >= 2 && Array.isArray(state.savedAgents)
      ? state.savedAgents.map(snapshot => duplicateAgentSnapshot(snapshot as DAgentSnapshot))
      : [],
  } satisfies AgentGroupsState;
}

export const useChatAgentGroupsStore = create<AgentGroupsStore>()(persist(
  (set, get) => ({
    savedAgentGroups: [],
    savedAgents: [],

    saveAgentGroup: (snapshot, existingId) => {
      const id = existingId || agiUuid('chat-agent-group');
      const nextSnapshot = normalizeAgentGroupSnapshot({
        ...snapshot,
        id,
        updatedAt: Date.now(),
      });

      const existing = get().savedAgentGroups;
      const hasExisting = existing.some(group => group.id === id);
      set({
        savedAgentGroups: hasExisting
          ? existing.map(group => group.id === id ? nextSnapshot : group)
          : [nextSnapshot, ...existing],
      });
      return id;
    },

    saveAgent: (snapshot, existingId) => {
      const id = existingId || agiUuid('chat-participant-assistant');
      const normalizedName = snapshot.name.trim() || snapshot.participant.name.trim() || 'Untitled agent';
      const normalizedParticipant = snapshot.participant.kind === 'assistant'
        ? normalizeParticipant(snapshot.participant)
        : {
          ...snapshot.participant,
          kind: 'assistant' as const,
          personaId: defaultSystemPurposeId,
        };
      const nextSnapshot: DAgentSnapshot = {
        ...snapshot,
        id,
        name: normalizedName,
        participant: { ...normalizedParticipant, name: normalizedName },
        updatedAt: Date.now(),
      };

      const existing = get().savedAgents;
      const hasExisting = existing.some(agent => agent.id === id);
      set({
        savedAgents: hasExisting
          ? existing.map(agent => agent.id === id ? nextSnapshot : agent)
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

    renameAgent: (id, name) => set(state => ({
      savedAgents: state.savedAgents.map(agent =>
        agent.id === id
          ? {
              ...agent,
              name: name.trim() || agent.name,
              participant: {
                ...agent.participant,
                name: name.trim() || agent.name,
              },
              updatedAt: Date.now(),
            }
          : agent),
    })),

    deleteAgentGroup: (id) => set(state => ({
      savedAgentGroups: state.savedAgentGroups.filter(group => group.id !== id),
    })),

    deleteAgent: (id) => set(state => ({
      savedAgents: state.savedAgents.filter(agent => agent.id !== id),
    })),

    importAgentGroups: (snapshots) => {
      if (!snapshots.length)
        return 0;

      const normalizedSnapshots = snapshots.map(snapshot => normalizeAgentGroupSnapshot(snapshot as DAgentGroupSnapshot & Record<string, unknown>));

      const existing = get().savedAgentGroups;
      const existingById = new Map(existing.map(group => [group.id, group]));
      let importedCount = 0;

      for (const snapshot of normalizedSnapshots) {
        existingById.set(snapshot.id, duplicateAgentGroupSnapshot(snapshot));
        importedCount++;
      }

      set({
        savedAgentGroups: [...existingById.values()].sort((a, b) => b.updatedAt - a.updatedAt),
      });

      return importedCount;
    },
  }),
  {
    name: 'app-chat-agent-groups',
    version: 5,
    migrate: migratePersistedAgentGroupsState,
  },
));
