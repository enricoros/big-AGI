import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getChatTitleEditorSx,
  getDeleteConfirmButtonProps,
  getInactiveChatConfirmDeleteButtonSx,
  getInactiveChatDeleteButtonSx,
  getInactiveChatMainButtonSx,
  getInactiveChatRowShellSx,
} from './ChatDrawerItem.layout';

test('inactive chat row shell extends the soft background across the whole row', () => {
  assert.deepStrictEqual(getInactiveChatRowShellSx(false), {
    mx: '0.25rem',
    my: '0.1875rem',
    borderRadius: 'sm',
    backgroundColor: 'neutral.softBg',
  });
});

test('inactive incognito chat row shell keeps its patterned background across the whole row', () => {
  assert.deepStrictEqual(getInactiveChatRowShellSx(true), {
    mx: '0.25rem',
    my: '0.1875rem',
    borderRadius: 'sm',
    backgroundColor: 'background.level2',
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03), rgba(0,0,0,0.03) 10px, transparent 10px, transparent 20px)',
    border: '1px solid',
    borderColor: 'background.level3',
    '& .MuiListItemDecorator-root': {
      color: '#9C27B0',
    },
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
    flex: 1,
    border: 'none',
    position: 'relative',
    borderRadius: 'sm',
    minHeight: '2.5rem',
    mr: '2.75rem',
    backgroundColor: 'transparent',
    transition: 'background-color 0.16s ease',
    '&:hover': {
      backgroundColor: 'neutral.softHoverBg',
    },
    '&:focus-visible': {
      backgroundColor: 'neutral.softHoverBg',
    },
  });

  assert.deepStrictEqual(getInactiveChatMainButtonSx(false, true), {
    flex: 1,
    border: 'none',
    position: 'relative',
    borderRadius: 'sm',
    minHeight: '2.5rem',
    mr: '5rem',
    backgroundColor: 'transparent',
    transition: 'background-color 0.16s ease',
    '&:hover': {
      backgroundColor: 'neutral.softHoverBg',
    },
    '&:focus-visible': {
      backgroundColor: 'neutral.softHoverBg',
    },
  });

  assert.deepStrictEqual(getInactiveChatMainButtonSx(true, false), {
    flex: 1,
    border: 'none',
    position: 'relative',
    borderRadius: 'sm',
    minHeight: '2.5rem',
    mr: '2.75rem',
    backgroundColor: 'transparent',
    transition: 'background-color 0.16s ease',
    '&:hover': {
      backgroundColor: 'background.level3',
    },
    '&:focus-visible': {
      backgroundColor: 'background.level3',
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
