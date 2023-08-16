import * as React from 'react';

import { AppLabs } from '../src/apps/labs/AppLabs';

import { AppLayout } from '~/common/layout/AppLayout';


export default function LabsPage() {
  return (
    <AppLayout suspendAutoModelsSetup>
      <AppLabs />
    </AppLayout>
  );
}