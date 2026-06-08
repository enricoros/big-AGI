import * as React from 'react';

import {
  Accordion,
  AccordionDetails,
  AccordionGroup,
  AccordionSummary,
  accordionSummaryClasses,
  Box,
  Chip,
  Typography,
} from '@mui/joy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { RenderMarkdownMemo } from '~/modules/blocks/markdown/RenderMarkdown';


// ─── Types ───────────────────────────────────────────────────────────────────

interface SLMSection {
  type: 'header' | 'phase' | 'final';
  phaseNum?: number;
  phaseName?: string;
  content: string;
  hasWarning: boolean;
  isStreaming: boolean;
}


// ─── Parser ──────────────────────────────────────────────────────────────────

function parseSLMOutput(text: string): SLMSection[] {
  const sections: SLMSection[] = [];

  const phaseRegex = /\*\*Phase (\d+) — ([^\n*]+)\*\*/g;
  const finalRegex = /## ✦ Final Output/;

  const phaseMatches: Array<{ index: number; phaseNum: number; phaseName: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = phaseRegex.exec(text)) !== null) {
    phaseMatches.push({ index: m.index, phaseNum: parseInt(m[1]), phaseName: m[2].trim() });
  }

  const finalMatchResult = finalRegex.exec(text);
  const finalIndex = finalMatchResult?.index ?? -1;

  // Header block (before Phase 1)
  const headerEnd = phaseMatches[0]?.index ?? text.length;
  const headerContent = text.slice(0, headerEnd).trim();
  if (headerContent) {
    sections.push({ type: 'header', content: headerContent, hasWarning: false, isStreaming: phaseMatches.length === 0 });
  }

  // Phase blocks
  for (let i = 0; i < phaseMatches.length; i++) {
    const { index, phaseNum, phaseName } = phaseMatches[i];
    const lineEnd = text.indexOf('\n', index);
    const contentStart = lineEnd > -1 ? lineEnd + 1 : index;
    const nextBoundary =
      phaseMatches[i + 1]?.index ??
      (finalIndex > -1 ? Math.max(0, text.lastIndexOf('\n---', finalIndex)) : text.length);
    const content = text.slice(contentStart, nextBoundary).trim();
    const isLast = i === phaseMatches.length - 1 && finalIndex === -1;

    sections.push({
      type: 'phase',
      phaseNum,
      phaseName,
      content,
      hasWarning: content.includes('⚠️'),
      isStreaming: isLast,
    });
  }

  // Final output block
  if (finalIndex > -1 && finalMatchResult) {
    const content = text.slice(finalIndex + finalMatchResult[0].length).trim();
    sections.push({ type: 'final', content, hasWarning: false, isStreaming: true });
  }

  return sections;
}


// ─── Phase metadata ───────────────────────────────────────────────────────────

const PHASE_ICON: Record<number, string> = {
  1: '🗂️', 2: '⚡', 3: '🔍', 4: '🔧', 5: '✔️', 6: '✨', 7: '🔗',
};

const PHASE_COLOR: Record<number, 'primary' | 'neutral' | 'success' | 'warning'> = {
  1: 'neutral', 2: 'primary', 3: 'neutral', 4: 'warning',
  5: 'success', 6: 'primary', 7: 'success',
};


// ─── Sub-components ──────────────────────────────────────────────────────────

function PhaseStatusIcon({ hasWarning, isStreaming }: { hasWarning: boolean; isStreaming: boolean }) {
  if (isStreaming) return (
    <Box component='span' sx={{
      display: 'inline-flex',
      animation: 'slm-spin 1s linear infinite',
      '@keyframes slm-spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
    }}>
      ⟳
    </Box>
  );
  if (hasWarning) return <WarningAmberIcon sx={{ fontSize: '1rem', color: 'warning.500' }} />;
  return <CheckCircleOutlineIcon sx={{ fontSize: '1rem', color: 'success.500' }} />;
}

interface PhaseAccordionProps {
  section: SLMSection;
  isOpen: boolean;
  onToggle: (phaseNum: number) => void;
}

