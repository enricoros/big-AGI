import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip } from '@mui/joy';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import CodeIcon from '@mui/icons-material/Code';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import RepeatIcon from '@mui/icons-material/Repeat';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';
import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { DMessageRole } from '~/common/stores/chat/chat.message';
import type { DVoidPlaceholderModelOp, DVoidPlaceholderPart } from '~/common/stores/chat/chat.fragments';
import { adjustContentScaling, ContentScaling, themeScalingMap } from '~/common/app.theme';
import { DataStreamViz } from '~/common/components/DataStreamViz';
import { animationSpinHalfPause } from '~/common/util/animUtils';


// configuration
const DATASTREAM_VISUALIZATION_DELAY = Math.round(2 * Math.PI * 1000);
const MODELOP_TIMEOUT_DELAY = 5; // seconds
const MODELOP_TIMEOUT_LIMIT = 300; // seconds


const _styles = {
  followUpChip: {
    px: 1.5,
    py: 0.375,
    my: '1px', // to not crop the outline on mobile, or on beam
    outline: '1px solid',
    outlineColor: 'primary.solidBg', // .outlinedBorder
    boxShadow: `1px 2px 4px -3px var(--joy-palette-primary-solidBg)`,

    // wrap text if needed - introduced for retry error messages
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  } as const,

  followUpChipIcon: {
    fontSize: '1rem',
    mr: 0.5,
    animation: `${animationSpinHalfPause} 2s ease-in-out infinite`,
  } as const,

  opChip: {
    maxWidth: '100%', // fundamental for the ellipsize to work
    // width: '100%', // would have way less 'jumpy-ness'
    // minWidth: 200, // would work on mobile, but no clear advantage
    // fontWeight: 500,
    minHeight: '2rem',
    // replaced by Box with px: 2
    // mx: 1.5, // example: RenderPlainText has _styles.typography.mx = 1.5
    pl: 1.5,
    pr: 1.75,
    borderRadius: 'sm',
    boxShadow: 'inset 1px 1px 4px -2px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s ease',
    '& .MuiChip-startDecorator': {
      marginRight: '0.5em',
    },
  },
} as const satisfies Record<string, SxProps>;


const modelOperationConfig = {
  'search-web': { Icon: SearchRoundedIcon, color: 'neutral' },
  'gen-image': { Icon: BrushRoundedIcon, color: 'success' },
  'code-exec': { Icon: CodeIcon, color: 'primary' },
} as const;


function ModelOperationChip(props: {
  mot: 'search-web' | 'gen-image' | 'code-exec',
  cts: number,
  text: string,
  contentScaling: ContentScaling,
}) {

  // state
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  // derived
  const { Icon, color } = modelOperationConfig[props.mot] ?? {};
  const timerActive = Math.floor((Date.now() - props.cts) / 1000) < MODELOP_TIMEOUT_LIMIT;

  // [effect] show the elapsed time
  React.useEffect(() => {
    if (!timerActive) return; // prevent long-past timers to show
    const timerId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - props.cts) / 1000);
      if (elapsed >= MODELOP_TIMEOUT_DELAY)
        setElapsedSeconds(elapsed);
    }, 1000);
    return () => {
      clearInterval(timerId);
      setElapsedSeconds(0);
    };
  }, [props.cts, timerActive]);

  return (
    <Chip
      size='sm'
      color={color}
      variant='soft'
      startDecorator={<Icon />}
      sx={{
        ..._styles.opChip,
        fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
      }}
    >
      <span className='agi-ellipsize'>{props.text}{elapsedSeconds >= MODELOP_TIMEOUT_DELAY && <span style={{ opacity: 0.6 }}> · {elapsedSeconds}s</span>}</span>
    </Chip>
  );
}


export function BlockPartPlaceholder(props: {
  placeholderText: string,
  placeholderType?: DVoidPlaceholderPart['pType'],
  placeholderModelOp?: DVoidPlaceholderModelOp,
  placeholderAixControl?: DVoidPlaceholderPart['aixControl'],
  messageRole: DMessageRole,
  contentScaling: ContentScaling,
  showAsItalic?: boolean,
  showAsDataStreamViz?: boolean,
}) {

  // state
  const [showVisualization, setShowVisualization] = React.useState(false);

  // derived state
  const shouldShowViz = props.showAsDataStreamViz && !props.placeholderModelOp;


  React.useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;

    if (shouldShowViz)
      timerId = setTimeout(() => setShowVisualization(true), DATASTREAM_VISUALIZATION_DELAY);
    else
      setShowVisualization(false);

    return () => timerId && clearTimeout(timerId);
  }, [shouldShowViz]);


  // Alternative placeholder visualization
  if (shouldShowViz && showVisualization)
    return <DataStreamViz height={1 + 8 * 4} />;


  // Type-based visualization
  const isFollowUp = props.placeholderType === 'chat-gen-follow-up';
  if (isFollowUp) return (
    <Chip
      color='primary'
      variant='soft'
      size='sm'
      sx={_styles.followUpChip}
      startDecorator={<HourglassEmptyIcon sx={_styles.followUpChipIcon} />}
    >
      {props.placeholderText}
    </Chip>
  );

  // AIX Control renderer (e.g., error correction retry)
  if (props.placeholderAixControl?.ctl === 'ec-retry') {
    const { rScope, rCauseHttp, rCauseConn } = props.placeholderAixControl;
    const color = rScope === 'srv-dispatch' ? 'primary' : rScope === 'srv-op' ? 'warning' : 'danger';
    return (
      <Chip
        // size='sm'
        color={color}
        variant='soft'
        startDecorator={<div style={{ opacity: 0.75 }}>{rCauseHttp || rCauseConn || rScope}</div>}
        endDecorator={<RepeatIcon style={{ opacity: 0.5 }} />}
        onClick={() => console.log({ props })}
        sx={{
          gap: 1.5,
          px: 1.5,
          py: 0.375,
          my: '1px', // to not crop the outline on mobile, or on beam
          boxShadow: `1px 2px 4px -3px var(--joy-palette-${color}-solidBg)`,
          // wrap text if needed - introduced for retry error messages
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      >
        {props.placeholderText}
      </Chip>
    );
  }

  // Model operation renderer
  if (props.placeholderModelOp)
    return (
      <BlocksContainer>
        <Box sx={{ px: 1.5 }}>
          <ModelOperationChip
            text={props.placeholderText}
            mot={props.placeholderModelOp.mot}
            cts={props.placeholderModelOp.cts}
            contentScaling={adjustContentScaling(props.contentScaling, -1)}
          />
        </Box>
      </BlocksContainer>
    );

  return (
    <ScaledTextBlockRenderer
      text={props.placeholderText}
      contentScaling={props.contentScaling}
      textRenderVariant='text'
      showAsItalic={props.showAsItalic}
    />
  );
}