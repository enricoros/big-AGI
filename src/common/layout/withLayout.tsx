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

  const { type, ...rest } = layoutOptions;

  switch (type) {

    case 'optima':
      return <OptimaLayout {...rest}>{children}</OptimaLayout>;

    case 'plain':
      return <PlainLayout {...rest}>{children}</PlainLayout>;

    default:
      console.error('No layout specified for this top-level page');
      return <>{children}</>;

  }
}
