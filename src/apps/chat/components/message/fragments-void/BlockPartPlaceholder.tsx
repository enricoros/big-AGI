import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip, ColorPaletteProp, Divider, Tooltip } from '@mui/joy';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ClearAllRoundedIcon from '@mui/icons-material/ClearAllRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CodeIcon from '@mui/icons-material/Code';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import RepeatIcon from '@mui/icons-material/Repeat';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';
import { RenderCodeMemo } from '~/modules/blocks/code/RenderCode';
import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { DMessageFragmentId, DVoidPlaceholderMOp, DVoidPlaceholderPart } from '~/common/stores/chat/chat.fragments';
import { DataStreamViz } from '~/common/components/DataStreamViz';
import { adjustContentScaling, ContentScaling, themeScalingMap } from '~/common/app.theme';
import { animationSpinHalfPause } from '~/common/util/animUtils';


// configuration
const DATASTREAM_VISUALIZATION_DELAY = Math.round(2 * Math.PI * 1000);
const MODELOP_TIMEOUT_DELAY = 5; // seconds
const MODELOP_TIMEOUT_LIMIT = 300; // seconds

const modelOperationConfig: Record<DVoidPlaceholderMOp['mot'], { Icon: React.ElementType, color: ColorPaletteProp }> = {
  'search-web': { Icon: SearchRoundedIcon, color: 'neutral' },
  'gen-image': { Icon: BrushRoundedIcon, color: 'success' },
  'code-exec': { Icon: CodeIcon, color: 'primary' },
} as const;


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
  },

  followUpChipIcon: {
    fontSize: '1rem',
    mr: 0.5,
    animation: `${animationSpinHalfPause} 2s ease-in-out infinite`,
  },

  opList: {
    // backgroundColor: 'red',
    px: 1.5,
    display: 'flex',
    flexDirection: 'column',
  },

  opChipTooltip: {
    borderRadius: 'xs',
    boxShadow: 'md',
    fontSize: 'xs',
    whiteSpace: 'pre-wrap',
    maxWidth: '96vw',
    p: 2,
  },
  opChip: {
    maxWidth: '100%', // fundamental for the ellipsize to work
    // width: '100%', // would have way less 'jumpy-ness'
    minWidth: 100, // safety floor, constant across active/done states
    // fontWeight: 500,
    minHeight: '1.75rem',
    // replaced by Box with px: 2
    // mx: 1.5, // example: RenderPlainText has _styles.typography.mx = 1.5
    pl: 1.5,
    pr: 1.75,
    boxShadow: 'inset 1px 1px 4px -2px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s ease',
    '& .MuiChip-startDecorator': {
      marginRight: '0.5em',
    },
  },
  opChipDone: {
    boxShadow: undefined, // reset
    color: 'text.tertiary',
    background: 'transparent',
    // done chips are rendered in 'plain' only, so the following works, otherwise it would remove the bg even in 'soft' for instance
    '& > button': {
      background: 'transparent',
    },
  },
} as const satisfies Record<string, SxProps>;


// --- Render Follow-Up ---

function RenderChipFollowUp(props: {
  text: string
}) {
  return (
    <Chip
      size='sm'
      color='primary'
      variant='soft'
      sx={_styles.followUpChip}
      startDecorator={<HourglassEmptyIcon sx={_styles.followUpChipIcon} />}
    >
      {props.text}
    </Chip>
  )
}


// --- Render AIX Control ---

function RenderChipAixControl({ aixControl, text }: {
  text: string,
  aixControl: Exclude<DVoidPlaceholderPart['aixControl'], undefined>, // DVoidPlaceholderAixControlRetry
}) {

  // derived
  let startText: number | string | undefined;
  let color: ColorPaletteProp;
  let Icon: React.ElementType | undefined;
  if (aixControl.ctl === 'ac-info')
    color = 'primary';
  else if (aixControl.ctl === 'ec-retry') {
    const { rCauseConn, rCauseHttp, rScope } = aixControl;
    startText = rCauseHttp || rCauseConn || rScope;
    color = rScope === 'srv-dispatch' ? 'primary'
      : rScope === 'srv-op' ? 'warning'
        : 'danger';
    Icon = RepeatIcon;
  } else
    color = 'danger';

  return (
    <Chip
      size='sm'
      color={color}
      variant='soft'
      startDecorator={startText ? <div style={{ opacity: 0.75, textWrap: 'nowrap' }}>{startText}</div> : Icon ? <Icon style={{ opacity: 0.75 }} /> : undefined}
      sx={{
        mx: 1.5, // usual, esp for the looks into Beam
        gap: 1.5,
        px: 1.5,
        py: 0.375,
        my: '1px', // to not crop the outline on mobile, or on beam
        boxShadow: `inset 1px 2px 2px -1px var(--joy-palette-${color}-outlinedBorder)`,
        // outline: `1px solid var(--joy-palette-${color}-outlinedBorder)`,
        // wrap text if needed - introduced for retry error messages
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }}
    >
      {text || 'Unknown Stream Control'}
    </Chip>
  );
}


