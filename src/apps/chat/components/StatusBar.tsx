import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Box, IconButton, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MinimizeIcon from '@mui/icons-material/Minimize';

// import { isMacUser } from '~/common/util/pwaUtils';
import type { ShortcutObject } from '~/common/components/shortcuts/useGlobalShortcuts';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { useGlobalShortcutsStore } from '~/common/components/shortcuts/store-global-shortcuts';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


// configuration
const COMPOSER_ENABLE_MINIMIZE = false;


const hideButtonTooltip = (
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    Hide Shortcuts<br />
    Enable again in Settings &gt; Labs
  </Box>
);

const _styles = {

  bar: {
    borderBottom: '1px solid',
    // borderBottomColor: 'var(--joy-palette-divider)',
    borderBottomColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.1)',
    // borderTopColor: 'rgba(var(--joy-palette-neutral-mainChannel, 99 107 116) / 0.4)',
    // backgroundColor: 'var(--joy-palette-background-surface)',
    // paddingBlock: '0.25rem',
    paddingInline: '0.5rem',
    // layout
    display: 'flex',
    flexFlow: 'row nowrap',
    columnGap: '1.5rem', // space between shortcuts
    lineHeight: '1em',
    // animation: `${animateAppear} 0.3s ease-out`,
    // transition: 'all 0.2s ease',
    // '&:hover': {
    //   backgroundColor: 'var(--joy-palette-background-level1)',
    // },
  } as const,

  hideButton: {
    '--IconButton-size': '28px',
    '--Icon-fontSize': '16px',
    '--Icon-color': 'var(--joy-palette-text-tertiary)',
    mr: -0.5,
  } as const,

  shortcut: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    gap: '2px', // space between modifiers
    marginBlock: '0.25rem',
    // transition: 'transform 0.2s ease',
    // '&:hover': {
    //   transform: 'scale(1.05)',
    // },
    '&:hover > div': {
      backgroundColor: 'background.level1',
    } as const,
    cursor: 'pointer',
    [`&[aria-disabled="true"]`]: {
      opacity: 0.5,
      pointerEvents: 'none',
    } as const,
  } as const,

  itemKey: {
    fontSize: 'xs',
    fontWeight: 'md',
    border: '1px solid',
    borderColor: 'neutral.outlinedBorder',
    borderRadius: 'xs',
    // backgroundColor: 'var(--joy-palette-neutral-outlinedBorder)',
    backgroundColor: 'background.popup',
    // boxShadow: 'inset 2px 0px 4px -2px var(--joy-palette-background-backdrop)',
    boxShadow: 'xs',
    // minWidth: '1rem',
    paddingBlock: '1px',
    paddingInline: '4px',
    // pointerEvents: 'none',
    cursor: 'pointer',
    transition: 'background-color 1s ease',
  } as const,

  itemIcon: {
    fontSize: 'md',
  } as const,

} as const;


// const animateAppear = keyframes`
//     from {
//         opacity: 0;
//         transform: translateY(10px);
//     }
//     to {
//         opacity: 1;
//         transform: translateY(0);
//     }
// `;


// Display mac-style shortcuts on windows as well
const displayMacModifiers = true;

function _platformAwareModifier(symbol: 'Ctrl' | 'Alt' | 'Shift') {
  switch (symbol) {
    case 'Ctrl':
      return displayMacModifiers ? '⌃' : 'Ctrl';
    case 'Shift':
      return displayMacModifiers ? '⇧' : '⇧';
    case 'Alt':
      return displayMacModifiers ? '⌥' /* Option */ : 'Alt';
  }
}

const ShortcutItemMemo = React.memo(ShortcutItem);

function ShortcutItem(props: { shortcut: ShortcutObject }) {

  const handleClicked = React.useCallback(() => {
    if (props.shortcut.action !== '_specialPrintShortcuts')
      props.shortcut.action();
  }, [props.shortcut]);

  return (
    <Box
      onClick={!props.shortcut.disabled ? handleClicked : undefined}
      aria-disabled={props.shortcut.disabled}
      sx={_styles.shortcut}
    >
      {!!props.shortcut.ctrl && <Box sx={_styles.itemKey}>{_platformAwareModifier('Ctrl')}</Box>}
      {!!props.shortcut.shift && <Box sx={_styles.itemKey}>{_platformAwareModifier('Shift')}</Box>}
      {/*{!!props.shortcut.altForNonMac && <Box sx={_styles.itemKey} onClick={handleClicked}>{_platformAwareModifier('Alt')}</ShortcutKey>}*/}
      <Box sx={_styles.itemKey}>{props.shortcut.key === 'Escape' ? 'Esc' : props.shortcut.key === 'Enter' ? '↵' : props.shortcut.key.toUpperCase()}</Box>
      &nbsp;<Typography level='body-xs'>{props.shortcut.description}</Typography>
      {!!props.shortcut.endDecoratorIcon && <props.shortcut.endDecoratorIcon sx={_styles.itemIcon} />}
    </Box>
  );
}

