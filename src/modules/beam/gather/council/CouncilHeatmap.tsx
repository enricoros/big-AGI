/**
 * Council Heatmap Matrix - shows who ranked whom
 */

import * as React from 'react';
import { Box, Sheet, Typography, Tooltip } from '@mui/joy';

import type { CouncilRanking } from './beam.gather.council.types';

interface CouncilHeatmapProps {
  rankings: CouncilRanking[];
  rayIds: string[];
  rayModelNames: Map<string, string>;
}

export function CouncilHeatmap(props: CouncilHeatmapProps) {
  const { rankings, rayIds, rayModelNames } = props;

  // Build matrix: ranker -> ranked -> position
  const matrix = new Map<string, Map<string, number>>();
  for (const ranking of rankings) {
    const rankerMap = new Map<string, number>();
    for (const { rayId, position } of ranking.rankings) {
      rankerMap.set(rayId, position);
    }
    matrix.set(ranking.rankerRayId, rankerMap);
  }

  // Calculate average rank for each ray (column totals)
  const avgRanks = rayIds.map(rayId => {
    const positions: number[] = [];
    for (const ranking of rankings) {
      const pos = ranking.rankings.find(r => r.rayId === rayId)?.position;
      if (pos !== undefined) positions.push(pos);
    }
    const avg = positions.length > 0
      ? positions.reduce((sum, p) => sum + p, 0) / positions.length
      : 0;
    return avg;
  });

  // Color gradient: 1 (green) -> N (red)
  const getColor = (position: number | undefined, totalRays: number) => {
    if (position === undefined) return '#888'; // Gray for missing

    // Normalize: 1 -> 0.0, N -> 1.0
    const normalized = (position - 1) / (totalRays - 1);

    // Green -> Yellow -> Orange -> Red
    if (normalized < 0.33) {
      // Green to Yellow
      const t = normalized / 0.33;
      return `hsl(${120 - 60 * t}, 70%, 50%)`;
    } else if (normalized < 0.67) {
      // Yellow to Orange
      const t = (normalized - 0.33) / 0.34;
      return `hsl(${60 - 30 * t}, 70%, 50%)`;
    } else {
      // Orange to Red
      const t = (normalized - 0.67) / 0.33;
      return `hsl(${30 - 30 * t}, 70%, 50%)`;
    }
  };

  return (
    <Sheet
      variant='soft'
      sx={{
        borderRadius: 'md',
        p: 2,
        overflowX: 'auto',
      }}
    >
      <Typography level='title-md' sx={{ mb: 2 }}>
        📊 Ranking Matrix
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `120px repeat(${rayIds.length}, 60px)`,
          gap: 0.5,
          fontSize: 'xs',
        }}
      >
        {/* Header row */}
        <Box />
        {rayIds.map(rayId => (
          <Tooltip key={rayId} title={rayModelNames.get(rayId) || rayId}>
            <Box
              sx={{
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '0.75rem',
                transform: 'rotate(-45deg)',
                transformOrigin: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                height: '60px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
            >
              {(rayModelNames.get(rayId) || rayId).slice(0, 10)}
            </Box>
          </Tooltip>
        ))}

        {/* Matrix rows */}
        {rayIds.map((rankerRayId, rankerIdx) => {
          const rankerName = rayModelNames.get(rankerRayId) || rankerRayId;
          const rankerMap = matrix.get(rankerRayId);

          return (
            <React.Fragment key={rankerRayId}>
              {/* Row header */}
              <Tooltip title={rankerName}>
                <Box
                  sx={{
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {rankerName.slice(0, 15)}
                </Box>
              </Tooltip>

              {/* Row cells */}
              {rayIds.map((rankedRayId, rankedIdx) => {
                const position = rankerMap?.get(rankedRayId);
                const isSelf = rankerRayId === rankedRayId;

                const cellContent = isSelf ? '-' : (position !== undefined ? position.toString() : '?');
                const bgColor = isSelf ? '#ddd' : getColor(position, rayIds.length);

                return (
                  <Tooltip
                    key={rankedRayId}
                    title={
                      isSelf
                        ? 'Self (not ranked)'
                        : `${rankerName} ranked ${rayModelNames.get(rankedRayId)} as #${position || '?'}`
                    }
                  >
                    <Box
                      sx={{
                        backgroundColor: bgColor,
                        color: isSelf ? '#888' : '#fff',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'sm',
                        height: '40px',
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          boxShadow: 'md',
                          zIndex: 10,
                        },
                        transition: 'transform 0.2s, box-shadow 0.2s',
                      }}
                    >
                      {cellContent}
                    </Box>
                  </Tooltip>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* Average row */}
        <Box sx={{ fontWeight: 'bold', fontSize: '0.75rem', borderTop: '2px solid', pt: 1, mt: 1 }}>
          Avg Rank
        </Box>
        {avgRanks.map((avg, idx) => (
          <Box
            key={rayIds[idx]}
            sx={{
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '0.875rem',
              borderTop: '2px solid',
              pt: 1,
              mt: 1,
            }}
          >
            {avg.toFixed(1)}
          </Box>
        ))}
      </Box>

      {/* Legend */}
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
          Color scale:
        </Typography>
        <Box
          sx={{
            width: '100px',
            height: '12px',
            background: 'linear-gradient(to right, hsl(120, 70%, 50%), hsl(60, 70%, 50%), hsl(30, 70%, 50%), hsl(0, 70%, 50%))',
            borderRadius: 'sm',
          }}
        />
        <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
          (1st → Last)
        </Typography>
      </Box>
    </Sheet>
  );
}
