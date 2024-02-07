import * as React from 'react';
import { shallow } from 'zustand/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Checkbox, Chip, chipClasses, IconButton, Input, List, ListItem, ListItemButton, Textarea, Tooltip, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import DoneIcon from '@mui/icons-material/Done';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
import TelegramIcon from '@mui/icons-material/Telegram';

import { DConversationId, useChatStore } from '~/common/state/store-chats';
import { lineHeightTextarea } from '~/common/app.theme';
import { navigateToPersonas } from '~/common/app.routes';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { SystemPurposeData, SystemPurposeId, SystemPurposes } from '../../../../data';
import { usePurposeStore } from './store-purposes';


// 'special' purpose IDs, for tile hiding purposes
const PURPOSE_ID_PERSONA_CREATOR = '__persona-creator__';

// defined looks
const tileSize = 7.5; // rem
const tileGap = 0.5; // rem


function Tile(props: {
  text?: string,
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
      color={(!props.isEditMode && props.isActive) ? 'primary' : props.isHighlighted ? 'primary' : 'neutral'}
      onClick={props.onClick}
      sx={{
        aspectRatio: 1,
        height: `${tileSize}rem`,
        fontWeight: 500,
        ...((props.isEditMode || !props.isActive) ? {
          boxShadow: props.isHighlighted ? '0 2px 8px -2px rgb(var(--joy-palette-primary-mainChannel) / 50%)' : 'sm',
          backgroundColor: props.isHighlighted ? undefined : 'background.surface',
        } : {}),
        flexDirection: 'column', gap: 1,
        ...props.sx,
      }}
    >
      {/* [Edit mode checkbox] */}
      {props.isEditMode && (
        <Checkbox
          variant='soft' color='neutral'
          checked={!props.isHidden}
          // label={<Typography level='body-xs'>show</Typography>}
          sx={{ position: 'absolute', left: `${tileGap}rem`, top: `${tileGap}rem` }}
        />
      )}

      {/* Icon and Text */}
      <Box sx={{ fontSize: '2rem' }}>
        {props.symbol}
      </Box>
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

  // external state
  const { showExamples, showFinder, setShowExamples } = useUIPreferencesStore(state => ({
    showExamples: state.showPersonaExamples,
    showFinder: state.showPersonaFinder,
    setShowExamples: state.setShowPersonaExamples,
  }), shallow);
  const { systemPurposeId, setSystemPurposeId } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      systemPurposeId: conversation ? conversation.systemPurposeId : null,
      setSystemPurposeId: conversation ? state.setSystemPurposeId : null,
    };
  }, shallow);
  const { hiddenPurposeIDs, toggleHiddenPurposeId } = usePurposeStore(state => ({ hiddenPurposeIDs: state.hiddenPurposeIDs, toggleHiddenPurposeId: state.toggleHiddenPurposeId }), shallow);


  // derived state

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

  const handlePurposeChanged = React.useCallback((purposeId: SystemPurposeId | null) => {
    if (purposeId && setSystemPurposeId)
      setSystemPurposeId(props.conversationId, purposeId);
  }, [props.conversationId, setSystemPurposeId]);

  const handleCustomSystemMessageChange = React.useCallback((v: React.ChangeEvent<HTMLTextAreaElement>): void => {
    // TODO: persist this change? Right now it's reset every time.
    //       maybe we shall have a "save" button just save on a state to persist between sessions
    SystemPurposes['Custom'].systemMessage = v.target.value;
  }, []);

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


  // safety check - shouldn't happen
  if (!selectedPurpose || !setSystemPurposeId)
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
              {editMode ? <DoneIcon /> : <EditIcon />}
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
              boxShadow: 'xs',
              backgroundColor: 'neutral.softDisabledBg',
            }}
          />
        )}


        {/* [row -3] Description */}
        <Box sx={{ gridColumn: '1 / -1', mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>


          {/* Description*/}
          <Typography level='body-sm' sx={{ color: 'text.primary' }}>
            {selectedPurpose?.description || 'No description available'}
          </Typography>
          {/* Examples Toggle */}
          {fourExamples && (
            <Chip
              variant='outlined'
              size='md'
              onClick={() => setShowExamples(!showExamples)}
              endDecorator={<KeyboardArrowDownIcon />}
              className={showExamples ? 'agi-expanded' : undefined}
              sx={{
                px: 1.5,
                [`& .${chipClasses.endDecorator}`]: {
                  transition: 'transform 0.2s',
                },
                [`&.agi-expanded .${chipClasses.endDecorator}`]: {
                  transform: 'rotate(-180deg)',
                },
              }}
            >
              {showExamples ? 'Examples' : 'Examples'}
            </Chip>
          )}

        </Box>

        {/* [row -2] Example incipits */}
        <Box sx={{
          gridColumn: '1 / -1',
          pt: 1,
          // animated collapser
          display: 'grid',
          gridTemplateRows: !showExamples ? '0fr' : '1fr',
          transition: 'grid-template-rows 0.2s cubic-bezier(.17,.84,.44,1)',
        }}>
          <List sx={{
            // animated collapsee
            overflow: 'hidden',
            padding: 0,
            // items layout
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(${tileSize * 2 + 1}rem, 1fr))`,
            gap: 1,
          }}>
            {fourExamples?.map((example, idx) => (
              <ListItem
                key={idx}
                variant='soft'
                sx={{
                  borderRadius: 'xs',
                  boxShadow: 'xs',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'background.surface',
                  '& svg': { opacity: 0.1, transition: 'opacity 0.2s' },
                  '&:hover svg': { opacity: 1 },
                }}
              >
                <ListItemButton onClick={() => props.runExample(example)} sx={{ justifyContent: 'space-between' }}>
                  <Typography level='body-sm'>
                    {example}
                  </Typography>
                  <TelegramIcon color='primary' sx={{}} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>

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
              <Typography level='body-sm' sx={{ px: 0.75 }}>
                Just start chatting when done.
              </Typography>
            }
            sx={{
              gridColumn: '1 / -1',
              backgroundColor: 'background.surface',
              '&:focus-within': {
                backgroundColor: 'background.popup',
              },
              lineHeight: lineHeightTextarea,
            }}
          />
        )}

      </Box>

    </Box>
  );
}