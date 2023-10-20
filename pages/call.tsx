import * as React from 'react';

import { AppCall } from '../src/apps/call/AppCall';

import { AppLayout } from '~/common/layout/AppLayout';


export default function CallPage() {
  return (
    <AppLayout>
      <AppCall />
    </AppLayout>
  );
}