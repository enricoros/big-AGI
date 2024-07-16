import * as React from 'react';

import { AppDiff } from '../src/apps/diff/AppDiff';

import { withLayout } from '~/common/layout/withLayout';


export default function DiffPage() {
  return withLayout({ type: 'optima' }, <AppDiff />);
}