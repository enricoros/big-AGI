import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import { List, useTheme } from '@mui/joy';
import { DConversation, DConversationId } from '~/common/state/store-chats';
import { ChatNavigationItemMemo } from './ChatNavigationItem';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';


// Define the ConversationList component with its own props
export const ConversationList = (props: {
    conversations: DConversation[],
    activeConversationId: DConversationId | null,
    disableNewButton: boolean,
    onConversationActivate: (conversationId: DConversationId, closeMenu: boolean) => void,
    onConversationDelete: (conversationId: DConversationId) => void,
    onConversationImportDialog: () => void,
    onConversationNew: () => DConversationId,
    onConversationsDeleteAll: (folderId: string | null) => void,
    selectedFolderId: string | null,
    setSelectedFolderId: (folderId: string | null) => void,
    labsEnhancedUI: boolean,
    showSymbols: boolean,
  }) => {
    const listRef = useRef<HTMLDivElement>(null);
    const [showDownArrow, setShowDownArrow] = useState(false);
    const [showUpArrow, setShowUpArrow] = useState(false);

    const theme = useTheme();


    // derived state
    const maxChatMessages = props.conversations.reduce((longest, _c) => Math.max(longest, _c.messages.length), 1);
    const totalConversations = props.conversations.length;
    const hasChats = totalConversations > 0;
    const singleChat = totalConversations === 1;
    const softMaxReached = totalConversations >= 50;
  
    const checkForOverflow = () => {
      const currentList = listRef.current;
      if (currentList) {
        const isOverflowing = currentList.scrollHeight > currentList.clientHeight;
        setShowDownArrow(isOverflowing);
        setShowUpArrow(false); // Initially, we don't want to show the up arrow
      }
    };
  
    const checkScrollPosition = () => {
      const currentList = listRef.current;
      if (currentList) {
        const isAtBottom = currentList.scrollHeight - currentList.scrollTop === currentList.clientHeight;
        const isAtTop = currentList.scrollTop === 0;
        setShowDownArrow(!isAtBottom);
        setShowUpArrow(!isAtTop);
      }
    };
  
    useEffect(() => {
      checkForOverflow();
      window.addEventListener('resize', checkForOverflow);
  
      // Add scroll event listener
      const currentList = listRef.current;
      if (currentList) {
        currentList.addEventListener('scroll', checkScrollPosition);
      }
  
      return () => {
        window.removeEventListener('resize', checkForOverflow);
        // Remove scroll event listener
        if (currentList) {
          currentList.removeEventListener('scroll', checkScrollPosition);
        }
      };
    }, [props.conversations]);
  
    const styles: { container: CSSProperties; listContainer: CSSProperties; arrow: CSSProperties, arrowDown: CSSProperties, arrowUp: CSSProperties } = {
      container: {
        position: 'relative', // Container for both list and arrows
        maxHeight: '200px',
      },
      listContainer: {
        maxHeight: '200px',
        overflow: 'auto',
      },
      arrow: {
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        color: theme.palette.text.secondary,
        opacity: 0.7,
        fontSize: '30px',
      },
      arrowDown: {
        bottom: 0,
      },
      arrowUp: {
        top: 10,
        // rotate arrow 180 degrees
        transform: 'translateX(-50%) rotate(180deg)',
      },
    };
  
    return (
      <div style={styles.container}>
        <div style={styles.listContainer} ref={listRef}>
          <List>
            {props.conversations.map((conversation, index) => (
               <ChatNavigationItemMemo
               key={'nav-' + conversation.id}
               conversation={conversation}
               isActive={conversation.id === props.activeConversationId}
               isLonely={singleChat}
               maxChatMessages={(props.labsEnhancedUI || softMaxReached) ? maxChatMessages : 0}
               showSymbols={props.showSymbols}
               onConversationActivate={props.onConversationActivate}
               onConversationDelete={props.onConversationDelete}
             />
            ))}
          </List>
        </div>
        {showUpArrow && (
          <ExpandCircleDownIcon
            style={{ ...styles.arrow, ...styles.arrowUp }}
            onClick={() => {
              listRef.current?.scrollTo({
                top: 0,
                behavior: 'smooth',
              });
            }}
          />
        )}
        {showDownArrow && (
          <ExpandCircleDownIcon
            style={{ ...styles.arrow, ...styles.arrowDown }}
            onClick={() => {
              listRef.current?.scrollTo({
                top: listRef.current?.scrollHeight,
                behavior: 'smooth',
              });
            }}
          />
        )}
      </div>
    );

};

export default React.memo(ConversationList);
