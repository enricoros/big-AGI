/**
 * Live SVG Animator - the takeover UI mounted by AppChat when the mode is active.
 *
 * Owns the loop lifecycle (AbortController) and the mic (useSpeechRecognition). The store holds all loop
 * state; this component subscribes to it. Empty state = prompt + Start; running state = large
 * current frame + live mic/steer ticker + stats + event log + Stop.
 */

import * as React from 'react';

import { Box, Button, Chip, CircularProgress, IconButton, Input, Sheet, Textarea, Tooltip, Typography } from '@mui/joy';
import MicIcon from '@mui/icons-material/Mic';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StopIcon from '@mui/icons-material/Stop';

import { useShallow } from 'zustand/react/shallow';

import { PLACEHOLDER_INTERIM_TRANSCRIPT, type SpeechResult, useSpeechRecognition } from '~/common/components/speechrecognition/useSpeechRecognition';
import { useLLM } from '~/common/stores/llms/llms.hooks';

import { LIVESVG_ASR_TIMEOUT_MS, LIVESVG_FRAMES_PER_CALL_MAX, type Frame } from './livesvg.types';
import { findLiveSvgLLM } from './livesvg.svgutils';
import { liveSvgActions, useLiveSvgStore } from './store-livesvg';
import { runLiveSvgLoop } from './livesvg.loop';


const _styles = {
  root: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'background.level3',
    p: { xs: 1, md: 2 },
    gap: 1.5,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  },
  // empty state
  emptyWrap: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    px: 2,
  },
  emptyInner: {
    width: '100%',
    maxWidth: 640,
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
  },
  // running state
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    flexWrap: 'wrap',
  },
  stage: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  micHud: {
    position: 'absolute',
    bottom: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    maxWidth: '92%',
    px: 1,
    py: 0.5,
    borderRadius: 'xl',
    backgroundColor: 'background.surface',
    boxShadow: 'md',
    zIndex: 1,
  },
  micCaption: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    // fixed width so the mic button doesn't jump around as the caption text changes
    width: 300,
    minWidth: 300,
    flexShrink: 0,
  },
  bigFrame: {
    width: 512,
    maxWidth: '100%',
    maxHeight: '100%',
    aspectRatio: '1 / 1',
    borderRadius: 'md',
    boxShadow: 'lg',
    overflow: 'hidden',
    backgroundColor: 'background.surface',
    '& svg': { width: '100%', height: '100%', display: 'block' },
  },
  statsPanel: {
    borderRadius: 'sm',
    p: 1,
    display: 'flex',
    gap: 2,
    alignItems: 'stretch',
    flexShrink: 0,
  },
  chart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '2px',
    height: 56,
    width: '100%',
    overflow: 'hidden',
  },
  chartBar: {
    flex: '1 1 0',
    minWidth: 2,
    maxWidth: 16,
    borderRadius: '2px 2px 0 0',
    backgroundColor: 'primary.solidBg',
  },
  statsNumbers: {
    display: 'flex',
    gap: 1.5,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  logPanel: {
    borderRadius: 'sm',
    p: 1,
    flexShrink: 0,
  },
  logScroll: {
    height: 88,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 0.25,
  },
  logLine: {
    fontFamily: 'code',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  ticker: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
} as const;


// curated starters - each has continuous motion the regenerate-every-frame loop can actually advance.
// (palette-shifts over static geometry are deliberately excluded: they read as a slideshow, not animation.)
// Each carries example voice steers, surfaced on hover and applicable live once it's playing.
const LIVESVG_TEMPLATES: { label: string; prompt: string; steers: string[] }[] = [
  {
    label: '🚀 Rocket launch',
    prompt: 'A flat-vector rocket on a launchpad under a starry sky. Ignite, lift off, climb, leave a trail, and shrink toward the stars. Bold, simple shapes.',
    steers: ['add stage separation', 'tilt it toward the moon', 'pull back to show the whole planet'],
  },
  {
    label: '🐹 Capybara hot spring',
    prompt: 'A round, content capybara sitting in a steaming vector hot spring, ripples spreading outward and steam curling upward. Cozy flat illustration.',
    steers: ['drop a yuzu fruit in the water', 'make it snow', 'add a tiny duck friend'],
  },
  {
    label: '🪐 Solar system forming',
    prompt: 'A black field with a bright central star. Planets condense from dust and begin orbiting at different speeds. Clean vector circles and orbit lines.',
    steers: ['give the third planet a moon', 'speed up the orbits', 'add a comet streaking through'],
  },
  {
    label: '🌱 Plant growing',
    prompt: 'A seed in soil on a flat pastel background. It sprouts, the stem rises, and leaves unfurl one by one. Simple, organic vector shapes.',
    steers: ['make it bloom into a flower', 'turn the petals red', 'add a bee circling it'],
  },
  {
    label: '💓 Beating heart',
    prompt: 'A single bold vector heart on a clean background, pulsing rhythmically, with concentric rings radiating outward on each beat.',
    steers: ['slow the heartbeat', 'shift it to cool blue', 'let it crack and then heal'],
  },
  {
    label: '🌊 Ocean and a sailboat',
    prompt: 'A simple sailboat on stylized vector waves, with gentle parallax swells and a sky shifting overhead. Calm and flat.',
    steers: ['whip up a storm', 'add a lighthouse on the right', 'calm it back to glassy water'],
  },
];


function Stat(props: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ textAlign: 'right', minWidth: 52 }}>
      <Typography level='title-sm' sx={{ lineHeight: 1.1 }}>{props.value}</Typography>
      <Typography level='body-xs' textColor='text.tertiary'>{props.label}</Typography>
    </Box>
  );
}

