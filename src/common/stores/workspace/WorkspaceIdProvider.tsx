import * as React from 'react';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';

import { DWorkspaceId, workspaceForConversationIdentity } from './workspace.types';


// The Context and the data it will prop-drill
const WorkspaceContext = React.createContext(null as any as WorkspaceContextData);

interface WorkspaceContextData {
  workspaceId: DWorkspaceId | null;
}


/**
 * Provides the workspaceId for its children
 */
export function WorkspaceIdProvider(props: {
  conversationId: DConversationId | null,
  children?: React.ReactNode,
}) {

  // workspace data
  const workspaceData = React.useMemo(() => ({
    workspaceId: workspaceForConversationIdentity(props.conversationId),
  }), [props.conversationId]);

  return (
    <WorkspaceContext.Provider value={workspaceData}>
      {props.children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Access the workspaceId from within a WorkspaceIdProvider subtree
 */
export function useContextWorkspaceId() {
  const value = React.useContext(WorkspaceContext);
  if (!value)
    throw new Error('Missing WorkspaceProvider');
  return value.workspaceId;
}
