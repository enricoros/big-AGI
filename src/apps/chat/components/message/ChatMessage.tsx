import * as React from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';

import { Alert, Avatar, Box, Button, Chip, CircularProgress, IconButton, ListDivider, ListItem, ListItemDecorator, Menu, MenuItem, Stack, Theme, Tooltip, Typography, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import Face6Icon from '@mui/icons-material/Face6';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import ReplayIcon from '@mui/icons-material/Replay';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import ShapeLineOutlinedIcon from '@mui/icons-material/ShapeLineOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';

import { requireUserKeyElevenLabs, speakText } from '@/modules/elevenlabs/elevenlabs.client';
import { requireUserKeyProdia } from '@/modules/prodia/prodia.client';

import { DMessage } from '@/common/state/store-chats';
import { InlineTextarea } from '@/common/components/InlineTextarea';
import { Link } from '@/common/components/Link';
import { SystemPurposeId, SystemPurposes } from '../../../../data';
import { cssRainbowColorKeyframes } from '@/common/theme';
import { extractCommands } from '@/common/util/extractCommands';
import { prettyBaseModel } from '@/common/util/conversationToMarkdown';
import { useSettingsStore } from '@/common/state/store-settings';

import { OpenInCodepen } from './OpenInCodepen';
import { OpenInReplit } from './OpenInReplit';


/// Utilities to parse messages into blocks of text and code

type Block = TextBlock | CodeBlock | ImageBlock;
type TextBlock = { type: 'text'; content: string; };
type CodeBlock = { type: 'code'; content: string; language: string | null; complete: boolean; code: string; };
type ImageBlock = { type: 'image'; url: string; };

const inferCodeLanguage = (markdownLanguage: string, code: string): string | null => {
  let detectedLanguage;
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
      detectedLanguage = languageMap[extension];
      if (detectedLanguage)
        return detectedLanguage;
    }
  }

  // based on how the code starts, return the language
  const codeStarts = [
    { starts: ['<!DOCTYPE html', '<html'], language: 'html' },
    { starts: ['<'], language: 'xml' },
    { starts: ['from '], language: 'python' },
    { starts: ['import ', 'export '], language: 'typescript' }, // or python
    { starts: ['interface ', 'function '], language: 'typescript' }, // ambiguous
    { starts: ['package '], language: 'java' },
    { starts: ['using '], language: 'csharp' },
  ];

  for (const codeStart of codeStarts) {
    if (codeStart.starts.some((start) => code.startsWith(start))) {
      return codeStart.language;
    }
  }

  // If no language detected based on code start, use Prism to tokenize and detect language
  const languages = ['bash', 'css', 'java', 'javascript', 'json', 'markdown', 'python', 'typescript']; // matches Prism component imports
  let maxTokens = 0;

  languages.forEach((language) => {
    const grammar = Prism.languages[language];
    const tokens = Prism.tokenize(code, grammar);
    const tokenCount = tokens.filter((token) => typeof token !== 'string').length;

    if (tokenCount > maxTokens) {
      maxTokens = tokenCount;
      detectedLanguage = language;
    }
  });
  return detectedLanguage || null;
};

/**
 * FIXME: expensive function, especially as it's not been used in incremental fashion
 */
const parseBlocks = (forceText: boolean, text: string): Block[] => {
  if (forceText)
    return [{ type: 'text', content: text }];

  if (text.startsWith('https://images.prodia.xyz/') && text.endsWith('.png') && text.length > 60 && text.length < 70)
    return [{ type: 'image', url: text.trim() }];

  const codeBlockRegex = /`{3,}([\w\\.+-_]+)?\n([\s\S]*?)(`{3,}|$)/g;
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

