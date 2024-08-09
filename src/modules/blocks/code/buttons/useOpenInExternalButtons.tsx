import * as React from 'react';

import { CodePenIcon } from '~/common/components/icons/3rdparty/CodePenIcon';
import { StackBlitzIcon } from '~/common/components/icons/3rdparty/StackBlitzIcon';

import { OverlayButton } from '../../OverlayButton';
import { isCodePenSupported, openInCodePen } from './openInCodePen';
import { isJSFiddleSupported, openInJsFiddle } from './openInJsFiddle';
import { isStackBlitzSupported, openInStackBlitz } from './openInStackBlitz';


const stableNoButtons: React.ReactNode[] = [];

export function useOpenInExternalButtons(code: string, blockTitle: string, blockIsPartial: boolean, inferredCodeLanguage: string | null, isSVGCode: boolean, noTooltips: boolean) {
  return React.useMemo(() => {
    if (blockIsPartial)
      return stableNoButtons;

    const mayExternal = code?.indexOf('\n') > 0;
    if (!mayExternal)
      return stableNoButtons;

    const buttons: React.ReactNode[] = [];

    const canJSFiddle = isJSFiddleSupported(inferredCodeLanguage, code);
    if (canJSFiddle) buttons.push(
      <OverlayButton key='jsfiddle' tooltip={noTooltips ? null : 'Open in JSFiddle'} placement='bottom' onClick={() => openInJsFiddle(code, inferredCodeLanguage!)}>
        JS
      </OverlayButton>,
    );

    const canCodePen = isCodePenSupported(inferredCodeLanguage, isSVGCode);
    if (canCodePen) buttons.push(
      <OverlayButton key='codepen' tooltip={noTooltips ? null : 'Open in CodePen'} placement='bottom' onClick={() => openInCodePen(code, inferredCodeLanguage!)}>
        <CodePenIcon />
      </OverlayButton>,
    );

    const canStackBlitz = isStackBlitzSupported(inferredCodeLanguage);
    if (canStackBlitz) buttons.push(
      <OverlayButton key='stackblitz' tooltip={noTooltips ? null : 'Open in StackBlitz'} placement='bottom' onClick={() => openInStackBlitz(code, inferredCodeLanguage!, blockTitle)}>
        <StackBlitzIcon />
      </OverlayButton>,
    );

    return buttons?.length > 0 ? buttons : stableNoButtons;
  }, [code, blockIsPartial, blockTitle, inferredCodeLanguage, isSVGCode, noTooltips]);
}