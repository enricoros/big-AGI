import * as React from 'react';

import { AppPersonas } from '../src/apps/personas/AppPersonas';

import type { LayoutOptions } from '~/common/layout/LayoutOptions';



export default function PersonasPage() {
  return <AppPersonas />;
}
PersonasPage.layoutOptions = { type: 'optima' } satisfies LayoutOptions;