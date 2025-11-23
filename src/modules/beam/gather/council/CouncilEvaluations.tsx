/**
 * Council Evaluations - tabbed view of all ranking evaluations
 */

import * as React from 'react';
import { Box, Sheet, Typography, Tabs, TabList, Tab, TabPanel } from '@mui/joy';

import { RenderMarkdown } from '~/modules/blocks/markdown/RenderMarkdown';

import type { CouncilRanking } from './beam.gather.council.types';

interface CouncilEvaluationsProps {
  rankings: CouncilRanking[];
}

export function CouncilEvaluations(props: CouncilEvaluationsProps) {
  const { rankings } = props;
  const [selectedTab, setSelectedTab] = React.useState(0);

  return (
    <Sheet
      variant='soft'
      sx={{
        borderRadius: 'md',
        p: 2,
      }}
    >
      <Typography level='title-md' sx={{ mb: 2 }}>
        📝 Peer Evaluations
      </Typography>

      <Tabs
        value={selectedTab}
        onChange={(_, value) => setSelectedTab(value as number)}
      >
        <TabList>
          {rankings.map((ranking, idx) => (
            <Tab key={ranking.rankerRayId} value={idx}>
              {ranking.rankerModelName}
            </Tab>
          ))}
        </TabList>

        {rankings.map((ranking, idx) => (
          <TabPanel key={ranking.rankerRayId} value={idx} sx={{ p: 2 }}>
            <Box
              sx={{
                maxHeight: '400px',
                overflowY: 'auto',
                pr: 1,
              }}
            >
              {/* Full evaluation text */}
              <Box sx={{ mb: 3 }}>
                <RenderMarkdown
                  content={ranking.evaluationText}
                  sx={{ fontSize: 'sm' }}
                />
              </Box>

              {/* Extracted ranking (highlighted) */}
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  backgroundColor: 'primary.softBg',
                  borderLeft: '3px solid',
                  borderColor: 'primary.solidBg',
                  borderRadius: 'sm',
                }}
              >
                <Typography level='body-xs' sx={{ fontWeight: 'bold', mb: 1 }}>
                  Extracted Ranking:
                </Typography>
                <Typography
                  level='body-sm'
                  sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {ranking.extractedRanking}
                </Typography>
              </Box>
            </Box>
          </TabPanel>
        ))}
      </Tabs>
    </Sheet>
  );
}
