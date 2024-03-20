import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, styled, Tooltip, Typography } from '@mui/joy';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { InlineTextarea } from '~/common/components/InlineTextarea';

import type { TChatGenerateInstruction, TInstruction } from './beam.gather';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { GATHER_SHOW_SYSTEM_PROMPT } from '../beam.config';


const gatherConfigWrapperSx: SxProps = {
  '--Card-padding': '1rem',

  mx: 'var(--Pad)',
  // px: '0.5rem',
  mb: 'calc(-1 * var(--Pad))', // absorb gap to the next-top

  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'md',
  borderBottom: 'none',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,

  // backgroundColor: 'background.surface',
  backgroundColor: 'success.softBg',
  overflow: 'hidden',

  // every child apart from the last one has a bottom border
  '& > *:not(:last-child)': {
    borderBottom: '1px solid',
    borderColor: 'neutral.outlinedBorder',
  },
};

// const configChatInstructionSx: SxProps = {
//   backgroundColor: 'transparent',
//   borderBottom: 'none',
//   px: '0.25rem',
//   flex: 1,
// };

const InstructionGridWrapper = styled(Box)({
  marginInline: 'var(--Card-padding)',
  minHeight: '2rem',

  // layout
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  columnGap: 'var(--Pad_2)',
});


/**
 * A single key-value pair of an instruction. Editable, in place.
 */
function EditableChatInstructionGridItem(props: {
  itemKey: keyof TChatGenerateInstruction,
  itemValue: TChatGenerateInstruction['systemPrompt'],
  label: string,
  isEditable: boolean,
  onEdit: (update: Partial<TChatGenerateInstruction>) => void
}) {

  // state
  const [isEditing, setIsEditing] = React.useState(false);

  const handleEditBegin = React.useCallback(() => props.isEditable && setIsEditing(true), [props.isEditable]);

  const handleEditCancel = React.useCallback(() => setIsEditing(false), []);

  const { onEdit } = props;
  const handleEdit = React.useCallback((text: string) => {
    setIsEditing(false);
    text && onEdit({ [props.itemKey]: text });
  }, [onEdit, props.itemKey]);

  return <>

    {/* Label */}
    <Typography level='body-xs'>
      {props.label}
    </Typography>

    {/* Instruction.Key.Text | Edit */}
    {isEditing ? (
      <InlineTextarea
        initialText={props.itemValue}
        onCancel={handleEditCancel}
        onEdit={handleEdit}
        sx={{ ml: -1.5, mr: -1, fontSize: 'sm' }}
      />
    ) : (
      <Box onDoubleClick={handleEditBegin} sx={{ fontSize: 'sm' }}>
        {props.itemValue}
      </Box>
    )}

    {/* Edit Button */}
    <Tooltip disableInteractive title={`Edit`}>
      <IconButton size='sm' color='success' disabled={!props.isEditable} onClick={handleEditBegin} sx={{ my: 0.5 }}>
        {props.isEditable && <EditRoundedIcon />}
      </IconButton>
    </Tooltip>

  </>;
}


function EditableInstruction(props: {
  isMobile: boolean,
  instruction: TInstruction,
  instructionIndex: number,
  isEditable: boolean,
  onInstructionEdit: (instructionIndex: number, update: Partial<TInstruction>) => void
}) {

  const { instruction, instructionIndex, onInstructionEdit } = props;
  const handleEditInstructionItem = React.useCallback((update: Partial<TInstruction>) => {
    onInstructionEdit(instructionIndex, update);
  }, [instructionIndex, onInstructionEdit]);

  return (instruction.type === 'chat-generate') ? (
    <InstructionGridWrapper>
      {GATHER_SHOW_SYSTEM_PROMPT && (
        <EditableChatInstructionGridItem
          label='System Prompt:'
          itemKey='systemPrompt'
          itemValue={instruction.systemPrompt}
          isEditable={props.isEditable}
          onEdit={handleEditInstructionItem}
        />
      )}
      <EditableChatInstructionGridItem
        label={GATHER_SHOW_SYSTEM_PROMPT ? 'User Prompt:' : ''}
        itemKey='userPrompt'
        itemValue={instruction.userPrompt}
        isEditable={props.isEditable}
        onEdit={handleEditInstructionItem}
      />
    </InstructionGridWrapper>
  ) : (
    <InstructionGridWrapper>
      <Typography level='body-xs'>
        Checklist: TBA
      </Typography>
    </InstructionGridWrapper>
  );
}


export function BeamGatherConfig(props: {
  beamStore: BeamStoreApi
  isMobile: boolean,
}) {

  // external state
  const { fusionIndex, fusionIsEditable, fusionInstructions } = useBeamStore(props.beamStore, useShallow(store => {
    const fusion = store.fusionIndex !== null ? store.fusions[store.fusionIndex] ?? null : null;
    return {
      fusionIndex: store.fusionIndex,
      fusionIsEditable: fusion?.isEditable === true,
      fusionInstructions: fusion?.instructions ?? [],
    };
  }));


  const handleInstructionEdit = React.useCallback((instructionIndex: number, update: Partial<TInstruction>) => {
    fusionIndex !== null && props.beamStore.getState().fusionInstructionEdit(fusionIndex, instructionIndex, update);
  }, [fusionIndex, props.beamStore]);


  // Skip component is the Fusion is not editable
  // Note: will show the edit icon in the Pane anyway
  // if (!fusionIsEditable && !GATHER_DEBUG_NONCUSTOM)
  //   return null;

  return (
    <Box sx={gatherConfigWrapperSx}>
      {fusionInstructions.map((instruction, instructionIndex) =>
        <EditableInstruction
          key={'i-' + instructionIndex}
          instruction={instruction}
          instructionIndex={instructionIndex}
          isEditable={fusionIsEditable}
          isMobile={props.isMobile}
          onInstructionEdit={handleInstructionEdit}
        />,
      )}
    </Box>
  );
}