import * as React from 'react';

import { AppCall } from '../src/apps/call/AppCall';

import type { LayoutOptions } from '~/common/layout/LayoutOptions';


export default function CallPage() {
  return <AppCall />;
}
CallPage.layoutOptions = { type: 'optima' } satisfies LayoutOptions;