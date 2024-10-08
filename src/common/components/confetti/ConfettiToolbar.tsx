import Button from '@mui/joy/Button';
import ButtonGroup from '@mui/joy/ButtonGroup';
import { useConfettiSettings } from './confetti-settings';
import { MouseEventHandler } from 'react';

export function ConfettiToolbar() {
  const [activeSettings, commands] = useConfettiSettings();

  const prev: MouseEventHandler = (_?: unknown) => {
    commands.goToPrevStep();
  };
  const next: MouseEventHandler = (_?: unknown) => {
    commands.goToNextStep();
  };
  const random: MouseEventHandler = (_?: unknown) => {
    try {
      commands.random();
    } catch (e) {
      console.error(e);
    }
  };
  const reset: MouseEventHandler = (_?: unknown) => {
    try {
      commands.reset();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ButtonGroup
      buttonFlex={1}
      variant="soft"
      sx={{ '--ButtonGroup-radius': '40px' }}
      aria-label="confetti button group"
    >
      {/* <Button>🎆</Button> */}
      {/* <Button onClick={(e) => prev(e)} startDecorator={'⏮'}>
        Prev
      </Button> */}
      <Button onClick={(e) => random(e)} startDecorator={'🎆'} endDecorator={'🎆'}>
        Rand
      </Button>
      {/* <Button onClick={(e) => next(e)} endDecorator={'⏭'}>
        Next
      </Button> */}
      <Button onClick={(e) => reset(e)} endDecorator={'↩'}>
        Reset
      </Button>
    </ButtonGroup>
  );
}
