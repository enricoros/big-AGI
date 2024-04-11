import * as React from 'react';
import { shallow } from 'zustand/shallow';
import { v4 as uuidv4 } from 'uuid';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Avatar, Box, Button, Card, CardContent, Checkbox, IconButton, Input, List, ListItem, ListItemButton, Textarea, Tooltip, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import DoneIcon from '@mui/icons-material/Done';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SearchIcon from '@mui/icons-material/Search';
import TelegramIcon from '@mui/icons-material/Telegram';

import { SystemPurposeData, SystemPurposeId, SystemPurposes } from '../../../../data';

import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';
import { useChatLLM } from '~/modules/llms/store-llms';

import { DConversationId, DMessage, useChatStore } from '~/common/state/store-chats';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { lineHeightTextareaMd } from '~/common/app.theme';
import { navigateToPersonas } from '~/common/app.routes';
import { useChipBoolean } from '~/common/components/useChipBoolean';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { YouTubeURLInput } from './YouTubeURLInput';
import { usePurposeStore } from './store-purposes';


// 'special' purpose IDs, for tile hiding purposes
const PURPOSE_ID_PERSONA_CREATOR = '__persona-creator__';
const TILE_ACTIVE_COLOR = 'primary' as const;

// defined looks
const tileSize = 7; // rem
const tileGap = 0.5; // rem


function Tile(props: {
  text?: string,
  imageUrl?: string,
  symbol?: string,
  isActive: boolean,
  isEditMode: boolean,
  isHidden?: boolean,
  isHighlighted?: boolean,
  onClick: () => void,
  sx?: SxProps,
}) {
  return (
    <Button
      variant={(!props.isEditMode && props.isActive) ? 'solid' : props.isHighlighted ? 'soft' : 'soft'}
      color={(!props.isEditMode && props.isActive) ? 'primary' : props.isHighlighted ? 'primary' : TILE_ACTIVE_COLOR}
      onClick={props.onClick}
      sx={{
        aspectRatio: 1,
        height: `${tileSize}rem`,
        fontWeight: 'md',
        lineHeight: 'xs',
        ...((props.isEditMode || !props.isActive) ? {
          boxShadow: `0 2px 8px -3px rgb(var(--joy-palette-${TILE_ACTIVE_COLOR}-darkChannel) / 30%)`,
          // boxShadow: props.isHighlighted
          //   ? '0 2px 8px -2px rgb(var(--joy-palette-primary-darkChannel) / 30%)'
          //   : 'sm',
          backgroundColor: props.isHighlighted ? undefined : 'background.popup',
          // ...(props.imageUrl && {
          //   backgroundImage: `linear-gradient(rgba(255 255 255 /0.85), rgba(255 255 255 /1)), url(${props.imageUrl})`,
          //   backgroundPosition: 'center',
          //   backgroundSize: 'cover',
          //   '&:hover': {
          //     backgroundImage: 'none',
          //   },
          // }),
        } : {}),
        flexDirection: 'column', gap: props.symbol === '🎭' ? 0.5 : 1.25, pt: 1.25,
        ...props.sx,
      }}
    >
      {/* [Edit mode checkbox] */}
      {props.isEditMode && (
        <Checkbox
          variant='soft' color={TILE_ACTIVE_COLOR}
          checked={!props.isHidden}
          // label={<Typography level='body-xs'>show</Typography>}
          sx={{ position: 'absolute', left: `${tileGap}rem`, top: `${tileGap}rem` }}
        />
      )}

      {/* Icon and Text */}
      {/*<Box sx={{ fontSize: '2rem' }}>*/}
      {/*  {props.symbol}*/}
      {/*</Box>*/}
      <Avatar
        variant='plain'
        src={props.imageUrl}
        sx={{
          '--Avatar-size': '3rem',
          fontSize: '2rem',
          borderRadius: props.imageUrl ? 'sm' : 0,
          boxShadow: (props.imageUrl && !props.isActive) ? 'sm' : undefined,
        }}
      >
        {props.symbol}
      </Avatar>
      <div>
        {props.text}
      </div>
    </Button>
  );
}


/**
 * Purpose selector for the current chat. Clicking on any item activates it for the current chat.
 */