function RenderCode(props: { codeBlock: CodeBlock, sx?: SxProps }) {
  const [showSVG, setShowSVG] = React.useState(true);

  const hasSVG = props.codeBlock.code.startsWith('<svg') && props.codeBlock.code.endsWith('</svg>');
  const renderSVG = hasSVG && showSVG;

  const languagesCodepen = ['html', 'css', 'javascript', 'json', 'typescript'];
  const hasCodepenLanguage = hasSVG || (props.codeBlock.language && languagesCodepen.includes(props.codeBlock.language));

  const languagesReplit = ['python', 'java', 'csharp'];
  const hasReplitLanguage = props.codeBlock.language && languagesReplit.includes(props.codeBlock.language);

  const handleCopyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(props.codeBlock.code);
  };

  return (
    <Box
      component='code'
      sx={{
        position: 'relative', mx: 0, p: 1.5, // this block gets a thicker border
        display: 'block', fontWeight: 500,
        whiteSpace: 'break-spaces',
        '&:hover > .code-buttons': { opacity: 1 },
        ...(props.sx || {}),
      }}>

      {/* Buttons */}
      <Box
        className='code-buttons'
        sx={{
          backdropFilter: 'blur(6px) grayscale(0.8)',
          position: 'absolute', top: 0, right: 0, zIndex: 10, pt: 0.5, pr: 0.5,
          display: 'flex', flexDirection: 'row', gap: 1,
          opacity: 0, transition: 'opacity 0.3s',
        }}>
        {hasSVG && (
          <Tooltip title={renderSVG ? 'Show Code' : 'Render SVG'} variant='solid'>
            <IconButton variant={renderSVG ? 'solid' : 'soft'} color='neutral' onClick={() => setShowSVG(!showSVG)}>
              <ShapeLineOutlinedIcon />
            </IconButton>
          </Tooltip>
        )}
        {hasCodepenLanguage &&
          <OpenInCodepen codeBlock={{ code: props.codeBlock.code, language: props.codeBlock.language || undefined }} />
        }
        {hasReplitLanguage &&
          <OpenInReplit codeBlock={{ code: props.codeBlock.code, language: props.codeBlock.language || undefined }} />
        }
        <Tooltip title='Copy Code' variant='solid'>
          <IconButton variant='outlined' color='neutral' onClick={handleCopyToClipboard}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Highlighted Code / SVG render */}
      <Box
        dangerouslySetInnerHTML={{ __html: renderSVG ? props.codeBlock.code : props.codeBlock.content }}
        sx={renderSVG ? { lineHeight: 0 } : {}}
      />
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

const RenderText = ({ textBlock, sx }: { textBlock: TextBlock; sx?: SxProps; }) => {
  const elements = extractCommands(textBlock.content);
  return (
    <Typography
      sx={{
        lineHeight: 1.75,
        mx: 1.5,
        display: 'flex', alignItems: 'baseline',
        overflowWrap: 'anywhere',
        whiteSpace: 'break-spaces',
        ...(sx || {}),
      }}
    >
      {elements.map((element, index) =>
        element.type === 'cmd'
          ? <Chip key={index} component='span' size='md' variant='solid' color='neutral' sx={{ mr: 1 }}>{element.value}</Chip>
          : <span key={index}>{element.value}</span>,
      )}
    </Typography>
  );
};

const RenderImage = (props: { imageBlock: ImageBlock, allowRunAgain: boolean, onRunAgain: (e: React.MouseEvent) => void }) =>
  <Box
    sx={theme => ({
      display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative',
      mx: 1.5,
      // p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1,
      minWidth: 32, minHeight: 32, boxShadow: theme.vars.shadow.md,
      background: theme.palette.neutral.solidBg,
      '& picture': { display: 'flex' },
      '& img': { maxWidth: '100%', maxHeight: '100%' },
      '&:hover > .image-buttons': { opacity: 1 },
    })}>
    {/* External Image */}
    <picture><img src={props.imageBlock.url} alt='Generated Image' /></picture>
    {/* Image Buttons */}
    <Box
      className='image-buttons'
      sx={{
        position: 'absolute', top: 0, right: 0, zIndex: 10, pt: 0.5, px: 0.5,
        display: 'flex', flexDirection: 'row', gap: 0.5,
        opacity: 0, transition: 'opacity 0.3s',
      }}>
      {props.allowRunAgain && (
        <Tooltip title='Draw again' variant='solid'>
          <IconButton variant='solid' color='neutral' onClick={props.onRunAgain}>
            <ReplayIcon />
          </IconButton>
        </Tooltip>
      )}
      <IconButton component={Link} href={props.imageBlock.url} target='_blank' variant='solid' color='neutral'>
        <ZoomOutMapIcon />
      </IconButton>
    </Box>
  </Box>;


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

