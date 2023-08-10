import * as React from 'react';

import { Box, Button, Modal, ModalClose, ModalDialog, ModalOverflow, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';


/**
 * Base for our Modal components (Preferences, Models Setup, etc.)
 */
export function GoodModal(props: { title: string | React.JSX.Element, strongerTitle?: boolean, open: boolean, onClose: () => void, startButton?: React.JSX.Element, sx?: SxProps, children: React.ReactNode }) {
  return (
    <Modal open={props.open} onClose={props.onClose}>
      <ModalOverflow>
        <ModalDialog
          sx={{
            minWidth: { xs: 360, sm: 500, md: 600, lg: 700 },
            maxWidth: 700,
            display: 'flex', flexDirection: 'column', gap: 3,
            ...props.sx,
          }}>

          <Box sx={{ mb: -1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography level={props.strongerTitle !== true ? 'title-md' : 'title-lg'}>
              {props.title}
            </Typography>
            <ModalClose sx={{ position: 'static', mr: -1 }} />
          </Box>

          {props.children}

          <Box sx={{ mt: 'auto', display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between' }}>
            {props.startButton}
            <Button variant='solid' color='neutral' onClick={props.onClose} sx={{ ml: 'auto', minWidth: 100 }}>
              Close
            </Button>
          </Box>

        </ModalDialog>
      </ModalOverflow>
    </Modal>
  );
}
