import * as React from 'react';
import { Sandpack } from '@codesandbox/sandpack-react';

import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-java';

import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import SportsMartialArtsOutlinedIcon from '@mui/icons-material/SportsMartialArtsOutlined';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import { Avatar, Box, Button, IconButton, ListDivider, ListItem, ListItemDecorator, Menu, MenuItem, Stack, Textarea, Tooltip, Typography, useTheme } from '@mui/joy';
import { SxProps, Theme } from '@mui/joy/styles/types';


// One message in the chat

export interface UiMessage {
  uid: string;
  sender: 'You' | 'Bot' | string;
  role: 'assistant' | 'system' | 'user';
  text: string;
  model: string; // optional for 'assistant' roles (not user messages)
  avatar: string | React.ElementType | null;
}


/// Utilities to split the message into blocks of text and code

type MessageBlock = { type: 'text'; content: string; } | CodeMessageBlock;
type CodeMessageBlock = { type: 'code'; content: string; code: string; language: string; };

const parseAndHighlightCodeBlocks = (text: string): MessageBlock[] => {
  const codeBlockRegex = /`{3,}(\w+)?\n([\s\S]*?)(`{3,}|$)/g;
  const result: MessageBlock[] = [];

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1] || 'typescript';
    const codeBlock = match[2].trim();

    // Load the specified language if it's not loaded yet
    // NOTE: this is commented out because it inflates the size of the bundle by 200k
    // if (!Prism.languages[language]) {
    //   try {
    //     require(`prismjs/components/prism-${language}`);
    //   } catch (e) {
    //     console.warn(`Prism language '${language}' not found, falling back to 'typescript'`);
    //   }
    // }

    const highlightedCode = Prism.highlight(
      codeBlock,
      Prism.languages[language] || Prism.languages.typescript,
      language,
    );
    result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    result.push({ type: 'code', content: highlightedCode, code: codeBlock, language });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return result;
};

const copyToClipboard = (text: string) => {
  if (typeof navigator !== 'undefined')
    navigator.clipboard.writeText(text)
      .then(() => console.log('Message copied to clipboard'))
      .catch((err) => console.error('Failed to copy message: ', err));
};


/// Renderers for the different types of message blocks

type SandpackConfig = { template: 'vanilla-ts' | 'vanilla', files: Record<string, string> };

function RunnableCode({ codeBlock, theme }: { codeBlock: CodeMessageBlock, theme: Theme }): JSX.Element | null {
  let config: SandpackConfig;
  switch (codeBlock.language) {
    case 'typescript':
    case 'javascript':
      config = {
        template: 'vanilla-ts',
        files: { '/index.ts': codeBlock.code },
      };
      break;
    case 'html':
      config = {
        template: 'vanilla',
        files: { '/index.html': codeBlock.code },
      };
      break;
    default:
      return null;
  }
  return (
    <Sandpack {...config} theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
              options={{ showConsole: true, showConsoleButton: true, showTabs: false, showNavigator: false }} />
  );
}

function ChatMessageCodeBlock({ codeBlock, theme, sx }: { codeBlock: CodeMessageBlock, theme: Theme, sx?: SxProps }) {
  const [showSandpack, setShowSandpack] = React.useState(false);

  const handleCopyToClipboard = () =>
    copyToClipboard(codeBlock.code);

  const handleToggleSandpack = () =>
    setShowSandpack(!showSandpack);

  return <Box component='code' sx={{
    position: 'relative', ...(sx || {}), mx: 0, p: 1.5,
    display: 'block', fontWeight: 500, background: theme.vars.palette.background.level1,
    '&:hover > button': { opacity: 1 },
  }}>
    <IconButton variant='plain' color='primary' onClick={handleCopyToClipboard} sx={{ position: 'absolute', top: 0, right: 0, zIndex: 10, p: 0.5, opacity: 0, transition: 'opacity 0.3s' }}>
      <ContentCopyIcon />
    </IconButton>
    <IconButton variant='plain' color='primary' onClick={handleToggleSandpack} sx={{ position: 'absolute', top: 0, right: 50, zIndex: 10, p: 0.5, opacity: 0, transition: 'opacity 0.3s' }}>
      {showSandpack ? <StopOutlinedIcon /> : <PlayArrowOutlinedIcon />}
    </IconButton>
    <Box dangerouslySetInnerHTML={{ __html: codeBlock.content }} />
    {showSandpack && <RunnableCode codeBlock={codeBlock} theme={theme} />}
  </Box>;
}

function prettyModel(model: string): string {
  if (model.startsWith('gpt-4')) return 'gpt-4';
  if (model.startsWith('gpt-3.5-turbo')) return '3.5-turbo';
  return model;
}


/**
 * ChatMessage component is a customizable chat message UI component that supports
 * different roles (user, assistant, and system), text editing, syntax highlighting,
 * and code execution using Sandpack for TypeScript, JavaScript, and HTML code blocks.
 * The component also provides options for copying code to clipboard and expanding
 * or collapsing long user messages.
 *
 * @param {UiMessage} props.uiMessage - The UI message object containing message data.
 * @param {Function} props.onDelete - The function to call when the delete button is clicked.
 * @param {Function} props.onEdit - The function to call when the edit button is clicked and the edited text is submitted.
 */
