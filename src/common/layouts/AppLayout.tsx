import * as React from 'react';

import { Container, useTheme } from '@mui/joy';

import { NoSSR } from '@/common/components/NoSSR';
import { useSettingsStore } from '@/common/state/store-settings';

import { SettingsModal } from '../../apps/settings/SettingsModal';


export function AppLayout({ children }: { children: React.ReactNode }) {
  // external state
  const theme = useTheme();
  const centerMode = useSettingsStore(state => state.centerMode);

  return (
    // Global NoSSR wrapper: the overall Container could have hydration issues when using localStorage and non-default maxWidth
    <NoSSR>

      <Container
        disableGutters
        maxWidth={centerMode === 'full' ? false : centerMode === 'narrow' ? 'md' : 'xl'}
        sx={{
          boxShadow: {
            xs: 'none',
            md: centerMode === 'narrow' ? theme.vars.shadow.md : 'none',
            xl: centerMode !== 'full' ? theme.vars.shadow.lg : 'none',
          },
        }}>

        {children}

        <SettingsModal />

      </Container>

    </NoSSR>
  );
}