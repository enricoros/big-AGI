import * as React from 'react';

import { AppDraw } from '../src/apps/draw/AppDraw';

import { withLayout } from '~/common/layout/withLayout';


export default function DrawPage() {
  return withLayout({ type: 'optima' }, <AppDraw />);
}