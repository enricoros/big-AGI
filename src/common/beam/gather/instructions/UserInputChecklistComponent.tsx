import * as React from 'react';

import { Box, Button, Checkbox, Typography } from '@mui/joy';

import { UserChecklistOption } from './UserInputChecklistInstruction';


export function parseTextToChecklist(text: string): UserChecklistOption[] {
  // Updated regex to match optional spaces (one or two) before '-', and both [ ] and [x] (case-insensitive for 'x')
  const regex = /^ {0,2}- \[([ xX])] (.*)$/gm;
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

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Typography level='body-md' sx={{ mt: 1 }}>
        Select the Merge options to apply:
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {localOptions.map((option) => (
          <Checkbox
            key={option.id}
            size='sm'
            checked={option.selected}
            onChange={() => handleToggle(option.id)}
            label={option.label}
            sx={{ whiteSpace: 'break-spaces', ml: 2 }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          onClick={() => props.onConfirm(localOptions)}
        >
          Confirm Selection
        </Button>
        <Button
          color='neutral'
          variant='soft'
          onClick={props.onCancel}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
}