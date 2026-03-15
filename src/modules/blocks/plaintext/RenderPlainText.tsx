import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Chip, Typography } from '@mui/joy';

import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { extractChatCommand } from '../../../apps/chat/commands/commands.registry';
import { findParticipantMentions, getParticipantMentionSx } from '~/common/util/dMessageUtils';


const _style = {
  mx: 1.5,
  // display: 'flex', // Commented on 2023-12-29: the commands were drawn as columns
  alignItems: 'baseline',
  overflowWrap: 'anywhere',
  whiteSpace: 'break-spaces',
} as const;

function renderTextWithMentions(
  text: string,
  participants?: DConversationParticipant[],
  onAppendMention?: (mentionText: string) => void,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const mentionMatch of findParticipantMentions(text, participants)) {
    if (mentionMatch.mentionStart > lastIndex)
      parts.push(text.slice(lastIndex, mentionMatch.mentionStart));

    parts.push(onAppendMention ? (
      <button
        key={`${mentionMatch.mentionStart}-${mentionMatch.mentionName}`}
        type='button'
        onClick={() => onAppendMention(`@${mentionMatch.mentionName}`)}
        style={getParticipantMentionSx(mentionMatch.mentionName, true) as React.CSSProperties}
      >
        {mentionMatch.mentionText}
      </button>
    ) : (
      <span key={`${mentionMatch.mentionStart}-${mentionMatch.mentionName}`} style={getParticipantMentionSx(mentionMatch.mentionName) as React.CSSProperties}>
        {mentionMatch.mentionText}
      </span>
    ));

    lastIndex = mentionMatch.mentionEnd;
  }

  if (lastIndex < text.length)
    parts.push(text.slice(lastIndex));

  return parts;
}


/**
 * Renders a text block with chat commands.
 */
export const RenderPlainText = (props: { content: string; sx?: SxProps; onAppendMention?: (mentionText: string) => void; participants?: DConversationParticipant[]; }) => {

  const elements = extractChatCommand(props.content);

  const memoSx = React.useMemo(() => ({ ..._style, ...props.sx }), [props.sx]);

  return (
    <Typography sx={memoSx}>
      {elements.map((element, index) =>
        <React.Fragment key={index}>
          {element.type === 'cmd'
            ? <>
              <Chip component='span' size='md' variant='solid' color={element.isErrorNoArgs ? 'danger' : 'neutral'} sx={{ mr: 1 }}>
                {element.command}
              </Chip>
              <span>{renderTextWithMentions(element.params ?? '', props.participants, props.onAppendMention)}</span>
            </>
            : <span>{renderTextWithMentions(element.value, props.participants, props.onAppendMention)}</span>
          }
        </React.Fragment>,
      )}
    </Typography>
  );
};
