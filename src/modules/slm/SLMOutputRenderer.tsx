import * as React from 'react';

import type { ColorPaletteProp, SxProps } from '@mui/joy/styles/types';
import {
  Accordion,
  AccordionDetails,
  AccordionGroup,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  Typography,
} from '@mui/joy';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

import { RenderMarkdownMemo } from '~/modules/blocks/markdown/RenderMarkdown';


// ─── Types ────────────────────────────────────────────────────────────────────

interface SLMPhase {
  num: number;
  name: string;
  content: string;
  hasWarning: boolean;
  isActive: boolean; // currently running (not yet complete)
}

interface ParsedSLMOutput {
  phases: SLMPhase[];
  finalOutput: string | null;
  isComplete: boolean;
}


// ─── Parser ───────────────────────────────────────────────────────────────────

function parseSLMOutput(text: string): ParsedSLMOutput {
  const phaseRegex = /\*\*Phase (\d+(?:\.\d+)?) — ([^\n*]+)\*\*/g;
  const finalMarker = '## ✦ Final Output';

  const phaseHits: Array<{ index: number; num: number; name: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = phaseRegex.exec(text)) !== null) {
    phaseHits.push({ index: m.index, num: parseFloat(m[1]), name: m[2].trim() });
  }

  const finalIdx = text.indexOf(finalMarker);
  const isComplete = finalIdx !== -1;

  const phases: SLMPhase[] = phaseHits.map(({ index, num, name }, i) => {
    const lineEnd = text.indexOf('\n', index);
    const contentStart = lineEnd > -1 ? lineEnd + 1 : index;
    const nextBoundary =
      phaseHits[i + 1]?.index ??
      (isComplete ? Math.max(0, text.lastIndexOf('\n---', finalIdx)) : text.length);
    const content = text.slice(contentStart, nextBoundary).trim();
    const isLast = i === phaseHits.length - 1;

    return {
      num,
      name,
      content,
      hasWarning: content.includes('⚠️'),
      isActive: isLast && !isComplete,
    };
  });

  let finalOutput: string | null = null;
  if (isComplete) {
    finalOutput = text.slice(finalIdx + finalMarker.length).trim();
  }

  return { phases, finalOutput, isComplete };
}


// ─── Phase color/label helpers ────────────────────────────────────────────────

const PHASE_COLOR: Record<number, ColorPaletteProp> = {
  1: 'neutral', 2: 'primary', 3: 'neutral', 4: 'warning',
  5: 'success', 6: 'primary', 7: 'success',
};

function phaseColor(num: number): ColorPaletteProp {
  return PHASE_COLOR[Math.floor(num)] ?? 'neutral';
}


// ─── Status indicator ─────────────────────────────────────────────────────────

const spinSx: SxProps = {
  display: 'inline-flex',
  animation: 'slm-spin 1.1s linear infinite',
  '@keyframes slm-spin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
};

function PhaseStatus({ hasWarning, isActive }: { hasWarning: boolean; isActive: boolean }) {
  if (isActive)
    return (
      <Box component='span' sx={{ ...spinSx, color: 'primary.400', fontSize: '1rem', lineHeight: 1 }}>
        ◌
      </Box>
    );
  if (hasWarning)
    return <WarningAmberRoundedIcon sx={{ fontSize: '0.95rem', color: 'warning.500' }} />;
  return <CheckRoundedIcon sx={{ fontSize: '0.95rem', color: 'success.500' }} />;
}


// ─── Single phase accordion ───────────────────────────────────────────────────

