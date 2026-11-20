import * as React from 'react';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { ExternalDocsLink } from '~/common/components/ExternalDocsLink';
import { GoodModal } from '~/common/components/modals/GoodModal';

import { ExportChats, ExportConfig } from './ExportChats';
import { type ImportConfig, TradeImport } from './TradeImport';

export type TradeConfig = ImportConfig | ExportConfig;

export function TradeModal(props: { config: TradeConfig, onConversationActivate: (conversationId: DConversationId) => void, onImported?: () => void, onClose: () => void }) {
  return (
    <GoodModal
      open onClose={props.onClose}
      dividers
      title={<>
        <b>{props.config.dir === 'import' ? 'Import' : 'Export '}</b> {(props.config.dir === 'export' && !props.config.exportAll) ? 'conversation' : ''}
      </>}
      startButton={<ExternalDocsLink level='body-sm' docPage='account-backup'>Learn more</ExternalDocsLink>}
    >

      {props.config.dir === 'import' && (
        <TradeImport files={props.config.files} onConversationActivate={props.onConversationActivate} onImported={props.onImported} />
      )}

      {props.config.dir === 'export' && (
        <ExportChats config={props.config} onClose={props.onClose} />
      )}

    </GoodModal>
  );
}