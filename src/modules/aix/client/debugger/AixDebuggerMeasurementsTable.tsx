import * as React from 'react';

import { Table, Typography } from '@mui/joy';

import type { AixClientDebugger } from './memstore-aix-client-debugger';


export function AixDebuggerMeasurementsTable(props: {
  measurements: AixClientDebugger.Measurements
}) {

  // empty placeholder
  if (!props.measurements?.length)
    return (
      <Typography level='body-sm' fontStyle='italic'>
        No performance measurements available
      </Typography>
    );

  // assume the keys of the first measurement are uniform across all measurements
  const headers = Object.keys(props.measurements[0]);

  return (
    <Table
      size='sm'
      variant='outlined'
      sx={{

        backgroundColor: 'background.surface',
        '& th': { fontWeight: 'bold', whiteSpace: 'nowrap', p: 1 },
        '& td': { fontFamily: 'code', p: 1 },
      }}
    >
      <thead>
      <tr>
        {headers.map(header => (
          <th key={header}>{header}</th>
        ))}
      </tr>
      </thead>
      <tbody>
      {props.measurements.map((measurement, index) => (
        <tr key={index}>
          {headers.map(header => {
            const value = measurement[header];
            // Format percentages with 1 decimal place
            const displayValue = header === 'percent' && typeof value === 'number'
              ? `${value.toFixed(1)}%`
              : value;
            return <td key={header}>{displayValue}</td>;
          })}
        </tr>
      ))}
      </tbody>
    </Table>
  );
}