export function PersonaSelector(props: { conversationId: DConversationId, runExample: (example: string) => void }) {

  // state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filteredIDs, setFilteredIDs] = React.useState<SystemPurposeId[] | null>(null);
  const [editMode, setEditMode] = React.useState(false);
  const [isYouTubeTranscriberActive, setIsYouTubeTranscriberActive] = React.useState(false);


  // external state
  const showFinder = useUIPreferencesStore(state => state.showPersonaFinder);
  const [showExamples, showExamplescomponent] = useChipBoolean('Examples', false);
  const [showPrompt, showPromptComponent] = useChipBoolean('Prompt', false);
  const { systemPurposeId, setSystemPurposeId } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      systemPurposeId: conversation ? conversation.systemPurposeId : null,
      setSystemPurposeId: conversation ? state.setSystemPurposeId : null,
    };
  }, shallow);
  const { hiddenPurposeIDs, toggleHiddenPurposeId } = usePurposeStore(state => ({ hiddenPurposeIDs: state.hiddenPurposeIDs, toggleHiddenPurposeId: state.toggleHiddenPurposeId }), shallow);
  const { chatLLM } = useChatLLM();


  // derived state

  const isCustomPurpose = systemPurposeId === 'Custom';

  const { selectedPurpose, fourExamples } = React.useMemo(() => {
    const selectedPurpose: SystemPurposeData | null = systemPurposeId ? (SystemPurposes[systemPurposeId] ?? null) : null;
    // const selectedExample = selectedPurpose?.examples?.length
    //   ? selectedPurpose.examples[Math.floor(Math.random() * selectedPurpose.examples.length)]
    //   : null;
    const fourExamples = selectedPurpose?.examples?.slice(0, 4) ?? null;
    return { selectedPurpose, fourExamples };
  }, [systemPurposeId]);


  const unfilteredPurposeIDs = (filteredIDs && showFinder) ? filteredIDs : Object.keys(SystemPurposes) as SystemPurposeId[];
  const visiblePurposeIDs = editMode ? unfilteredPurposeIDs : unfilteredPurposeIDs.filter(id => !hiddenPurposeIDs.includes(id));
  const hidePersonaCreator = hiddenPurposeIDs.includes(PURPOSE_ID_PERSONA_CREATOR);


  // Handlers

// Modify the handlePurposeChanged function to check for the YouTube Transcriber
  const handlePurposeChanged = React.useCallback((purposeId: SystemPurposeId | null) => {
    if (purposeId) {
      if (purposeId === 'YouTubeTranscriber') {
        // If the YouTube Transcriber tile is clicked, set the state accordingly
        setIsYouTubeTranscriberActive(true);
      } else {
        setIsYouTubeTranscriberActive(false);
      }
      if (setSystemPurposeId) {
        setSystemPurposeId(props.conversationId, purposeId);
      }
    }
  }, [props.conversationId, setSystemPurposeId]);

  React.useEffect(() => {
    const isTranscriberActive = systemPurposeId === 'YouTubeTranscriber';
    setIsYouTubeTranscriberActive(isTranscriberActive);
  }, [systemPurposeId]);


