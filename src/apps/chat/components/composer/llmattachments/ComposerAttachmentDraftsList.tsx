import * as React from 'react';

import { CircularProgress, ListDivider, ListItemDecorator, MenuItem } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import type { AgiAttachmentPromptsData } from '~/modules/aifn/agiattachmentprompts/useAgiAttachmentPrompts';

import type { AttachmentDraft, AttachmentDraftId, AttachmentDraftsAction } from '~/common/attachment-drafts/attachment.types';
import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-attachment-drafts_slice';
import type { AttachmentEnrichmentSummary, IAttachmentEnrichment } from '~/common/attachment-drafts/llm-enrichment/attachment.enrichment';
import { AttachmentDraftsList } from '~/common/attachment-drafts/attachment-drafts-ui/AttachmentDraftsList';

import { LLMAttachmentsPromptsButtonMemo } from './LLMAttachmentsPromptsButton';
import { ViewDocPartModal } from '../../message/fragments-content/ViewDocPartModal';
import { ViewImageRefPartModal } from '../../message/fragments-content/ViewImageRefPartModal';


/**
 * Composer-specific wrapper around the generic AttachmentDraftsList.
 * Provides: viewer modals, AI prompts button, "What can I do?" menu item.
 */
export function ComposerAttachmentDraftsList(props: {
  attachmentDrafts: AttachmentDraft[],
  attachmentDraftsStoreApi: AttachmentDraftsStoreApi,
  enrichment: IAttachmentEnrichment,
  enrichmentSummary: AttachmentEnrichmentSummary,
  agiAttachmentPrompts: AgiAttachmentPromptsData,
  onAttachmentDraftsAction: (attachmentDraftId: AttachmentDraftId | null, actionId: AttachmentDraftsAction) => void,
}) {

  const { agiAttachmentPrompts, attachmentDrafts } = props;


  // memo components

  const startDecorator = React.useMemo(() =>
      !agiAttachmentPrompts.isVisible && !agiAttachmentPrompts.hasData ? undefined
        : <LLMAttachmentsPromptsButtonMemo data={agiAttachmentPrompts} />
    , [agiAttachmentPrompts]);


  // memo rendering functions

  const renderDocViewer = React.useCallback(
    (part: React.ComponentProps<typeof ViewDocPartModal>['docPart'], onClose: () => void) =>
      <ViewDocPartModal docPart={part} onClose={onClose} />
    , []);

  const renderImageViewer = React.useCallback(
    (part: React.ComponentProps<typeof ViewImageRefPartModal>['imageRefPart'], onClose: () => void) =>
      <ViewImageRefPartModal imageRefPart={part} onClose={onClose} />
    , []);

  const renderOverallMenuExtra = React.useCallback(() => <>
    <MenuItem color='primary' variant='soft' onClick={agiAttachmentPrompts.refetch} disabled={!attachmentDrafts.length || agiAttachmentPrompts.isFetching}>
      <ListItemDecorator>{agiAttachmentPrompts.isFetching ? <CircularProgress size='sm' /> : <AutoFixHighIcon />}</ListItemDecorator>
      What can I do?
    </MenuItem>
    <ListDivider />
  </>, [agiAttachmentPrompts.isFetching, agiAttachmentPrompts.refetch, attachmentDrafts.length]);


  return (
    <AttachmentDraftsList
      attachmentDraftsStoreApi={props.attachmentDraftsStoreApi}
      attachmentDrafts={attachmentDrafts}
      enrichment={props.enrichment}
      enrichmentSummary={props.enrichmentSummary}
      onAttachmentDraftsAction={props.onAttachmentDraftsAction}
      startDecorator={startDecorator}
      renderDocViewer={renderDocViewer}
      renderImageViewer={renderImageViewer}
      renderOverallMenuExtra={renderOverallMenuExtra}
    />
  );
}
