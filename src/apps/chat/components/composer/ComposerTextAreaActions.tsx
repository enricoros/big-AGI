import * as React from 'react';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';

import { Alert, Box, Button, CircularProgress, Sheet } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import { aixFunctionCallTool } from '~/modules/aix/client/aix.client.fromSimpleFunction';
import { aixStreamingChatGenerate } from '~/modules/aix/client/aix.client';
import { getChatLLMId } from '~/modules/llms/store-llms';

import type { AttachmentDraft } from '~/common/attachment-drafts/attachment.types';
import { DMessageAttachmentFragment, DMessageDocPart, DMessageToolInvocationPart, isContentFragment } from '~/common/stores/chat/chat.fragments';
import { useShallowStable } from '~/common/util/useShallowObject';

import { ReplyToBubble } from '../message/ReplyToBubble';
import { getChatAutoAI } from '../../store-app-chat';


function aixTextPart(text: string) {
  return { pt: 'text' as const, text };
}

function aixSystemMessage(text: string) {
  return { parts: [aixTextPart(text)] };
}


async function proposeActionsForAttachments(allFragments: DMessageAttachmentFragment[], abortSignal: AbortSignal) {
  // sanity checks
  const llmId = getChatLLMId();
  const docParts = allFragments.filter(f => f.part.pt === 'doc').map(f => f.part) as DMessageDocPart[];
  const docs_count = docParts.length;
  if (!llmId || docs_count < 2)
    return [];

  const num_suggestions = 3;

  const inputSchema = z.object({
    content_analysis: z.object({
      attachments: z.array(
        z.object({
          name: z.string().describe('Identifier of the file.'),
          type: z.string().describe('Type or format of the file.'),
          summary: z.string().describe('Brief summary of the file\'s content, structure, commonalities and uniqueness. Be specific.'),
        }),
      ).describe('List of attachments provided for analysis.'),
      relationships: z.string().describe('Identified patterns, relationships, dependencies and differences between the attachments.'),
    }).describe(`Analysis of the ${docs_count} attachments.`),
    top_orthogonal_user_actions: z.array(
      z.string().describe('Proposed action, written as a short 5-10 words instruction coming from the user, each starting with an action verb.'),
    ).describe(`List of ${num_suggestions} orthogonal inferred actions, deeply tied to patterns between the content, each action relating to all attachments.`),
    most_valuable_action: z.string().describe(`The most valuable option to take, considering the nature of all attachments. Suggested something at the intersection of the ${docs_count} attachments.`).optional(),
  });

  const aixChatGenerate: AixAPIChatGenerate_Request = {
    systemMessage: aixSystemMessage(
      `You are an AI assistant skilled in content analysis and task inference within a chat application. 
Your function is to examine the attachments provided by the user, understand their nature and potential relationships, guess the user intention, and suggest the most likely and valuable actions the user intends to perform.
Respond only by calling the propose_user_actions_for_attachments function.`),
    chatSequence: [{
      role: 'user',
      parts: [
        aixTextPart(
          `The user wants to perform an action for which is attaching ${docs_count} related pieces of content. 
Analyze the provided content to determine its nature, identify any relationships between the pieces, and infer the most probable task or action the user wants to perform. 
Then generate ${num_suggestions} orthogonal suggestions for actions the user might want to perform with these files.`),
        ...docParts,
      ],
    }],
    tools: [
      aixFunctionCallTool({
        name: 'propose_user_actions_for_attachments',
        description: `Proposes ${num_suggestions} user actions from content analysis of ${docs_count} attached files.`,
        inputSchema,
      }),
    ],
    toolsPolicy: { type: 'any' },
  } as const;

  const { fragments } = await aixStreamingChatGenerate(llmId, aixChatGenerate, 'DEV', 'DEV', false, abortSignal, undefined);

  // validate
  if (!Array.isArray(fragments) || fragments.length !== 1)
    throw new Error('AIX: Unexpected response');
  if (!isContentFragment(fragments[0]) || fragments[0].part.pt !== 'tool_invocation')
    throw new Error('AIX: Missing invocation');
  const toolInvocation: DMessageToolInvocationPart = fragments[0].part;
  if (toolInvocation.invocation.type !== 'function_call' || toolInvocation.invocation.name !== 'propose_user_actions_for_attachments')
    throw new Error('AIX: Unexpected invocation');
  if (!toolInvocation.invocation.args)
    throw new Error('AIX: Missing args');
  const args = inputSchema.parse(JSON.parse(toolInvocation.invocation.args));
  if (!args.top_orthogonal_user_actions?.length)
    throw new Error('AIX: Missing output');

  // prepend the top action to the list
  let topActions = args.top_orthogonal_user_actions;
  if (args.most_valuable_action) {
    topActions = topActions.filter(a => a !== args.most_valuable_action);
    topActions.unshift(args.most_valuable_action);
  }
  // return top 3
  return (topActions || []).slice(0, 3);
}


