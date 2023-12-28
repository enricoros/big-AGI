import * as React from 'react';

import { AppCall } from '../src/apps/call/AppCall';

import { withLayout } from '~/common/layout/withLayout';


export default function CallPage() {
  return withLayout({ type: 'optima' }, <AppCall />);
}