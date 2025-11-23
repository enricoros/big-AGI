/**
 * Council Leaderboard - displays aggregate rankings (llm-council style)
 */

import * as React from 'react';
import { Box, Sheet, Typography, Chip, Tooltip } from '@mui/joy';

import type { CouncilAggregation } from './beam.gather.council.types';

interface CouncilLeaderboardProps {
  aggregations: CouncilAggregation[];
  showControversy?: boolean;
}

export function CouncilLeaderboard(props: CouncilLeaderboardProps) {
  const { aggregations, showControversy = true } = props;

  // Determine medal emoji
  const getMedal = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  // Determine if controversial (high std dev)
  const isControversial = (stdDev: number) => stdDev > 1.0;

  return (
    <Sheet
      variant='soft'
      sx={{
        borderRadius: 'md',
        p: 2,
      }}
    >
      <Typography level='title-md' sx={{ mb: 2 }}>
        🏆 Council Rankings
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {aggregations.map((agg, index) => {
          const controversial = showControversy && isControversial(agg.standardDeviation);

          return (
            <Box
              key={agg.rayId}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 'sm',
                backgroundColor: index === 0 ? 'success.softBg' : 'background.level1',
                border: '1px solid',
                borderColor: controversial ? 'warning.outlinedBorder' : 'divider',
              }}
            >
              {/* Rank */}
              <Typography
                level='h4'
                sx={{
                  minWidth: '3rem',
                  textAlign: 'center',
                  fontSize: '1.5rem',
                }}
              >
                {getMedal(index)}
              </Typography>

              {/* Model Name */}
              <Box sx={{ flex: 1 }}>
                <Typography level='title-sm' sx={{ fontWeight: 'bold' }}>
                  {agg.modelName}
                </Typography>
                <Typography level='body-xs' sx={{ color: 'text.secondary', mt: 0.5 }}>
                  Avg: {agg.averageRank.toFixed(2)} ({agg.voteCount} votes)
                </Typography>
              </Box>

              {/* Controversy Indicator */}
              {controversial && (
                <Tooltip
                  title={`Controversial (σ=${agg.standardDeviation.toFixed(2)}). Rankings varied: ${agg.positions.join(', ')}`}
                  placement='left'
                >
                  <Chip
                    size='sm'
                    color='warning'
                    variant='soft'
                  >
                    ⚡ Controversial
                  </Chip>
                </Tooltip>
              )}

              {/* Consensus Indicator */}
              {showControversy && !controversial && agg.standardDeviation < 0.5 && (
                <Tooltip
                  title={`Strong consensus (σ=${agg.standardDeviation.toFixed(2)}). Rankings: ${agg.positions.join(', ')}`}
                  placement='left'
                >
                  <Chip
                    size='sm'
                    color='success'
                    variant='soft'
                  >
                    ✓ Consensus
                  </Chip>
                </Tooltip>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Legend */}
      {showControversy && (
        <Typography level='body-xs' sx={{ mt: 2, color: 'text.tertiary', fontStyle: 'italic' }}>
          Lower average rank is better. Controversy indicates disagreement among rankers.
        </Typography>
      )}
    </Sheet>
  );
}
