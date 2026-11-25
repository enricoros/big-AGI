/**
 * Engine test UI: the Test button and the result line under the engine panel.
 * The result is component state, voided when the engine, its profile or its credentials change.
 */

import * as React from 'react';

import { Alert, Box, Button, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { DASRxEngineAny } from '../asrx.types';
import type { ASRxEngineTestResult, ASRxTestWord } from '../asrx.engine-test';
import { asrxTestEngine } from '../asrx.engine-test';


type _ShownResult = Exclude<ASRxEngineTestResult, { outcome: 'aborted' }>;

export function useASRxEngineTest(engine: DASRxEngineAny) {

  // state
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<_ShownResult | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // a change to what the test exercised voids its result and stops a run in flight
  const testedSetup = JSON.stringify([engine.engineId, engine.profile, engine.credentials]);
  React.useEffect(() => {
    setResult(null);
    return () => abortRef.current?.abort();
  }, [testedSetup]);

  const run = React.useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setResult(null);
    // the controller outlives the transcript: a new run, a setup change or unmount still aborts what the run left going
    void asrxTestEngine(engine, controller.signal)
      .then(outcome => !controller.signal.aborted && outcome.outcome !== 'aborted' && setResult(outcome))
      .finally(() => abortRef.current === controller && setRunning(false));
  }, [engine]);

  const stop = React.useCallback(() => abortRef.current?.abort(), []);

  return { running, result, run, stop };
}


export function ASRxEngineTestButton({ test, disabled }: {
  test: ReturnType<typeof useASRxEngineTest>;
  disabled: boolean;
}) {
  const isError = test.result?.outcome === 'error';
  return (
    <Button
      size='sm'
      variant={test.running ? 'soft' : 'outlined'}
      color={test.running ? 'primary' : isError ? 'danger' : 'neutral'}
      disabled={disabled}
      startDecorator={test.running ? <StopRoundedIcon /> : <PlayArrowRoundedIcon />}
      onClick={test.running ? test.stop : test.run}
      sx={_styles.button}
    >
      {test.running ? 'Testing...' : isError ? 'Retry' : 'Test'}
    </Button>
  );
}


/** The result as an embossed alert, colored by verdict: passed, words off, or the test could not run. */
export function ASRxEngineTestResultLine({ result }: { result: _ShownResult }) {
  const color = result.outcome === 'error' ? 'danger' : result.grade.pass ? 'success' : 'warning';
  return (
    <Alert
      color={color}
      startDecorator={color === 'success' ? <CheckRoundedIcon /> : <WarningRoundedIcon />}
      sx={{
        ..._styles.alert,
        borderColor: `${color}.outlinedBorder`,
        boxShadow: `inset 1px 1px 4px -3px var(--joy-palette-${color}-solidHoverBg)`,
      }}
    >
      {result.outcome === 'error' ? (
        <Box sx={_styles.errorText}>{result.errorText}</Box>
      ) : (
        <ResultGraded result={result} />
      )}
    </Alert>
  );
}

function ResultGraded({ result }: { result: Extract<_ShownResult, { outcome: 'graded' }> }) {
  const { grade, latencyMs, languageForced } = result;
  const modelName = result.model.slice(result.model.indexOf('/') + 1); // 'openai/gpt-transcribe' -> 'gpt-transcribe'
  const wordsOff = `${grade.wordsOff} of ${grade.wordsTotal} words off`;
  return (
    <Box sx={_styles.result}>
      <div>
        <Box component='span' sx={_styles.verdict}>{grade.pass ? 'Passed' : wordsOff}</Box>
        {grade.pass && grade.wordsOff > 0 && <Box component='span' sx={_styles.detail}>{wordsOff}</Box>}
        <Box component='span' sx={_styles.detail}>{(latencyMs / 1000).toFixed(1)} s</Box>
        <Box component='span' sx={_styles.detail}>{modelName}</Box>
      </div>
      <Typography level='body-sm' sx={_styles.heard}>
        &quot;{grade.wordsOff ? <MarkedWords words={grade.words} /> : result.heardText}&quot;
      </Typography>
      {languageForced && (
        <Typography level='body-xs' sx={_styles.note}>
          Language set to English for this test
        </Typography>
      )}
    </Box>
  );
}


/** The transcript with each miss marked: expected words struck, wrong or extra heard words colored. */
function MarkedWords({ words }: { words: ASRxTestWord[] }) {
  return <>{words.map((word, index) => {
    const space = index ? ' ' : '';
    switch (word.op) {
      case 'ok':
        return <React.Fragment key={index}>{space}{word.heard}</React.Fragment>;
      case 'swap':
        return <React.Fragment key={index}>{space}<Box component='s' sx={_styles.wordExpected}>{word.expected}</Box> <Box component='span' sx={_styles.wordHeard}>{word.heard}</Box></React.Fragment>;
      case 'extra':
        return <React.Fragment key={index}>{space}<Box component='span' sx={_styles.wordHeard}>{word.heard}</Box></React.Fragment>;
      case 'missing':
        return <React.Fragment key={index}>{space}<Box component='s' sx={_styles.wordExpected}>{word.expected}</Box></React.Fragment>;
    }
  })}</>;
}


// --- styles ---

const _styles = {
  button: {
    ml: 2,
    minWidth: 120,
  },
  alert: {
    alignItems: 'flex-start', // icon on the first line
    border: '1px solid',
  },
  errorText: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  result: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.5,
  },
  verdict: {
    fontWeight: 'md',
  },
  detail: {
    ml: 1.5,
    opacity: 0.75,
  },
  heard: {
    color: 'text.secondary',
  },
  note: {
    color: 'text.tertiary',
  },
  wordExpected: {
    color: 'text.tertiary',
  },
  wordHeard: {
    color: 'danger.plainColor',
    fontWeight: 'md',
  },
} as const;
