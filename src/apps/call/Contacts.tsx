import * as React from 'react';
import { shallow } from 'zustand/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Avatar, Box, Card, CardContent, Chip, IconButton, Link as MuiLink, ListDivider, MenuItem, Sheet, Switch, Typography } from '@mui/joy';
import CallIcon from '@mui/icons-material/Call';

import { GitHubProjectIssueCard } from '~/common/components/GitHubProjectIssueCard';
import { animationShadowRingLimey } from '~/common/util/animUtils';
import { conversationTitle, DConversation, DConversationId, useChatStore } from '~/common/state/store-chats';
import { usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';

import type { AppCallIntent } from './AppCall';
import { MockPersona, useMockPersonas } from './state/useMockPersonas';
import { useAppCallStore } from './state/store-app-call';


// number of conversations to show before collapsing
const COLLAPSED_COUNT = 2;


const ContactCardAvatar = (props: { size: string, symbol?: string, imageUrl?: string, onClick?: () => void, sx?: SxProps }) =>
  <Avatar
    // variant='outlined'
    onClick={props.onClick}
    src={props.imageUrl}
    sx={{
      '--Avatar-size': props.size,
      fontSize: props.size,
      backgroundColor: 'background.popup',
      boxShadow: !props.imageUrl ? 'sm' : null,
      ...props.sx,
    }}
  >
    {/* As fallback, show the large Persona Symbol */}
    {!props.imageUrl && <Box>{props.symbol}</Box>}
  </Avatar>;


const ContactCardConversationCall = (props: { conversation: DConversation, onConversationClicked: (conversationId: DConversationId) => void, }) =>
  <Chip
    variant='plain' color='primary' size='sm'
    endDecorator={<CallIcon />}
    onClick={() => props.onConversationClicked(props.conversation.id)}
    slotProps={{
      root: {
        sx: {
          maxWidth: 'unset',
          mx: -1,
          px: 1,
          py: 0.25,
        },
      },
    }}
  >
    {conversationTitle(props.conversation, 'Chat')}
  </Chip>;


function CallContactCard(props: {
  persona: MockPersona,
  callGrayUI: boolean,
  conversations: DConversation[],
  setCallIntent: (intent: AppCallIntent) => void,
}) {

  // state
  const [conversationsExpanded, setConversationsExpanded] = React.useState(false);

  // derived state
  const { persona, setCallIntent } = props;
  const conversations = props.conversations.slice(0, conversationsExpanded ? undefined : COLLAPSED_COUNT);
  const hasConversations = !!conversations.length;
  const showExpander = props.conversations.length > COLLAPSED_COUNT && !conversationsExpanded;


  const handleCallPersona = React.useCallback(() => setCallIntent({
    conversationId: null,
    personaId: persona.personaId,
    backTo: 'app-call-contacts',
  }), [persona.personaId, setCallIntent]);

  const handleCallPersonaRe = React.useCallback((conversationId: DConversationId | null) => setCallIntent({
    conversationId: conversationId,
    personaId: persona.personaId,
    backTo: 'app-call-contacts',
  }), [persona.personaId, setCallIntent]);

  return (

    <Box sx={{ mt: 3.5 }}>

      <Card sx={{
        // boxShadow: 'lg',
        height: '100%',
        gap: 0,
      }}>

        {/* Persona Symbol - Overlapping */}
        <ContactCardAvatar
          size='6rem'
          symbol={persona.symbol}
          imageUrl={persona?.imageUri}
          sx={{
            mx: 'auto',
            mt: '-2.5rem',
          }}
        />

        <CardContent sx={{ my: 2, display: 'flex' }}>
          {/* Persona Description */}
          <Typography level='body-xs' sx={{ minHeight: '3em', mb: hasConversations ? 1.5 : undefined }}>
            {typeof persona.description === 'string' ? persona.description : 'Custom persona'}
          </Typography>

          {/*{hasConversations && <Divider>*/}
          {/*<Typography level='body-xs'>call about</Typography>*/}
          {/*</Divider>}*/}

          {/* Persona Recent Converstions */}
          {conversations.map(conversation =>
            <ContactCardConversationCall
              key={conversation.id}
              conversation={conversation}
              onConversationClicked={handleCallPersonaRe}
            />,
          )}

          {showExpander && <Chip
            variant='plain' color='primary' size='sm'
            onClick={() => setConversationsExpanded(true)}
            slotProps={{
              root: {
                sx: {
                  maxWidth: 'unset',
                  mx: -1,
                  px: 1,
                  py: 0.25,
                },
              },
            }}
          >
            {`+${props.conversations.length - COLLAPSED_COUNT} more`}
          </Chip>}

        </CardContent>

        {/*<Divider />*/}

        {/* Bottom Name and "Call" Button */}
        <Sheet
          variant='soft' color='primary'
          invertedColors={props.callGrayUI ? undefined : true}
          sx={{
            // emulate CardOverflow, because CardOverflow doesn't work well with Sheet/Inverted
            // (there's also a potential top-level inversion)
            '--variant-borderWidth': '1px',
            '--CardOverflow-offset': 'calc(-1 * var(--Card-padding))',
            '--CardOverflow-radius': 'calc(var(--Card-radius) - var(--variant-borderWidth, 0px))',
            margin: '0 var(--CardOverflow-offset) var(--CardOverflow-offset)',
            borderRadius: '0 0 var(--CardOverflow-radius) var(--CardOverflow-radius)',
            padding: '0.5rem var(--Card-padding)',

            // contents
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography level='title-md'>
            {persona.title}
          </Typography>
          <MuiLink overlay onClick={handleCallPersona}>
            <IconButton size='md' variant='soft' sx={{
              // borderRadius: '50%',
              ml: 'auto',
              mr: -1,
            }}>
              <CallIcon />
            </IconButton>
          </MuiLink>
        </Sheet>

      </Card>

    </Box>

  );
}


function useConversationsByPersona() {
  const conversations = useChatStore(state => state.conversations, shallow);

  return React.useMemo(() => {
    // group by personaId
    const groupedConversations: { [personaId: string]: DConversation[] } = conversations.reduce((acc, conversation) => {
      const personaId = conversation.systemPurposeId;
      acc[personaId] = [...acc[personaId] || [], conversation];
      return acc;
    }, {} as { [personaId: string]: DConversation[] });

    // sort conversations by time and limit to 3
    Object.values(groupedConversations).forEach(conversations =>
      conversations.sort((a, b) => (b.updated || b.created) - (a.updated || a.created)),
    );

    return groupedConversations;
  }, [conversations]);
}


export function Contacts(props: { setCallIntent: (intent: AppCallIntent) => void }) {

  // external state
  const {
    grayUI, toggleGrayUI,
    showConversations, toggleShowConversations,
    showSupport, toggleShowSupport,
  } = useAppCallStore();
  const { personas } = useMockPersonas();
  const conversationsByPersona = useConversationsByPersona();


  // pluggable UI

  const menuItems = React.useMemo(() => <>

    <MenuItem onClick={toggleShowConversations}>
      Conversations
      <Switch checked={showConversations} sx={{ ml: 'auto' }} />
    </MenuItem>

    <MenuItem onClick={toggleShowSupport}>
      Support
      <Switch checked={showSupport} sx={{ ml: 'auto' }} />
    </MenuItem>

    <MenuItem onClick={toggleGrayUI}>
      Grayed UI
      <Switch checked={grayUI} sx={{ ml: 'auto' }} />
    </MenuItem>

  </>, [grayUI, showConversations, showSupport, toggleGrayUI, toggleShowConversations, toggleShowSupport]);

  usePluggableOptimaLayout(null, null, menuItems, 'CallUI');


  return <>

    {/* Header "Call AGI" */}
    <Box sx={{
      my: 6,
      display: 'flex', alignItems: 'center',
      gap: 3,
    }}>
      <IconButton
        variant='soft' color='success'
        sx={{
          '--IconButton-size': { xs: '4.2rem', md: '5rem' },
          borderRadius: '50%',
          pointerEvents: 'none',
          backgroundColor: 'background.popup',
          animation: `${animationShadowRingLimey} 5s infinite`,
        }}>
        <CallIcon />
      </IconButton>

      <Box>
        <Typography level='title-lg'>
          Call AGI
        </Typography>
        <Typography level='title-sm' sx={{ mt: 1 }}>
          Explore ideas and ignite creativity
        </Typography>
        <Chip variant='outlined' size='sm' sx={{ px: 1, py: 0.5, mt: 0.25, ml: -1, textWrap: 'wrap' }}>
          Out-of-the-blue, or within a conversation
        </Chip>
      </Box>
    </Box>

    <ListDivider>
      Personas
    </ListDivider>

    {/* Personas Cards */}
    <Box
      sx={{
        width: '100%',
        my: 5,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: { xs: 1, md: 2 },
      }}
    >
      {personas.map((persona) =>
        <CallContactCard
          key={persona.personaId}
          persona={persona}
          callGrayUI={grayUI}
          conversations={!showConversations ? [] : conversationsByPersona[persona.personaId] || []}
          setCallIntent={props.setCallIntent}
        />,
      )}
    </Box>

    {showSupport && <ListDivider sx={{ my: 1 }} />}

    {showSupport && <GitHubProjectIssueCard
      issue={354}
      text='Call App: Support thread and compatibility matrix'
      note={<>
        Voice input uses the HTML Web Speech API, and speech output requires an ElevenLabs API Key.
      </>}
      // note2='Please report any issues you encounter'
      sx={{
        width: '100%',
        mb: 2,
        mt: 5,
      }}
    />}

  </>;
}