function PhaseAccordion({ section, isOpen, onToggle }: PhaseAccordionProps) {
  const phaseNum = section.phaseNum ?? 0;
  const color = PHASE_COLOR[phaseNum] ?? 'neutral';

  const handleChange = React.useCallback(
    (_: React.SyntheticEvent, expanded: boolean) => {
      // MUI Joy fires onChange with `expanded = true` when opening, `false` when closing.
      // We only need to know a toggle happened.
      void expanded;
      onToggle(phaseNum);
    },
    [onToggle, phaseNum],
  );

  return (
    <AccordionGroup
      sx={{
        borderRadius: 'sm',
        border: '1px solid',
        borderColor: isOpen ? `${color}.200` : 'divider',
        mb: 0.5,
        transition: 'border-color 0.15s',
        '&:hover': { borderColor: `${color}.300` },
      }}
    >
      <Accordion expanded={isOpen} onChange={handleChange}>
        <AccordionSummary
          indicator={<KeyboardArrowDownIcon />}
          slotProps={{
            button: {
              sx: {
                py: 0.75,
                px: 1.5,
                borderRadius: 'sm',
                [`&.${accordionSummaryClasses.button}[aria-expanded='true']`]: {
                  bgcolor: `${color}.50`,
                },
              },
            },
            indicator: {
              sx: { transition: 'transform 0.2s', fontSize: '1rem' },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0 }}>
            <Typography level='body-xs' sx={{ fontFamily: 'monospace', color: 'text.tertiary', minWidth: 20 }}>
              {PHASE_ICON[phaseNum] ?? '·'}
            </Typography>
            <Chip
              size='sm'
              variant='soft'
              color={color}
              sx={{ fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}
            >
              Phase {phaseNum}
            </Chip>
            <Typography
              level='body-sm'
              fontWeight='md'
              sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {section.phaseName}
            </Typography>
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <PhaseStatusIcon hasWarning={section.hasWarning} isStreaming={section.isStreaming} />
            </Box>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          {/* Scrollable content area so long agent outputs don't overflow */}
          <Box sx={{ px: 1, pb: 1, maxHeight: 480, overflowY: 'auto', overflowX: 'hidden' }}>
            {section.content
              ? <RenderMarkdownMemo content={section.content} />
              : (
                <Typography level='body-xs' sx={{ color: 'text.tertiary', fontStyle: 'italic', py: 1 }}>
                  {section.isStreaming ? 'Working…' : 'No content.'}
                </Typography>
              )
            }
          </Box>
        </AccordionDetails>
      </Accordion>
    </AccordionGroup>
  );
}


// ─── Main renderer ────────────────────────────────────────────────────────────

const SLM_HEADER_MARKER = '🛰️ **SLM Matrix Active**';

export function isSLMOutput(text: string): boolean {
  return text.startsWith(SLM_HEADER_MARKER) || text.trimStart().startsWith(SLM_HEADER_MARKER);
}

export function SLMOutputRenderer({ text }: { text: string }) {
  const sections = React.useMemo(() => parseSLMOutput(text), [text]);

  const header = sections.find(s => s.type === 'header');
  const phases = sections.filter(s => s.type === 'phase');
  const finalSection = sections.find(s => s.type === 'final');

  // ── Open/close state lives HERE, not inside PhaseAccordion, so streaming
  //    updates that re-render phases never reset the user's expand choices.
  const [openPhases, setOpenPhases] = React.useState<Set<number>>(new Set());

  const handleTogglePhase = React.useCallback((phaseNum: number) => {
    setOpenPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseNum)) { next.delete(phaseNum); } else { next.add(phaseNum); }
      return next;
    });
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mx: '0.75rem' }}>

      {/* Header bar */}
      {header && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1.5, py: 0.75,
          bgcolor: 'background.level1',
          borderRadius: 'sm',
          border: '1px solid',
          borderColor: 'divider',
        }}>
          <Typography level='body-sm' sx={{ fontWeight: 700, letterSpacing: '0.02em' }}>
            🛰️ SLM Matrix
          </Typography>
          {phases.length > 0 && (
            <Chip size='sm' variant='outlined' color='neutral' sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>
              {phases.filter(p => !p.isStreaming).length}/{phases.length} phases
            </Chip>
          )}
          {finalSection && (
            <Chip size='sm' variant='soft' color='success' sx={{ ml: 'auto', fontFamily: 'monospace', fontSize: '0.68rem' }}>
              ✦ Complete
            </Chip>
          )}
        </Box>
      )}

      {/* Phase accordions */}
      {phases.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {phases.map(section => (
            <PhaseAccordion
              key={`phase-${section.phaseNum}`}
              section={section}
              isOpen={openPhases.has(section.phaseNum ?? 0)}
              onToggle={handleTogglePhase}
            />
          ))}
        </Box>
      )}

      {/* Final Output — prominent, always visible, fully scrollable */}
      {finalSection && (
        <Box sx={{
          mt: 0.5,
          borderRadius: 'md',
          border: '1.5px solid',
          borderColor: 'primary.200',
          bgcolor: 'background.surface',
          // No overflow:hidden here — that was clipping code blocks
        }}>
          <Box sx={{
            px: 2, py: 1,
            bgcolor: 'primary.50',
            borderBottom: '1px solid',
            borderColor: 'primary.200',
            borderRadius: 'md md 0 0',
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <Typography level='title-sm' sx={{ fontWeight: 700, color: 'primary.700' }}>
              ✦ Final Output
            </Typography>
          </Box>
          <Box sx={{ px: 0.5, py: 0.5 }}>
            {finalSection.content
              ? <RenderMarkdownMemo content={finalSection.content} />
              : <Typography level='body-xs' sx={{ px: 2, py: 1, color: 'text.tertiary', fontStyle: 'italic' }}>Assembling…</Typography>
            }
          </Box>
        </Box>
      )}

      {!finalSection && phases.length === 0 && header && (
        <Typography level='body-xs' sx={{ color: 'text.tertiary', fontStyle: 'italic', px: 1 }}>
          Initializing pipeline…
        </Typography>
      )}
    </Box>
  );
}
