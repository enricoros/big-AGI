const inactiveDeleteButtonHoverBackgroundColor = '#202426';

export function getInactiveChatRowShellSx(isIncognito: boolean) {
  const baseBackgroundColor = isIncognito ? 'background.level2' : 'neutral.softBg';
  return {
    mx: '0.25rem',
    my: '0.1875rem',
    borderRadius: 'sm',
    backgroundColor: baseBackgroundColor,
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

export function getInactiveChatMainButtonSx(isIncognito: boolean, deleteArmed: boolean) {
  const hoverBackgroundColor = isIncognito ? 'background.level3' : 'neutral.softHoverBg';
  return {
    flex: 1,
    border: 'none',
    position: 'relative',
    borderRadius: 'sm',
    minHeight: '2.5rem',
    mr: deleteArmed ? '5rem' : '2.75rem',
    backgroundColor: 'transparent',
    transition: 'background-color 0.16s ease',
    '&:hover': {
      backgroundColor: hoverBackgroundColor,
    },
    '&:focus-visible': {
      backgroundColor: hoverBackgroundColor,
    },
    ...(isIncognito && {
      filter: 'contrast(0)',
    }),
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
