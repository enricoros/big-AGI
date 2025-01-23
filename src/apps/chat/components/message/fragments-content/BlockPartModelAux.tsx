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


const _styles = {

  block: {
    mx: 1.5,
  } as const,

  chip: {
    px: 1.5,
    py: 0.375,
    boxShadow: '0px 2px 4px -2px rgba(0, 0, 0, 0.25)',
  } as const,

  chipExpanded: {
    px: 1.5,
    py: 0.375,
  } as const,

  text: {
    backgroundColor: 'background.level1',
    borderRadius: 'md',
    boxShadow: 'inset 1px 1px 4px -3px var(--joy-palette-neutral-solidBg)',
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
  zenMode: boolean,
  contentScaling: ContentScaling,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,
}) {

  // state
  const [expanded, setExpanded] = React.useState(false);

  // external state
  const { showPromisedOverlay } = useOverlayComponents();

  // memo
  const scaledTypographySx = useScaledTypographySx(adjustContentScaling(props.contentScaling, -1), false, false);
  const textSx = React.useMemo(() => ({ ..._styles.text, ...scaledTypographySx }), [scaledTypographySx]);

  let typeText = props.auxType === 'reasoning' ? 'Thought Process' : 'Auxiliary';


  // handlers

  const { onFragmentReplace } = props;
  const showInline = !!onFragmentReplace;

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
        variant={expanded ? 'solid' : 'outlined'}
        size='sm'
        onClick={() => setExpanded(on => !on)}
        sx={expanded ? _styles.chipExpanded : _styles.chip}
        startDecorator={<AllInclusiveIcon />}
      >
        {expanded ? '' : <>&nbsp;Show </>}{typeText}
      </Chip>

      {expanded && showInline && (
        <Chip
          variant='outlined'
          size='sm'
          onClick={!onFragmentReplace ? undefined : handleInline}
          endDecorator={<TextFieldsIcon />}
          sx={_styles.chipExpanded}
        >
          Make Regular Text
        </Chip>
      )}
    </Box>

    {/* Controlled Box */}
    <ExpanderControlledBox expanded={expanded}>

      <Typography sx={textSx}>
        {props.auxText}
      </Typography>

    </ExpanderControlledBox>

  </Box>;
}