// --- Render Model Operations ---

function RenderChipListModelOps(props: {
  opLog: Exclude<DVoidPlaceholderPart['opLog'], undefined>,
  contentScaling: ContentScaling,
  messagePendingIncomplete: boolean,
  fragmentId: DMessageFragmentId,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
}) {

  // destructure
  const { contentScaling, opLog, fragmentId, onFragmentDelete } = props;

  // memo ordering - children right after their parent (recursive, for PFC nesting)
  const ordered = React.useMemo(() => {

    // fast path: no nesting -> keep insertion order
    if (!opLog.some(e => e.parentOpId)) return opLog;

    // collect children by parent
    const roots: DVoidPlaceholderMOp[] = [];
    const childrenOf = new Map<string, DVoidPlaceholderMOp[]>();
    for (const e of opLog)
      if (e.parentOpId) (childrenOf.get(e.parentOpId) ?? childrenOf.set(e.parentOpId, []).get(e.parentOpId)!).push(e);
      else roots.push(e);

    // recursively emit entry + descendants, then orphans
    const result: DVoidPlaceholderMOp[] = [];
    const placed = new Set<DVoidPlaceholderMOp>();
    const emit = (entry: DVoidPlaceholderMOp) => {
      result.push(entry);
      placed.add(entry);
      if (entry.opId)
        for (const child of childrenOf.get(entry.opId) ?? [])
          emit(child);
    };
    for (const root of roots) emit(root);
    for (const e of opLog) if (!placed.has(e)) result.push(e);

    return result;
  }, [opLog]);

  if (!ordered.length) return null;

  return (
    <BlocksContainer sx={_styles.opList}>

      {/* Operations list, with indentations */}
      {ordered.map((entry, i) => (
        <Box
          key={entry.opId}
          sx={!entry.level ? undefined : {
            ml: 2.125 * entry.level,
            borderLeft: '1px solid var(--joy-palette-neutral-outlinedBorder)',
            pl: 0.5,
          }}
        >
          <ModelOperationChip
            op={entry}
            contentScaling={contentScaling}
            messagePendingIncomplete={props.messagePendingIncomplete}
          />
        </Box>
      ))}

      {/* Harakiri chip, if possible (the div avoids x-stretching) */}
      {!!onFragmentDelete && <div>
        <OperationsHarakiriChip
          label='Clear steps'
          fragmentId={fragmentId}
          contentScaling={contentScaling}
          onFragmentDelete={onFragmentDelete}
        />
      </div>}

    </BlocksContainer>
  );
}

function ModelOperationChip(props: {
  op: DVoidPlaceholderMOp,
  contentScaling: ContentScaling,
  messagePendingIncomplete: boolean,
}) {

  // state
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  // derived
  const { mot, cts, text, state, iTexts, oTexts } = props.op;
  const { Icon, color } = modelOperationConfig[mot] ?? {};
  const isDone = state === 'done';
  const isError = state === 'error';
  const isFinished = isDone || isError;

  const iText = iTexts?.join('\n\n').trimStart() ?? null;
  const oText = oTexts?.join('\n') ?? null;
  const hasDetails = !!iText || !!oText;

  const timerIsActive = props.messagePendingIncomplete && !isFinished && Math.floor((Date.now() - cts) / 1000) < MODELOP_TIMEOUT_LIMIT;

  // [effect] show the elapsed time
  React.useEffect(() => {
    if (!timerIsActive) return; // prevent long-past timers to show
    const timerId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - cts) / 1000);
      if (elapsed >= MODELOP_TIMEOUT_DELAY)
        setElapsedSeconds(elapsed);
    }, 1000);
    return () => {
      clearInterval(timerId);
      setElapsedSeconds(0);
    };
  }, [cts, timerIsActive]);


  // memo style
  const chipSx: SxProps = React.useMemo(() => ({
    ..._styles.opChip,
    ...(isFinished && _styles.opChipDone),
    ...(isError && { color: undefined /* we inherit 'warning' */ }),
    ...(hasDetails && { cursor: 'pointer' }),
    fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
  }), [isFinished, isError, hasDetails, props.contentScaling]);

  const chipElement = (
    <Chip
      size='sm'
      color={isError ? 'warning' : isFinished ? 'neutral' : color}
      variant={isFinished ? 'plain' : 'soft'}
      onClick={!hasDetails ? undefined : () => false}
      startDecorator={isError ? <CloseRoundedIcon /> : isDone ? <CheckRoundedIcon /> : <Icon />}
      sx={chipSx}
    >
      <span className='agi-ellipsize'>
        {text}
        {elapsedSeconds >= MODELOP_TIMEOUT_DELAY && (
          <span style={{ opacity: 0.6 }}>
            {' · '}<span style={{ display: 'inline-block', minWidth: elapsedSeconds >= 100 ? '4ch' : '3ch' }}>{elapsedSeconds}s</span>
          </span>
        )}
      </span>
    </Chip>
  );

  return !hasDetails ? chipElement : (
    <Tooltip variant='outlined' placement='top' arrow sx={_styles.opChipTooltip} title={
      <div>
        {/* Input: rendered as code if */}
        {!!iText && mot === 'code-exec' ? (
          <RenderCodeMemo
            code={iText}
            semiStableId={`model-op-input-${props.op.opId}`}
            title=''
            isPartial={false}
            renderHideTitle={true}
            sx={{ m: -1.5, fontSize: props.contentScaling }}
          />
        ) : iText}

        {!!iTexts?.length && !!oTexts?.length && <Divider sx={{ my: 2 }} />}

        {!!oTexts?.length && oTexts.map((t, i) => (
          <span key={i} style={t.startsWith('exit code:') ? { color: 'var(--joy-palette-warning-plainColor)', fontWeight: 600 } : undefined}>
            {i > 0 && '\n'}{t}
          </span>
        ))}
      </div>
    }>
      {chipElement}
    </Tooltip>
  );
}

