import * as React from 'react';

import type { ColorPaletteProp } from '@mui/joy/styles/types';
import { Box, Chip, Typography } from '@mui/joy';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import TextFieldsIcon from '@mui/icons-material/TextFields';

import { RenderMarkdown } from '~/modules/blocks/markdown/RenderMarkdown';
import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { adjustContentScaling, ContentScaling } from '~/common/app.theme';
import { createTextContentFragment, DMessageContentFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';


// configuration
const ENABLE_MARKDOWN_DETECTION = false;
// const REASONING_COLOR = '#ca74b8'; // '#f22a85' (folder-aligned), '#ca74b8' (emoji-aligned)
const REASONING_COLOR: ColorPaletteProp = 'success';
const ANTHROPIC_REDACTED_EXPLAINER = //  https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking#example-streaming-with-redacted-thinking
  'Some of Claude\'s internal reasoning has been automatically encrypted for safety reasons. This doesn\'t affect the quality of responses.';


const _styles = {

  block: {
    mx: 1.5,
  } as const,

  chip: {
    px: 1.5,
    py: 0.375,
    my: '1px', // to not crop the outline on mobile
    outline: '1px solid',
    outlineColor: `${REASONING_COLOR}.solidBg`, // .outlinedBorder
    boxShadow: `1px 2px 4px -3px var(--joy-palette-${REASONING_COLOR}-solidBg)`,
  } as const,

  chipDisabled: {
    px: 1.5,
    py: 0.375,
    my: '1px', // to not crop the outline on mobile
  } as const,

  chipIcon: {
    fontSize: '1rem',
    mr: 0.5,
  } as const,

  chipExpanded: {
    mt: '1px', // need to copy the `chip` mt
    px: 1.5,
    py: 0.375,
    // borderRadius: 'sm',
    // transition: 'border-radius 0.2s ease-in-out',
  } as const,

  text: {
    borderRadius: '12px',
    border: '1px solid',
    borderColor: `${REASONING_COLOR}.outlinedColor`,
    backgroundColor: `rgb(var(--joy-palette-${REASONING_COLOR}-lightChannel) / 15%)`, // similar to success.50
    boxShadow: 'inset 1px 1px 3px -3px var(--joy-palette-neutral-solidBg)',
    mt: 1,
    p: 1,

    // plain text style
    overflowWrap: 'anywhere',
    whiteSpace: 'break-spaces',

    // layout
    display: 'flex',
    flexDirection: 'column',
  } as const,

  buttonInline: {
    outline: 'none',
    // borderRadius: 'sm',
    // fontSize: 'xs',
  } as const,

} as const;


/** Detect if content is potentially markdown based on common markdown patterns */
function _maybeMarkdownReasoning(trimmed: string): boolean {
  // const trimmed = text.trimStart();
  return trimmed.startsWith('**')
    || trimmed.startsWith('# ')
    || /^#{2,6}\s/.test(trimmed);
}


export function BlockPartModelAux(props: {
  fragmentId: DMessageFragmentId,
  auxType: 'reasoning' | string,
  auxText: string,
  auxHasSignature: boolean,
  auxRedactedDataCount: number,
  zenMode: boolean,
  contentScaling: ContentScaling,
  isLastVoid: boolean,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,
}) {

  // state
  const [neverExpanded, setNeverExpanded] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);

  // external state
  const { showPromisedOverlay } = useOverlayComponents();

  // memo
  const scaledTypographySx = useScaledTypographySx(adjustContentScaling(props.contentScaling, -1), false, false);
  const textSx = React.useMemo(() => ({ ..._styles.text, ...scaledTypographySx }), [scaledTypographySx]);
  const maybeMarkdown = React.useMemo(() => !ENABLE_MARKDOWN_DETECTION || neverExpanded ? false : _maybeMarkdownReasoning(props.auxText), [neverExpanded, props.auxText]);

  let typeText = props.auxType === 'reasoning' ? 'Reasoning' : 'Auxiliary';


  // handlers

  const { onFragmentReplace } = props;
  const showInline = !!onFragmentReplace;

  const handleToggleExpanded = React.useCallback(() => {
    setNeverExpanded(false);
    setExpanded(on => !on);
  }, []);

  const handleInline = React.useCallback(() => {
    if (!onFragmentReplace) return;
    showPromisedOverlay('chat-message-inline-aux', {}, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText={<>
          Convert this {typeText.toLowerCase()} into regular message text?
          <br />
          It will become part of the message and can&apos;t be collapsed again.
        </>}
        positiveActionText='Convert'
      />,
    ).then(() => {
      onFragmentReplace(props.fragmentId, createTextContentFragment(props.auxText));
    }).catch(() => null /* ignore closure */);
  }, [onFragmentReplace, props.auxText, props.fragmentId, showPromisedOverlay, typeText]);


  // create up to 3 dots '.' based on the length of the auxText (1 dot per 100 characters)
  // const dots = '.'.repeat(Math.floor(props.auxText.length / 100) % 5);

  return <Box sx={_styles.block}>

    {/* Chip to expand/collapse */}
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
      <Chip
        color={props.isLastVoid ? REASONING_COLOR : 'neutral'}
        variant={expanded ? 'solid' : 'soft'}
        size='sm'
        onClick={handleToggleExpanded}
        sx={expanded ? _styles.chipExpanded : props.isLastVoid ? _styles.chip : _styles.chipDisabled}
        startDecorator={<AllInclusiveIcon sx={_styles.chipIcon}  /* sx={{ color: expanded ? undefined : REASONING_COLOR }} */ />}
        // startDecorator='🧠'
      >
        Show {typeText}
      </Chip>

      {expanded && showInline && !!props.auxText && (
        <Chip
          color={REASONING_COLOR}
          variant='soft'
          size='sm'
          disabled={!onFragmentReplace}
          onClick={!onFragmentReplace ? undefined : handleInline}
          endDecorator={<TextFieldsIcon />}
          sx={_styles.chip}
        >
          Make Regular Text
        </Chip>
      )}
    </Box>

    {/* Controlled Box */}
    <ExpanderControlledBox expanded={expanded}>

      {!neverExpanded && (
        (ENABLE_MARKDOWN_DETECTION && maybeMarkdown) ? (
          <Box sx={textSx}>
            <RenderMarkdown content={props.auxText} sx={{ ...scaledTypographySx, marginInline: '0!important' /* to override what's default in this component */ }} />
            {!!props.auxRedactedDataCount && <Box component='span' sx={{ color: 'text.disabled' }}> {ANTHROPIC_REDACTED_EXPLAINER}{'.'.repeat(props.auxRedactedDataCount % 5)}</Box>}
          </Box>
        ) : (
          <Typography sx={textSx}>
            <span>
              {props.auxText}
              {!!props.auxRedactedDataCount && <Box component='span' sx={{ color: 'text.disabled' }}> {ANTHROPIC_REDACTED_EXPLAINER}{'.'.repeat(props.auxRedactedDataCount % 5)}</Box>}
            </span>
          </Typography>
        )
      )}

    </ExpanderControlledBox>

  </Box>;
}