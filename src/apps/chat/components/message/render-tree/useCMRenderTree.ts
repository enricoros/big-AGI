import * as React from 'react';

import type { Immutable } from '~/common/types/immutable.types';
import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';

import type { CMRenderMode, CMRenderTree } from './cmRenderTree.types';
import { buildCMRenderTree, CMBuildOptions } from './cmRenderTree.build';
import { recycleCMRenderTree } from './cmRenderTree.recycle';


/**
 * The render tree of a message, rebuilt when the fragments, mode or options change and recycled against the last one.
 * The host memoizes `options` from its inputs, so the object is stable and goes to the builder as is.
 */
export function useCMRenderTree(fragments: Immutable<DMessageFragment[]>, mode: CMRenderMode, options: CMBuildOptions): CMRenderTree {
  const previousRef = React.useRef<CMRenderTree | undefined>(undefined);
  return React.useMemo(() => {
    const tree = recycleCMRenderTree(previousRef.current, buildCMRenderTree(fragments, mode, options));
    previousRef.current = tree;
    return tree;
  }, [fragments, mode, options]);
}
