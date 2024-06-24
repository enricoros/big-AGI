import { Box, styled, Textarea } from '@mui/joy';

import { lineHeightChatTextMd } from '~/common/app.theme';


const blocksTextStyleSx = {
  // note: this will be used for non-blocks mainly (errors and other strings ourside of RenderXYX)
  lineHeight: lineHeightChatTextMd,

  // customize the text selection color (also in edit mode)
  '& *::selection': {
    // backgroundColor: '#fc70c3',
    backgroundColor: 'var(--joy-palette-primary-solidBg)',
    color: 'var(--joy-palette-primary-solidColor)',
  },
};


/**
 * This style is reused by all the Fragments (BlocksRenderer being the Text one),
 * contained within a singe Grid (1fr) in the Message component.
 */
export const BlocksContainer = styled(Box)({
  // the parent is a Grid, and this takes up to the Grid's width
  // - maxWidth: '100%' makes sure we don't x-scroll the whole chat window
  // - width: '100%' would also maximize the fragment width to the containing grid even if smaller
  // NOTE 1: we choose just `maxWidth` to allow the grid to place this towards the start/end of the message
  // however see `ContentPartTextEdit` where we set the width to 100% as we need a large editor
  // NOTE 2: after seeing html/code fragments smaller than the text fragments before them, we're back
  // to using width: 100% to make sure the fragments are all the same width (we lose the alignment unfortunately)
  width: '100%',

  // enables children's x-scrollbars (clips to the Fragment, so sub-parts will stay within this)
  overflowX: 'auto',

  // text style
  ...blocksTextStyleSx,
});

/**
 * Use this TextArea for block-like looks while editing.
 */
export const BlocksTextarea = styled(Textarea)({
  // very important: back to a 100% width - the parent is a Grid - see why we need this in BlocksContainer
  width: '100%',

  // just shrink padding tiny bit
  paddingBlock: '0.25rem',
  // marginBlock: '-0.25rem',

  // make the editing stand out a bit more
  boxShadow: 'inset 1px 0px 3px -2px var(--joy-palette-warning-softColor)',
  outline: '1px solid',
  outlineColor: 'var(--joy-palette-warning-solidBg)',

  // text style
  ...blocksTextStyleSx,
});