// Implement handleAddMessage function
  const handleAddMessage = (messageText: string) => {
    // Retrieve the appendMessage action from the useChatStore
    const { appendMessage } = useChatStore.getState();

    const conversationId = props.conversationId;

    // Create a new message object
    const newMessage: DMessage = {
      id: uuidv4(),
      text: messageText,
      sender: 'Bot',
      avatar: null,
      typing: false,
      role: 'assistant' as 'assistant',
      tokenCount: 0,
      created: Date.now(),
      updated: null,
    };

    // Append the new message to the conversation
    appendMessage(conversationId, newMessage);
  };


  const handleCustomSystemMessageChange = React.useCallback((v: React.ChangeEvent<HTMLTextAreaElement>): void => {
    // TODO: persist this change? Right now it's reset every time.
    //       maybe we shall have a "save" button just save on a state to persist between sessions
    SystemPurposes['Custom'].systemMessage = v.target.value;
  }, []);

  const handleSwitchToCustom = React.useCallback((customText: string) => {
    if (setSystemPurposeId) {
      SystemPurposes['Custom'].systemMessage = customText;
      setSystemPurposeId(props.conversationId, 'Custom');
    }
  }, [props.conversationId, setSystemPurposeId]);

  const toggleEditMode = React.useCallback(() => setEditMode(on => !on), []);


  // Search (filtering)

  const handleSearchClear = React.useCallback(() => {
    setSearchQuery('');
    setFilteredIDs(null);
  }, []);

  const handleSearchOnChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    if (!query)
      return handleSearchClear();

    // Filter results based on search term (title and description)
    const lcQuery = query.toLowerCase();
    const ids = (Object.keys(SystemPurposes) as SystemPurposeId[])
      .filter(key => SystemPurposes.hasOwnProperty(key))
      .filter(key => {
        const purpose = SystemPurposes[key as SystemPurposeId];
        return purpose.title.toLowerCase().includes(lcQuery)
          || (typeof purpose.description === 'string' && purpose.description.toLowerCase().includes(lcQuery));
      });

    setSearchQuery(query);
    setFilteredIDs(ids);

    // If there's a search term, activate the first item
    // if (ids.length && systemPurposeId && !ids.includes(systemPurposeId))
    //   handlePurposeChanged(ids[0] as SystemPurposeId);
  }, [handleSearchClear]);

  const handleSearchOnKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key == 'Escape')
      handleSearchClear();
  }, [handleSearchClear]);


  // safety check - shouldn't happen - this is set to null when the conversation is not found
  if (!setSystemPurposeId)
    return null;


  return (
    <Box sx={{
      maxWidth: 'md',
      minWidth: `${2 + 1 + tileSize * 2}rem`, // accomodate at least 2 columns (scroll-x in case)
      mx: 'auto',
      minHeight: '60svh',
      display: 'grid',
      px: { xs: 0.5, sm: 1, md: 2 },
      py: 2,
    }}>

      {showFinder && <Box>
        <Input
          fullWidth
          variant='outlined' color='neutral'
          value={searchQuery} onChange={handleSearchOnChange}
          onKeyDown={handleSearchOnKeyDown}
          placeholder='Search for purpose…'
          startDecorator={<SearchIcon />}
          endDecorator={searchQuery && (
            <IconButton onClick={handleSearchClear}>
              <ClearIcon />
            </IconButton>
          )}
          sx={{
            boxShadow: 'sm',
          }}
        />
      </Box>}


      <Box sx={{
        my: 'auto',
        // layout
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${tileSize}rem, ${tileSize}rem))`,
        justifyContent: 'center', gap: `${tileGap}rem`,
      }}>

        {/* [row 0] ...  Edit mode [ ] */}
        <Box sx={{
          gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Typography level='title-sm'>
            AI Persona
          </Typography>
          <Tooltip disableInteractive title={editMode ? 'Done Editing' : 'Edit Tiles'}>
            <IconButton size='sm' onClick={toggleEditMode} sx={{ my: '-0.25rem' /* absorb the button padding */ }}>
              {editMode ? <DoneIcon /> : <EditRoundedIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Personas Tiles */}
        {visiblePurposeIDs.map((spId: SystemPurposeId) => {
          const isActive = systemPurposeId === spId;
          const systemPurpose = SystemPurposes[spId];
          return (
            <Tile
              key={'tile-' + spId}
              text={systemPurpose?.title}
              imageUrl={systemPurpose?.imageUri}
              symbol={systemPurpose?.symbol}
              isActive={isActive}
              isEditMode={editMode}
              isHidden={hiddenPurposeIDs.includes(spId)}
              isHighlighted={systemPurpose?.highlighted}
              onClick={() => editMode ? toggleHiddenPurposeId(spId) : handlePurposeChanged(spId)}
            />
          );
        })}

        {/* Persona Creator Tile */}
        {(editMode || !hidePersonaCreator) && (
          <Tile
            text='Persona Creator'
            symbol='🎭'
            isActive={false}
            isEditMode={editMode}
            isHidden={hidePersonaCreator}
            onClick={() => editMode ? toggleHiddenPurposeId(PURPOSE_ID_PERSONA_CREATOR) : void navigateToPersonas()}
            sx={{
              fontSize: 'xs',
              boxShadow: 'xs',
              backgroundColor: 'neutral.softDisabledBg',
            }}
          />
        )}


        {/* [row -3] Description */}
        <Box sx={{ gridColumn: '1 / -1', mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>


          {/* Description*/}
          <Typography level='body-sm' sx={{ color: 'text.primary' }}>
            {!selectedPurpose
              ? 'Cannot find the former persona' + (systemPurposeId ? ` "${systemPurposeId}"` : '')
              : selectedPurpose?.description || 'No description available'}
          </Typography>
          {/* Examples Toggle */}
          {/*<Box sx={{ display: 'flex', flexFlow: 'row wrap', flexShrink: 1 }}>*/}
          {fourExamples && showExamplescomponent}
          {!isCustomPurpose && showPromptComponent}
          {/*</Box>*/}
        </Box>

        {/* [row -3] Example incipits */}
        {systemPurposeId !== 'Custom' && (
          <ExpanderControlledBox expanded={showExamples || (!isCustomPurpose && showPrompt)} sx={{ gridColumn: '1 / -1', pt: 1 }}>
            {showExamples && (
              <List
                aria-label='Persona Conversation Starters'
                sx={{
                  // example items 2-col layout
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(${tileSize * 3 + 1}rem, 1fr))`,
                  gap: 1,
                }}
              >
                {fourExamples?.map((example, idx) => (
                  <ListItem
                    key={idx}
                    variant='outlined'
                    sx={{
                      // padding: '0.25rem 0.5rem',
                      backgroundColor: 'background.popup',
                      borderRadius: 'md',
                      boxShadow: 'xs',
                      '& svg': { opacity: 0.1, transition: 'opacity 0.2s' },
                      '&:hover svg': { opacity: 1 },
                    }}
                  >
                    <ListItemButton onClick={() => props.runExample(example)} sx={{ justifyContent: 'space-between', borderRadius: 'md' }}>
                      <Typography level='body-sm'>
                        {example}
                      </Typography>
                      <TelegramIcon color='primary' sx={{}} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
            {(!isCustomPurpose && showPrompt) && (
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography level='title-sm'>
                      System Prompt
                    </Typography>
                    <Button
                      variant='plain' color='neutral' size='sm'
                      endDecorator={<EditNoteIcon />}
                      onClick={() => handleSwitchToCustom(bareBonesPromptMixer(selectedPurpose?.systemMessage || 'No system message available', chatLLM?.id))}
                      sx={{ ml: 'auto', my: '-0.25rem' /* absorb the button padding */ }}
                    >
                      Custom
                    </Button>
                  </Box>
                  <Typography level='body-sm' sx={{ whiteSpace: 'break-spaces' }}>
                    {bareBonesPromptMixer(selectedPurpose?.systemMessage || 'No system message available', chatLLM?.id)}
                  </Typography>
                  {!!selectedPurpose?.systemMessageNotes && (
                    <Alert sx={{ m: -1, mt: 1, p: 1 }}>
                      <Typography level='body-xs'>
                        Prompt notes: {selectedPurpose.systemMessageNotes}
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </ExpanderControlledBox>
        )}

        {/* [row -1] Custom Prompt box */}
        {systemPurposeId === 'Custom' && (
          <Textarea
            autoFocus
            variant='outlined'
            placeholder='Craft your custom system message here…'
            minRows={3}
            defaultValue={SystemPurposes['Custom']?.systemMessage}
            onChange={handleCustomSystemMessageChange}
            endDecorator={
              <Alert sx={{ flex: 1, p: 1 }}>
                <Typography level='body-xs'>
                  Just start chatting when done.
                </Typography>
              </Alert>
            }
            sx={{
              gridColumn: '1 / -1',
              backgroundColor: 'background.surface',
              '&:focus-within': {
                backgroundColor: 'background.popup',
              },
              lineHeight: lineHeightTextareaMd,
            }}
          />
        )}

        {/* [row -1] YouTube URL */}
        {isYouTubeTranscriberActive && (
          <YouTubeURLInput
            onSubmit={(url) => handleAddMessage(url)}
            isFetching={false}
            sx={{
              gridColumn: '1 / -1',
            }}
          />
        )}

      </Box>

    </Box>
  );
}