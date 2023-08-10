import * as React from 'react';

import { Divider } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';

import { ImportConfig, ImportConversations } from './ImportChats';
import { ExportConfig, ExportChats } from './ExportChats';

export type TradeConfig = ImportConfig | ExportConfig;

export function TradeModal(props: { config: TradeConfig, onClose: () => void }) {
  return (
    <GoodModal title={<><b>{props.config.dir === 'import' ? 'Import ' : props.config.dir === 'export' ? 'Export ' : ''}</b> conversations</>} open onClose={props.onClose}>
      <Divider />
      {props.config.dir === 'import' && <ImportConversations onClose={props.onClose} />}
      {props.config.dir === 'export' && <ExportChats config={props.config} onClose={props.onClose} />}
      <Divider />
    </GoodModal>
  );
}