function OperationsHarakiriChip(props: {
  label: string,
  fragmentId: DMessageFragmentId, // used for self deletion
  contentScaling: ContentScaling,
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
}) {

  const { fragmentId, onFragmentDelete } = props;

  // handler

  const handleDeleteSelf = React.useCallback(() => {
    onFragmentDelete(fragmentId);
  }, [fragmentId, onFragmentDelete]);


  // memo style
  const chipSx: SxProps = React.useMemo(() => ({
    ..._styles.opChip,
    ..._styles.opChipDone,
    fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
  }), [props.contentScaling]);

  return (
    <Chip
      size='sm'
      variant='plain'
      onClick={handleDeleteSelf}
      startDecorator={<ClearAllRoundedIcon /* sx={{ opacity: 0 }} */ />}
      sx={chipSx}
    >
      {props.label}
    </Chip>
  );
}


interface BlockPartPlaceholderProps {
  placeholderPart: DVoidPlaceholderPart,
  contentScaling: ContentScaling,
  messagePendingIncomplete: boolean,
  showAsDataStreamViz?: boolean,
  zenMode?: boolean,

  // used for self deletion
  fragmentId: DMessageFragmentId,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  // onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,
}

/**
 * Transient placeholder: follow-ups, retries, model-op progress (with PFC nesting), or italic text.
 */
export function BlockPartPlaceholder({ placeholderPart, contentScaling, messagePendingIncomplete, showAsDataStreamViz, zenMode, fragmentId, onFragmentDelete }: BlockPartPlaceholderProps){

  // state
  const [showVisualization, setShowVisualization] = React.useState(false);

  // derived state
  const { pText, pType, opLog, aixControl } = placeholderPart;
  const shouldShowViz = showAsDataStreamViz && !opLog?.length && !aixControl;


  // [effect] if allowed trigger the viz effect in 6.28 seconds, otherwise clear it
  React.useEffect(() => {
    if (!shouldShowViz) return setShowVisualization(false);
    const timerId = setTimeout(() => setShowVisualization(true), DATASTREAM_VISUALIZATION_DELAY);
    return () => clearTimeout(timerId);
  }, [shouldShowViz]);


  // rendering switchboard

  // Alternative placeholder visualization
  if (shouldShowViz && showVisualization)
    return <DataStreamViz height={1 + 8 * 4} />;

  // 1. autoChatFollowUps's 'Follow Up' notices
  if (pType === 'chat-gen-follow-up')
    return <RenderChipFollowUp text={pText} />;

  // 2. AIX Control renderer - only for error correction retry
  if (aixControl?.ctl)
    return <RenderChipAixControl text={pText} aixControl={aixControl} />;

  // 3. Model operation render - stacked list when multiple operations, single chip otherwise
  if (opLog?.length) return zenMode ? null : (
    <RenderChipListModelOps
      opLog={opLog}
      contentScaling={adjustContentScaling(contentScaling, -1)}
      messagePendingIncomplete={messagePendingIncomplete}
      fragmentId={fragmentId}
      onFragmentDelete={onFragmentDelete}
    />
  );

  // 4. 'placeholder text' in italic - used in various places in the app
  return (
    <ScaledTextBlockRenderer
      text={pText}
      contentScaling={contentScaling}
      textRenderVariant='text'
      // showAsDanger={false}
      showAsItalic={true}
    />
  );
}