import * as React from 'react';

import { Accordion, AccordionDetails, AccordionGroup, AccordionSummary, accordionSummaryClasses, Box } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


export function ExpanderAccordion(props: { title?: React.ReactNode, icon?: React.ReactNode, startCollapsed?: boolean, children?: React.JSX.Element }) {

  // state
  const [expanded, setExpanded] = React.useState(props.startCollapsed !== true);

  return (
    <AccordionGroup>
      <Accordion
        // variant={expanded ? 'solid' : 'soft'}
        expanded={expanded}
        onChange={(_event, expanded) => setExpanded(expanded)}
      >
        <AccordionSummary
          variant='soft'
          indicator={<KeyboardArrowDownIcon />}
          slotProps={{
            indicator: {
              sx: {
                transition: 'transform 0.2s',
              },
            },
          }}
          sx={{
            [`&.${accordionSummaryClasses.indicator}[aria-expanded='true']`]: {
              transform: 'rotate(-180deg)',
            },
          }}
        >
          {props.icon} {props.title}
        </AccordionSummary>

        <AccordionDetails variant='solid'>
          <Box sx={{ display: 'grid' }}>
            {expanded && props.children}
          </Box>
        </AccordionDetails>

      </Accordion>
    </AccordionGroup>
  );
}