import * as React from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';

import { Alert, Avatar, Box, Button, IconButton, ListDivider, ListItem, ListItemDecorator, Menu, MenuItem, Stack, Textarea, Tooltip, Typography, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import Face6Icon from '@mui/icons-material/Face6';
import FastForwardIcon from '@mui/icons-material/FastForward';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

import { DMessage } from '@/lib/store-chats';
import { Link } from '@/components/util/Link';
import { SystemPurposeId, SystemPurposes } from '@/lib/data';
import { cssRainbowColorKeyframes } from '@/lib/theme';
import { prettyBaseModel } from '@/lib/publish';
import { useSettingsStore } from '@/lib/store-settings';


/// Utilities to parse messages into blocks of text and code

type Block = TextBlock | CodeBlock;
type TextBlock = { type: 'text'; content: string; };
type CodeBlock = { type: 'code'; content: string; language: string | null; complete: boolean; code: string; };

const inferCodeLanguage = (markdownLanguage: string, code: string): string | null => {
  // we have an hint
  if (markdownLanguage) {
    // no dot: assume is the syntax-highlight name
    if (!markdownLanguage.includes('.'))
      return markdownLanguage;

    // dot: there's probably a file extension
    const extension = markdownLanguage.split('.').pop();
    if (extension) {
      const languageMap: { [key: string]: string } = {
        cs: 'csharp', html: 'html', java: 'java', js: 'javascript', json: 'json', jsx: 'javascript',
        md: 'markdown', py: 'python', sh: 'bash', ts: 'typescript', tsx: 'typescript', xml: 'xml',
      };
      const language = languageMap[extension];
      if (language)
        return language;
    }
  }

  // based on how the code starts, return the language
  if (code.startsWith('<DOCTYPE html') || code.startsWith('<!DOCTYPE')) return 'html';
  if (code.startsWith('<')) return 'xml';
  if (code.startsWith('from ')) return 'python';
  if (code.startsWith('import ') || code.startsWith('export ')) return 'typescript'; // or python
  if (code.startsWith('interface ') || code.startsWith('function ')) return 'typescript'; // ambiguous
  if (code.startsWith('package ')) return 'java';
  if (code.startsWith('using ')) return 'csharp';
  return null;
};

/**
 * FIXME: expensive function, especially as it's not been used in incremental fashion
 */
const parseBlocks = (forceText: boolean, text: string): Block[] => {
  if (forceText)
    return [{ type: 'text', content: text }];

  const codeBlockRegex = /`{3,}([\w\\.+]+)?\n([\s\S]*?)(`{3,}|$)/g;
  const result: Block[] = [];

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const markdownLanguage = (match[1] || '').trim();
    const code = match[2].trim();
    const blockEnd: string = match[3];

    // Load the specified language if it's not loaded yet
    // NOTE: this is commented out because it inflates the size of the bundle by 200k
    // if (!Prism.languages[language]) {
    //   try {
    //     require(`prismjs/components/prism-${language}`);
    //   } catch (e) {
    //     console.warn(`Prism language '${language}' not found, falling back to 'typescript'`);
    //   }
    // }

    const codeLanguage = inferCodeLanguage(markdownLanguage, code);
    const highlightLanguage = codeLanguage || 'typescript';
    const highlightedCode = Prism.highlight(
      code,
      Prism.languages[highlightLanguage] || Prism.languages.typescript,
      highlightLanguage,
    );

    result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    result.push({ type: 'code', content: highlightedCode, language: codeLanguage, complete: blockEnd.startsWith('```'), code });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return result;
};


/// Renderers for the different types of message blocks

function RenderCode({ codeBlock, sx }: { codeBlock: CodeBlock, sx?: SxProps }) {
  const handleCopyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(codeBlock.code);
  };

  return (
    <Box
      component='code'
      sx={{
        position: 'relative', mx: 0, p: 1.5, // this block gets a thicker border
        display: 'block', fontWeight: 500,
        whiteSpace: 'break-spaces',
        '&:hover > button': { opacity: 1 },
        ...(sx || {}),
      }}>
      <Tooltip title='Copy Code' variant='solid'>
        <IconButton
          variant='outlined' color='neutral' onClick={handleCopyToClipboard}
          sx={{
            position: 'absolute', top: 0, right: 0, zIndex: 10, p: 0.5,
            opacity: 0, transition: 'opacity 0.3s',
          }}>
          <ContentCopyIcon />
        </IconButton>
      </Tooltip>
      <Box dangerouslySetInnerHTML={{ __html: codeBlock.content }} />
    </Box>
  );
}

