import * as React from 'react';

import { Box, Button, Chip, LinearProgress, Sheet, Switch, Textarea, Typography } from '@mui/joy';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { speakText } from '../speex.client';
import { speex_splitTextIntoChunks } from '../speex.processing';


// Test sample texts
const TEST_TEXTS = {
  short: 'Hello, this is a short test of the text-to-speech system.',
  multi: `This is the first paragraph. It should be spoken first, and the system should wait for playback to complete.

Here comes the second paragraph. If you hear this after the first one finishes, sequential playback works.

And finally, the third paragraph. This confirms chunking and sequential playback work correctly.`,
  long: `The quick brown fox jumps over the lazy dog. This is a classic pangram containing every letter of the English alphabet.

Now let's test the chunking system. When text exceeds the maximum chunk length, it should split at natural boundaries like paragraphs or sentences.

Here's another paragraph with multiple sentences. The first sentence ends here. The second provides more content. The third wraps things up.

Finally, we conclude with a shorter paragraph to verify varying lengths are handled appropriately.`,
};


export function SpeexSystemTest() {

  // state
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState({ current: 0, total: 0 });
  const [log, setLog] = React.useState<string[]>([]);
  const [customText, setCustomText] = React.useState(TEST_TEXTS.multi);
  const [maxChunkLength, setMaxChunkLength] = React.useState<false | number>(200);
  const [noCleanup, setNoCleanup] = React.useState(false);
  const [noStreaming, setNoStreaming] = React.useState(false);
  const [noLivePlay, setNoLivePlay] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // helpers
  const addLog = React.useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-14), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const clearLog = React.useCallback(() => setLog([]), []);

  // handlers
  const handleTestSequential = React.useCallback(async () => {
    if (isPlaying) return;

    setIsPlaying(true);
    clearLog();
    setProgress({ current: 0, total: 0 });
    abortControllerRef.current = new AbortController();

    addLog(`Start ${customText.length}c chunk=${maxChunkLength}`);

    const result = await speakText(
      customText,
      undefined,
      {
        maxChunkLength,
        disableUnspeakable: noCleanup,
        rpcDisableStreaming: noStreaming,
        disableLivePlayback: noLivePlay,
      },
      abortControllerRef.current.signal,
      {
        onChunkStart: (p) => {
          setProgress({ current: p.chunkIndex, total: p.totalChunks });
          addLog(`▶ ${p.chunkIndex + 1}/${p.totalChunks}`);
        },
        onChunkEnd: (p) => {
          setProgress({ current: p.chunkIndex + 1, total: p.totalChunks });
          addLog(`✓ ${p.chunkIndex + 1}/${p.totalChunks}`);
        },
        onChunkError: (error, p) => {
          addLog(`✗ ${p.chunkIndex + 1}: ${error.message}`);
        },
        onComplete: (aborted) => {
          addLog(aborted ? 'Aborted' : 'Done');
        },
      },
    );

    addLog(`${result.chunksSpoken}/${result.totalChunks} spoken`);
    setIsPlaying(false);
    abortControllerRef.current = null;
  }, [isPlaying, customText, maxChunkLength, noCleanup, noStreaming, noLivePlay, addLog, clearLog]);

  const handleStop = React.useCallback(() => {
    if (abortControllerRef.current) {
      addLog('Stopping...');
      abortControllerRef.current.abort();
    }
  }, [addLog]);

  const handleTestChunking = React.useCallback(() => {
    clearLog();
    if (maxChunkLength === false) {
      addLog(`No chunking (${customText.length}c)`);
      return;
    }
    const chunks = speex_splitTextIntoChunks(customText, maxChunkLength);
    addLog(`${customText.length}c → ${chunks.length} chunks`);
    chunks.forEach((chunk, i) => {
      addLog(` [${i + 1}] ${chunk.length}c: "${chunk.slice(0, 30)}${chunk.length > 30 ? '…' : ''}"`);
    });
  }, [customText, maxChunkLength, addLog, clearLog]);

  // derived
  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Sheet variant='soft' color='warning' sx={{ p: 2, borderRadius: 'md' }}>

      {/* Preset + Chunk length */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1, alignItems: 'center' }}>
        <Typography level='body-xs' sx={{ mr: 0.5 }}>Text:</Typography>
        {Object.keys(TEST_TEXTS).map((key) => (
          <Chip
            key={key}
            size='sm'
            variant={customText === TEST_TEXTS[key as keyof typeof TEST_TEXTS] ? 'solid' : 'outlined'}
            onClick={() => setCustomText(TEST_TEXTS[key as keyof typeof TEST_TEXTS])}
            sx={{ cursor: 'pointer' }}
          >
            {key}
          </Chip>
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography level='body-xs' sx={{ mr: 0.5 }}>Chunk:</Typography>
        {([false, 50, 200, 400] as const).map((len) => (
          <Chip key={String(len)} size='sm' variant={maxChunkLength === len ? 'solid' : 'outlined'} onClick={() => setMaxChunkLength(len)} sx={{ cursor: 'pointer' }}>
            {len === false ? 'off' : len}
          </Chip>
        ))}
      </Box>

      {/* Switches */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1, alignItems: 'center' }}>
        <Typography level='body-xs' endDecorator={<Switch size='sm' checked={!noCleanup} onChange={(e) => setNoCleanup(!e.target.checked)} />}>Cleanup</Typography>
        <Typography level='body-xs' endDecorator={<Switch size='sm' checked={!noStreaming} onChange={(e) => setNoStreaming(!e.target.checked)} />}>Stream</Typography>
        <Typography level='body-xs' endDecorator={<Switch size='sm' checked={!noLivePlay} onChange={(e) => setNoLivePlay(!e.target.checked)} />}>Live</Typography>
      </Box>

      {/* Text input */}
      <Textarea
        size='sm'
        minRows={2}
        maxRows={4}
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        placeholder='Enter text to test...'
        sx={{ mb: 1.5 }}
      />

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <Button color='success' disabled={isPlaying || !customText.trim()} startDecorator={<PlayArrowRoundedIcon />} onClick={handleTestSequential}>
          Play
        </Button>
        <Button color='danger' disabled={!isPlaying} startDecorator={<StopRoundedIcon />} onClick={handleStop}>
          Stop
        </Button>
        <Button color='neutral' onClick={handleTestChunking} disabled={isPlaying || !customText.trim()}>
          Chunking
        </Button>
        {log.length > 0 && (
          <Button size='sm' variant='plain' color='neutral' onClick={clearLog} sx={{ ml: 'auto' }}>
            Clear
          </Button>
        )}
      </Box>

      {/* Progress bar */}
      {isPlaying && (
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography level='body-xs'>{progress.current}/{progress.total} chunks</Typography>
            <Typography level='body-xs'>{Math.round(progressPercent)}%</Typography>
          </Box>
          <LinearProgress determinate value={progressPercent} />
        </Box>
      )}

      {/* Log output */}
      {log.length > 0 && (
        <Sheet variant='soft' sx={{
          p: 1,
          fontFamily: 'code',
          fontSize: 'xs',
          maxHeight: 320,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {log.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))}
        </Sheet>
      )}

    </Sheet>
  );
}
