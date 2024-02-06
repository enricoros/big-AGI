import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Checkbox, IconButton, Input, Textarea, Tooltip, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import DoneIcon from '@mui/icons-material/Done';
import EditIcon from '@mui/icons-material/Edit';
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

// Constants for tile sizes / grid width - breakpoints need to be computed here to work around
// the "flex box cannot shrink over wrapped content" issue
//
// Absolutely dislike this workaround, but it's the only way I found to make it work


/**
 * Purpose selector for the current chat. Clicking on any item activates it for the current chat.
 */
export function PersonaSelector(props: { conversationId: DConversationId, runExample: (example: string) => void }) {
  // state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filteredIDs, setFilteredIDs] = React.useState<SystemPurposeId[] | null>(null);
  const [editMode, setEditMode] = React.useState(false);

  // external state
  const showFinder = useUIPreferencesStore(state => state.showPurposeFinder);
  const { systemPurposeId, setSystemPurposeId } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      systemPurposeId: conversation ? conversation.systemPurposeId : null,
      setSystemPurposeId: conversation ? state.setSystemPurposeId : null,
    };
  }, shallow);
  const { hiddenPurposeIDs, toggleHiddenPurposeId } = usePurposeStore(state => ({ hiddenPurposeIDs: state.hiddenPurposeIDs, toggleHiddenPurposeId: state.toggleHiddenPurposeId }), shallow);


  // derived state

  const { selectedPurpose, selectedExample } = React.useMemo(() => {
    const selectedPurpose: SystemPurposeData | null = systemPurposeId ? (SystemPurposes[systemPurposeId] ?? null) : null;
    const selectedExample = selectedPurpose?.examples?.length
      ? selectedPurpose.examples[Math.floor(Math.random() * selectedPurpose.examples.length)]
      : null;
    return { selectedPurpose, selectedExample };
  }, [systemPurposeId]);


  const unfilteredPurposeIDs = (filteredIDs && showFinder) ? filteredIDs : Object.keys(SystemPurposes);
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
      minWidth: '18rem',
      mx: 'auto',
      minHeight: '60svh',
      display: 'grid',
      p: { xs: 1, sm: 1 },
    }}>

      {showFinder && <Box sx={{}}>
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
        // mx: 'auto',
        my: 'auto',
        // width: '100%',
        // height: '100%',

        // layout
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 8rem))',
        justifyContent: 'center', gap: 1,
      }}>

        {/* [row 0] ...  Edit mode [ ] */}
        <Box sx={{
          gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
        }}>
          <Typography level='title-sm'>
            AI Persona
          </Typography>
          <Tooltip disableInteractive title={editMode ? 'Done Editing' : 'Edit Tiles'}>
            <IconButton size='sm' onClick={toggleEditMode}>
              {editMode ? <DoneIcon /> : <EditIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Personas Tiles */}
        {visiblePurposeIDs.map((spId) => (
          <Button
            key={spId}
            variant={(!editMode && systemPurposeId === spId) ? 'solid' : 'soft'}
            color={(!editMode && systemPurposeId === spId) ? 'primary' : SystemPurposes[spId as SystemPurposeId]?.highlighted ? 'warning' : 'neutral'}
            onClick={() => editMode
              ? toggleHiddenPurposeId(spId)
              : handlePurposeChanged(spId as SystemPurposeId)
            }
            sx={{
              aspectRatio: 1,
              height: '8rem',
              fontWeight: 500,
              ...((editMode || systemPurposeId !== spId) ? {
                boxShadow: 'md',
                ...(SystemPurposes[spId as SystemPurposeId]?.highlighted ? {} : { backgroundColor: 'background.surface' }),
              } : {}),
              flexDirection: 'column', gap: 1,
            }}
          >
            {editMode && (
              <Checkbox
                color='neutral'
                checked={!hiddenPurposeIDs.includes(spId)}
                // label={<Typography level='body-xs'>show</Typography>}
                sx={{ position: 'absolute', left: 8, top: 8 }}
              />
            )}
            <div style={{ fontSize: '2rem' }}>
              {SystemPurposes[spId as SystemPurposeId]?.symbol}
            </div>
            <div>
              {SystemPurposes[spId as SystemPurposeId]?.title}
            </div>
          </Button>
        ))}

        {/* Persona Creator Tile */}
        {(editMode || !hidePersonaCreator) && (
          <Button
            variant='soft'
            color='neutral'
            onClick={() => editMode ? toggleHiddenPurposeId(PURPOSE_ID_PERSONA_CREATOR) : void navigateToPersonas()}
            sx={{
              aspectRatio: 1,
              height: '8rem',
              fontWeight: 500,
              boxShadow: 'xs',
              backgroundColor: 'neutral.softDisabledBg',
              flexDirection: 'column', gap: 1,
            }}
          >
            {editMode && (
              <Checkbox
                color='neutral'
                checked={!hidePersonaCreator}
                // label={<Typography level='body-xs'>show</Typography>}
                sx={{ position: 'absolute', left: 8, top: 8 }}
              />
            )}
            <div>
              <div style={{ fontSize: '2rem' }}>
                🎭
              </div>
              {/*<SettingsAccessibilityIcon style={{ opacity: 0.5 }} />*/}
            </div>
            <div style={{ textAlign: 'center' }}>
              Persona Creator
            </div>
          </Button>
        )}


        {/* [row -2] Example incipits */}
        <Typography
          level='body-sm'
          sx={{
            gridColumn: '1 / -1',
            display: 'flex', alignItems: 'center', gap: 1,
            // justifyContent: 'center',
            '&:hover > button': { opacity: 1 },
          }}>
          {!selectedPurpose
            ? 'Oops! No AI persona found for your search.'
            : (selectedExample
                ? <>
                  Example: {selectedExample}
                  <IconButton
                    color='primary'
                    onClick={() => props.runExample(selectedExample)}
                    sx={{ opacity: 0, transition: 'opacity 0.3s' }}
                  >
                    <TelegramIcon />
                  </IconButton>
                </>
                : selectedPurpose.description
            )}
        </Typography>

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
              <Typography level='body-sm' sx={{ px: 1 }}>
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
              mt: 1,
            }}
          />
        )}

      </Box>

    </Box>
  );
}