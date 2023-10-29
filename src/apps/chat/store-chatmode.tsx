import * as React from 'react';
import { create } from 'zustand';


export type ChatModeId = 'immediate' | 'immediate-follow-up' | 'write-user' | 'react' | 'draw-imagine';

/// Describe the chat modes
export const ChatModeItems: { [key in ChatModeId]: { label: string; description: string | React.JSX.Element; experimental?: boolean } } = {
  'immediate': {
    label: 'Chat',
    description: 'Persona answers',
  },
  'immediate-follow-up': {
    label: 'Augmented Chat',
    description: 'Chat with follow-up questions',
    experimental: true,
  },
  'write-user': {
    label: 'Write',
    description: 'Just append a message',
  },
  'react': {
    label: 'Reason+Act',
    description: 'Answer your questions with ReAct and search',
  },
  'draw-imagine': {
    label: 'Draw',
    description: 'AI Image Generation',
  },
};


/// Store

interface ChatModeData {

  chatModeId: ChatModeId;
  setChatModeId: (chatModeId: ChatModeId) => void;

}

export const useChatModeStore = create<ChatModeData>()(
  (set) => ({

    chatModeId: 'immediate',
    setChatModeId: (chatModeId) => set({ chatModeId }),

  }),
);