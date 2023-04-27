import * as React from 'react';

import { Box, Button, Modal, ModalClose, ModalDialog, ModalOverflow, Typography } from '@mui/joy';

import { ElevenlabsSettings } from '@/modules/elevenlabs/ElevenlabsSettings';
import { OpenAIAdvancedSettings } from '@/modules/openai/OpenAIAdvancedSettings';
import { OpenAISettings } from '@/modules/openai/OpenAISettings';
import { ProdiaSettings } from '@/modules/prodia/ProdiaSettings';
import { SearchSettings } from '@/modules/search/SearchSettings';

import { UISettings } from './UISettings';


/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 *
 * @param {boolean} open Whether the Settings modal is open
 * @param {() => void} onClose Call this to close the dialog from outside
 */
export function SettingsModal({ open, onClose }: { open: boolean, onClose: () => void; }) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalOverflow>
        <ModalDialog sx={{ maxWidth: 500, display: 'flex', p: { xs: 1, sm: 2, lg: '20px' } }}>

          <Typography level='h6' sx={{ mb: 2 }}>Settings</Typography>
          <ModalClose />

          <OpenAISettings />

          <UISettings />

          <ElevenlabsSettings />

          <ProdiaSettings />

          <SearchSettings />

          <OpenAIAdvancedSettings />

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant='solid' onClick={onClose}>
              Close
            </Button>
          </Box>

        </ModalDialog>
      </ModalOverflow>
    </Modal>
  );
}
