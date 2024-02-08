import * as React from 'react';

import { Chip, chipClasses } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


function ChipExpander(props: {
  text: React.ReactNode,
  expand: boolean,
  handleToggleExpand: () => void
}) {
  return (
    <Chip
      variant={props.expand ? 'solid' : 'outlined'}
      size='md'
      onClick={props.handleToggleExpand}
      endDecorator={<KeyboardArrowDownIcon />}
      aria-expanded={props.expand}
      sx={{
        px: 1.5,
        [`& .${chipClasses.endDecorator}`]: {
          transition: 'transform 0.2s',
        },
        [`&[aria-expanded='true'] .${chipClasses.endDecorator}`]: {
          transform: 'rotate(-180deg)',
        },
      }}
    >
      {props.text}
    </Chip>
  );
}

export function useChipBoolean(text: React.ReactNode, initialExpand = false): [boolean, React.JSX.Element] {

  // state
  const [expanded, setExpanded] = React.useState(initialExpand);

  const component = React.useMemo(() => (
    <ChipExpander text={text} expand={expanded} handleToggleExpand={() => setExpanded(on => !on)} />
  ), [expanded, text]);

  return [expanded, component];
}