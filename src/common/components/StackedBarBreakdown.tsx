import * as React from 'react';

import { Box, Typography } from '@mui/joy';


/** Generic segment interface for stacked bar charts */
export interface StackedBarSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface StackedBarBreakdownProps {
  /** Array of segments to display */
  segments: StackedBarSegment[];
  /** Optional title for the chart */
  title?: React.ReactNode;
  /** Whether to show absolute values in the legend (otherwise just percentages) */
  showValues?: boolean;
  /** Function to format values for display and tooltips */
  valueFormatter?: (value: number) => string;
  /** Optional description text below the chart */
  description?: string;
}


export function StackedBarBreakdown({ segments, title, showValues = false, valueFormatter = (v) => v.toString(), description }: StackedBarBreakdownProps) {
  // Calculate total for percentages
  const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;

  // Filter out zero-value segments
  const nonZeroSegments = segments.filter(seg => seg.value > 0);

  return (
    <Box>
      {title && (
        typeof title === 'string'
          ? <Typography level='title-md' mb={1}>{title}</Typography>
          : title
      )}

      {/* The stacked bar */}
      <Box sx={{
        display: 'flex',
        height: 10,
        borderRadius: 'sm',
        overflow: 'hidden',
        boxShadow: 'xs',
        my: 1,
      }}>
        {nonZeroSegments.map(({ key, value, color }) => {
          const percentage = (value / total) * 100;
          return (
            <Box
              key={key}
              title={`${valueFormatter(value)} (${percentage.toFixed(0)}%)`}
              sx={{
                width: `${percentage}%`,
                backgroundColor: color,
                // transition: 'width 0.3s ease-in-out',
              }}
            />
          );
        })}
      </Box>

      {/* Legend with colored squares */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {nonZeroSegments.map(({ key, label, value, color }) => {
          const percentage = (value / total) * 100;
          return (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{
                width: 10, height: 10, backgroundColor: color, borderRadius: 'sm',
                boxShadow: 'xs'
              }} />
              <Typography level='body-xs'>
                {label} {showValues
                ? `${valueFormatter(value)} (${percentage.toFixed(0)}%)`
                : `(${percentage.toFixed(0)}%)`}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {description && (
        <Typography level='body-sm' mt={1}>{description}</Typography>
      )}
    </Box>
  );
}