export function ComposerTextAreaActions(props: {
  attachmentDrafts: AttachmentDraft[],
  showChatReplyTo: boolean,
  replyToGenerateText: string | null,
  onAppendAndSend: (appendText: string) => Promise<void>,
  onReplyToClear: () => void,
}) {

  // external state
  const { autoSuggestAttachmentPrompts } = getChatAutoAI();

  const allFragments = useShallowStable(props.attachmentDrafts.flatMap(draft => draft.outputFragments));

  const enableAttachmentGuess = autoSuggestAttachmentPrompts && allFragments.length >= 2;

  const { data: attachmentInstructionCandidates, error, isPending, isFetching, refetch } = useQuery({
    enabled: enableAttachmentGuess,
    queryKey: ['attachment-guess', ...allFragments.map(f => f.fId).sort()],
    queryFn: async (context) => proposeActionsForAttachments(allFragments, context.signal),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleUpdateAttachmentGuess = React.useCallback(async () => await refetch(), [refetch]);


  if (!props.showChatReplyTo && !enableAttachmentGuess)
    return null;

  return (

    <Box sx={{
      flex: 1,
      // marginBottom: 0.5,
      // margin: 1,
      // marginTop: 0,

      // layout
      display: 'grid',
      justifyItems: 'start',
      gap: 1,

      // Buttons
      [`& button`]: {
        '--Button-gap': '1.2rem',
        transition: 'background-color 0.2s, color 0.2s',
        // minWidth: 160,
      },
    }}>

      {/* Reply-To bubble */}
      {props.showChatReplyTo && (
        <ReplyToBubble
          replyToText={props.replyToGenerateText}
          onClear={props.onReplyToClear}
          className='reply-to-bubble'
        />
      )}

      {/* User Prompt candidates */}
      {enableAttachmentGuess && !!attachmentInstructionCandidates?.length && (
        attachmentInstructionCandidates.map((candidate, index) => (
          <Sheet
            key={index}
            color='primary'
            variant='soft'
            onClick={() => props.onAppendAndSend(candidate)}
            sx={{
              placeSelf: 'end',
              // width: '100%',
              backgroundColor: 'background.surface',
              border: '1px solid',
              borderColor: 'primary.outlinedBorder',
              borderRadius: '2rem',
              borderTopRightRadius: 0,
              px: 1.5,
              py: 0.5,
              fontSize: 'sm',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'primary.solidBg',
                color: 'primary.solidColor',
              },
            }}
          >
            {candidate}
          </Sheet>
        ))
      )}

      {/* Guess Action Button */}

      {enableAttachmentGuess && <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>

        {/* Guess / Guess Again */}
        <Button
          variant='outlined'
          color='primary'
          disabled={isFetching}
          endDecorator={isFetching ? <CircularProgress color='neutral' sx={{ '--CircularProgress-size': '16px' }} /> : <AutoFixHighIcon sx={{ fontSize: '20px' }} />}
          onClick={handleUpdateAttachmentGuess}
          sx={{
            px: 3,
            backgroundColor: 'background.surface',
            boxShadow: '0 4px 6px -4px rgb(var(--joy-palette-primary-darkChannel) / 40%)',
            borderRadius: 'sm',
          }}
        >
          {isFetching ? 'Guessing what to do...' : isPending ? 'Guess what to do' : 'What else could we do'}
        </Button>

        {!!error && <Alert variant='soft' color='danger'>
          {error.message || 'Error guessing actions'}
        </Alert>}

      </Box>}

    </Box>
  );
}
