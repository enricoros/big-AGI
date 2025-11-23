/**
 * BeamCouncilView - Main council voting view
 * Displays all visualizations and orchestrates the council voting process
 */

import * as React from 'react';
import { Box, Button, CircularProgress, Sheet, Typography, Accordion, AccordionSummary, AccordionDetails, AccordionGroup } from '@mui/joy';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HowToVoteIcon from '@mui/icons-material/HowToVote';

import { ChatMessage } from '../../../../apps/chat/components/message/ChatMessage';
import { getIsMobile } from '~/common/components/useMatchMedia';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';

import type { BeamStoreApi } from '../../store-beam.hooks';
import { beamCardMessageScrollingSx, beamCardMessageSx } from '../../BeamCard';
import { getBeamCardScrolling } from '../../store-module-beam';

import type { CouncilResults, CouncilProgress } from './beam.gather.council.types';
import { CouncilLeaderboard } from './CouncilLeaderboard';
import { CouncilHeatmap } from './CouncilHeatmap';
import { CouncilEvaluations } from './CouncilEvaluations';

interface BeamCouncilViewProps {
  beamStore: BeamStoreApi;
  onClose: () => void;
  onAccept?: (synthesisText: string) => void;
}

export function BeamCouncilView(props: BeamCouncilViewProps) {
  const { beamStore, onClose, onAccept } = props;

  const [progress, setProgress] = React.useState<CouncilProgress>({
    state: 'idle',
    currentStep: 0,
    totalSteps: 0,
    message: '',
  });

  const [results, setResults] = React.useState<CouncilResults | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const isMobile = getIsMobile();

  // Extract rays and model names
  const rays = props.beamStore.getState().rays;
  const rayIds = rays.map(r => r.rayId);
  const rayModelNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const ray of rays) {
      // Try to extract model name from ray metadata or use a fallback
      const modelName = ray.rayLlmId || `Model ${rays.indexOf(ray) + 1}`;
      map.set(ray.rayId, modelName);
    }
    return map;
  }, [rays]);

  // Run council voting when component mounts
  React.useEffect(() => {
    const runCouncilVoting = async () => {
      try {
        setProgress({
          state: 'ranking',
          currentStep: 0,
          totalSteps: rays.length + 1,
          message: 'Initializing council voting...',
        });

        const { executeCouncilVoting } = await import('./beam.gather.council.execution');

        const chatHistory = props.beamStore.getState().inputHistory || [];
        const chairmanLlmId = props.beamStore.getState().currentGatherLlmId || rays[0]?.rayLlmId;

        if (!chairmanLlmId) {
          throw new Error('No chairman model selected');
        }

        const rayData = rays.map(ray => ({
          rayId: ray.rayId,
          llmId: ray.rayLlmId!,
          modelName: rayModelNames.get(ray.rayId) || 'Unknown',
          message: ray.message!,
        }));

        const abortController = new AbortController();

        const councilResults = await executeCouncilVoting(
          chatHistory,
          rayData,
          chairmanLlmId,
          abortController.signal,
          setProgress,
        );

        setResults(councilResults);
        setProgress({
          state: 'complete',
          currentStep: rays.length + 1,
          totalSteps: rays.length + 1,
          message: 'Council voting complete!',
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setProgress({
          state: 'error',
          currentStep: 0,
          totalSteps: 0,
          message: 'Council voting failed',
          error: errorMessage,
        });
      }
    };

    runCouncilVoting();
  }, []); // Run once on mount

  const handleAccept = () => {
    if (results?.chairmanSynthesis && onAccept) {
      const synthesisText = messageFragmentsReduceText(results.chairmanSynthesis.fragments);
      onAccept(synthesisText);
    }
  };

  return (
    <Box
      sx={{
        gridColumn: '1 / -1',
        mt: 2,
        mb: 2,
      }}
    >
      <Sheet
        variant='outlined'
        sx={{
          borderRadius: 'lg',
          p: 3,
          backgroundColor: 'background.surface',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <HowToVoteIcon sx={{ fontSize: '2rem', color: 'primary.solidBg' }} />
            <Typography level='h3'>
              Council Voting
            </Typography>
          </Box>
          <Button
            size='sm'
            variant='plain'
            color='neutral'
            onClick={onClose}
            startDecorator={<CloseIcon />}
          >
            Close
          </Button>
        </Box>

        {/* Progress */}
        {progress.state !== 'complete' && progress.state !== 'error' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <CircularProgress size='sm' />
            <Typography level='body-sm'>
              {progress.message} ({progress.currentStep}/{progress.totalSteps})
            </Typography>
          </Box>
        )}

        {/* Error */}
        {error && (
          <Box
            sx={{
              p: 2,
              backgroundColor: 'danger.softBg',
              borderRadius: 'md',
              mb: 3,
            }}
          >
            <Typography level='body-sm' sx={{ color: 'danger.solidColor' }}>
              Error: {error}
            </Typography>
          </Box>
        )}

        {/* Results */}
        {results && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Leaderboard */}
            <CouncilLeaderboard
              aggregations={results.aggregations}
              showControversy={true}
            />

            {/* Expandable sections */}
            <AccordionGroup>
              {/* Heatmap Matrix */}
              <Accordion>
                <AccordionSummary>
                  <Typography level='title-sm'>📊 Ranking Matrix (Heatmap)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <CouncilHeatmap
                    rankings={results.rankings}
                    rayIds={rayIds}
                    rayModelNames={rayModelNames}
                  />
                </AccordionDetails>
              </Accordion>

              {/* Evaluations */}
              <Accordion>
                <AccordionSummary>
                  <Typography level='title-sm'>📝 Peer Evaluations (Detailed)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <CouncilEvaluations rankings={results.rankings} />
                </AccordionDetails>
              </Accordion>
            </AccordionGroup>

            {/* Chairman Synthesis */}
            {results.chairmanSynthesis && (
              <Box>
                <Typography level='title-md' sx={{ mb: 2 }}>
                  🎯 Chairman Synthesis
                </Typography>
                <ChatMessage
                  message={results.chairmanSynthesis as any}
                  fitScreen={isMobile}
                  isMobile={isMobile}
                  hideAvatar
                  adjustContentScaling={-1}
                  sx={!getBeamCardScrolling() ? beamCardMessageSx : beamCardMessageScrollingSx}
                />
              </Box>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
              {onAccept && (
                <Button
                  size='lg'
                  variant='solid'
                  color='success'
                  onClick={handleAccept}
                  startDecorator={<CheckCircleIcon />}
                >
                  Accept Synthesis
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Sheet>
    </Box>
  );
}
