import * as React from 'react';

import type { ChatExecuteMode } from './execute-mode.types';


interface ModeDescription {
  label: string;
  description: string | React.JSX.Element;
  canAttach?: boolean;
  highlight?: boolean;
  shortcut?: string;
  hideOnDesktop?: boolean;
  requiresTTI?: boolean;
}


export const ExecuteModeItems: { [key in ChatExecuteMode]: ModeDescription } = {
  'generate-content': {
    label: 'Chat',
    description: 'Persona replies',
    canAttach: true,
  },
  'generate-text-v1': {
    label: 'Chat (Stable)',
    description: 'Model replies (stable)',
    canAttach: true,
  },
  'beam-content': {
    label: 'Beam', // Best of, Auto-Prime, Top Pick, Select Best
    description: 'Combine multiple models', // Smarter: combine...
    shortcut: 'Ctrl + Enter',
    canAttach: true,
    hideOnDesktop: true,
  },
  'append-user': {
    label: 'Write',
    description: 'Append a message',
    shortcut: 'Alt + Enter',
    canAttach: true,
  },
  'generate-image': {
    label: 'Draw',
    description: 'AI Image Generation',
    requiresTTI: true,
  },
  'react-content': {
    label: 'Reason + Act', //  · α
    description: 'Answer questions in multiple steps',
  },
};