const RenderMarkdown = ({ textBlock }: { textBlock: TextBlock }) => {
  const theme = useTheme();
  return <Box
    className={`markdown-body ${theme.palette.mode === 'dark' ? 'markdown-body-dark' : 'markdown-body-light'}`}
    sx={{
      mx: '12px !important',                                // margin: 1.5 like other blocks
      '& table': { width: 'inherit !important' },           // un-break auto-width (tables have 'max-content', which overflows)
      '--color-canvas-default': 'transparent !important',   // remove the default background color
      fontFamily: `inherit !important`,                     // use the default font family
      lineHeight: '1.75 !important',                        // line-height: 1.75 like the text block
    }}>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{textBlock.content}</ReactMarkdown>
  </Box>;
};

const RenderText = ({ textBlock }: { textBlock: TextBlock }) =>
  <Typography
    sx={{
      lineHeight: 1.75,
      mx: 1.5,
      overflowWrap: 'anywhere',
      whiteSpace: 'break-spaces',
    }}>
    {textBlock.content}
  </Typography>;


function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined')
    navigator.clipboard.writeText(text)
      .then(() => console.log('Message copied to clipboard'))
      .catch((err) => console.error('Failed to copy message: ', err));
}

function explainErrorInMessage(text: string, isAssistant: boolean, modelId?: string) {
  let errorMessage: JSX.Element | null = null;
  const isAssistantError = isAssistant && (text.startsWith('[Issue] ') || text.startsWith('[OpenAI Issue]'));
  if (isAssistantError) {
    if (text.startsWith('OpenAI API error: 429 Too Many Requests')) {
      // TODO: retry at the api/chat level a few times instead of showing this error
      errorMessage = <>
        The model appears to be occupied at the moment. Kindly select <b>GPT-3.5 Turbo</b>,
        or give it another go by selecting <b>Run again</b> from the message menu.
      </>;
    } else if (text.includes('"model_not_found"')) {
      // note that "model_not_found" is different than "The model `gpt-xyz` does not exist" message
      errorMessage = <>
        The API key appears to be unauthorized for {modelId || 'this model'}. You can change to <b>GPT-3.5
        Turbo</b> and simultaneously <Link noLinkStyle href='https://openai.com/waitlist/gpt-4-api' target='_blank'>request
        access</Link> to the desired model.
      </>;
    } else if (text.includes('"context_length_exceeded"')) {
      // TODO: propose to summarize or split the input?
      const pattern: RegExp = /maximum context length is (\d+) tokens.+you requested (\d+) tokens/;
      const match = pattern.exec(text);
      const usedText = match ? <b>{parseInt(match[2] || '0').toLocaleString()} tokens &gt; {parseInt(match[1] || '0').toLocaleString()}</b> : '';
      errorMessage = <>
        This thread <b>surpasses the maximum size</b> allowed for {modelId || 'this model'}. {usedText}.
        Please consider removing some earlier messages from the conversation, start a new conversation,
        choose a model with larger context, or submit a shorter new message.
      </>;
    } else if (text.includes('"invalid_api_key"')) {
      errorMessage = <>
        The API key appears to not be correct or to have expired.
        Please <Link noLinkStyle href='https://openai.com/account/api-keys' target='_blank'>check your API key</Link> and
        update it in the <b>Settings</b> menu.
      </>;
    } else if (text.includes('"insufficient_quota"')) {
      errorMessage = <>
        The API key appears to have <b>insufficient quota</b>. Please
        check <Link noLinkStyle href='https://platform.openai.com/account/usage' target='_blank'>your usage</Link> and
        make sure the usage is under <Link noLinkStyle href='https://platform.openai.com/account/billing/limits' target='_blank'>the limits</Link>.
      </>;
    }
  }
  return { errorMessage, isAssistantError };
}


/**
 * The Message component is a customizable chat message UI component that supports
 * different roles (user, assistant, and system), text editing, syntax highlighting,
 * and code execution using Sandpack for TypeScript, JavaScript, and HTML code blocks.
 * The component also provides options for copying code to clipboard and expanding
 * or collapsing long user messages.
 *
 */
