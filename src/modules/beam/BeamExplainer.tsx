import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { ExplainerCarousel, ExplainerPage } from '~/common/components/ExplainerCarousel';
import { animationEnterScaleUp } from '~/common/util/animUtils';


const beamSteps: ExplainerPage[] = [
  {
    stepDigits: '',
    stepName: 'Welcome',
    // titlePrefix: 'Welcome to Beam.', //  Better answers, faster.
    titlePrefix: 'Welcome to ', titleSpark: 'Beam',
    // titleSpark: 'B E A M',
    // titleSuffix: ' azing',
    // titleSquircle: true,
    mdContent: `
**Beam** is a chat modality in Big-AGI to engage multiple AI models, [together](https://big-agi.com/blog/beam-multi-model-ai-reasoning). 
 
It's like having a brainstorm session with several smart people,
each adding their own unique perspective.
Beam lets you make the best of them all.

![big-AGI BEAM Rays](https://raw.githubusercontent.com/enricoros/big-AGI/main/public/images/explainers/explainer-beam-scatter-1200px-alpha.png)

`, // Let&apos;s get you to better chat answers, faster.
  },
  {
    stepDigits: '01',
    stepName: 'Beam',
    titlePrefix: 'Explore with ', titleSpark: 'Beam', titleSuffix: '.',
    // titleSpark: 'Beaming', titleSuffix: ': Exploration',
    mdContent: `
**Beaming is the exploration phase**, where AI models generate ideas.

Simply pick the AI models you want to use (you can load/save combos) and start them. 
You can then select a single response to continue the chat,
or keep the responses you like and do a Merge.

**Important:** _Best used in earlier / shorter chats_. 💰 Beware of the token usage of Beaming and Merging;
being parallel and lengthy operations, they will use more tokens than regular chats. 

Use a mix of different AI models to get a diverse set of ideas and perspectives. 
`, // and delete the ones that aren't helpful
  },
  {
    stepDigits: '02',
    stepName: 'Merge',
    titlePrefix: 'Combine with ', titleSpark: 'Merge', titleSuffix: '.',
    // titleSpark: 'Merging', titleSuffix: ': Synthesis', // Synthesis, Convergence
    mdContent: `
Merging is **combining the best parts of each response** into a great, coherent answer.

You can choose from various merge options, including **Fusion**, **Checklist**, **Compare**, and **Custom**.
Experiment with different options to find the one that works best for your chat.

![big-AGI BEAM Rays](https://raw.githubusercontent.com/enricoros/big-AGI/main/public/images/explainers/explainer-beam-gather-1600px-alpha.png)
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
  padding: 3, // { xs: 3, md: 3 },
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
        explainerId='beam-onboard'
        steps={beamSteps}
        // footer={
        //   <Typography level='body-xs' sx={{ textAlign: 'center', maxWidth: '400px', mx: 'auto' }}>
        //     {/*Unlock beaming, combine AI wisdom, achieve clarity.*/}
        //     {/*Discover, Design and Dream.*/}
        //     {/*The journey from exploration to refinement is iterative.*/}
        //     {/*Each cycle sharpens your ideas, bringing you closer to innovation.*/}
        //   </Typography>
        // }
        onFinished={props.onWizardComplete}
      />

    </Box>

  );
}