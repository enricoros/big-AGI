import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getChatTitleEditorSx,
  getDeleteHoldProgressSx,
  getDeleteConfirmButtonProps,
  getFolderTintBackgroundImage,
  getInactiveChatHoverSx,
  getFolderTintHoverSx,
  getInactiveChatConfirmDeleteButtonSx,
  getInactiveChatDeleteButtonSx,
  getInactiveChatMainButtonSx,
  getInactiveChatRowShellSx,
} from './ChatDrawerItem.layout';

test('delete hold progress style stays inert at zero and clamps to a full danger fill at one', () => {
  assert.deepStrictEqual(getDeleteHoldProgressSx(0), {});

  assert.deepStrictEqual(getDeleteHoldProgressSx(1), {
    color: 'danger.softColor',
    backgroundImage: 'linear-gradient(90deg, rgba(var(--joy-palette-danger-mainChannel) / 0.24) 0%, rgba(var(--joy-palette-danger-mainChannel) / 0.24) 100%, transparent 100%, transparent 100%)',
    boxShadow: 'inset 0 0 0 1px rgba(var(--joy-palette-danger-mainChannel) / 0.22)',
  });
});

test('inactive chat row shell extends the soft background across the whole row', () => {
  assert.deepStrictEqual(getInactiveChatRowShellSx(false), {
    mx: '0.25rem',
    my: '0.1875rem',
    borderRadius: 'sm',
    backgroundColor: 'neutral.softBg',
    transition: 'background-color 0.16s ease',
    '&:hover': {
      backgroundColor: 'neutral.softHoverBg',
    },
    '&:focus-within': {
      backgroundColor: 'neutral.softHoverBg',
    },
  });
});

test('inactive chat row shell adds only a mild folder tint when a folder color exists', () => {
  assert.deepStrictEqual(getInactiveChatRowShellSx(false, '#f13d41'), {
    mx: '0.25rem',
    my: '0.1875rem',
    borderRadius: 'sm',
    backgroundColor: 'neutral.softBg',
    transition: 'background-color 0.16s ease',
    backgroundImage: 'linear-gradient(rgba(241, 61, 65, 0.07), rgba(241, 61, 65, 0.07))',
    '&:hover': {
      backgroundColor: 'neutral.softHoverBg',
      backgroundImage: 'linear-gradient(rgba(241, 61, 65, 0.12), rgba(241, 61, 65, 0.12))',
    },
    '&:focus-within': {
      backgroundColor: 'neutral.softHoverBg',
      backgroundImage: 'linear-gradient(rgba(241, 61, 65, 0.12), rgba(241, 61, 65, 0.12))',
    },
  });
});

test('inactive incognito chat row shell keeps its patterned background across the whole row', () => {
  assert.deepStrictEqual(getInactiveChatRowShellSx(true), {
    mx: '0.25rem',
    my: '0.1875rem',
    borderRadius: 'sm',
    backgroundColor: 'background.level2',
    transition: 'background-color 0.16s ease',
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03), rgba(0,0,0,0.03) 10px, transparent 10px, transparent 20px)',
    '&:hover': {
      backgroundColor: 'background.level3',
    },
    '&:focus-within': {
      backgroundColor: 'background.level3',
    },
    border: '1px solid',
    borderColor: 'background.level3',
    '& .MuiListItemDecorator-root': {
      color: '#9C27B0',
    },
  });
});

test('folder tint background image converts supported hex colors and ignores invalid values', () => {
  assert.equal(
    getFolderTintBackgroundImage('#f13d41', 0.1),
    'linear-gradient(rgba(241, 61, 65, 0.1), rgba(241, 61, 65, 0.1))',
  );
  assert.equal(
    getFolderTintBackgroundImage('#abc', 0.07),
    'linear-gradient(rgba(170, 187, 204, 0.07), rgba(170, 187, 204, 0.07))',
  );
  assert.equal(getFolderTintBackgroundImage('warning', 0.07), undefined);
});

test('folder tint hover helper creates only the overlay layer', () => {
  assert.deepStrictEqual(
    getFolderTintHoverSx('#f13d41', 0.12),
    { backgroundImage: 'linear-gradient(rgba(241, 61, 65, 0.12), rgba(241, 61, 65, 0.12))' },
  );
  assert.deepStrictEqual(getFolderTintHoverSx(undefined, 0.12), {});
});

test('inactive chat hover helper keeps row-wide hover colors aligned', () => {
  assert.deepStrictEqual(getInactiveChatHoverSx(false, '#f13d41'), {
    backgroundColor: 'neutral.softHoverBg',
    backgroundImage: 'linear-gradient(rgba(241, 61, 65, 0.12), rgba(241, 61, 65, 0.12))',
  });
  assert.deepStrictEqual(getInactiveChatHoverSx(true), {
    backgroundColor: 'background.level3',
  });
});