export const StatusBarMemo = React.memo(StatusBar);

export function StatusBar(props: { toggleMinimized?: () => void, isMinimized?: boolean }) {

  // state (modifiers pressed/not)
  const { showPromisedOverlay } = useOverlayComponents();
  // const [ctrlPressed, setCtrlPressed] = React.useState(false);
  // const [shiftPressed, setShiftPressed] = React.useState(false);

  // external state
  const labsShowShortcutBar = useUXLabsStore(state => state.labsShowShortcutBar);
  const shortcuts = useGlobalShortcutsStore(useShallow(state => {
    let visibleShortcuts = !labsShowShortcutBar ? [] : state.getAllShortcuts().filter(shortcut => !!shortcut.description);
    const maxLevel = Math.max(...visibleShortcuts.map(s => s.level ?? 0));
    if (maxLevel > 0)
      visibleShortcuts = visibleShortcuts.filter(s => s.level === maxLevel);
    visibleShortcuts.sort((a, b) => {
      // if they don't have a 'shift', they are sorted first
      if (a.shift !== b.shift)
        return a.shift ? 1 : -1;
      // (Hack) If the description is 'Beam', it goes last
      if (a.description === 'Beam Edit')
        return 1;
      // alphabetical for the rest
      return a.key.localeCompare(b.key);
    });
    return visibleShortcuts;
  }));

  // handlers
  const handleHideShortcuts = React.useCallback((event: React.MouseEvent) => {
    if (event.shiftKey) {
      console.log('shortcutGroups', useGlobalShortcutsStore.getState().shortcutGroups);
      return;
    }
    showPromisedOverlay('shortcuts-confirm-close', {}, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText='Remove productivity tips and shortcuts? You can add it back in Settings > Labs.'
        positiveActionText='Remove'
      />,
    ).then(() => useUXLabsStore.getState().setLabsShowShortcutBar(false)).catch(() => null /* ignore closure */);
  }, [showPromisedOverlay]);

  // React to modifiers
  // React.useEffect(() => {
  //   const handleKeyDown = (e: KeyboardEvent) => {
  //     if (e.key === 'Control') setCtrlPressed(true);
  //     if (e.key === 'Shift') setShiftPressed(true);
  //   };
  //   const handleKeyUp = (e: KeyboardEvent) => {
  //     if (e.key === 'Control') setCtrlPressed(false);
  //     if (e.key === 'Shift') setShiftPressed(false);
  //   };
  //   window.addEventListener('keydown', handleKeyDown);
  //   window.addEventListener('keyup', handleKeyUp);
  //   return () => {
  //     window.removeEventListener('keydown', handleKeyDown);
  //     window.removeEventListener('keyup', handleKeyUp);
  //   };
  // }, []);

  if (!labsShowShortcutBar)
    return null;

  return (
    <Box
      aria-label='Shortcuts and status bar'
      sx={_styles.bar}
    >

      {(!props.toggleMinimized || !COMPOSER_ENABLE_MINIMIZE) && !props.isMinimized ? (
        // Close Button
        <GoodTooltip variantOutlined arrow placement='top' title={hideButtonTooltip}>
          <IconButton size='sm' onClick={handleHideShortcuts} sx={_styles.hideButton}>
            <CloseRoundedIcon />
          </IconButton>
        </GoodTooltip>
      ) : (
        // Minimize / Maximize Button - note the Maximize icon would be more correct, but also less discoverable
        <IconButton size='sm' onClick={props.toggleMinimized} sx={_styles.hideButton}>
          {props.isMinimized ? <ExpandLessIcon /> : <MinimizeIcon />}
        </IconButton>
      )}

      {/* Show all shortcuts */}
      {shortcuts.map((shortcut, idx) => (
        <ShortcutItemMemo key={shortcut.key + idx} shortcut={shortcut} />
      ))}

    </Box>
  );
}
