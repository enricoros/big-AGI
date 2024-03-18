import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Typography } from '@mui/joy';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { animationEnterScaleUp } from '~/common/util/animUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';
import { useUICounter } from '~/common/state/store-ui';

import { BEAM_INVERT_USER_MESSAGE, SCATTER_RAY_DEF } from './beam.config';
import { BeamExplainer } from './BeamExplainer';
import { BeamPaneGather } from './BeamPaneGather';
import { BeamPaneScatter } from './BeamPaneScatter';
import { BeamRayGrid } from './BeamRayGrid';
import { BeamStoreApi, useBeamStore } from './store-beam.hooks';


const userMessageContainerSx: SxProps = {
  pt: 'var(--Pad)',
  px: 'var(--Pad)',
  mb: 'calc(-1 * var(--Pad))',
};

const userMessageContainerInvertedSx: SxProps = {
  ...userMessageContainerSx,
  backgroundColor: 'neutral.solidBg',
  pt: 0,
};

const userMessageSx: SxProps = {
  border: '1px solid',
  borderColor: 'primary.outlinedBorder',
  borderRadius: 'md',
  borderBottom: 'none',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  // px: '0.5rem',
  pr: '0.125rem',
  // boxShadow: 'sm',
  // the following make it end-aligned
  // borderBottomRightRadius: 0,
  // borderRight: 'none',
  // px: 'var(--Pad)',
} as const;

const assistantMessageSx: SxProps = {
  backgroundColor: 'success.softBg',
  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'md',
  borderBottom: 'none',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  px: '0.5rem',
  // boxShadow: 'sm',
  // the following make it start-aligned
  // borderTopLeftRadius: 0,
  // borderLeft: 'none',
} as const;