export function messageBackground(theme: Theme, messageRole: DMessage['role'], wasEdited: boolean, unknownAssistantIssue: boolean): string {
  const defaultBackground = theme.vars.palette.background.surface;
  switch (messageRole) {
    case 'system':
      return wasEdited ? theme.vars.palette.warning.plainHoverBg : defaultBackground;
    case 'user':
      return theme.vars.palette.primary.plainHoverBg; // .background.level1
    case 'assistant':
      return unknownAssistantIssue ? theme.vars.palette.danger.softBg : defaultBackground;
  }
  return defaultBackground;
}

export function makeAvatar(messageAvatar: string | null, messageRole: DMessage['role'], messageOriginLLM: string | undefined, messagePurposeId: SystemPurposeId | undefined, messageSender: string, messageTyping: boolean, size: 'sm' | undefined = undefined): JSX.Element {
  if (typeof messageAvatar === 'string' && messageAvatar)
    return <Avatar alt={messageSender} src={messageAvatar} />;
  const iconSx = { width: 40, height: 40 };
  const mascotSx = size === 'sm' ? { width: 40, height: 40 } : { width: 64, height: 64 };
  switch (messageRole) {
    case 'system':
      return <SettingsSuggestIcon sx={iconSx} />;  // https://em-content.zobj.net/thumbs/120/apple/325/robot_1f916.png

    case 'assistant':
      // display a gif avatar when the assistant is typing (people seem to love this, so keeping it after april fools')
      if (messageTyping) {
        return <Avatar
          alt={messageSender} variant='plain'
          src={messageOriginLLM === 'prodia'
            ? 'https://i.giphy.com/media/5t9ujj9cMisyVjUZ0m/giphy.webp'
            : messageOriginLLM?.startsWith('react-')
              ? 'https://i.giphy.com/media/l44QzsOLXxcrigdgI/giphy.webp'
              : 'https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp'}
          sx={{ ...mascotSx, borderRadius: 8 }}
        />;
      }
      // display the purpose symbol
      if (messageOriginLLM === 'prodia')
        return <PaletteOutlinedIcon sx={iconSx} />;
      const symbol = SystemPurposes[messagePurposeId as SystemPurposeId]?.symbol;
      if (symbol)
        return <Box
          sx={{
            fontSize: '24px',
            textAlign: 'center',
            width: '100%', minWidth: `${iconSx.width}px`, lineHeight: `${iconSx.height}px`,
          }}
        >
          {symbol}
        </Box>;
      // default assistant avatar
      return <SmartToyOutlinedIcon sx={iconSx} />; // https://mui.com/static/images/avatar/2.jpg

    case 'user':
      return <Face6Icon sx={iconSx} />;            // https://www.svgrepo.com/show/306500/openai.svg
  }
  return <Avatar alt={messageSender} />;
}


/**
 * The Message component is a customizable chat message UI component that supports
 * different roles (user, assistant, and system), text editing, syntax highlighting,
 * and code execution using Sandpack for TypeScript, JavaScript, and HTML code blocks.
 * The component also provides options for copying code to clipboard and expanding
 * or collapsing long user messages.
 *
 */
