import * as React from 'react';

import { Box } from '@mui/joy';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { AppBreadcrumbs } from '~/common/components/AppBreadcrumbs';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { capitalizeFirstLetter } from '~/common/util/textUtils';

import { CHAT_NOVEL_TITLE } from '../../AppChat';
import { useEditableConversationTitle } from './useEditableConversationTitle';


/**
 * Top-bar context breadcrumbs - the single navigation crumb-trail shared by the Chat and Beam bars.
 *
 * Today it renders one crumb: the current conversation. Two modes:
 *  - LEAF (chat view): the conversation IS the current location -> the crumb is *editable* (click to rename).
 *  - ANCESTOR (sub-context, e.g. Beam): the conversation is a *parent* -> the crumb is a clickable link that
 *    navigates back (via `onConversationClick`), and `children` render as the trailing leaf crumb(s).
 *
 * Forward seams (kept deliberately minimal, see kb/product/PRD.FUTURE-sigils.md + PRD.FUTURE.LLM-recursive-overlays.md):
 *  - Parent crumbs (Folder -> Space -> Project, or Document): wrap this in <AppBreadcrumbsProvider preTitle=... onPreClick=...>
 *    so ancestors render to the left of the conversation. The "leaf = editable, ancestors = navigate" rule already holds.
 *  - Sigil-backed crumbs: when the `entity.open` command layer lands, each crumb should become a sigil chip
 *    so a click dispatches a real navigation command with live rename-surviving titles - symmetrical with AI navigation.
 *
 * This component (and its hook) is line-agnostic and byte-identical across `main`/`dev`: it owns the reusable
 * breadcrumb; each line wires it into its own ChatBarChat/ChatBarBeam and (on `dev`) its own visibility setting.
 */

const _styles = {

  // wrapper: lets the breadcrumb collapse/ellipsize gracefully inside the centered top bar.
  // Joy Breadcrumbs renders as `nav > ol > li`; keep it on one line and let the crumbs shrink rather than wrap.
  root: {
    minHeight: 'var(--Bar)',
    mr: 1.5,
    minWidth: 0, // allow flex children to shrink so the title can ellipsize
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    '& nav': { overflow: 'hidden' },
    '& nav > ol': { flexWrap: 'nowrap' },
    '& nav > ol > li': { minWidth: 0 },
  },

  // the conversation crumb is capped to ~ a selector's width, so a long title never pushes the
  // persona/model selectors off-center (the whole group stays centered in the bar)
  titleCap: {
    maxWidth: { xs: 144, sm: 200, md: 260 },
  } as const,

  titleEditable: {
    maxWidth: { xs: 144, sm: 200, md: 260 },
    cursor: 'pointer', // was: 'text'
    borderRadius: 'xs',
    px: 0.25,
    '&:hover': { textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px' },
  } as const,

  // inline editor: shown in place of the breadcrumb while renaming (chat-view leaf only)
  editor: {
    minWidth: 280,
    maxWidth: 'min(72dvw, 480px)',
    mx: { md: 1 },
  } as const,

} as const;


export function ChatBarBreadcrumbs(props: {
  conversationId: DConversationId | null,
  conversationTitle: string,
  isMobile?: boolean,
  // when set, the conversation crumb becomes a clickable *ancestor* (navigates) and `children` render as the leaf
  onConversationClick?: () => void,
  children?: React.ReactNode,
}) {

  // inline-rename state (line-agnostic hook)
  const { isEditing, beginEdit, commitEdit, cancelEdit } = useEditableConversationTitle(props.conversationId);

  // derived state
  const { conversationTitle, onConversationClick } = props;
  const isSubContext = !!onConversationClick;


  // [edit mode] replace the breadcrumb with the inline editor (chat-view leaf only).
  // NOTE: once ancestor crumbs (Projects/Spaces) exist, render this editor *within* the leaf crumb instead of replacing the trail.
  if (isEditing && !isSubContext) {
    return (
      <InlineTextarea
        initialText={conversationTitle?.trim() || ''}
        placeholder='Chat title...'
        invertedColors
        centerText
        maxRows={3} // bound the auto-grow: long titles scroll within ~3 rows instead of making the editor very tall
        onEdit={commitEdit}
        onCancel={cancelEdit}
        sx={_styles.editor}
      />
    );
  }

  const displayTitle = capitalizeFirstLetter(conversationTitle?.trim() || (isSubContext ? 'Chat' : CHAT_NOVEL_TITLE));

  // the conversation crumb: clickable *ancestor* (sub-context) or editable *leaf* (chat view)
  const conversationCrumb = isSubContext ? (
    <Box className='agi-ellipsize' sx={_styles.titleCap}>{displayTitle}</Box>
  ) : (
    <TooltipOutlined placement='bottom-start' title='Rename Chat'>
      <Box className='agi-ellipsize' sx={_styles.titleEditable} onClick={beginEdit}>
        {displayTitle}
      </Box>
    </TooltipOutlined>
  );

  return (
    <Box sx={_styles.root}>
      <AppBreadcrumbs
        size='md' // match the persona/model selectors and Beam's title-md leaf; unifies sizing across chat & beam
        rootTitle={conversationCrumb}
        onRootClick={isSubContext ? onConversationClick : undefined}
      >
        {props.children}
      </AppBreadcrumbs>
    </Box>
  );
}