function TpsSparkline(props: { values: number[] }) {
  const max = Math.max(1, ...props.values);
  if (!props.values.length)
    return <Box sx={{ ..._styles.chart, alignItems: 'center', justifyContent: 'center' }}><Typography level='body-xs' textColor='text.tertiary'>no data yet</Typography></Box>;
  return (
    <Box sx={_styles.chart}>
      {props.values.map((v, i) => (
        <Box key={i} title={`gen ${i + 1}: ${v.toFixed(0)} tok/s`} sx={{ ..._styles.chartBar, height: `${Math.max(3, (v / max) * 100)}%` }} />
      ))}
    </Box>
  );
}

export function LiveSvgAnimator(props: { isMobile: boolean }) {

  // store state
  const { status, prompt, timeline, fps, currentFrameIndex, selectedLlmId, frameDelayMs, framesPerCall, error, recentSteers, totalGenerations, totalTokensIn, totalTokensOut, totalGenMs, tpsHistory, log } = useLiveSvgStore(useShallow((s) => ({
    status: s.status,
    prompt: s.prompt,
    timeline: s.timeline,
    fps: s.fps,
    currentFrameIndex: s.currentFrameIndex,
    selectedLlmId: s.selectedLlmId,
    frameDelayMs: s.frameDelayMs,
    framesPerCall: s.framesPerCall,
    error: s.error,
    recentSteers: s.recentSteers,
    totalGenerations: s.totalGenerations,
    totalTokensIn: s.totalTokensIn,
    totalTokensOut: s.totalTokensOut,
    totalGenMs: s.totalGenMs,
    tpsHistory: s.tpsHistory,
    log: s.log,
  })));

  // auto-scroll the event log to the bottom on new entries
  const logRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  // local state
  const [micEnabled, setMicEnabled] = React.useState(false);                    // push-to-talk intent (never auto-arms)
  const [micResult, setMicResult] = React.useState<SpeechResult | null>(null);  // current interim result, for live display
  const micAccumRef = React.useRef('');       // finalized text banked across silence-restarts this session
  const micSendingRef = React.useRef(false);  // a Stop click is in flight: the next 'done' becomes the steer
  const abortRef = React.useRef<AbortController | null>(null);

  // 'the' model: adopted from the chat's selected (Cerebras) model on enter - shown read-only
  const selectedLlm = useLLM(selectedLlmId);

  // voice steering via the browser ASR (the same engine the Composer uses). One callback handles interim
  // (shown live) and 'done': a silence/auto end just banks the text and keeps listening; sending happens
  // ONLY on an explicit Stop, asynchronously, when the flushed 'done' arrives with flagSendOnDone.
  const onSpeechResult = React.useCallback((result: SpeechResult) => {
    if (!result.done) {
      setMicResult({ ...result }); // spread: the engine mutates one object in place, so a new ref is needed to re-render
      return;
    }
    setMicResult(null);
    const chunk = result.transcript.trim();
    if (chunk)
      micAccumRef.current = micAccumRef.current ? micAccumRef.current + ' ' + chunk : chunk;
    // explicit Stop & send (flagSendOnDone is set by stopRecognition(true))
    if (result.flagSendOnDone || micSendingRef.current) {
      const full = micAccumRef.current.trim();
      micAccumRef.current = '';
      micSendingRef.current = false;
      setMicEnabled(false);
      if (full) {
        liveSvgActions().pushSteer(full);
        liveSvgActions().pushLog('info', `🎤 steer sent: “${full}”`);
      }
    }
  }, []);

  const { recognitionState, startRecognition, stopRecognition } = useSpeechRecognition('webSpeechApi', onSpeechResult, LIVESVG_ASR_TIMEOUT_MS);
  const micAvailable = recognitionState.isAvailable;

  // the mic never auto-arms: force it off whenever we're not actively running (so a loop restart doesn't re-arm it)
  React.useEffect(() => {
    if (status !== 'running') setMicEnabled(false);
  }, [status]);

  // drive the engine from the push-to-talk intent: start when armed, restart across silence-ends to keep
  // listening, stop when disarmed - but never while a Stop-and-send is in flight (that path stops it itself).
  React.useEffect(() => {
    if (!recognitionState.isAvailable || micSendingRef.current) return;
    const wantActive = status === 'running' && micEnabled;
    if (wantActive && !recognitionState.isActive)
      startRecognition();
    else if (!wantActive && recognitionState.isActive)
      stopRecognition(false);
  }, [status, micEnabled, recognitionState.isAvailable, recognitionState.isActive, startRecognition, stopRecognition]);

  // consolidated transcript shown live: banked text + current session's finalized + in-progress words
  // (minus the 'Listening...' placeholder). It never disappears mid-recording - it clears only on Stop.
  const liveTranscript = [
    micAccumRef.current,
    micResult?.transcript ?? '',
    micResult && micResult.interimTranscript !== PLACEHOLDER_INTERIM_TRANSCRIPT ? micResult.interimTranscript : '',
  ].map((s) => s.trim()).filter(Boolean).join(' ');
  // show only the tail (latest words) so the fixed-width caption stays put as you speak
  const liveTranscriptTail = liveTranscript.length > 64 ? '…' + liveTranscript.slice(-64) : liveTranscript;

  // stop the loop + release everything on unmount
  React.useEffect(() => () => {
    abortRef.current?.abort();
    liveSvgActions().stop();
  }, []);


  // handlers

  const handleStart = React.useCallback(() => {
    const trimmed = liveSvgActions().prompt.trim();
    if (!trimmed) return;
    const llmId = liveSvgActions().selectedLlmId || findLiveSvgLLM()?.id || null;
    if (!llmId) {
      liveSvgActions()._setError('No model available. Add a Cerebras key (Gemma multimodal) or any image-input model in Models, then pick it above.');
      return;
    }
    setMicEnabled(false);
    liveSvgActions().setSelectedLlmId(llmId);
    liveSvgActions().start(trimmed);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    void runLiveSvgLoop(llmId, ctrl.signal);
  }, []);

  const handlePreset = React.useCallback((promptText: string) => {
    liveSvgActions().setPrompt(promptText);
    handleStart();
  }, [handleStart]);

  const handleStop = React.useCallback(() => {
    liveSvgActions().stop();
    abortRef.current?.abort();
  }, []);

  const handleNew = React.useCallback(() => {
    abortRef.current?.abort();
    liveSvgActions().reset();
  }, []);

  // mic is push-to-activate: click to start a fresh capture; click again to STOP - the only thing that sends.
  // Stop is async (like the Composer): stopRecognition(true) flushes a final 'done' (flagSendOnDone) that
  // onSpeechResult turns into one steer. If the engine is mid-restart, send the banked text directly.
  const handleMicToggle = () => {
    if (!micAvailable) return;
    if (!micEnabled) {
      micAccumRef.current = '';
      micSendingRef.current = false;
      setMicResult(null);
      setMicEnabled(true);
      return;
    }
    micSendingRef.current = true;
    if (recognitionState.isActive) {
      stopRecognition(true);
    } else {
      const full = micAccumRef.current.trim();
      micAccumRef.current = '';
      micSendingRef.current = false;
      setMicResult(null);
      setMicEnabled(false);
      if (full) {
        liveSvgActions().pushSteer(full);
        liveSvgActions().pushLog('info', `🎤 steer sent: “${full}”`);
      }
    }
  };


  const showEmpty = status === 'idle' && timeline.length === 0;
  const latest: Frame | undefined = timeline[timeline.length - 1];

  // derived statistics
  const avgTps = totalGenMs > 0 ? totalTokensOut / (totalGenMs / 1000) : 0;
  const lastTps = tpsHistory.length ? tpsHistory[tpsHistory.length - 1] : 0;


  return (
    <Box sx={_styles.root}>

      {/* header - title + the adopted (read-only) model; exit via the toolbar toggle */}
      <Box sx={_styles.header}>
        <Typography level='title-md' sx={{ flexShrink: 0 }}>Cerebras - Live SVG</Typography>
        {/*{!!selectedLlm && <Chip size='sm' variant='outlined' color='neutral'>{selectedLlm.label}</Chip>}*/}
      </Box>

      {showEmpty ? (

        /* ---- empty state: prompt + Start ---- */
        <Box sx={_styles.emptyWrap}>
          <Box sx={_styles.emptyInner}>
            <Typography level='body-sm' textColor='text.tertiary'>
              Describe something that moves. The model redraws the whole scene every frame, so it keeps animating - and you can steer it out loud while it plays.
            </Typography>
            <Textarea
              autoFocus={!props.isMobile}
              minRows={3}
              maxRows={8}
              placeholder='e.g. a paper plane looping through a sunny sky'
              value={prompt}
              onChange={(e) => liveSvgActions().setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleStart();
              }}
            />
            {/* one-click starters: set the prompt and start playing immediately; hover for the voice steers */}
            <Box>
              <Typography level='body-xs' textColor='text.tertiary' sx={{ mb: 0.5 }}>Starters (click to play, then steer by voice):</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {LIVESVG_TEMPLATES.map((t) => (
                  <Tooltip
                    key={t.label}
                    variant='soft'
                    placement='top'
                    title={
                      <Box sx={{ maxWidth: 280, py: 0.25 }}>
                        <Typography level='body-xs' sx={{ mb: 0.5 }}>{t.prompt}</Typography>
                        <Typography level='body-xs' textColor='text.tertiary'>
                          Try saying: {t.steers.map((s) => `“${s}”`).join(' · ')}
                        </Typography>
                      </Box>
                    }
                  >
                    <Chip variant='soft' color='primary' onClick={() => handlePreset(t.prompt)}>
                      {t.label}
                    </Chip>
                  </Tooltip>
                ))}
              </Box>
            </Box>

            {!!error && <Typography level='body-sm' color='danger'>{error}</Typography>}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button color='primary' startDecorator={<PlayArrowIcon />} disabled={!prompt.trim()} onClick={handleStart}>
                Start
              </Button>
            </Box>
          </Box>
        </Box>

      ) : (

        /* ---- running state ---- */
        <>
          {/* controls + telemetry */}
          <Box sx={_styles.controls}>
            {status === 'running' ? (
              <Button color='danger' startDecorator={<StopIcon />} onClick={handleStop}>Stop</Button>
            ) : status === 'stopping' ? (
              <Button color='danger' variant='soft' startDecorator={<CircularProgress size='sm' />} disabled>Stopping…</Button>
            ) : (
              <>
                <Button color='primary' startDecorator={<PlayArrowIcon />} disabled={!prompt.trim()} onClick={handleStart}>Start again</Button>
                <Button color='neutral' variant='soft' startDecorator={<RestartAltIcon />} onClick={handleNew}>New</Button>
              </>
            )}

            <Chip size='sm' variant='outlined'>frame #{currentFrameIndex}</Chip>
            <Chip size='sm' variant='outlined'>{fps ? fps.toFixed(1) : '0.0'} fps</Chip>

            <Box sx={{ flex: 1 }} />

            {/* frames generated per inference call (1..4) - fewer calls => fewer rate-limit hits */}
            <Tooltip title='SVG frames generated per request (more = fewer calls, but blind intra-call continuity)'>
              <Input
                size='sm'
                type='number'
                value={framesPerCall}
                onChange={(e) => liveSvgActions().setFramesPerCall(Number(e.target.value) || 1)}
                startDecorator='frames/call'
                slotProps={{ input: { min: 1, max: LIVESVG_FRAMES_PER_CALL_MAX, step: 1 } }}
                sx={{ width: 170 }}
              />
            </Tooltip>

            {/* user-adjustable pause between generations (live; takes effect on the next frame) */}
            <Tooltip title='Pause between generations (helps avoid rate-limit errors)'>
              <Input
                size='sm'
                type='number'
                value={frameDelayMs}
                onChange={(e) => liveSvgActions().setFrameDelayMs(Number(e.target.value) || 0)}
                startDecorator='delay'
                endDecorator='ms'
                slotProps={{ input: { min: 0, step: 100 } }}
                sx={{ width: 170 }}
              />
            </Tooltip>
          </Box>

          {!!error && <Typography level='body-sm' color='danger'>{error}</Typography>}

          {/* large current frame, with the centered recording control overlaid */}
          <Box sx={_styles.stage}>
            {latest ? (
              <Box sx={_styles.bigFrame} dangerouslySetInnerHTML={{ __html: latest.svg }} />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: 'text.tertiary' }}>
                <CircularProgress />
                <Typography level='body-sm'>Generating first frame…</Typography>
              </Box>
            )}

            {/* centered recording mechanism: mic toggle + live transcript */}
            <Box sx={_styles.micHud}>
              <Tooltip title={!micAvailable ? 'Speech recognition unavailable in this browser' : micEnabled ? 'Stop & send' : 'Speak to steer'}>
                <IconButton
                  size='sm'
                  variant={micEnabled && status === 'running' ? 'solid' : 'soft'}
                  color={!micAvailable ? 'neutral' : micEnabled ? 'danger' : 'neutral'}
                  onClick={handleMicToggle}
                  sx={{ borderRadius: 'lg' }}
                >
                  <MicIcon />
                </IconButton>
              </Tooltip>
              <Typography level='body-sm' textColor='text.secondary' sx={_styles.micCaption}>
                {micEnabled
                  ? (liveTranscriptTail ? `“${liveTranscriptTail}”` : 'listening…')
                  : recentSteers.length ? `sent: ${recentSteers.slice(-1)[0]}` : 'tap to speak'}
              </Typography>
            </Box>
          </Box>

          {/* statistics: tokens/sec per generation chart + running totals */}
          <Sheet variant='soft' sx={_styles.statsPanel}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography level='body-xs' textColor='text.tertiary' sx={{ mb: 0.25 }}>Tokens/sec per generation</Typography>
              <TpsSparkline values={tpsHistory} />
            </Box>
            <Box sx={_styles.statsNumbers}>
              <Stat label='generations' value={totalGenerations} />
              <Stat label='out tokens' value={totalTokensOut.toLocaleString()} />
              <Stat label='in tokens' value={totalTokensIn.toLocaleString()} />
              <Stat label='avg tok/s' value={avgTps.toFixed(0)} />
              <Stat label='last tok/s' value={lastTps.toFixed(0)} />
            </Box>
          </Sheet>

          {/* event / error log - so failures are visible instead of silent placeholders */}
          <Sheet variant='soft' sx={_styles.logPanel}>
            <Typography level='body-xs' textColor='text.tertiary' sx={{ mb: 0.25 }}>Event log</Typography>
            <Box ref={logRef} sx={_styles.logScroll}>
              {!log.length ? (
                <Typography level='body-xs' textColor='text.tertiary'>No events yet.</Typography>
              ) : log.map((e) => (
                <Typography
                  key={e.id}
                  level='body-xs'
                  sx={_styles.logLine}
                  textColor={e.kind === 'error' ? 'danger.plainColor' : e.kind === 'warn' ? 'warning.plainColor' : 'text.tertiary'}
                >
                  {e.text}
                </Typography>
              ))}
            </Box>
          </Sheet>
        </>

      )}

    </Box>
  );
}
