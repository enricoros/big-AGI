import * as React from 'react';

import { Divider } from '@mui/joy';

import { DConversationId } from '~/common/state/store-chats';
import { GoodModal } from '~/common/components/GoodModal';

import { ExportChats, ExportConfig } from './ExportChats';
import { ImportConfig, ImportConversations } from './ImportChats';

export type TradeConfig = ImportConfig | ExportConfig;

export function TradeModal(props: { config: TradeConfig, onConversationActivate: (conversationId: DConversationId) => void, onClose: () => void }) {
  return (
    <GoodModal title={<><b>{props.config.dir === 'import' ? 'Import ' : props.config.dir === 'export' ? 'Export ' : ''}</b> conversations</>} open onClose={props.onClose}>
      <Divider />
      {props.config.dir === 'import' && <ImportConversations onConversationActivate={props.onConversationActivate} onClose={props.onClose} />}
      {props.config.dir === 'export' && <ExportChats config={props.config} onClose={props.onClose} />}
      <Divider />
    </GoodModal>
  );
}