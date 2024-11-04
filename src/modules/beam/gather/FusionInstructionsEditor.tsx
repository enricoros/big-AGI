import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Divider, Typography } from '@mui/joy';

import { InlineTextarea } from '~/common/components/InlineTextarea';

import type { BeamStoreApi } from '../store-beam.hooks';
import type { GatherInstruction } from './instructions/GatherInstruction';
import type { FusionFactorySpec } from './instructions/beam.gather.factories';
import type { Instruction } from './instructions/beam.gather.execution';
import { useModuleBeamStore } from '../store-module-beam';


// Editor for a ChatInstruction
function EditableChatInstructionPrompt(props: {
  isEditable: boolean,
  itemKey: keyof GatherInstruction,
  itemValue: GatherInstruction['systemPrompt'],
  label: string,
  onEdit: (update: Partial<GatherInstruction>) => void,
}) {

  // state
  const [_isEditing, setIsEditing] = React.useState(false);


  // handlers

  const handleEditBegin = React.useCallback(() => setIsEditing(true), []);

  const handleEditCancel = React.useCallback(() => setIsEditing(false), []);

  const { onEdit } = props;
  const handleEdit = React.useCallback((text: string) => {
    setIsEditing(false);
    text && onEdit({ [props.itemKey]: text });
  }, [onEdit, props.itemKey]);


  return <>

    {/* Label */}
    <Typography level='body-xs' sx={{ minHeight: '1.5rem', display: 'flex', alignItems: 'end' }}>
      {props.label}
    </Typography>

    {/* Instruction > Key > Text | Edit */}
    {props.isEditable ? (
      <InlineTextarea
        decolor
        initialText={props.itemValue}
        minRows={3}
        onCancel={handleEditCancel}
        onEdit={handleEdit}
        sx={{
          // fontSize: 'sm',
          gridColumn: '2 / -1',
          // backgroundColor: 'background.level1',
          '&:focus-within': { backgroundColor: 'background.popup' },
        }}
      />
    ) : (
      <Box onDoubleClick={props.isEditable ? handleEditBegin : undefined} sx={{
        // fontSize: 'sm',
        whiteSpace: 'break-spaces',
      }}>
        {props.itemValue}
      </Box>
    )}

    {/* Duplicate Button */}
    {/*  <Tooltip disableInteractive title='Edit as Custom'>*/}
    {/*    <IconButton size='sm' onClick={handleEditBegin}>*/}
    {/*      <EditRoundedIcon />*/}
    {/*    </IconButton>*/}
    {/*  </Tooltip>*/}
  </>;
}


// Editor for any Instruction (specializes the implementation)
function EditableInstruction(props: {
  instruction: Instruction,
  instructionIndex: number,
  isEditable: boolean,
  onInstructionEdit: (instructionIndex: number, update: Partial<Instruction>) => void,
}) {

  // external state
  const gatherShowAllPrompts = useModuleBeamStore(state => state.gatherShowAllPrompts);

  // derived state
  const { instruction, instructionIndex, onInstructionEdit } = props;


  const handleEditInstructionItem = React.useCallback((update: Partial<Instruction>) => {
    onInstructionEdit(instructionIndex, update);
  }, [instructionIndex, onInstructionEdit]);


  return (instruction.type === 'gather') ? (
    <>
      {gatherShowAllPrompts && (
        <EditableChatInstructionPrompt
          isEditable={props.isEditable}
          itemKey='systemPrompt'
          itemValue={instruction.systemPrompt}
          label='System Instruction:'
          onEdit={handleEditInstructionItem}
        />
      )}
      <EditableChatInstructionPrompt
        isEditable={props.isEditable}
        itemKey='userPrompt'
        itemValue={instruction.userPrompt}
        label='User Instruction:'
        onEdit={handleEditInstructionItem}
      />
    </>
  ) : (
    <>
      <Typography level='body-xs' sx={{ minHeight: '2.5rem', display: 'flex', alignItems: 'center' }}>
        Type
      </Typography>
      <Typography level='body-sm' sx={{ gridColumn: '2 / -1' }}>
        {instruction.type}
      </Typography>
    </>
  );
}


const instructionsListSx: SxProps = {
  // not enabled from the former implementation
  // '--Card-padding': { xs: '0.5rem', md: '1rem' },
  //
  // mx: 'var(--Pad)',
  // mb: 'calc(-1 * var(--Pad))', // absorb gap to the next-top
  // px: 'var(--Card-padding)',
  // py: 'calc(var(--Card-padding) / 2)',
  //
  // border: '1px solid',
  // borderColor: 'neutral.outlinedBorder',
  // borderRadius: 'md',
  // borderBottom: 'none',
  // borderBottomLeftRadius: 0,
  // borderBottomRightRadius: 0,
  //
  // backgroundColor: 'background.surface',

  // every child apart from the last one has a bottom border
  // '& > *:not(:last-child)': {
  //   borderBottom: '1px solid',
  //   borderColor: 'neutral.outlinedBorder',
  // },

  // layout
  // gridTemplateColumns: 'auto 1fr auto',
  // columnGap: 'var(--Pad_2)',
  display: 'grid',
  alignItems: 'center',
  gap: 'var(--Pad_2)',
};


export function FusionInstructionsEditor(props: {
  beamStore: BeamStoreApi,
  factory: FusionFactorySpec,
  fusionId: string,
  instructions: Instruction[],
  isFusing: boolean,
  isIdle: boolean,
  onStart: () => void,
}) {

  // derived state
  const { beamStore, fusionId, instructions, isFusing } = props;


  // handlers
  // const handleFusionCopyAsCustom = React.useCallback(() => {
  //   beamStore.getState().fusionRecreateAsCustom(fusionId);
  // }, [fusionId, beamStore]);

  const handleInstructionEdit = React.useCallback((instructionIndex: number, update: Partial<Instruction>) => {
    beamStore.getState().fusionInstructionUpdate(fusionId, instructionIndex, update);
  }, [fusionId, beamStore]);


  const instructionsMemo = React.useMemo(() => {
    const elements: React.JSX.Element[] = [];
    instructions.forEach((instruction, instructionIndex) => {

      // Separator between instructions
      if (instructionIndex > 0)
        elements.push(<Divider key={'div-' + instructionIndex} sx={{ gridColumn: '1 / -1' }} />);

      elements.push(
        <EditableInstruction
          key={'inst-' + instructionIndex}
          isEditable
          instruction={instruction}
          instructionIndex={instructionIndex}
          onInstructionEdit={handleInstructionEdit}
          // onFusionCopyAsCustom={handleFusionCopyAsCustom}
        />,
      );
    });
    return elements;
  }, [handleInstructionEdit, instructions]);


  return <>

    {!props.isFusing && (
      <Box sx={instructionsListSx}>
        {instructionsMemo}
      </Box>
    )}

    {/* Bottom message */}
    {props.isIdle && (
      <Typography level='body-xs' endDecorator={undefined/* <PlayArrowRoundedIcon aria-label='Start Merge' onClick={props.onStart} /> */}>
        Just press the Start Merge button when done.
      </Typography>
    )}

  </>;
}