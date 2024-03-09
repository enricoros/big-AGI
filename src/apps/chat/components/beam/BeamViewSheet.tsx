import { Sheet, styled } from '@mui/joy';
import { keyframes } from '@emotion/react';


const animationEnter = keyframes`
    0% {
        opacity: 0;
        transform: translateY(8px);
        scale: 1.1;
    }
    100% {
        opacity: 1;
        transform: translateY(0);
        scale: 1;
    }
`;

export const BeamViewSheet = styled(Sheet)(({ theme }) => ({
  // animation
  animation: `${animationEnter} 0.3s cubic-bezier(.17,.84,.44,1)`,

  // layout
  display: 'flex',
  flexDirection: 'column',
})) as typeof Sheet;
