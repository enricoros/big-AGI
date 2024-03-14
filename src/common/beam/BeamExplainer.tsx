import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Typography } from '@mui/joy';

import { ExplainerCarousel, ExplainerPage } from '~/common/components/ExplainerCarousel';
import { animationEnterScaleUp } from '~/common/util/animUtils';


const beamSteps: ExplainerPage[] = [
  {
    stepDigits: '',
    stepName: 'Welcome',
    titlePrefix: 'Welcome to',
    titleSquircle: true,
    titleSpark: 'BEAM',
    // titleSpark: 'B E A M',
    // titleSuffix: ' azing',
    mdContent: `
**Hello, Pioneer.**

Your journey to brilliance continues. Unlock the power of **Beaming** to explore vast possibilities and **Merge** to crystalize your vision.

**BEAM** is where ideas flourish. Welcome to the future of creativity. 

**Let's begin.**
`,
  },
  {
    stepDigits: '01',
    stepName: 'Beam',
    titleSpark: 'BEAM',
    titleSuffix: ': Exploration',
    mdContent: `
**Beam** allows you to run multiple AI models in parallel, exploring the solution space from different points of view.

1. Reach closer to your goal, faster
2. Tap into multiple AI perspectives
3. Uncover beyond conventional solutions

#### How to Beam (Phase 1/2):

- Define your problem
- Launch multiple AI models, up to 8
- Keep good responses, discard the noise, repeat

> Beam until you are satisfied or undecided on a few responses.

**Beaming** is the first step. Be curious.
`,
  },
  {
    stepDigits: '02',
    stepName: 'Merge',
    titleSpark: 'MERGE',
    titleSuffix: ': Convergence', // Synthesis, Convergence
    mdContent: `
**Merge** combines the best AI responses into a single one.

1. Combine insights into one solution
2. Leverage collective AI wisdom

#### How to Merge:
Uses all the remaining Beam responses, and lets you choose how to fuse them together. 

- Select the fusion *LLM*
- Choose a Merge *method*, then *start*:
  - **✨ Pick**: AI chooses the best response
  - **✨ Fusion**: AI combines the best parts of each response
  - **✨ Compare**: AI breaks down and compares the responses
  - **✨ Custom**: define your own fusion prompt 
- Review and accept the results, or try again

**Done**, you can now bring the merged message, or any other message, back to the chat.
    `, // > Merge until you have a single, high-quality response. Or choose the final response manually, skipping merge.
  },
  {
    stepDigits: '',
    stepName: 'Tips',
    titleSuffix: 'Effectiveness Tips',
    mdContent: `
#### Human in the loop
You, the user, provide the creative direction and final judgement. The AI models are justy tools to give you drafts to quickly evaluate.
There are additional deep reasons why this works [in our blog](https://big-agi.com/blog/introducing-beam).

#### Best Use
This tool is crafted for the **early stages** of a process, where it delivers unparalleled insights and perspectives precisely **when your
project needs clarity and direction**. 

The diversity of perspectives acts **like the wisdom of a seasoned team**, offering a wide array of solutions and viewpoints.

#### Warnings
The tool **will consume more Tokens** than a regular chat, which is one more reason to use it early on when
a chat history is short and the return of investment is greater.
`,
  },
] as const;


export function BeamExplainer(props: {
  onWizardComplete: () => any,
  sx?: SxProps,
}) {

  return (
    <Box
      // variant={grayUI ? 'solid' : 'soft'}
      // invertedColors={grayUI ? true : undefined}
      sx={{
        '--Pad': { xs: '1rem', md: '1.5rem' },
        '--Pad_2': 'calc(var(--Pad) / 2)',

        // enter animation
        animation: `${animationEnterScaleUp} 0.2s cubic-bezier(.17,.84,.44,1)`,

        // scrollable layout
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',

        padding: 'var(--Pad)',

        ...props.sx,
      }}>

      <ExplainerCarousel
        steps={beamSteps}
        footer={
          <Typography level='body-xs' sx={{ textAlign: 'center', maxWidth: '400px', mx: 'auto' }}>
            The journey from exploration to refinement is iterative.
            Each cycle sharpens your ideas, bringing you closer to innovation.
          </Typography>
        }
        onFinished={props.onWizardComplete}
      />

    </Box>

  );
}