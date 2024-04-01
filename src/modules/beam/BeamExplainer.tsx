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
    // titleSquircle: true,
    titleSpark: 'Beam',
    // titleSpark: 'B E A M',
    // titleSuffix: ' azing',
    mdContent: `
**Hello, we just launched Beam for you.**

Beam is a new Big-AGI chat modality that allows you to engage multiple AI models in parallel. 
 
It's like having a brainstorm session with several smart people,
only they are AI models. And as with people,
each AI model has its own unique perspective.
And Beam lets you make the best of them.

![big-AGI BEAM Rays](https://raw.githubusercontent.com/enricoros/big-AGI/main/public/images/explainers/explainer-beam-scatter-1200px-alpha.png)

Let&apos;s get you to **better chat answers, faster**.
`,
  },
  {
    stepDigits: '01',
    stepName: 'Beam',
    titleSpark: 'Beaming',
    titleSuffix: ': Exploration',
    mdContent: `
**Beaming is the exploration phase, it's where you get the AI models to generate ideas.**

To Beam, pick the AI models you want to use (you can also load/save combos), and start them all at once or one by one.
Keep the responses you like and delete the ones that aren't helpful.

**Important**: 💰 Beware of the token usage of Beaming and Merging.
Being multiple and high-intensity operations,
they can consume more tokens than regular chats.
It is better to _use them in early/shorter chats_.

Use a mix of different AI models to get a diverse set of ideas and perspectives.

**Once you see a response you love, send it back to the chat**, otherwise move to the Merge step.
`,
  },
  {
    stepDigits: '02',
    stepName: 'Merge',
    titleSpark: 'Merging',
    titleSuffix: ': Convergence', // Synthesis, Convergence
    mdContent: `
**Merging is the consolidation phase**, where AI combines the best parts of the responses into a great, coherent answer.

![big-AGI BEAM Rays](https://raw.githubusercontent.com/enricoros/big-AGI/main/public/images/explainers/explainer-beam-gather-1600px-alpha.png)

You can choose from various merge options, including Fusion, Checklist, Compare, and Custom.
Feel free to experiment with different options to find the one that works best for you.
    `, // > Merge until you have a single, high-quality response. Or choose the final response manually, skipping merge.
  },
//   {
//     stepDigits: '',
//     stepName: 'Tips',
//     titleSuffix: 'Effectiveness Tips', //  · N × GPT-4 -> GPT-5
//     mdContent: `
// #### Human as a Judge
// You, the user, provide creative direction and final judgement. The AI models are powerful tools that generate drafts for you to quickly evaluate and refine.
// There are profound reasons why this approach works, which we explore [in our blog](https://big-agi.com/blog/introducing-beam).
//
// #### Best Use
// This tool is designed for the **early stages** of a process, where it delivers unparalleled insights and perspectives precisely **when your
// project needs clarity and direction**.
//
// The diversity of perspectives acts **like the wisdom of a seasoned team**, offering a wide array of solutions and viewpoints.
//
// #### Considerations
// The tool **will consume more Tokens** than a regular chat, which is another reason to use it early on when
// a chat history is short, and the return on investment is greater.
// `,
//   },
] as const;


const beamExplainerSx: SxProps = {
  // allows the content to be scrolled (all browsers)
  overflowY: 'auto',
  // actually make sure this scrolls & fills
  height: '100%',

  // style
  padding: { xs: '1rem', md: '1.5rem' },
  animation: `${animationEnterScaleUp} 0.2s cubic-bezier(.17,.84,.44,1)`,

  // layout
  display: 'grid',
};


export function BeamExplainer(props: {
  onWizardComplete: () => any,
}) {

  return (
    <Box
      // variant={grayUI ? 'solid' : 'soft'}
      // invertedColors={grayUI ? true : undefined}
      sx={beamExplainerSx}
    >

      <ExplainerCarousel
        steps={beamSteps}
        footer={
          <Typography level='body-xs' sx={{ textAlign: 'center', maxWidth: '400px', mx: 'auto' }}>
            {/*Unlock beaming, combine AI wisdom, achieve clarity.*/}
            {/*Discover, Design and Dream.*/}
            {/*The journey from exploration to refinement is iterative.*/}
            {/*Each cycle sharpens your ideas, bringing you closer to innovation.*/}
          </Typography>
        }
        onFinished={props.onWizardComplete}
      />

    </Box>

  );
}