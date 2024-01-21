import * as React from 'react';

import { AppPlaceholder } from '../src/apps/AppPlaceholder';

import { withLayout } from '~/common/layout/withLayout';


export default function DrawPage() {
  return withLayout({ type: 'optima' }, <AppPlaceholder />);
}