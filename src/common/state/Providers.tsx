import * as React from 'react';
import type { EmotionCache } from '@emotion/react';

import { ProviderTRPCQueryClient } from './ProviderTRPCQueryClient';
import { ProviderTheming } from './ProviderTheming';
import { ProviderServerState } from '~/common/state/ProviderServerState';


export const Providers = (props: { emotionCache?: EmotionCache, children: React.ReactNode }) =>
  <ProviderTheming emotionCache={props.emotionCache}>
    <ProviderTRPCQueryClient>
      <ProviderServerState>
        {props.children}
      </ProviderServerState>
    </ProviderTRPCQueryClient>
  </ProviderTheming>;
