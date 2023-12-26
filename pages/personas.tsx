import * as React from 'react';

import { AppPersonas } from '../src/apps/personas/AppPersonas';

import { withLayout } from '~/common/layout/withLayout';


export default function PersonasPage() {
  return withLayout({ type: 'optima' }, <AppPersonas />);
}