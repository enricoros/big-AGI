// import * as React from 'react';
//
// import type { SxProps } from '@mui/joy/styles/types';
// import { Alert, Box, Button, CircularProgress } from '@mui/joy';
// import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
//
// import type { AgiAttachmentPromptsData } from '~/modules/aifn/attachmentprompts/useAgiAttachmentPrompts';
//
//
// const promptsButtonSx: SxProps = { display: 'flex', gap: 1, mb: 0.5 };
//
// export function AttachmentsPromptsButton({ data }: { data: AgiAttachmentPromptsData }) {
//   return (
//     <Box sx={promptsButtonSx}>
//
//       <Button
//         variant='outlined'
//         color='primary'
//         disabled={data.isFetching}
//         endDecorator={
//           data.isFetching ? <CircularProgress color='neutral' sx={{ '--CircularProgress-size': '16px' }} />
//             : <AutoFixHighIcon sx={{ fontSize: '20px' }} />
//         }
//         onClick={data.refetch}
//         sx={{
//           px: 3,
//           backgroundColor: 'background.surface',
//           boxShadow: '0 4px 6px -4px rgb(var(--joy-palette-primary-darkChannel) / 40%)',
//           borderRadius: 'sm',
//         }}
//       >
//         {data.isFetching ? 'Guessing what to do...' : data.isPending ? 'Guess what to do' : 'What else could we do'}
//       </Button>
//
//       {!!data.error && (
//         <Alert variant='soft' color='danger'>
//           {data.error.message || 'Error guessing actions'}
//         </Alert>
//       )}
//
//     </Box>
//   );
// }