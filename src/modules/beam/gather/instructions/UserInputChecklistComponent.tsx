import * as React from 'react';

import { Box, Button, Checkbox } from '@mui/joy';

import { GATHER_COLOR } from '../../beam.config';
import { UserChecklistOption } from './UserInputChecklistInstruction';


export function parseTextToChecklist(text: string, relaxMatch: boolean): UserChecklistOption[] {
  // Updated regex to match optional spaces (one or two) before '-', and both [ ] and [x] (case-insensitive for 'x')
  const regex = !relaxMatch ? /^ {0,2}[-*•] \[([ xX])] (.*)$/gm : /^ {0,2}[-*•]\s+(.*)$/gm;
  let matches;
  const options: UserChecklistOption[] = [];

  // Use while loop to iterate over all matches
  while ((matches = regex.exec(text)) !== null) {
    // matches[1] contains the space or 'x', indicating if the option is selected
    const selected = matches[1].toLowerCase() === 'x';
    const label = matches[2]; // The actual label of the option

    options.push({
      id: `option-${options.length}`,
      label: label,
      selected: selected,
    });
  }

  return options;
}


function parseMarkdownBold(text: string) {
  // Split the text by the markdown bold syntax
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    // Check if the part is meant to be bold
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}


export function UserInputChecklistComponent(props: {
  options: UserChecklistOption[];
  onConfirm: (selectedOptions: UserChecklistOption[]) => void;
  onCancel: () => void;
}) {
  // Use local state to manage selections
  const [localOptions, setLocalOptions] = React.useState<UserChecklistOption[]>(props.options);

  const handleToggle = React.useCallback((optionId: string) => {
    setLocalOptions((currentOptions) =>
      currentOptions.map((option) =>
        option.id === optionId
          ? { ...option, selected: !option.selected }
          : option,
      ),
    );
  }, []);

  const moreThanHalfSelected = localOptions.filter(option => option.selected).length > localOptions.length / 2;

  return (
    <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
      {/*<Typography sx={{ mt: 1, fontWeight: 'md', fontSize: 'sm' }}>*/}
      {/*  Select how you want the merge:*/}
      {/*</Typography>*/}

      {localOptions.map((option) => (
        <Checkbox
          key={option.id}
          size='sm'
          color={GATHER_COLOR}
          // color='primary'
          checked={option.selected}
          onChange={() => handleToggle(option.id)}
          label={parseMarkdownBold(option.label)}
          slotProps={{
            root: { sx: { lineHeight: 'lg', ml: '1.625rem' } },
            checkbox: { sx: { mt: 0.25 } },
          }}
        />
      ))}

      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Button
          color={GATHER_COLOR}
          onClick={() => props.onConfirm(localOptions)}
        >
          Confirm Selection
        </Button>

        <Button
          color='neutral'
          variant='soft'
          onClick={() => setLocalOptions(localOptions.map(option => ({ ...option, selected: !moreThanHalfSelected })))}
        >
          {moreThanHalfSelected ? 'Uncheck All' : 'Check All'}
        </Button>

        <Button
          color='neutral'
          variant='soft'
          onClick={props.onCancel}
          sx={{ ml: 'auto' }}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
}