export function BeamView(props: {
  beamStore: BeamStoreApi,
  isMobile: boolean,
  showExplainer?: boolean,
}) {

  // state
  const [showHistoryMessage, setShowHistoryMessage] = React.useState(true);

  // linked state
  const { novel: explainerUnseen, touch: explainerCompleted, forget: explainerShow } = useUICounter('beam-wizard');
  const rayIds = useBeamStore(props.beamStore, useShallow(state => state.rays.map(ray => ray.rayId)));
  const raysCount = rayIds.length;
  const {
    inputHistory, inputIssues,
    mergeLlmId,
    readyScatter, isScattering,
    readyGather, isGathering,
  } = useBeamStore(props.beamStore, useShallow((state) => ({
    // state
    inputHistory: state.inputHistory,
    inputIssues: state.inputIssues,
    mergeLlmId: state.mergeLlmId,
    readyScatter: state.readyScatter,
    isScattering: state.isScattering,
    readyGather: state.readyGather,
    isGathering: state.isGathering,
  })));
  const { editInputHistoryMessage, setRayCount, startScatteringAll, stopScatteringAll, setMergeLlmId, terminate } = props.beamStore.getState();
  const [_, mergeLlmComponent] = useLLMSelect(mergeLlmId, setMergeLlmId, props.isMobile ? '' : 'Merge Model');

  // configuration

  const handleTerminate = React.useCallback(() => terminate(), [terminate]);

  const handleRaySetCount = React.useCallback((n: number) => setRayCount(n), [setRayCount]);

  const handleRayIncreaseCount = React.useCallback(() => setRayCount(raysCount + 1), [setRayCount, raysCount]);


  // runnning

  // [effect] pre-populate a default number of rays
  const bootup = raysCount < SCATTER_RAY_DEF;
  React.useEffect(() => {
    bootup && handleRaySetCount(SCATTER_RAY_DEF);
  }, [bootup, handleRaySetCount]);


  const lastMessage = inputHistory?.slice(-1)[0] || null;

  const otherHistoryCount = Math.max(0, (inputHistory?.length || 0) - 1);
  const isFirstMessageSystem = inputHistory?.[0]?.role === 'system';
  const userMessageDecorator = React.useMemo(() => {
    return (otherHistoryCount >= 1 && showHistoryMessage) ? (
      <Typography level='body-xs' sx={{ my: 1.5, opacity: 0.9 }} onClick={() => setShowHistoryMessage(on => !on)}>
        ... {otherHistoryCount === 1 ? (isFirstMessageSystem ? '1 system message' : '1 message') : `${otherHistoryCount} messages`} before ...
      </Typography>
    ) : null;
  }, [isFirstMessageSystem, otherHistoryCount, showHistoryMessage]);

  if (props.showExplainer && explainerUnseen)
    return <BeamExplainer onWizardComplete={explainerCompleted} />;

  return (
    <ScrollToBottom disableAutoStick>

      <Box sx={{
        // scroller fill
        minHeight: '100%',

        // enter animation
        animation: `${animationEnterScaleUp} 0.2s cubic-bezier(.17,.84,.44,1)`,

        // config
        '--Pad': { xs: '1rem', md: '1.5rem' },
        '--Pad_2': 'calc(var(--Pad) / 2)',

        // layout
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--Pad)',
        pb: 'var(--Pad)',
      }}>

        {/* Config Issues */}
        {!!inputIssues && <Alert>{inputIssues}</Alert>}


        {/* User Message */}
        {!!lastMessage && (
          <Box sx={BEAM_INVERT_USER_MESSAGE ? userMessageContainerInvertedSx : userMessageContainerSx}>
            <ChatMessageMemo
              message={lastMessage}
              fitScreen={props.isMobile}
              showAvatar={true}
              adjustContentScaling={-1}
              topDecorator={userMessageDecorator}
              onMessageEdit={editInputHistoryMessage}
              sx={userMessageSx}
            />
          </Box>
        )}

        {/* Scatter Controls */}
        <BeamPaneScatter
          isMobile={props.isMobile}
          rayCount={raysCount}
          setRayCount={handleRaySetCount}
          startEnabled={readyScatter}
          startBusy={isScattering}
          onStart={startScatteringAll}
          onStop={stopScatteringAll}
          onExplainerShow={explainerShow}
        />

        {/* Rays Grid */}
        <BeamRayGrid
          beamStore={props.beamStore}
          linkedLlmId={mergeLlmId}
          isMobile={props.isMobile}
          rayIds={rayIds}
          onIncreaseRayCount={handleRayIncreaseCount}
        />

        {/* Gather Message */}
        {/*{(!!gatherMessage && !!gatherMessage.updated) && (*/}
        {/*  <Box sx={{*/}
        {/*    px: 'var(--Pad)',*/}
        {/*    mb: 'calc(-1 * var(--Pad))',*/}
        {/*  }}>*/}
        {/*    <ChatMessageMemo*/}
        {/*      message={gatherMessage}*/}
        {/*      fitScreen={props.isMobile}*/}
        {/*      showAvatar={false}*/}
        {/*      adjustContentScaling={-1}*/}
        {/*      sx={assistantMessageSx}*/}
        {/*    />*/}
        {/*  </Box>*/}
        {/*)}*/}

        {/* Gather Controls */}
        <BeamPaneGather
          gatherBusy={isGathering}
          gatherCount={readyGather}
          gatherEnabled={readyGather > 0 && !isScattering}
          isMobile={props.isMobile}
          mergeLlmComponent={mergeLlmComponent}
          onStart={() => null}
          onStop={() => null}
          onClose={handleTerminate}
        />

      </Box>

    </ScrollToBottom>
  );
}


/* Commented code with a callout box to explain the first message
  <Box>
    <CalloutTopRightIcon sx={{ color: 'primary.solidBg', fontSize: '2.53rem', rotate: '-10deg' }} />
    <Chip
      color='primary'
      variant='solid'
      endDecorator={<ChipDelete onClick={() => alert('aa')} />}
      sx={{
        mx: -2,
        py: 1,
        px: 2,
      }}
    >
      Last message in the conversation
    </Chip>
  </Box>
*/