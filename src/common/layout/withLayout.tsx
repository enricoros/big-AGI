import * as React from 'react';

import { OptimaLayout } from './optima/OptimaLayout';
import { PlainLayout } from './plain/PlainLayout';


type WithLayout = {
  type: 'optima';
  suspendAutoModelsSetup?: boolean;
} | {
  type: 'plain';
};


/**
 * Dynamic page-level layouting: a wrapper that adds the layout around the children.
 */
export function withLayout(layoutOptions: WithLayout, children: React.ReactNode): React.ReactElement {

  // Optima layout: also wrap it in the OptimaLayoutProvider
  if (layoutOptions.type === 'optima')
    return <OptimaLayout {...layoutOptions}>{children}</OptimaLayout>;

  else if (layoutOptions.type === 'plain')
    return <PlainLayout {...layoutOptions}>{children}</PlainLayout>;

  // if no layout is specified, return the children as-is
  console.error('No layout specified for this top-level page');
  return <>{children}</>;
}