import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Checkbox, Grid, IconButton, Stack, Typography } from '@mui/joy';
import ScienceIcon from '@mui/icons-material/Science';
import TelegramIcon from '@mui/icons-material/Telegram';

import { Link } from '~/common/components/Link';
import { useChatStore } from '~/common/state/store-chats';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { SystemPurposeId, SystemPurposes } from '../../../../data';
import { usePurposeStore } from './store-purposes';


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
const bpTileGap = { xs: 2, md: 3 };


// Add this utility function to get a random array element
const getRandomElement = <T, >(array: T[]): T | undefined =>
  array.length > 0 ? array[Math.floor(Math.random() * array.length)] : undefined;


/**
 * Purpose selector for the current chat. Clicking on any item activates it for the current chat.
 */
export function PersonaSelector(props: { conversationId: string, runExample: (example: string) => void }) {
  // state
  const [editMode, setEditMode] = React.useState(false);

  // external state
  const { experimentalLabs } = useUIPreferencesStore(state => ({
    experimentalLabs: state.experimentalLabs,
  }), shallow);
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


  const toggleEditMode = () => setEditMode(!editMode);


  const handlePurposeChanged = (purposeId: SystemPurposeId | null) => {
    if (purposeId)
      setSystemPurposeId(props.conversationId, purposeId);
  };

  // we show them all if the filter is clear (null)
  const unfilteredPurposeIDs = Object.keys(SystemPurposes);
  const purposeIDs = editMode ? unfilteredPurposeIDs : unfilteredPurposeIDs.filter(id => !hiddenPurposeIDs.includes(id));

  const selectedPurpose = purposeIDs.length ? (SystemPurposes[systemPurposeId] ?? null) : null;
  const selectedExample = selectedPurpose?.examples && getRandomElement(selectedPurpose.examples) || null;

  return <>

    <Stack direction='column' sx={{ minHeight: '60vh', justifyContent: 'center', alignItems: 'center' }}>

      <Box sx={{ maxWidth: bpMaxWidth }}>

        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 1 }}>
          <Typography level='title-sm'>
            AI Persona
          </Typography>
          <Button variant='plain' color='neutral' size='sm' onClick={toggleEditMode}>
            {editMode ? 'Done' : 'Edit'}
          </Button>
        </Box>

        <Grid container spacing={tileSpacing} sx={{ justifyContent: 'flex-start' }}>
          {purposeIDs.map((spId) => (
            <Grid key={spId}>
              <Button
                variant={(!editMode && systemPurposeId === spId) ? 'solid' : 'soft'}
                color={(!editMode && systemPurposeId === spId) ? 'primary' : SystemPurposes[spId as SystemPurposeId]?.highlighted ? 'warning' : 'neutral'}
                onClick={() => !editMode && handlePurposeChanged(spId as SystemPurposeId)}
                sx={{
                  flexDirection: 'column',
                  fontWeight: 500,
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
                    label={<Typography level='body-sm'>show</Typography>}
                    checked={!hiddenPurposeIDs.includes(spId)} onChange={() => toggleHiddenPurposeId(spId)}
                    sx={{ alignSelf: 'flex-start' }}
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
          {/* Button to start the YouTube persona creator */}
          {experimentalLabs && <Grid>
            <Button
              variant='soft' color='neutral'
              component={Link} noLinkStyle href='/personas'
              sx={{
                '--Icon-fontSize': '2rem',
                flexDirection: 'column',
                fontWeight: 500,
                // gap: bpTileGap,
                height: bpTileSize,
                width: bpTileSize,
                border: `1px dashed`,
                boxShadow: 'md',
                backgroundColor: 'background.surface',
              }}
            >
              <div>
                <ScienceIcon />
              </div>
              <div>
                YouTube persona creator
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
                    variant='plain' color='primary' size='md'
                    onClick={() => props.runExample(selectedExample)}
                    sx={{ opacity: 0, transition: 'opacity 0.3s' }}
                  >
                    <TelegramIcon />
                  </IconButton>
                </>
                : selectedPurpose.description
            )}
        </Typography>

      </Box>

    </Stack>

  </>;
}