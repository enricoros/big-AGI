import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Chip, Typography } from '@mui/joy';

import { extractChatCommand } from '../../../apps/chat/commands/commands.registry';


// Adapt main's command pieces to the shared rendering shape; execution keeps its existing parser.
function extractPlainTextCommand(text: string) {
  const pieces = extractChatCommand(text);
  const command = pieces[0];
  if (command?.type !== 'cmd') return undefined;
  return {
    slashCmd: command.command,
    args: pieces.map(piece => piece.type === 'cmd' ? piece.params || '' : piece.value).join(''),
    issue: command.isErrorNoArgs,
  };
}


const _styles = {

  typography: {
    mx: 1.5,
    // display: 'flex', // Commented on 2023-12-29: the commands were drawn as columns
    alignItems: 'baseline',
    overflowWrap: 'anywhere',
    whiteSpace: 'break-spaces',
  } as const,

  chip: {
    px: 1,
    mr: 1,
  } as const,

} as const;


/** Text that starts with a known chat command - user markdown renders it as plain text, for the command chip. */
export function isTextChatCommand(text: string): boolean {
  return !!extractPlainTextCommand(text);
}


/**
 * Renders a text block with chat commands.
 */
export const RenderPlainText = (props: { content: string; renderHighlightCommands?: boolean, sx?: SxProps; }) => {

  const slashCommand = !props.renderHighlightCommands ? undefined : extractPlainTextCommand(props.content);

  const memoSx = React.useMemo(() => ({
    ..._styles.typography,
    ...props.sx,
  }), [props.sx]);

  return !slashCommand ? (
    <Typography sx={memoSx}>{props.content}</Typography>
  ) : (
    <Typography sx={memoSx}>

      {/* optional slash command tag */}
      <Chip component='span' size='md' variant='solid' color={slashCommand.issue ? 'danger' : undefined} sx={_styles.chip}>
        {slashCommand.slashCmd}
      </Chip>

      {/* args or text */}
      {slashCommand.args}

    </Typography>
  );
};
