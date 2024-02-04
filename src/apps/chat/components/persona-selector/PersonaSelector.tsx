import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Checkbox, Grid, IconButton, Input, Stack, Textarea, Tooltip, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import DoneIcon from '@mui/icons-material/Done';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import TelegramIcon from '@mui/icons-material/Telegram';

import { DConversationId, useChatStore } from '~/common/state/store-chats';
import { useAppServicesStore } from '~/common/state/store-atlas-app-services';
import { lineHeightTextarea } from '~/common/app.theme';
import { navigateToPersonas } from '~/common/app.routes';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { SystemPurposeId, SystemPurposes } from '../../../../data';
import { usePurposeStore } from './store-purposes';


// 'special' purpose IDs, for tile hiding purposes
const PURPOSE_ID_PERSONA_CREATOR = '__persona-creator__';

// Constants for tile sizes / grid width - breakpoints need to be computed here to work around
// the "flex box cannot shrink over wrapped content" issue
//
// Absolutely dislike this workaround, but it's the only way I found to make it work

const bpTileSize = { xs: 116, md: 125, xl: 130 };
const tileCols = [3, 4, 6];
const tileSpacing = 1;
const bpMaxWidth = Object.entries(bpTileSize).reduce((acc, [key, value], index) => {
  acc[key] = tileCols[index] * (value + 8 * tileSpacing) - 8 * tileSpacing;
  return acc;
}, {} as Record<string, number>);
const bpTileGap = { xs: 0.5, md: 1 };


// Add this utility function to get a random array element
const getRandomElement = <T, >(array: T[]): T | undefined =>
  array.length > 0 ? array[Math.floor(Math.random() * array.length)] : undefined;


/**
 * Purpose selector for the current chat. Clicking on any item activates it for the current chat.
 */
export function PersonaSelector(props: { conversationId: DConversationId, runExample: (example: string) => void }) {
  // state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filteredIDs, setFilteredIDs] = React.useState<SystemPurposeId[] | null>(null);
  const [editMode, setEditMode] = React.useState(false);
  
  const { token, setToken } = useAppServicesStore();


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

  // safety check - shouldn't happen
  if (!systemPurposeId || !setSystemPurposeId)
    return null;


  const handleSearchClear = () => {
    setSearchQuery('');
    setFilteredIDs(null);
  };

  const handleSearchOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    if (!query)
      return handleSearchClear();
    setSearchQuery(query);

    // Filter results based on search term
    const ids = Object.keys(SystemPurposes)
      .filter(key => SystemPurposes.hasOwnProperty(key))
      .filter(key => {
        const purpose = SystemPurposes[key as SystemPurposeId];
        return purpose.title.toLowerCase().includes(query.toLowerCase())
          || (typeof purpose.description === 'string' && purpose.description.toLowerCase().includes(query.toLowerCase()));
      });
    setFilteredIDs(ids as SystemPurposeId[]);

    // If there's a search term, activate the first item
    if (ids.length && !ids.includes(systemPurposeId))
      handlePurposeChanged(ids[0] as SystemPurposeId);
  };

  const handleSearchOnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key == 'Escape')
      handleSearchClear();
  };


  const toggleEditMode = () => setEditMode(!editMode);


  const handlePurposeChanged = (purposeId: SystemPurposeId | null) => {
    if (purposeId)
      setSystemPurposeId(props.conversationId, purposeId);
  };

  const handleCustomSystemMessageChange = (v: React.ChangeEvent<HTMLTextAreaElement>): void => {
    // TODO: persist this change? Right now it's reset every time.
    //       maybe we shall have a "save" button just save on a state to persist between sessions
    SystemPurposes['Custom'].systemMessage = v.target.value;
  };


  // we show them all if the filter is clear (null)
  const unfilteredPurposeIDs = (filteredIDs && showFinder) ? filteredIDs : Object.keys(SystemPurposes);
  const purposeIDs = editMode ? unfilteredPurposeIDs : unfilteredPurposeIDs.filter(id => !hiddenPurposeIDs.includes(id));

  const hidePersonaCreator = hiddenPurposeIDs.includes(PURPOSE_ID_PERSONA_CREATOR);

  const selectedPurpose = purposeIDs.length ? (SystemPurposes[systemPurposeId] ?? null) : null;
  const selectedExample = selectedPurpose?.examples && getRandomElement(selectedPurpose.examples) || null;

  return <>

    {showFinder && <Box sx={{ p: 2 * tileSpacing }}>
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

    <Stack direction='column' sx={{ minHeight: '60vh', justifyContent: 'center', alignItems: 'center' }}>

      <Box sx={{ maxWidth: bpMaxWidth }}>
      <Box>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
            <Typography level='title-sm'>
              {token}
              Atlas App Services: <input placeholder="user@mongodb.com" type="text"></input><input placeholder="*********" type="password"></input> <button onClick={()=>setToken("button-magic:"+Math.random())}>login</button>
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
          <Typography level='title-sm'>
            AI Persona
          </Typography>
          <Tooltip disableInteractive title={editMode ? 'Done Editing' : 'Edit Tiles'}>
            <IconButton size='sm' onClick={toggleEditMode}>
              {editMode ? <DoneIcon /> : <EditIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        <Grid container spacing={tileSpacing} sx={{ justifyContent: 'flex-start' }}>
          {purposeIDs.map((spId) => (
            <Grid key={spId}>
              <Button
                variant={(!editMode && systemPurposeId === spId) ? 'solid' : 'soft'}
                color={(!editMode && systemPurposeId === spId) ? 'primary' : SystemPurposes[spId as SystemPurposeId]?.highlighted ? 'warning' : 'neutral'}
                onClick={() => editMode
                  ? toggleHiddenPurposeId(spId)
                  : handlePurposeChanged(spId as SystemPurposeId)
                }
                sx={{
                  flexDirection: 'column',
                  fontWeight: 500,
                  // paddingInline: 1,
                  gap: bpTileGap,
                  height: bpTileSize,
                  width: bpTileSize,
                  ...((editMode || systemPurposeId !== spId) ? {
                    boxShadow: 'md',
                    ...(SystemPurposes[spId as SystemPurposeId]?.highlighted ? {} : { backgroundColor: 'background.surface' }),
                  } : {}),
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
            </Grid>
          ))}
          {/* Button to start the Persona Creator */}
          {(editMode || !hidePersonaCreator) && <Grid>
            <Button
              variant='soft' color='neutral'
              onClick={() => editMode
                ? toggleHiddenPurposeId(PURPOSE_ID_PERSONA_CREATOR)
                : void navigateToPersonas()
              }
              sx={{
                flexDirection: 'column',
                fontWeight: 500,
                // paddingInline: 1,
                gap: bpTileGap,
                height: bpTileSize,
                width: bpTileSize,
                // border: `1px dashed`,
                // borderColor: 'neutral.softActiveBg',
                boxShadow: 'xs',
                backgroundColor: 'neutral.softDisabledBg',
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
          </Grid>}
        </Grid>
        <Typography
          level='body-sm'
          sx={{
            mt: selectedExample ? 1 : 3,
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

        {systemPurposeId === 'Custom' && (
          <Textarea
            variant='outlined' autoFocus placeholder={'Craft your custom system message here…'}
            minRows={3}
            defaultValue={SystemPurposes['Custom']?.systemMessage} onChange={handleCustomSystemMessageChange}
            sx={{
              backgroundColor: 'background.level1',
              '&:focus-within': {
                backgroundColor: 'background.popup',
              },
              lineHeight: lineHeightTextarea,
              mt: 1,
            }} />
        )}

      </Box>

      
    </Stack>

  </>;
}