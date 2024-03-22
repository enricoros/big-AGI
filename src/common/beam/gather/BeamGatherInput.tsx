import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Divider, IconButton, styled, Tooltip, Typography } from '@mui/joy';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { InlineTextarea } from '~/common/components/InlineTextarea';

import type { TChatGenerateInstruction, TInstruction } from './beam.gather';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { GATHER_SHOW_SYSTEM_PROMPT } from '../beam.config';


const gatherInputWrapperSx: SxProps = {
  '--Card-padding': { xs: '0.5rem', md: '1rem' },

  mx: 'var(--Pad)',
  mb: 'calc(-1 * var(--Pad))', // absorb gap to the next-top
  px: 'var(--Card-padding)',
  py: 'calc(var(--Card-padding) / 2)',

  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'md',
  borderBottom: 'none',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,

  backgroundColor: 'background.surface',
  // backgroundColor: 'success.softBg',
  // overflow: 'hidden',

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

const InstructionGridThreeColsWrapper = styled(Box)({
  // layout
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  columnGap: 'var(--Pad_2)',
});


type EditMethod = 'edit' | 'duplicate' | 'none';


/**
 * A single key-value pair of an instruction. Editable, in place.
 */
function EditableChatInstructionPrompt(props: {
  editMethod: EditMethod,
  itemKey: keyof TChatGenerateInstruction,
  itemValue: TChatGenerateInstruction['systemPrompt'],
  label: string,
  onDuplicate: () => void,
  onEdit: (update: Partial<TChatGenerateInstruction>) => void,
}) {

  // state
  const [isEditing, setIsEditing] = React.useState(false);

  const { editMethod, onDuplicate, onEdit } = props;
  const handleEditBegin = React.useCallback(() => {
    if (editMethod === 'duplicate')
      return onDuplicate();
    if (editMethod === 'edit')
      return setIsEditing(true);
  }, [editMethod, onDuplicate]);

  const handleEditCancel = React.useCallback(() => setIsEditing(false), []);

  const handleEdit = React.useCallback((text: string) => {
    setIsEditing(false);
    text && onEdit({ [props.itemKey]: text });
  }, [onEdit, props.itemKey]);

  return <>

    {/* Label */}
    <Typography level='body-xs' sx={{ minHeight: '2.5rem', display: 'flex', alignItems: 'center' }}>
      {props.label}
    </Typography>

    {/* Instruction > Key > Text | Edit */}
    {editMethod === 'edit' ? (
      <InlineTextarea
        plain
        initialText={props.itemValue}
        onCancel={handleEditCancel}
        onEdit={handleEdit}
        sx={{
          // fontSize: 'sm',
          gridColumn: '2 / -1',
        }}
      />
    ) : (
      <Box onDoubleClick={handleEditBegin} sx={{
        // fontSize: 'sm',
        whiteSpace: 'break-spaces',
      }}>
        {props.itemValue}
      </Box>
    )}

    {/* Edit Button */}
    {props.editMethod === 'duplicate' && (
      <Tooltip disableInteractive title='Edit as Custom'>
        <IconButton size='sm' onClick={handleEditBegin}>
          <EditRoundedIcon />
        </IconButton>
      </Tooltip>
    )}

  </>;
}


function EditableInstruction(props: {
  editMethod: EditMethod,
  instruction: TInstruction,
  instructionIndex: number,
  onFusionCopyAsCustom: () => void
  onInstructionEdit: (instructionIndex: number, update: Partial<TInstruction>) => void,
}) {

  const { instruction, instructionIndex, onInstructionEdit } = props;
  const handleEditInstructionItem = React.useCallback((update: Partial<TInstruction>) => {
    onInstructionEdit(instructionIndex, update);
  }, [instructionIndex, onInstructionEdit]);


  return (instruction.type === 'chat-generate') ? <>
    {GATHER_SHOW_SYSTEM_PROMPT && (
      <EditableChatInstructionPrompt
        editMethod={props.editMethod}
        itemKey='systemPrompt'
        itemValue={instruction.systemPrompt}
        label='System:'
        onDuplicate={props.onFusionCopyAsCustom}
        onEdit={handleEditInstructionItem}
      />
    )}
    <EditableChatInstructionPrompt
      editMethod={props.editMethod}
      itemKey='userPrompt'
      itemValue={instruction.userPrompt}
      label='Command:'
      onDuplicate={props.onFusionCopyAsCustom}
      onEdit={handleEditInstructionItem}
    />
  </> : <>
    <Typography level='body-xs' sx={{ minHeight: '2.5rem', display: 'flex', alignItems: 'center' }}>
      Type
    </Typography>
    <Typography level='body-sm' sx={{ gridColumn: '2 / -1' }}>
      {instruction.type}
    </Typography>
  </>;
}


export function BeamGatherInput(props: {
  beamStore: BeamStoreApi,
  gatherShowPrompts: boolean
}) {

  // external state (all null if we don't have an index)
  const { currentFusionId, currentIsEditable, currentInstructions } = useBeamStore(props.beamStore, useShallow(store => {
    const fusion = store.currentFusionId !== null ? store.fusions.find(fusion => fusion.fusionId === store.currentFusionId) ?? null : null;
    return {
      currentFusionId: fusion?.fusionId ?? null,
      currentIsEditable: fusion?.isEditable === true,
      currentInstructions: fusion?.instructions ?? [],
    };
  }));


  // handlers
  const handleFusionCopyAsCustom = React.useCallback(() => {
    currentFusionId !== null && props.beamStore.getState().fusionRecreateAsCustom(currentFusionId);
  }, [currentFusionId, props.beamStore]);

  const handleInstructionEdit = React.useCallback((instructionIndex: number, update: Partial<TInstruction>) => {
    currentFusionId !== null && props.beamStore.getState().fusionInstructionUpdate(currentFusionId, instructionIndex, update);
  }, [currentFusionId, props.beamStore]);


  const styleMemo = React.useMemo(() => {
    return currentIsEditable ? { ...gatherInputWrapperSx, backgroundColor: 'primary.softBg' } : gatherInputWrapperSx;
  }, [currentIsEditable]);

  const instructionsMemo = React.useMemo(() => {
    const elements: React.JSX.Element[] = [];
    currentInstructions
      .slice(0, 1)
      .forEach((instruction, instructionIndex) => {

        // Separator between instructions
        if (instructionIndex > 0)
          elements.push(<Divider key={'div-' + instructionIndex} sx={{ gridColumn: '1 / -1' }} />);

        // Instruction (editable or copyable)
        elements.push(
          <EditableInstruction
            key={'inst-' + instructionIndex}
            editMethod={currentIsEditable ? 'edit' : 'duplicate'}
            instruction={instruction}
            instructionIndex={instructionIndex}
            onFusionCopyAsCustom={handleFusionCopyAsCustom}
            onInstructionEdit={handleInstructionEdit}
          />,
        );
      });
    return elements;
  }, [currentInstructions, currentIsEditable, handleFusionCopyAsCustom, handleInstructionEdit]);


  // render if existing and editable
  if (currentFusionId === null || (!currentIsEditable && !props.gatherShowPrompts))
    return null;

  return (
    <Box sx={styleMemo}>
      <InstructionGridThreeColsWrapper>
        {instructionsMemo}
      </InstructionGridThreeColsWrapper>
    </Box>
  );
}