function PhaseAccordion({ phase, isOpen, onToggle }: {
  phase: SLMPhase;
  isOpen: boolean;
  onToggle: (num: number) => void;
}) {
  const color = phaseColor(phase.num);
  const handleChange = React.useCallback(
    (_e: React.SyntheticEvent, expanded: boolean) => { void expanded; onToggle(phase.num); },
    [onToggle, phase.num],
  );

  return (
    <Accordion
      expanded={isOpen}
      onChange={handleChange}
      sx={{
        border: '1px solid',
        borderColor: isOpen ? `${color}.outlinedBorder` : 'divider',
        borderRadius: 'sm',
        mb: 0.5,
        transition: 'border-color 0.15s',
        '&:hover': { borderColor: `${color}.outlinedBorder` },
        '&::before': { display: 'none' }, // remove default MUI divider line
      }}
    >
      <AccordionSummary
        indicator={<ExpandMoreRoundedIcon sx={{ fontSize: '1rem', opacity: 0.6 }} />}
        slotProps={{
          button: {
            sx: {
              py: 0.75, px: 1.25,
              borderRadius: 'sm',
              gap: 0.75,
              '&[aria-expanded="true"]': { bgcolor: `${color}.softBg` },
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
          <Chip
            size='sm'
            variant='soft'
            color={color}
            sx={{ fontFamily: 'code', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, letterSpacing: '0.03em' }}
          >
            {Number.isInteger(phase.num) ? `P${phase.num}` : `P${phase.num}`}
          </Chip>
          <Typography
            level='body-sm'
            fontWeight='md'
            sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.primary' }}
          >
            {phase.name}
          </Typography>
          <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', mr: 0.5 }}>
            <PhaseStatus hasWarning={phase.hasWarning} isActive={phase.isActive} />
          </Box>
        </Box>
      </AccordionSummary>

      <AccordionDetails slotProps={{ content: { sx: { pb: 0 } } }}>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, maxHeight: 520, overflowY: 'auto', overflowX: 'hidden' }}>
          {phase.content
            ? <RenderMarkdownMemo content={phase.content} />
            : (
              <Typography level='body-xs' sx={{ color: 'text.tertiary', fontStyle: 'italic', py: 1 }}>
                {phase.isActive ? 'Running…' : 'No content.'}
              </Typography>
            )
          }
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}


// ─── Main renderer ────────────────────────────────────────────────────────────

const SLM_MARKER = '🛰️ **SLM Matrix Active**';

export function isSLMOutput(text: string): boolean {
  return text.trimStart().startsWith(SLM_MARKER);
}

export function SLMOutputRenderer({ text }: { text: string }) {
  const { phases, finalOutput, isComplete } = React.useMemo(() => parseSLMOutput(text), [text]);

  // Open/close state lives here so streaming re-renders don't reset expand choices
  const [openPhases, setOpenPhases] = React.useState<Set<number>>(new Set());

  const handleToggle = React.useCallback((num: number) => {
    setOpenPhases(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num); else next.add(num);
      return next;
    });
  }, []);

  const doneCount = phases.filter(p => !p.isActive).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, my: 0.5 }}>

      {/* Header row */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1.25, py: 0.65,
        borderRadius: 'sm',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.level1',
      }}>
        <AccountTreeOutlinedIcon sx={{ fontSize: '0.95rem', color: 'text.tertiary', flexShrink: 0 }} />
        <Typography level='body-sm' fontWeight='lg' sx={{ letterSpacing: '0.01em', color: 'text.secondary' }}>
          Liquid Matrix
        </Typography>
        {phases.length > 0 && (
          <Chip size='sm' variant='outlined' color='neutral' sx={{ fontFamily: 'code', fontSize: '0.62rem', ml: 0.25 }}>
            {doneCount}/{phases.length}
          </Chip>
        )}
        {isComplete && (
          <Chip size='sm' variant='soft' color='success' sx={{ ml: 'auto', fontSize: '0.65rem', fontWeight: 700 }}>
            Complete
          </Chip>
        )}
        {!isComplete && phases.length > 0 && (
          <Chip size='sm' variant='soft' color='primary' sx={{ ml: 'auto', fontSize: '0.65rem' }}>
            Running
          </Chip>
        )}
      </Box>

      {/* Phase accordions */}
      {phases.length > 0 && (
        <AccordionGroup disableDivider sx={{ gap: 0 }}>
          {phases.map(phase => (
            <PhaseAccordion
              key={phase.num}
              phase={phase}
              isOpen={openPhases.has(phase.num)}
              onToggle={handleToggle}
            />
          ))}
        </AccordionGroup>
      )}

      {/* Final output — shown when pipeline completes */}
      {finalOutput !== null && (
        <Box sx={{
          borderRadius: 'sm',
          border: '1.5px solid',
          borderColor: 'success.outlinedBorder',
          overflow: 'hidden',
        }}>
          <Box sx={{
            px: 1.25, py: 0.65,
            bgcolor: 'success.softBg',
            borderBottom: '1px solid',
            borderColor: 'success.outlinedBorder',
            display: 'flex', alignItems: 'center', gap: 0.75,
          }}>
            <CheckRoundedIcon sx={{ fontSize: '0.95rem', color: 'success.600' }} />
            <Typography level='body-sm' fontWeight='lg' sx={{ color: 'success.700' }}>
              Final Output
            </Typography>
          </Box>
          <Box sx={{ px: 0.5 }}>
            {finalOutput
              ? <RenderMarkdownMemo content={finalOutput} />
              : <Typography level='body-xs' sx={{ px: 2, py: 1, color: 'text.tertiary', fontStyle: 'italic' }}>Assembling…</Typography>
            }
          </Box>
        </Box>
      )}

      {/* Empty state while waiting for first phase */}
      {phases.length === 0 && !finalOutput && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5 }}>
          <Box component='span' sx={{ ...spinSx, color: 'primary.400', fontSize: '1rem' }}>◌</Box>
          <Typography level='body-xs' sx={{ color: 'text.tertiary', fontStyle: 'italic' }}>
            Initializing pipeline…
          </Typography>
        </Box>
      )}

    </Box>
  );
}
