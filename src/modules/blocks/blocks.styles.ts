import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';

import { ContentScaling, themeScalingMap } from '~/common/app.theme';

import type { AutoBlocksCodeRenderVariant } from './AutoBlocksRenderer';


// Styles for the various block components

export function useScaledCodeSx(fromAssistant: boolean, contentScaling: ContentScaling, codeRenderVariant: AutoBlocksCodeRenderVariant): SxProps {
  return React.useMemo(() => ({
    // Note: we don't handle 'enhanced' here, as we'll do it when the EnhancedRenderCode
    //       kicks in for real, and in what instance we patch this object.
    my:
      codeRenderVariant === 'plain' ? 0
        : themeScalingMap[contentScaling]?.blockCodeMarginY ?? 0,
    backgroundColor:
      codeRenderVariant === 'plain' ? 'background.surface'
        : fromAssistant ? 'neutral.plainHoverBg' : 'primary.plainActiveBg', // could use plainActiveBg to increase the background contrast in dark mode (#631), but it's really too bright in that case
    boxShadow:
      codeRenderVariant === 'plain' ? undefined
        : 'inset 2px 0px 5px -4px var(--joy-palette-background-backdrop)', // was 'xs'
    borderRadius: 'sm',
    fontFamily: 'code',
    fontSize: themeScalingMap[contentScaling]?.blockCodeFontSize ?? '0.875rem',
    fontWeight: 'md', // JetBrains Mono has a lighter weight, so we need that extra bump
    fontVariantLigatures: 'none',
    lineHeight: themeScalingMap[contentScaling]?.blockLineHeight ?? 1.75,
    minWidth: 288,
    minHeight: '2.75rem',
  }), [codeRenderVariant, contentScaling, fromAssistant]);
}

export function useScaledImageSx(contentScaling: ContentScaling): SxProps {
  return React.useMemo(() => ({
    fontSize: themeScalingMap[contentScaling]?.blockFontSize ?? undefined,
    lineHeight: themeScalingMap[contentScaling]?.blockLineHeight ?? 1.75,
    marginBottom: themeScalingMap[contentScaling]?.blockImageGap ?? 1.5,
  }), [contentScaling]);
}

export function useScaledTypographySx(contentScaling: ContentScaling, showAsDanger: boolean, showAsItalic: boolean) {
  return React.useMemo(() => ({
    fontSize: themeScalingMap[contentScaling]?.blockFontSize ?? undefined,
    lineHeight: themeScalingMap[contentScaling]?.blockLineHeight ?? 1.75,
    ...(showAsDanger ? { color: 'danger.500', fontWeight: 500 } : {}),
    ...(showAsItalic ? { fontStyle: 'italic' } : {}),
  }), [contentScaling, showAsDanger, showAsItalic]);
}

export function useToggleExpansionButtonSx(contentScaling: ContentScaling, codeRenderVariant: AutoBlocksCodeRenderVariant): SxProps {
  return React.useMemo(() => ({
    width: '100%',
    fontSize: themeScalingMap[contentScaling]?.fragmentButtonFontSize ?? undefined,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    ...(codeRenderVariant === 'plain' ? {
      // Style when inside the <DocumentFragmentEditor />
      backgroundColor: 'background.surface',
      // marginTop: -0.5,
    } : {
      // Style when inside <ChatMessage /> in particular for 'user' messages
      marginTop: 1,
    }),
  }), [codeRenderVariant, contentScaling]);
}
