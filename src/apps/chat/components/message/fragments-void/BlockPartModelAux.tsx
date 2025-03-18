import * as React from 'react';

import { Box, Chip, Typography } from '@mui/joy';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import TextFieldsIcon from '@mui/icons-material/TextFields';

import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { adjustContentScaling, ContentScaling } from '~/common/app.theme';
import { createTextContentFragment, DMessageContentFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';


// configuration
// const REASONING_COLOR = '#ca74b8'; // '#f22a85' (folder-aligned), '#ca74b8' (emoji-aligned)
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
    outlineColor: 'success.solidBg', // .outlinedBorder
    boxShadow: `1px 2px 4px -3px var(--joy-palette-success-solidBg)`,
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
    borderColor: 'success.outlinedColor',
    backgroundColor: 'rgb(var(--joy-palette-success-lightChannel) / 15%)', // similar to success.50
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

export function BlockPartModelAux(props: {
  fragmentId: DMessageFragmentId,
  auxType: 'reasoning' | string,
  auxText: string,
  auxHasSignature: boolean,
  auxRedactedDataCount: number,
  zenMode: boolean,
  contentScaling: ContentScaling,
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
        color='success'
        variant={expanded ? 'solid' : 'soft'}
        size='sm'
        onClick={handleToggleExpanded}
        sx={expanded ? _styles.chipExpanded : _styles.chip}
        startDecorator={<AllInclusiveIcon sx={_styles.chipIcon}  /* sx={{ color: expanded ? undefined : REASONING_COLOR }} */ />}
        // startDecorator='🧠'
      >
        Show {typeText}
      </Chip>

      {expanded && showInline && !!props.auxText && (
        <Chip
          color='success'
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
        <Typography sx={textSx}>
          <span>
            {props.auxText}
            {!!props.auxRedactedDataCount && <Box component='span' sx={{ color: 'text.disabled' }}> {ANTHROPIC_REDACTED_EXPLAINER}{'.'.repeat(props.auxRedactedDataCount % 5)}</Box>}
          </span>
        </Typography>
      )}

    </ExpanderControlledBox>

  </Box>;
}