const inactiveDeleteButtonHoverBackgroundColor = '#202426';
export const DELETE_HOLD_DURATION_MS = 1000;

function hexToRgbChannels(color: string): [number, number, number] | null {
  const normalized = color.trim();
  const shortHexMatch = /^#([\da-f]{3})$/i.exec(normalized);
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split('').map(channel => parseInt(channel + channel, 16));
    return [r, g, b];
  }

  const longHexMatch = /^#([\da-f]{6})$/i.exec(normalized);
  if (!longHexMatch)
    return null;

  const hex = longHexMatch[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

export function getFolderTintBackgroundImage(folderColor?: string | null, alpha: number = 0.08): string | undefined {
  if (!folderColor)
    return undefined;
  const rgb = hexToRgbChannels(folderColor);
  if (!rgb)
    return undefined;
  const [r, g, b] = rgb;
  const opacity = Math.max(0, Math.min(alpha, 1));
  return `linear-gradient(rgba(${r}, ${g}, ${b}, ${opacity}), rgba(${r}, ${g}, ${b}, ${opacity}))`;
}

export function getFolderTintHoverSx(folderColor?: string | null, alpha: number = 0.1) {
  const backgroundImage = getFolderTintBackgroundImage(folderColor, alpha);
  return backgroundImage ? { backgroundImage } as const : {} as const;
}

export function getInactiveChatHoverSx(isIncognito: boolean, folderColor?: string | null) {
  const backgroundColor = isIncognito ? 'background.level3' : 'neutral.softHoverBg';
  return {
    backgroundColor,
    ...(!isIncognito ? getFolderTintHoverSx(folderColor, 0.12) : {}),
  } as const;
}

export function getDeleteHoldProgressSx(holdProgress: number) {
  if (holdProgress <= 0)
    return {} as const;

  const progressPercent = `${Math.max(0, Math.min(holdProgress, 1)) * 100}%`;
  return {
    color: 'danger.softColor',
    backgroundImage: `linear-gradient(90deg, rgba(var(--joy-palette-danger-mainChannel) / 0.24) 0%, rgba(var(--joy-palette-danger-mainChannel) / 0.24) ${progressPercent}, transparent ${progressPercent}, transparent 100%)`,
    boxShadow: 'inset 0 0 0 1px rgba(var(--joy-palette-danger-mainChannel) / 0.22)',
  } as const;
}

export function getInactiveChatRowShellSx(isIncognito: boolean, folderColor?: string | null) {
  const baseBackgroundColor = isIncognito ? 'background.level2' : 'neutral.softBg';
  const folderTintBackgroundImage = !isIncognito ? getFolderTintBackgroundImage(folderColor, 0.07) : undefined;
  const hoverSx = getInactiveChatHoverSx(isIncognito, folderColor);
  return {
    mx: '0.25rem',
    my: '0.1875rem',
    borderRadius: 'sm',
    backgroundColor: baseBackgroundColor,
    transition: 'background-color 0.16s ease',
    ...(folderTintBackgroundImage ? {
      backgroundImage: folderTintBackgroundImage,
    } : {}),
    '&:hover': hoverSx,
    '&:focus-within': hoverSx,
    ...(isIncognito && {
      backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03), rgba(0,0,0,0.03) 10px, transparent 10px, transparent 20px)',
      border: '1px solid',
      borderColor: 'background.level3',
      '& .MuiListItemDecorator-root': {
        color: '#9C27B0',
      },
    }),
  } as const;
}

export function getChatTitleEditorSx(isActive: boolean) {
  return {
    flexGrow: 1,
    ml: -1.5,
    mr: -0.5,
    px: 0.75,
    py: 0.375,
    borderRadius: 'md',
    border: '1px solid',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    color: isActive ? 'common.white' : 'text.primary',
    boxShadow: 'none',
    transition: 'background-color 0.16s ease, border-color 0.16s ease',
    '&:hover': {
      backgroundColor: 'transparent',
    },
    '&:focus-within': {
      backgroundColor: 'transparent',
      borderColor: isActive ? 'rgba(255 255 255 / 0.24)' : 'primary.outlinedBorder',
    },
  } as const;
}

export function getInactiveChatMainButtonSx(isIncognito: boolean, deleteArmed: boolean, folderColor?: string | null) {
  void isIncognito;
  void folderColor;
  return {
    '--joy-palette-neutral-plainHoverBg': 'transparent',
    '--joy-palette-neutral-plainActiveBg': 'transparent',
    flex: 1,
    border: 'none',
    position: 'relative',
    borderRadius: 'sm',
    minHeight: '2.5rem',
    mr: deleteArmed ? '5rem' : '2.75rem',
    backgroundColor: 'transparent',
    transition: 'background-color 0.16s ease',
    '&:hover': {
      backgroundColor: 'transparent',
    },
    '&:focus-visible': {
      backgroundColor: 'transparent',
    },
    '&.Mui-focusVisible': {
      backgroundColor: 'transparent',
    },
    ...(isIncognito ? {
      filter: 'contrast(0)',
    } : {}),
  } as const;
}

export function getInactiveChatConfirmDeleteButtonSx() {
  return {
    position: 'absolute',
    top: '50%',
    right: 38,
    transform: 'translateY(-50%)',
    zIndex: 1,
    opacity: 1,
  } as const;
}

export function getInactiveChatDeleteButtonSx(deleteArmed: boolean) {
  return deleteArmed ? {
    position: 'absolute',
    top: '50%',
    right: 6,
    transform: 'translateY(-50%)',
    zIndex: 1,
    opacity: 1,
    backgroundColor: 'transparent',
    '&:hover': {
      backgroundColor: inactiveDeleteButtonHoverBackgroundColor,
    },
    '&:focus-visible': {
      backgroundColor: inactiveDeleteButtonHoverBackgroundColor,
    },
  } as const : {
    position: 'absolute',
    top: '50%',
    right: 6,
    transform: 'translateY(-50%)',
    zIndex: 1,
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.16s',
    backgroundColor: 'transparent',
    '.chat-drawer-item-shell:hover &': {
      opacity: 0.5,
      pointerEvents: 'auto',
    },
    '&:hover': {
      opacity: 1,
      backgroundColor: inactiveDeleteButtonHoverBackgroundColor,
    },
    '&:focus-visible': {
      opacity: 1,
      backgroundColor: inactiveDeleteButtonHoverBackgroundColor,
    },
  } as const;
}

export function getDeleteConfirmButtonProps() {
  return {
    variant: 'soft',
    color: 'danger',
    sx: {
      opacity: 1,
      mr: 0.5,
    },
  } as const;
}
