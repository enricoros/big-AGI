import type { SxProps } from '@mui/joy/styles/types';
import React from 'react';
import { TerminalContextProvider } from 'react-terminal';

export type CommandProvider = Record<string, string | ((...args: string[]) => string)>;

export function ProviderTerminal(props: {
  children: React.ReactNode;
  providers: CommandProvider[];
  activeCommandProviderId: string | null;
  setActiveCommandProviderId: (providerId: string | null) => void;
  sx?: SxProps;
}) {
  return <TerminalContextProvider>{props.children}</TerminalContextProvider>;
}
