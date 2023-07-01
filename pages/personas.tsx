import * as React from 'react';

import { AppPersonas } from '../src/apps/personas/AppPersonas';

import { AppLayout } from '~/common/layout/AppLayout';


export default function HomePage() {
  return (
    <AppLayout>
      <AppPersonas />
    </AppLayout>
  );
}