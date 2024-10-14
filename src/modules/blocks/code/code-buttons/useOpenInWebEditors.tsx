import * as React from 'react';

import { ListItemDecorator, MenuItem } from '@mui/joy';

import { CodePenIcon } from '~/common/components/icons/3rdparty/CodePenIcon';
import { GoogleColabIcon } from '~/common/components/icons/3rdparty/GoogleColabIcon';
import { JSFiddleIcon } from '~/common/components/icons/3rdparty/JSFiddleIcon';
import { StackBlitzIcon } from '~/common/components/icons/3rdparty/StackBlitzIcon';

import { isCodePenSupported, openInCodePen } from './openInCodePen';
import { isGoogleColabSupported, openInGoogleColab } from './openInGoogleColab';
import { isJSFiddleSupported, openInJsFiddle } from './openInJsFiddle';
import { isStackBlitzSupported, openInStackBlitz } from './openInStackBlitz';

const stableNoButtons: React.ReactNode[] = [];

export function useOpenInWebEditors(
  code: string,
  blockTitle: string,
  blockIsPartial: boolean,
  inferredCodeLanguage: string | null,
  isSVGCode: boolean,
) {
  return React.useMemo(() => {
    if (blockIsPartial) return stableNoButtons;

    const mayExternal = code?.indexOf('\n') > 0;
    if (!mayExternal) return stableNoButtons;

    const items: React.ReactNode[] = [];

    const canJSFiddle = isJSFiddleSupported(inferredCodeLanguage, code);
    if (canJSFiddle)
      items.push(
        <MenuItem key='jsfiddle' onClick={() => openInJsFiddle(code, inferredCodeLanguage!)}>
          <ListItemDecorator>
            <JSFiddleIcon />
          </ListItemDecorator>
          JSFiddle
        </MenuItem>,
      );

    const canCodePen = isCodePenSupported(inferredCodeLanguage, isSVGCode);
    if (canCodePen)
      items.push(
        <MenuItem key='codepen' onClick={() => openInCodePen(code, inferredCodeLanguage!)}>
          <ListItemDecorator>
            <CodePenIcon />
          </ListItemDecorator>
          CodePen
        </MenuItem>,
      );

    const canStackBlitz = isStackBlitzSupported(inferredCodeLanguage);
    if (canStackBlitz)
      items.push(
        <MenuItem key='stackblitz' onClick={() => openInStackBlitz(code, inferredCodeLanguage!, blockTitle)}>
          <ListItemDecorator>
            <StackBlitzIcon />
          </ListItemDecorator>
          StackBlitz
        </MenuItem>,
      );

    const canGoogleColab = isGoogleColabSupported(inferredCodeLanguage);
    if (canGoogleColab)
      items.push(
        <MenuItem key='googlecolab' onClick={() => openInGoogleColab(code)}>
          <ListItemDecorator>
            <GoogleColabIcon />
          </ListItemDecorator>
          Copy &amp; Paste in Colab
        </MenuItem>,
      );

    return items?.length > 0 ? items : stableNoButtons;
  }, [code, blockIsPartial, blockTitle, inferredCodeLanguage, isSVGCode]);
}
