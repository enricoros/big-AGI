import * as React from 'react';

import { AppShared } from '../../src/apps/shared/AppShared';

import { AppLayout } from '~/common/layout/AppLayout';


export default function SharedViewerPage() {
  return (
    <AppLayout suspendAutoModelsSetup>
      <AppShared />
    </AppLayout>
  );
}