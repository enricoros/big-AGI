import * as React from 'react';

import { AppTokens } from '../src/apps/tokens/AppTokens';

import { withLayout } from '~/common/layout/withLayout';


export default function TokenizerPage() {
  return withLayout({ type: 'optima' }, <AppTokens />);
}