export function ChatMessage(props: { uiMessage: UiMessage, onDelete: () => void, onEdit: (text: string) => void, onRunAgain: () => void }) {
  const theme = useTheme();
  const message = props.uiMessage;

  // viewing
  const [forceExpanded, setForceExpanded] = React.useState(false);

  // editing
  const [isHovering, setIsHovering] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedText, setEditedText] = React.useState(message.text);


  const closeMenu = () => setMenuAnchor(null);

  const handleMenuCopy = (e: React.MouseEvent) => {
    copyToClipboard(message.text);
    e.preventDefault();
    closeMenu();
  };

  const handleMenuEdit = (e: React.MouseEvent) => {
    if (!isEditing)
      setEditedText(message.text);
    setIsEditing(!isEditing);
    e.preventDefault();
    closeMenu();
  };

  const handleMenuRunAgain = (e: React.MouseEvent) => {
    props.onRunAgain();
    e.preventDefault();
    closeMenu();
  };

  const handleEditTextChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setEditedText(e.target.value);

  const handleEditKeyPressed = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
      props.onEdit(editedText);
    }
  };


  const handleExpand = () => setForceExpanded(true);


  // theming
  let background = theme.vars.palette.background.body;
  let textBackground: string | undefined = undefined;
  if (message.role === 'system') {
    background = theme.vars.palette.background.body;
    textBackground = theme.vars.palette.primary.plainHoverBg;
  } else if (message.sender === 'You') {
    background = theme.vars.palette.primary.plainHoverBg;
  } else if (message.role === 'assistant') {
    if (message.text.startsWith('Error: ') || message.text.startsWith('OpenAI API error: ')) {
      background = theme.vars.palette.danger.softBg;
    } else
      background = theme.vars.palette.background.body;
  }

  // text box css
  const chatFontCss = {
    my: 'auto',
    fontFamily: message.role === 'assistant' ? theme.fontFamily.code : undefined,
    fontSize: message.role === 'assistant' ? '14px' : '16px',
    lineHeight: 1.75,
  };

  // user message truncation
  let collapsedText = message.text;
  let isCollapsed = false;
  if (!forceExpanded && message.role === 'user') {
    const lines = message.text.split('\n');
    if (lines.length > 10) {
      collapsedText = lines.slice(0, 10).join('\n');
      isCollapsed = true;
    }
  }


  return (
    <ListItem sx={{
      display: 'flex', flexDirection: message.sender === 'You' ? 'row-reverse' : 'row', alignItems: 'flex-start',
      px: 1, py: 2,
      background,
      borderBottom: '1px solid',
      borderBottomColor: `rgba(${theme.vars.palette.neutral.mainChannel} / 0.1)`,
    }}>

      {/* Author */}

      <Stack sx={{ alignItems: 'center', minWidth: 64, textAlign: 'center' }}
             onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}
             onClick={event => setMenuAnchor(event.currentTarget)}>

        {isHovering ? (
          <IconButton variant='soft' color='primary'>
            <MoreVertIcon />
          </IconButton>
        ) : (
          typeof message.avatar === 'string'
            ? <Avatar alt={message.sender} src={message.avatar} />
            : (message.avatar != null)
              ? <message.avatar sx={{ width: 40, height: 40 }} />
              : <SportsMartialArtsOutlinedIcon sx={{ width: 40, height: 40 }} />
        )}

        {message.role === 'system' && (<Typography level='body2' color='neutral'>system</Typography>)}
        {message.role === 'assistant' && (
          <Tooltip title={message.model} variant='solid'>
            <Typography level='body2' color='neutral'>{prettyModel(message.model)}</Typography>
          </Tooltip>
        )}

        {/* message operations menu (floating) */}
        {!!menuAnchor && (
          <Menu open anchorEl={menuAnchor} onClose={closeMenu} sx={{ minWidth: 200 }}>
            <MenuItem onClick={handleMenuCopy}>
              <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
              Copy
            </MenuItem>
            <MenuItem onClick={handleMenuEdit}>
              <ListItemDecorator><EditIcon /></ListItemDecorator>
              {isEditing ? 'Discard' : 'Edit'}
            </MenuItem>
            <ListDivider />
            <MenuItem onClick={handleMenuRunAgain}>
              <ListItemDecorator><ReplayIcon /></ListItemDecorator>
              Restart
            </MenuItem>
            <MenuItem onClick={props.onDelete}>
              <ListItemDecorator><ClearIcon /></ListItemDecorator>
              Delete
            </MenuItem>
          </Menu>
        )}

      </Stack>


      {/* Edit / Blocks */}

      {isEditing ? (

        <Textarea variant='soft' color='primary' autoFocus minRows={1}
                  value={editedText} onChange={handleEditTextChanged} onKeyDown={handleEditKeyPressed}
                  sx={{ ...chatFontCss, flexGrow: 1 }} />

      ) : (

        <Box sx={{ ...chatFontCss, flexGrow: 0, whiteSpace: 'break-spaces' }}>
          {parseAndHighlightCodeBlocks(collapsedText).map((part, index) =>
            part.type === 'code' ? (
              <ChatMessageCodeBlock key={index} codeBlock={part} theme={theme} sx={chatFontCss} />
            ) : (
              <Typography key={index} level='body1' component='span'
                          sx={{ ...chatFontCss, mx: 1.5, background: textBackground }}>
                {part.content}
              </Typography>
            ),
          )}
          {isCollapsed && (
            <Button variant='plain' onClick={handleExpand}>
              ... expand ...
            </Button>
          )}
        </Box>

      )}

    </ListItem>
  );
}