export function ChatMessage(props: { message: DMessage, isLast: boolean, onMessageDelete: () => void, onMessageEdit: (text: string) => void, onMessageRunFrom: () => void }) {
  const {
    text: messageText,
    sender: messageSender,
    avatar: messageAvatar,
    typing: messageTyping,
    role: messageRole,
    purposeId: messagePurposeId,
    originLLM: messageModelId,
    // tokenCount: messageTokenCount,
    updated: messageUpdated,
  } = props.message;
  const fromAssistant = messageRole === 'assistant';
  const fromSystem = messageRole === 'system';
  const fromUser = messageRole === 'user';
  const wasEdited = !!messageUpdated;

  // state
  const [forceExpanded, setForceExpanded] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedText, setEditedText] = React.useState('');

  // external state
  const theme = useTheme();
  const showAvatars = useSettingsStore(state => state.zenMode) !== 'cleaner';
  const renderMarkdown = useSettingsStore(state => state.renderMarkdown) && !fromSystem;

  const closeOperationsMenu = () => setMenuAnchor(null);

  const handleMenuCopy = (e: React.MouseEvent) => {
    copyToClipboard(messageText);
    e.preventDefault();
    closeOperationsMenu();
  };

  const handleMenuEdit = (e: React.MouseEvent) => {
    if (!isEditing)
      setEditedText(messageText);
    setIsEditing(!isEditing);
    e.preventDefault();
    closeOperationsMenu();
  };

  const handleMenuRunAgain = (e: React.MouseEvent) => {
    e.preventDefault();
    props.onMessageRunFrom();
    closeOperationsMenu();
  };


  const handleEditTextChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setEditedText(e.target.value);

  const handleEditKeyPressed = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      setIsEditing(false);
      props.onMessageEdit(editedText);
    }
  };

  const handleEditBlur = () => {
    setIsEditing(false);
    if (editedText !== messageText && editedText?.trim())
      props.onMessageEdit(editedText);
  };


  const handleExpand = () => setForceExpanded(true);


  // soft error handling
  const { isAssistantError, errorMessage } = explainErrorInMessage(messageText, fromAssistant, messageModelId);


  // theming
  let background = theme.vars.palette.background.surface;
  switch (messageRole) {
    case 'system':
      if (wasEdited)
        background = theme.vars.palette.warning.plainHoverBg;
      break;
    case 'user':
      background = theme.vars.palette.primary.plainHoverBg; // .background.level1
      break;
    case 'assistant':
      if (isAssistantError && !errorMessage)
        background = theme.vars.palette.danger.softBg;
      break;
  }


  // avatar
  const avatarEl: JSX.Element | null = React.useMemo(
    () => {
      if (!showAvatars)
        return null;
      if (typeof messageAvatar === 'string' && messageAvatar)
        return <Avatar alt={messageSender} src={messageAvatar} />;
      switch (messageRole) {
        case 'system':
          return <SettingsSuggestIcon sx={{ width: 40, height: 40 }} />;  // https://em-content.zobj.net/thumbs/120/apple/325/robot_1f916.png
        case 'assistant':
          // display a gif avatar when the assistant is typing (people seem to love this, so keeping it after april fools')
          if (messageTyping)
            return <Avatar
              alt={messageSender} variant='plain'
              src='https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp'
              sx={{
                width: 64,
                height: 64,
                borderRadius: 8,
              }}
            />;
          const symbol = SystemPurposes[messagePurposeId as SystemPurposeId]?.symbol;
          if (symbol)
            return <Box
              sx={{
                fontSize: '24px',
                textAlign: 'center',
                width: '100%',
                height: 40,
                lineHeight: '40px',
              }}
            >
              {symbol}
            </Box>;
          return <SmartToyOutlinedIcon sx={{ width: 40, height: 40 }} />; // https://mui.com/static/images/avatar/2.jpg
        case 'user':
          return <Face6Icon sx={{ width: 40, height: 40 }} />;            // https://www.svgrepo.com/show/306500/openai.svg
      }
      return <Avatar alt={messageSender} />;
    }, [messageAvatar, messageRole, messagePurposeId, messageSender, messageTyping, showAvatars],
  );

  // text box css
  const cssBlocks = {
    my: 'auto',
  };
  const cssCode = {
    background: theme.vars.palette.background.level1,
    fontFamily: theme.fontFamily.code,
    fontSize: '14px',
    fontVariantLigatures: 'none',
    lineHeight: 1.75,
  };

  // user message truncation
  let collapsedText = messageText;
  let isCollapsed = false;
  if (fromUser && !forceExpanded) {
    const lines = messageText.split('\n');
    if (lines.length > 10) {
      collapsedText = lines.slice(0, 10).join('\n');
      isCollapsed = true;
    }
  }


  return (
    <ListItem sx={{
      display: 'flex', flexDirection: !fromAssistant ? 'row-reverse' : 'row', alignItems: 'flex-start',
      gap: 1, px: { xs: 1, md: 2 }, py: 2,
      background,
      borderBottom: `1px solid ${theme.vars.palette.divider}`,
      // borderBottomColor: `rgba(${theme.vars.palette.neutral.mainChannel} / 0.2)`,
      position: 'relative',
      '&:hover > button': { opacity: 1 },
    }}>

      {/* Avatar */}
      {showAvatars && <Stack
        sx={{ alignItems: 'center', minWidth: { xs: 50, md: 64 }, textAlign: 'center' }}
        onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}
        onClick={event => setMenuAnchor(event.currentTarget)}>

        {isHovering ? (
          <IconButton variant='soft' color={fromAssistant ? 'neutral' : 'primary'}>
            <MoreVertIcon />
          </IconButton>
        ) : (
          avatarEl
        )}

        {fromAssistant && (
          <Tooltip title={messageModelId || 'unk-model'} variant='solid'>
            <Typography level='body2' sx={messageTyping
              ? { animation: `${cssRainbowColorKeyframes} 5s linear infinite`, fontWeight: 500 }
              : { fontWeight: 500 }
            }>
              {prettyBaseModel(messageModelId)}
            </Typography>
          </Tooltip>
        )}

      </Stack>}


      {/* Edit / Blocks */}
      {!isEditing ? (

        <Box sx={{ ...cssBlocks, flexGrow: 0 }} onDoubleClick={handleMenuEdit}>

          {fromSystem && wasEdited && (
            <Typography level='body2' color='warning' sx={{ mt: 1, mx: 1.5 }}>modified by user - auto-update disabled</Typography>
          )}

          {!errorMessage && parseBlocks(fromSystem, collapsedText).map((block, index) =>
            block.type === 'code'
              ? <RenderCode key={'code-' + index} codeBlock={block} sx={cssCode} />
              : renderMarkdown
                ? <RenderMarkdown key={'text-md-' + index} textBlock={block} />
                : <RenderText key={'text-' + index} textBlock={block} />,
          )}

          {errorMessage && (
            <Tooltip title={<Typography sx={{ maxWidth: 800 }}>{collapsedText}</Typography>} variant='soft'>
              <Alert variant='soft' color='warning' sx={{ mt: 1 }}><Typography>{errorMessage}</Typography></Alert>
            </Tooltip>
          )}

          {isCollapsed && <Button variant='plain' onClick={handleExpand}>... expand ...</Button>}

        </Box>

      ) : (

        <Textarea
          variant='soft' color='warning' autoFocus minRows={1}
          value={editedText} onChange={handleEditTextChanged} onKeyDown={handleEditKeyPressed} onBlur={handleEditBlur}
          sx={{ ...cssBlocks, flexGrow: 1 }} />

      )}


      {/* Copy message */}
      {!fromSystem && !isEditing && (
        <Tooltip title={fromAssistant ? 'Copy response' : 'Copy input'} variant='solid'>
          <IconButton
            variant='outlined' color='neutral' onClick={handleMenuCopy}
            sx={{
              position: 'absolute', ...(fromAssistant ? { right: { xs: 12, md: 28 } } : { left: { xs: 12, md: 28 } }), zIndex: 10,
              opacity: 0, transition: 'opacity 0.3s',
            }}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
      )}


      {/* Message Operations menu */}
      {!!menuAnchor && (
        <Menu
          variant='plain' color='neutral' size='lg' placement='bottom-end' sx={{ minWidth: 280 }}
          open anchorEl={menuAnchor} onClose={closeOperationsMenu}>
          <MenuItem onClick={handleMenuCopy}>
            <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
            Copy
          </MenuItem>
          <MenuItem onClick={handleMenuEdit}>
            <ListItemDecorator><EditIcon /></ListItemDecorator>
            {isEditing ? 'Discard' : 'Edit'}
            {!isEditing && <span style={{ opacity: 0.5, marginLeft: '8px' }}> (double-click)</span>}
          </MenuItem>
          <ListDivider />
          {fromUser && (
            <MenuItem onClick={handleMenuRunAgain}>
              <ListItemDecorator><FastForwardIcon /></ListItemDecorator>
              {props.isLast ? 'Run Again' : 'Restart From Here'}
            </MenuItem>
          )}
          <MenuItem onClick={props.onMessageDelete} disabled={false /*fromSystem*/}>
            <ListItemDecorator><ClearIcon /></ListItemDecorator>
            Delete
          </MenuItem>
        </Menu>
      )}

    </ListItem>
  );
}