export function ChatMessage(props: { message: DMessage, isBottom: boolean, onMessageDelete: () => void, onMessageEdit: (text: string) => void, onMessageRunFrom: (offset: number) => void, onImagine: (messageText: string) => void }) {
  const {
    text: messageText,
    sender: messageSender,
    avatar: messageAvatar,
    typing: messageTyping,
    role: messageRole,
    purposeId: messagePurposeId,
    originLLM: messageOriginLLM,
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
  const [isImagining, setIsImagining] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  // external state
  const theme = useTheme();
  const showAvatars = useSettingsStore(state => state.zenMode) !== 'cleaner';
  const renderMarkdown = useSettingsStore(state => state.renderMarkdown) && !fromSystem;
  const isImaginable = !!useSettingsStore(state => state.prodiaModelId) || !requireUserKeyProdia;
  const isImaginableEnabled = messageText?.length > 5 && !messageText.startsWith('https://images.prodia.xyz/') && !(messageText.startsWith('/imagine') || messageText.startsWith('/img'));
  const isSpeakable = !!useSettingsStore(state => state.elevenLabsVoiceId) || !requireUserKeyElevenLabs;

  const closeOperationsMenu = () => setMenuAnchor(null);

  const handleMenuCopy = (e: React.MouseEvent) => {
    copyToClipboard(messageText);
    e.preventDefault();
    closeOperationsMenu();
  };

  const handleMenuEdit = (e: React.MouseEvent) => {
    setIsEditing(!isEditing);
    e.preventDefault();
    closeOperationsMenu();
  };


  const handleMenuImagine = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsImagining(true);
    await props.onImagine(messageText);
    setIsImagining(false);
    closeOperationsMenu();
  };

  const handleMenuSpeak = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSpeaking(true);
    await speakText(messageText);
    setIsSpeaking(false);
    closeOperationsMenu();
  };

  const handleMenuRunAgain = (e: React.MouseEvent) => {
    e.preventDefault();
    props.onMessageRunFrom(fromAssistant ? -1 : 0);
    closeOperationsMenu();
  };

  const handleTextEdited = (editedText: string) => {
    setIsEditing(false);
    if (editedText?.trim() && editedText !== messageText)
      props.onMessageEdit(editedText);
  };

  const handleExpand = () => setForceExpanded(true);


  // soft error handling
  const { isAssistantError, errorMessage } = explainErrorInMessage(messageText, fromAssistant, messageOriginLLM);

  // style
  let background = messageBackground(theme, messageRole, wasEdited, isAssistantError && !errorMessage);

  // avatar
  const avatarEl: JSX.Element | null = React.useMemo(
    () => showAvatars ? makeAvatar(messageAvatar, messageRole, messageOriginLLM, messagePurposeId, messageSender, messageTyping) : null,
    [messageAvatar, messageOriginLLM, messagePurposeId, messageRole, messageSender, messageTyping, showAvatars],
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
      ...(props.isBottom && { mb: 'auto' }),
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
          <Tooltip title={messageOriginLLM || 'unk-model'} variant='solid'>
            <Typography level='body2' sx={messageTyping
              ? { animation: `${cssRainbowColorKeyframes} 5s linear infinite`, fontWeight: 500 }
              : { fontWeight: 500 }
            }>
              {prettyBaseModel(messageOriginLLM)}
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
              : block.type === 'image'
                ? <RenderImage key={'image-' + index} imageBlock={block} allowRunAgain={props.isBottom} onRunAgain={handleMenuRunAgain} />
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

        <InlineTextarea initialText={messageText} onEdit={handleTextEdited} sx={{ ...cssBlocks, flexGrow: 1 }} />

      )}


      {/* Copy message */}
      {!fromSystem && !isEditing && (
        <Tooltip title={fromAssistant ? 'Copy message' : 'Copy input'} variant='solid'>
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
          {isImaginable && isImaginableEnabled && (
            <MenuItem onClick={handleMenuImagine} disabled={!isImaginableEnabled || isImagining}>
              <ListItemDecorator>{isImagining ? <CircularProgress size='sm' /> : <FormatPaintIcon />}</ListItemDecorator>
              Imagine
            </MenuItem>
          )}
          {isSpeakable && (
            <MenuItem onClick={handleMenuSpeak} disabled={isSpeaking}>
              <ListItemDecorator>{isSpeaking ? <CircularProgress size='sm' /> : <RecordVoiceOverIcon />}</ListItemDecorator>
              Speak
            </MenuItem>
          )}
          <ListDivider />
          {fromAssistant && (
            <MenuItem onClick={handleMenuRunAgain}>
              <ListItemDecorator><ReplayIcon /></ListItemDecorator>
              Retry
            </MenuItem>
          )}
          {fromUser && (
            <MenuItem onClick={handleMenuRunAgain}>
              <ListItemDecorator><FastForwardIcon /></ListItemDecorator>
              Run Again
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