test('inactive delete button stays hidden until the row shell is hovered', () => {
  assert.deepStrictEqual(getInactiveChatDeleteButtonSx(false), {
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
      backgroundColor: '#202426',
    },
    '&:focus-visible': {
      opacity: 1,
      backgroundColor: '#202426',
    },
  });
});

test('armed inactive delete button stays visually aligned while keeping hover feedback on the icon button itself', () => {
  assert.deepStrictEqual(getInactiveChatDeleteButtonSx(true), {
    position: 'absolute',
    top: '50%',
    right: 6,
    transform: 'translateY(-50%)',
    zIndex: 1,
    opacity: 1,
    backgroundColor: 'transparent',
    '&:hover': {
      backgroundColor: '#202426',
    },
    '&:focus-visible': {
      backgroundColor: '#202426',
    },
  });
});

test('armed inactive confirm delete button gets its own slot so it does not overlap the cancel button', () => {
  assert.deepStrictEqual(getInactiveChatConfirmDeleteButtonSx(), {
    position: 'absolute',
    top: '50%',
    right: 38,
    transform: 'translateY(-50%)',
    zIndex: 1,
    opacity: 1,
  });
});

test('inactive main button reserves space for the overlaid delete action and keeps the row visually continuous', () => {
  assert.deepStrictEqual(getInactiveChatMainButtonSx(false, false), {
    '--joy-palette-neutral-plainHoverBg': 'transparent',
    '--joy-palette-neutral-plainActiveBg': 'transparent',
    flex: 1,
    border: 'none',
    position: 'relative',
    borderRadius: 'sm',
    minHeight: '2.5rem',
    mr: '2.75rem',
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
  });

  assert.deepStrictEqual(getInactiveChatMainButtonSx(false, true), {
    '--joy-palette-neutral-plainHoverBg': 'transparent',
    '--joy-palette-neutral-plainActiveBg': 'transparent',
    flex: 1,
    border: 'none',
    position: 'relative',
    borderRadius: 'sm',
    minHeight: '2.5rem',
    mr: '5rem',
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
  });

  assert.deepStrictEqual(getInactiveChatMainButtonSx(false, false, '#f13d41'), {
    '--joy-palette-neutral-plainHoverBg': 'transparent',
    '--joy-palette-neutral-plainActiveBg': 'transparent',
    flex: 1,
    border: 'none',
    position: 'relative',
    borderRadius: 'sm',
    minHeight: '2.5rem',
    mr: '2.75rem',
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
  });

  assert.deepStrictEqual(getInactiveChatMainButtonSx(true, false), {
    '--joy-palette-neutral-plainHoverBg': 'transparent',
    '--joy-palette-neutral-plainActiveBg': 'transparent',
    flex: 1,
    border: 'none',
    position: 'relative',
    borderRadius: 'sm',
    minHeight: '2.5rem',
    mr: '2.75rem',
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
    filter: 'contrast(0)',
  });
});

test('delete confirmation button uses danger styling instead of success styling', () => {
  assert.deepStrictEqual(getDeleteConfirmButtonProps(), {
    variant: 'soft',
    color: 'danger',
    sx: {
      opacity: 1,
      mr: 0.5,
    },
  });
});

test('title editor uses a softer integrated surface for inactive chat rows', () => {
  assert.deepStrictEqual(getChatTitleEditorSx(false), {
    flexGrow: 1,
    ml: -1.5,
    mr: -0.5,
    px: 0.75,
    py: 0.375,
    borderRadius: 'md',
    border: '1px solid',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    color: 'text.primary',
    boxShadow: 'none',
    transition: 'background-color 0.16s ease, border-color 0.16s ease',
    '&:hover': {
      backgroundColor: 'transparent',
    },
    '&:focus-within': {
      backgroundColor: 'transparent',
      borderColor: 'primary.outlinedBorder',
    },
  });
});

test('title editor keeps active rows on the same color family as the row', () => {
  assert.deepStrictEqual(getChatTitleEditorSx(true), {
    flexGrow: 1,
    ml: -1.5,
    mr: -0.5,
    px: 0.75,
    py: 0.375,
    borderRadius: 'md',
    border: '1px solid',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    color: 'common.white',
    boxShadow: 'none',
    transition: 'background-color 0.16s ease, border-color 0.16s ease',
    '&:hover': {
      backgroundColor: 'transparent',
    },
    '&:focus-within': {
      backgroundColor: 'transparent',
      borderColor: 'rgba(255 255 255 / 0.24)',
    },
  });
});
