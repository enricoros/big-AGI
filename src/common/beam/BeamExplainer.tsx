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

![big-AGI BEAM Rays](https://raw.githubusercontent.com/enricoros/big-AGI/main/public/images/explainers/explainer-beam-scatter-1200px-alpha.png)

1. Reach closer to your goal, faster
2. Tap into multiple AI perspectives at once
3. Discover unconventional solutions

#### How to Beam (Phase 1/2):

- Clearly define your problem
- Launch up to 8 AI models in parallel
- Keep insightful responses, filter out the noise, and repeat

> Beam until you are satisfied or have narrowed down to a few promising responses.

**Beaming** is the first step. Be curious.
`,
  },
  {
    stepDigits: '02',
    stepName: 'Merge',
    titleSpark: 'MERGE',
    titleSuffix: ': Convergence', // Synthesis, Convergence
    mdContent: `
**Merge** combines the most valuable AI responses into a single cohesive response.

![big-AGI BEAM Rays](https://raw.githubusercontent.com/enricoros/big-AGI/main/public/images/explainers/explainer-beam-gather-1600px-alpha.png)

1. Combine insights into one solution
2. Leverage the collective wisdom of AI

#### How to Merge:
Utilizes all the remaining Beam responses and allows you to choose how to fuse them.

- Select the fusion *LLM*
- Choose a Merge *method*, then *start*:
- **✨ Pick**: AI selects the most promising response
- **✨ Fusion**: AI combines the best elements of each response
- **✨ Compare**: AI analyzes and compares the responses
- **✨ Custom**: Define your own fusion prompt
- Review and accept the results, or try again

**Done**. You can now bring the merged message or any other message back to the chat.
    `, // > Merge until you have a single, high-quality response. Or choose the final response manually, skipping merge.
  },
  {
    stepDigits: '',
    stepName: 'Tips',
    titleSuffix: 'Effectiveness Tips',
    mdContent: `
#### Human-in-the-loop · N × GPT-4 -> GPT-5
You, the user, provide creative direction and final judgement. The AI models are powerful tools that generate drafts for you to quickly evaluate and refine.
There are profound reasons why this approach works, which we explore [in our blog](https://big-agi.com/blog/introducing-beam).

#### Best Use
This tool is designed for the **early stages** of a process, where it delivers unparalleled insights and perspectives precisely **when your
project needs clarity and direction**.

The diversity of perspectives acts **like the wisdom of a seasoned team**, offering a wide array of solutions and viewpoints.

#### Considerations
The tool **will consume more Tokens** than a regular chat, which is another reason to use it early on when
a chat history is short, and the return on investment is greater.
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