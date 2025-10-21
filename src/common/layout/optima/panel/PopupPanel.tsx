import * as React from 'react';

import { CloseablePopup } from '~/common/components/CloseablePopup';

import { PanelContentPortal } from './PanelContentPortal';
import { optimaClosePanel } from '../useOptima';


export function PopupPanel(props: { anchorEl: HTMLElement | null }) {
  return (
    <CloseablePopup
      menu // this is NOT needed or wanted, but improves the look compared to the Box alternative
      anchorEl={props.anchorEl} onClose={optimaClosePanel}
      maxHeightGapPx={56 + 24}
      minWidth={280}
      noAutoFocus={true /* preserves the current behavior, we're not sure where this is used now */}
      placement='bottom-end'
    >

      {/* [Desktop] Portal within the Popup - [Mobile] always use the panel */}
      <PanelContentPortal />

    </CloseablePopup>
  );
}