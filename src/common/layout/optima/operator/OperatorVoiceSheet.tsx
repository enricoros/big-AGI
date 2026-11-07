import * as React from 'react';
import { keyframes } from '@emotion/react';

import { Box, Button, IconButton, Input, Typography } from '@mui/joy';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded';

import { BigAgiCircleIcon } from '~/common/components/icons/big-agi/BigAgiCircleIcon';
import { SpeechResult, useSpeechRecognition } from '~/common/components/speechrecognition/useSpeechRecognition';
import { brandLime } from '~/common/app.theme';

import { operatorDispatch, operatorRouteCommand, OperatorRoutedCommand } from './operator.actions';
import { useOperatorStore } from './store-operator';


const SHEET_BG = '#0d1114';
const Z_SHEET = 1210;

const SUGGESTIONS = [
  'Start a new chat about my trip',
  'Edit a new document',
  'Reorganize my files collection',
  'Incognito: quick question',
  'Go home',
];

const barBounce = keyframes`
  0%, 100% { transform: scaleY(0.35); }
  50% { transform: scaleY(1); }
`;

const orbBreath = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(212, 255, 58, 0.35); }
  50% { box-shadow: 0 0 0 14px rgba(212, 255, 58, 0); }
`;


export function OperatorVoiceSheet(props: { onClose: () => void }) {

  // state
  const [typed, setTyped] = React.useState('');
  const [spoken, setSpoken] = React.useState('');
  const [interim, setInterim] = React.useState('');
  const [answerFor, setAnswerFor] = React.useState<string | null>(null);

  // external state
  const { memoryMode, setMemoryMode } = useOperatorStore();

  const command = (typed || spoken || '').trim();
  const routed: OperatorRoutedCommand | null = operatorRouteCommand(command);


  // speech

  const handleSpeech = React.useCallback((result: SpeechResult) => {
    setInterim(result.interimTranscript === 'Listening...' ? '' : result.interimTranscript);
    if (result.transcript) setSpoken(result.transcript);
  }, []);

  const { recognitionState, startRecognition, toggleRecognition } = useSpeechRecognition('webSpeechApi', handleSpeech, 2000);
  const listening = recognitionState.isActive;

  // auto-start listening when the sheet opens (voice-first)
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    if (!startedRef.current && recognitionState.isAvailable) {
      startedRef.current = true;
      startRecognition();
    }
  }, [recognitionState.isAvailable, startRecognition]);


  // execute

  const { onClose } = props;
  const handleRun = React.useCallback((cmd: OperatorRoutedCommand | null) => {
    if (!cmd) return;
    if (cmd.action === 'ask') {
      setAnswerFor(cmd.query || '');
      return;
    }
    onClose();
    operatorDispatch(cmd.action);
  }, [onClose]);

  const transcriptText = command || interim;

  return <>

    {/* Backdrop */}
    <Box onClick={props.onClose} sx={{ position: 'fixed', inset: 0, zIndex: Z_SHEET - 1, backgroundColor: 'rgba(8,10,12,0.5)', backdropFilter: 'blur(3px)' }} />

    {/* Sheet */}
    <Box sx={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: Z_SHEET,
      backgroundColor: SHEET_BG, color: '#fff',
      borderTopLeftRadius: 22, borderTopRightRadius: 22,
      boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
      px: 2, pt: 1, pb: 'calc(16px + env(safe-area-inset-bottom))',
      display: 'flex', flexDirection: 'column', gap: 1.75,
    }}>

      {/* grabber */}
      <Box sx={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BigAgiCircleIcon sx={{ fontSize: '1.5rem', color: '#fff' }} />
        <Typography level='title-md' sx={{ color: '#fff', fontWeight: 'lg' }}>Operator</Typography>
        <Box sx={{ flex: 1 }} />
        {/* memory mode switch */}
        <Box sx={{ display: 'flex', borderRadius: 999, p: '2px', backgroundColor: 'rgba(255,255,255,0.08)' }}>
          {(['ephemeral', 'thread'] as const).map(mode => (
            <Box
              key={mode}
              onClick={() => setMemoryMode(mode)}
              sx={{
                px: 1.25, py: 0.4, borderRadius: 999, fontSize: 'xs', fontWeight: 'md', cursor: 'pointer',
                color: memoryMode === mode ? '#0d1114' : 'rgba(255,255,255,0.7)',
                backgroundColor: memoryMode === mode ? '#fff' : 'transparent',
              }}
            >
              {mode === 'ephemeral' ? 'No memory' : 'Operator thread'}
            </Box>
          ))}
        </Box>
        <IconButton size='sm' variant='plain' onClick={props.onClose} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' } }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      {/* Orb + transcript */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 84 }}>
        <Box
          onClick={() => toggleRecognition()}
          sx={{
            flexShrink: 0, width: 72, height: 72, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            backgroundColor: listening ? brandLime : 'rgba(255,255,255,0.1)',
            color: listening ? SHEET_BG : '#fff',
            animation: listening ? `${orbBreath} 1.8s ease-out infinite` : undefined,
          }}
        >
          {listening ? (
            [0.9, 0.55, 1, 0.7, 0.45].map((h, i) => (
              <Box key={i} sx={{
                width: 5, height: 30 * h, borderRadius: 3, backgroundColor: SHEET_BG,
                animation: `${barBounce} ${0.7 + i * 0.13}s ease-in-out infinite`,
              }} />
            ))
          ) : recognitionState.isAvailable ? <MicRoundedIcon sx={{ fontSize: '2rem' }} /> : <MicOffRoundedIcon sx={{ fontSize: '2rem', opacity: 0.6 }} />}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography level='body-xs' sx={{ color: listening ? brandLime : 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'lg' }}>
            {listening ? 'Listening' : recognitionState.isAvailable ? 'Tap to speak' : 'Voice unavailable · type below'}
          </Typography>
          <Typography level='title-lg' sx={{ color: transcriptText ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 'md', lineHeight: 1.3 }}>
            {transcriptText || 'Say a command, or ask anything.'}
          </Typography>
        </Box>
      </Box>

      {/* Routed intent */}
      {routed && !answerFor && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          p: 1, pl: 1.5, borderRadius: 14,
          border: '1px solid rgba(212,255,58,0.35)', backgroundColor: 'rgba(212,255,58,0.07)',
        }}>
          <SubdirectoryArrowRightRoundedIcon sx={{ color: brandLime, fontSize: '1.2rem' }} />
          <Typography level='body-sm' sx={{ color: '#fff', flex: 1 }}>{routed.label}</Typography>
          <Button size='sm' onClick={() => handleRun(routed)} endDecorator={<ArrowForwardRoundedIcon />} sx={{ backgroundColor: brandLime, color: SHEET_BG, borderRadius: 999, '&:hover': { backgroundColor: '#c4ef2a' } }}>
            Go
          </Button>
        </Box>
      )}

      {/* Ephemeral answer (prototype placeholder) */}
      {answerFor && (
        <Box sx={{ p: 1.5, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography level='body-xs' sx={{ color: 'rgba(255,255,255,0.5)' }}>{memoryMode === 'ephemeral' ? 'Not saved · no memory' : 'Operator thread · compressed memory'}</Typography>
          <Typography level='body-md' sx={{ color: '#fff' }}>The answer to “{answerFor}” streams here, right in the sheet.</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size='sm' variant='outlined' onClick={() => handleRun({ action: 'chat-incognito', label: '' })} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)', borderRadius: 999 }}>Continue as chat</Button>
            <Button size='sm' variant='plain' onClick={() => { setAnswerFor(null); setTyped(''); setSpoken(''); }} sx={{ color: 'rgba(255,255,255,0.7)', borderRadius: 999 }}>Ask another</Button>
          </Box>
        </Box>
      )}

      {/* Suggestions */}
      {!command && (
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', mx: -2, px: 2, scrollbarWidth: 'none' }}>
          {SUGGESTIONS.map(s => (
            <Box key={s} onClick={() => setTyped(s)} sx={{
              flexShrink: 0, px: 1.5, py: 0.75, borderRadius: 999, fontSize: 'sm', cursor: 'pointer',
              color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.16)',
            }}>
              {s}
            </Box>
          ))}
        </Box>
      )}

      {/* Typed fallback */}
      <Input
        value={typed}
        onChange={e => setTyped(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleRun(routed); }}
        placeholder='…or type a command'
        variant='plain'
        color='neutral'
        endDecorator={typed ? <IconButton size='sm' onClick={() => handleRun(routed)} sx={{ color: brandLime }}><ArrowForwardRoundedIcon /></IconButton> : undefined}
        sx={{
          borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', color: '#fff',
          '--Input-focusedThickness': '1px',
          '--Input-focusedHighlight': 'rgba(212,255,58,0.55)',
          '& input::placeholder': { color: 'rgba(255,255,255,0.4)' },
        }}
      />

    </Box>

  </>;
}
